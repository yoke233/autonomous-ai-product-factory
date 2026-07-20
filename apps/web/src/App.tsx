import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Goal, type GoalDetail, type Intake, type IntakeDraft } from "./api";

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: "已受理",
  RUNNING: "生产中",
  AWAITING_APPROVAL: "待批准",
  DELIVERED: "已交付",
  NO_SAFE_DELIVERY: "无安全交付",
  CANCELLED: "已取消",
  SYSTEM_FAULT: "系统故障",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`chip chip-${status}`}>
      <i className="lamp" />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

const STATIONS = ["受理", "生产", "验证", "批准", "交付"];

type LampState = "done" | "active" | "fail" | "off";

function stationStates(status: string): LampState[] {
  switch (status) {
    case "RECEIVED":
      return ["done", "off", "off", "off", "off"];
    case "RUNNING":
      return ["done", "active", "off", "off", "off"];
    case "AWAITING_APPROVAL":
      return ["done", "done", "done", "active", "off"];
    case "DELIVERED":
      return ["done", "done", "done", "done", "done"];
    case "NO_SAFE_DELIVERY":
      return ["done", "done", "fail", "off", "off"];
    case "SYSTEM_FAULT":
      return ["done", "fail", "off", "off", "off"];
    default:
      return ["off", "off", "off", "off", "off"];
  }
}

function StationStrip({ status }: { status: string }) {
  const states = stationStates(status);
  const tone = status === "AWAITING_APPROVAL" ? "amber" : status === "RUNNING" ? "blue" : "";
  return (
    <ol className={`stations ${tone}`} aria-label="生产线工位">
      {STATIONS.map((name, i) => (
        <li key={name} className={`station st-${states[i]}`}>
          <i className="st-lamp" />
          <span className="st-name">{name}</span>
        </li>
      ))}
    </ol>
  );
}

