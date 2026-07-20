import { useCallback, useEffect, useState } from "react";
import { api, type Goal, type GoalDetail } from "./api";

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: "已受理",
  RUNNING: "执行中",
  AWAITING_APPROVAL: "待批准",
  DELIVERED: "已交付",
  NO_SAFE_DELIVERY: "无安全交付",
  CANCELLED: "已取消",
  SYSTEM_FAULT: "系统故障",
};

function StatusChip({ status }: { status: string }) {
  return <span className={`chip chip-${status}`}>{STATUS_LABEL[status] ?? status}</span>;
}

function NewGoalForm({ onCreated }: { onCreated: (g: Goal) => void }) {
  const [repoPath, setRepoPath] = useState("");
  const [goalText, setGoalText] = useState("");
  const [buildCommand, setBuildCommand] = useState("");
  const [testCommand, setTestCommand] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const g = await api.createGoal({
        repoPath,
        goalText,
        repoProfile: {
          ...(buildCommand ? { buildCommand } : {}),
          ...(testCommand ? { testCommand } : {}),
        },
      });
      setRepoPath("");
      setGoalText("");
      onCreated(g);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h2>新建 Goal</h2>
      <label>
        仓库路径（本地 Git 仓库）
        <input value={repoPath} onChange={(e) => setRepoPath(e.target.value)} placeholder="D:\\project\\some-repo" required />
      </label>
      <label>
        Goal（最终想得到什么）
        <textarea value={goalText} onChange={(e) => setGoalText(e.target.value)} rows={4} required
          placeholder="例：给 README 增加一节安装说明，覆盖 Windows 和 macOS" />
      </label>
      <div className="row">
        <label>
          构建命令（可选，作验证 Evidence）
          <input value={buildCommand} onChange={(e) => setBuildCommand(e.target.value)} placeholder="pnpm build" />
        </label>
        <label>
          测试命令（可选，作验证 Evidence）
          <input value={testCommand} onChange={(e) => setTestCommand(e.target.value)} placeholder="pnpm test" />
        </label>
      </div>
      <p className="hint">未声明任何验证命令时 Assessment 只能是 INCONCLUSIVE，批准前请自行确认 diff。</p>
      {err && <p className="error">{err}</p>}
      <button disabled={busy}>{busy ? "提交中…" : "提交"}</button>
    </form>
  );
}

function GoalDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const [detail, setDetail] = useState<GoalDetail | null>(null);
  const [err, setErr] = useState("");

  const refresh = useCallback(() => {
    api.getGoal(id).then(setDetail).catch((e) => setErr(String(e)));
  }, [id]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  if (err) return <p className="error">{err}</p>;
  if (!detail) return <p>加载中…</p>;
  const { goal, candidate, assessment, events, runs } = detail;
  const act = (fn: (id: string) => Promise<Goal>) => () => fn(id).then(refresh).catch((e) => setErr(String(e)));

  return (
    <div>
      <button className="linklike" onClick={onBack}>← 返回列表</button>
      <div className="card">
        <div className="title-row">
          <h2>{goal.id}</h2>
          <StatusChip status={goal.status} />
        </div>
        <p className="mono dim">{goal.repo_path}</p>
        <p className="goal-text">{goal.goal_text}</p>

        {goal.status === "AWAITING_APPROVAL" && (
          <div className="actions">
            <button onClick={act(api.approve)}>批准交付</button>
            <button className="danger" onClick={act(api.reject)}>否决</button>
          </div>
        )}
        {["RECEIVED", "RUNNING"].includes(goal.status) && (
          <div className="actions">
            <button className="danger" onClick={act(api.cancel)}>取消</button>
          </div>
        )}
        {goal.outcome && <pre className="mono small">{JSON.stringify(goal.outcome, null, 2)}</pre>}
      </div>

      {assessment && (
        <div className="card">
          <h3>Assessment：{assessment.verdict}</h3>
          {assessment.evidence.notes && <p className="hint">{assessment.evidence.notes}</p>}
          {assessment.evidence.checks.map((c) => (
            <details key={c.name}>
              <summary className="mono">
                [{c.exitCode === 0 ? "✓" : "✗"}] {c.name}: <code>{c.command}</code> (exit {c.exitCode})
              </summary>
              <pre className="mono small">{c.outputTail}</pre>
            </details>
          ))}
        </div>
      )}

      {candidate && (
        <div className="card">
          <h3>Candidate</h3>
          <p className="mono dim">branch {candidate.branch} @ {candidate.head_commit.slice(0, 10)}</p>
          <pre className="mono small">{candidate.diff_stat}</pre>
          <details>
            <summary>完整 diff</summary>
            <pre className="mono small diff">{candidate.patch}</pre>
          </details>
        </div>
      )}

      <div className="card">
        <h3>时间线</h3>
        <ul className="timeline">
          {events.map((e) => (
            <li key={e.id}>
              <span className="dim">{new Date(e.created_at).toLocaleTimeString()}</span>
              <span className="mono kind">{e.kind}</span> {e.message}
            </li>
          ))}
        </ul>
        {runs.some((r) => r.error) && (
          <details>
            <summary>Run 错误</summary>
            {runs.filter((r) => r.error).map((r) => <pre key={r.id} className="mono small">{r.error}</pre>)}
          </details>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api.listGoals().then(setGoals).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  if (selected) return <main><GoalDetailView id={selected} onBack={() => setSelected(null)} /></main>;

  return (
    <main>
      <header>
        <h1>Factory Console</h1>
        <p className="dim">人 → AI → 产品 ｜ 监督式交付（设计 v0.6）</p>
      </header>
      <NewGoalForm onCreated={(g) => { refresh(); setSelected(g.id); }} />
      <div className="card">
        <h2>Goals</h2>
        {goals.length === 0 && <p className="dim">还没有 Goal。</p>}
        <table>
          <tbody>
            {goals.map((g) => (
              <tr key={g.id} onClick={() => setSelected(g.id)}>
                <td className="mono">{g.id}</td>
                <td><StatusChip status={g.status} /></td>
                <td className="goal-cell">{g.goal_text.slice(0, 80)}</td>
                <td className="dim">{new Date(g.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