function AndonBoard({ goals }: { goals: Goal[] }) {
  const count = (...statuses: string[]) => goals.filter((g) => statuses.includes(g.status)).length;
  const cells: { label: string; tone: string; n: number }[] = [
    { label: "生产中", tone: "blue", n: count("RECEIVED", "RUNNING") },
    { label: "待批准", tone: "amber", n: count("AWAITING_APPROVAL") },
    { label: "已交付", tone: "green", n: count("DELIVERED") },
    { label: "未交付", tone: "red", n: count("NO_SAFE_DELIVERY", "SYSTEM_FAULT") },
  ];
  return (
    <div className="andon" aria-label="状态总览">
      {cells.map((c) => (
        <div key={c.label} className={`andon-cell tone-${c.tone} ${c.n > 0 ? "lit" : ""}`}>
          <span className="andon-n">{c.n}</span>
          <span className="andon-label">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

function DraftPanel({ intake, onStarted }: { intake: Intake; onStarted: (g: Goal) => void }) {
  const draft = intake.draft as IntakeDraft;
  const [goalText, setGoalText] = useState(draft.goalText);
  const [buildCommand, setBuildCommand] = useState(draft.buildCommand ?? "");
  const [testCommand, setTestCommand] = useState(draft.testCommand ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setGoalText(draft.goalText);
    setBuildCommand(draft.buildCommand ?? "");
    setTestCommand(draft.testCommand ?? "");
  }, [draft]);

  const start = async () => {
    setBusy(true);
    setErr("");
    try {
      const g = await api.startIntake(intake.id, {
        goalText,
        ...(buildCommand ? { buildCommand } : {}),
        ...(testCommand ? { testCommand } : {}),
      });
      onStarted(g);
    } catch (e) {
      setErr(String(e));
      setBusy(false);
    }
  };

  return (
    <div className="card draft-card">
      <p className="eyebrow">工单草稿</p>
      <h3>需求已澄清，确认后开工</h3>
      <label>
        Goal（可修改，执行者只看得到这段文字）
        <textarea value={goalText} onChange={(e) => setGoalText(e.target.value)} rows={6} />
      </label>
      <div className="row">
        <label>
          构建命令（可选）
          <input value={buildCommand} onChange={(e) => setBuildCommand(e.target.value)} placeholder="pnpm build" />
        </label>
        <label>
          测试命令（可选）
          <input value={testCommand} onChange={(e) => setTestCommand(e.target.value)} placeholder="pnpm test" />
        </label>
      </div>
      {!buildCommand && !testCommand && (
        <p className="hint">没有验证命令时 Assessment 只能是 INCONCLUSIVE，批准前需自行确认 diff。</p>
      )}
      {err && <p className="error">{err}</p>}
      <button className="approve" onClick={start} disabled={busy || !goalText.trim()}>
        {busy ? "开工中…" : "开始生产"}
      </button>
    </div>
  );
}

function IntakeView({ onStarted, onBack }: { onStarted: (g: Goal) => void; onBack: () => void }) {
  const [intake, setIntake] = useState<Intake | null>(null);
  const [repoPath, setRepoPath] = useState("");
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const busy = pending !== null;
  const chatEnd = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "nearest" });
  }, [intake?.messages.length, pending]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setPending(text);
    setErr("");
    try {
      const session = intake ?? (await api.createIntake(repoPath.trim()));
      setIntake(session);
      setInput("");
      setIntake(await api.sendIntakeMessage(session.id, text));
    } catch (e2) {
      setErr(String(e2));
      setInput(text);
    } finally {
      setPending(null);
    }
  };

  return (
    <div>
      <button className="linklike" onClick={onBack}>← 返回列表</button>
      <div className="card">
        <p className="eyebrow">需求沟通</p>
        <h2>先聊清楚，再开工</h2>
        {!intake ? (
          <label>
            仓库路径（本地 Git 仓库，Agent 会阅读它来了解上下文）
            <input value={repoPath} onChange={(e) => setRepoPath(e.target.value)} placeholder="D:\\project\\some-repo" />
          </label>
        ) : (
          <p className="mono dim">{intake.repo_path}</p>
        )}

        {(intake !== null || pending !== null) && (
          <div className="chat">
            {(intake?.messages ?? []).map((m, i) => (
              <div key={i} className={`msg msg-${m.role}`}>
                <span className="msg-role">{m.role === "user" ? "你" : "Agent"}</span>
                <p>{m.text}</p>
              </div>
            ))}
            {pending !== null && (
              <>
                <div className="msg msg-user">
                  <span className="msg-role">你</span>
                  <p>{pending}</p>
                </div>
                <div className="msg msg-agent">
                  <span className="msg-role">Agent</span>
                  <p className="thinking"><i className="lamp" />正在阅读仓库并思考…</p>
                </div>
              </>
            )}
            <div ref={chatEnd} />
          </div>
        )}

        <form className="chat-input" onSubmit={send}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={intake ? 2 : 4}
            placeholder={intake ? "回复 Agent…" : "描述你想要什么，例：给项目加一个 CLI 入口，能打印版本号"}
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(e);
            }}
          />
          <button className="primary" disabled={busy || !input.trim() || (!intake && !repoPath.trim())}>
            {busy ? "等待中…" : intake ? "发送" : "开始沟通"}
          </button>
        </form>
        <p className="hint">Ctrl+Enter 发送。Agent 会用只读权限查看仓库，聊明确后在下方生成工单草稿。</p>
        {err && <p className="error">{err}</p>}
      </div>

      {intake?.draft && <DraftPanel intake={intake} onStarted={onStarted} />}
    </div>
  );
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
      <p className="eyebrow">下达工单</p>
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
      <button className="primary" disabled={busy}>{busy ? "提交中…" : "提交工单"}</button>
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
  if (!detail) return <p className="dim">加载中…</p>;
  const { goal, candidate, assessment, events, runs } = detail;
  const act = (fn: (id: string) => Promise<Goal>) => () => fn(id).then(refresh).catch((e) => setErr(String(e)));

  return (
    <div>
      <button className="linklike" onClick={onBack}>← 返回列表</button>
      <div className="card">
        <StationStrip status={goal.status} />
        <div className="title-row">
          <h2 className="mono">{goal.id}</h2>
          <StatusChip status={goal.status} />
        </div>
        <p className="mono dim">{goal.repo_path}</p>
        <p className="goal-text">{goal.goal_text}</p>

        {goal.status === "AWAITING_APPROVAL" && (
          <div className="actions">
            <button className="approve" onClick={act(api.approve)}>批准交付</button>
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
          <p className="eyebrow">验证证据</p>
          <div className="title-row">
            <h3>Assessment</h3>
            <span className={`verdict verdict-${assessment.verdict}`}>{assessment.verdict}</span>
          </div>
          {assessment.evidence.notes && <p className="hint">{assessment.evidence.notes}</p>}
          {assessment.evidence.checks.map((c) => (
            <details key={c.name}>
              <summary className="mono">
                <i className={`lamp ${c.exitCode === 0 ? "lamp-green" : "lamp-red"}`} />
                {c.name}: <code>{c.command}</code> (exit {c.exitCode})
              </summary>
              <pre className="mono small">{c.outputTail}</pre>
            </details>
          ))}
        </div>
      )}

      {candidate && (
        <div className="card">
          <p className="eyebrow">封存产物</p>
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
        <p className="eyebrow">生产记录</p>
        <h3>时间线</h3>
        <ul className="timeline">
          {events.map((e) => (
            <li key={e.id}>
              <span className="dim mono t">{new Date(e.created_at).toLocaleTimeString()}</span>
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

type View = { t: "list" } | { t: "goal"; id: string } | { t: "intake" };

export default function App() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [view, setView] = useState<View>({ t: "list" });

  const refresh = useCallback(() => {
    api.listGoals().then(setGoals).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  const openGoal = (g: Goal) => {
    refresh();
    setView({ t: "goal", id: g.id });
  };

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <h1>Factory Console</h1>
          <p className="dim">人 → AI → 产品 ｜ 监督式交付</p>
        </div>
        <AndonBoard goals={goals} />
      </header>
      <main>
        {view.t === "goal" && <GoalDetailView id={view.id} onBack={() => setView({ t: "list" })} />}
        {view.t === "intake" && <IntakeView onStarted={openGoal} onBack={() => setView({ t: "list" })} />}
        {view.t === "list" && (
          <>
            <div className="card entry-card">
              <div>
                <p className="eyebrow">新建工单</p>
                <h2>先和 Agent 沟通需求</h2>
                <p className="dim">Agent 会阅读目标仓库、澄清目标和验收方式，聊明确后生成工单草稿，确认即开工。</p>
              </div>
              <button className="primary" onClick={() => setView({ t: "intake" })}>开始沟通</button>
            </div>
            <details className="skip-form">
              <summary>跳过沟通，直接填写工单</summary>
              <NewGoalForm onCreated={openGoal} />
            </details>
            <div className="card">
              <p className="eyebrow">工单</p>
              <h2>Goals</h2>
              {goals.length === 0 && <p className="dim">还没有工单。先和 Agent 聊聊你想要什么。</p>}
              <table>
                <tbody>
                  {goals.map((g) => (
                    <tr key={g.id} onClick={() => setView({ t: "goal", id: g.id })}>
                      <td className="mono id-cell">{g.id}</td>
                      <td><StatusChip status={g.status} /></td>
                      <td className="goal-cell">{g.goal_text.slice(0, 80)}</td>
                      <td className="dim time-cell">{new Date(g.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </>
  );
}
