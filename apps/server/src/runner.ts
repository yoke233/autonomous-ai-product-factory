import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Goal, VerificationCheck } from "./types.js";

export interface ProducerResult {
  ok: boolean;
  detail: string;
}

export interface RunnerContext {
  goal: Goal;
  runId: string;
  worktreeDir: string;
  branch: string;
  signal: AbortSignal;
}

/** Producer 接口：在隔离 worktree 内产生变更。stub 供测试，claude 为真实执行。 */
export type Producer = (ctx: RunnerContext) => Promise<ProducerResult>;

const PRODUCER_TIMEOUT_MS = 20 * 60 * 1000;
const VERIFY_TIMEOUT_MS = 10 * 60 * 1000;

export function exec(
  cmd: string,
  args: string[],
  opts: { cwd: string; timeoutMs: number; shell?: boolean; signal?: AbortSignal; stdin?: string },
): Promise<{ code: number; out: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      shell: opts.shell ?? false,
      windowsHide: true,
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
    if (opts.stdin !== undefined) {
      child.stdin.write(opts.stdin);
      child.stdin.end();
    }
    let out = "";
    const cap = (chunk: Buffer) => {
      out += chunk.toString();
      if (out.length > 200_000) out = out.slice(-100_000);
    };
    child.stdout.on("data", cap);
    child.stderr.on("data", cap);
    const timer = setTimeout(() => child.kill("SIGKILL"), opts.timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, out });
    });
  });
}

async function git(repo: string, args: string[], signal?: AbortSignal): Promise<string> {
  const r = await exec("git", ["-C", repo, ...args], {
    cwd: repo,
    timeoutMs: 120_000,
    ...(signal ? { signal } : {}),
  });
  if (r.code !== 0) throw new Error(`git ${args.join(" ")} failed (${r.code}): ${r.out.slice(-2000)}`);
  return r.out.trim();
}

/** stub Producer：写一个标记文件，用于集成测试，不消耗模型调用。 */
export const stubProducer: Producer = async (ctx) => {
  writeFileSync(path.join(ctx.worktreeDir, "FACTORY_STUB.md"), `stub change for ${ctx.goal.id}\n`);
  return { ok: true, detail: "stub producer wrote FACTORY_STUB.md" };
};

/**
 * claude Producer：headless 调用 Claude Code，只授予文件工具（Producer 不跑命令，
 * 验证由 harness 独立执行 —— 对应 docs/01 §6 的职责分离）。
 */
export const claudeProducer: Producer = async (ctx) => {
  const prompt = [
    `你在一个隔离的 git worktree 中工作，任务如下：`,
    ``,
    ctx.goal.goal_text,
    ``,
    `约束：只允许创建/编辑文件完成任务；不要运行构建、测试或任何命令（验证由外部系统负责）；`,
    `不要修改 .git 目录；完成后直接结束，不需要总结。`,
  ].join("\n");
  // prompt 经 stdin 传入：shell:true 时 argv 不做引号保护，多行/中文 prompt 会被拆散。
  const r = await exec(
    "claude",
    ["-p", "--permission-mode", "acceptEdits", "--disallowedTools", "Bash", "WebSearch", "WebFetch"],
    { cwd: ctx.worktreeDir, timeoutMs: PRODUCER_TIMEOUT_MS, shell: true, signal: ctx.signal, stdin: prompt },
  );
  if (r.code !== 0) return { ok: false, detail: `claude exited ${r.code}: ${r.out.slice(-2000)}` };
  return { ok: true, detail: r.out.slice(-2000) };
};

export interface ExecutionResult {
  branch: string;
  worktreeDir: string;
  baseCommit: string;
  headCommit: string;
  diffStat: string;
  patch: string;
  producerDetail: string;
  checks: VerificationCheck[];
}

/** 完整执行一次 Run：worktree 隔离 → Producer → 封存 diff → Repo Profile 验证。 */
export async function executeRun(goal: Goal, runId: string, producer: Producer, signal: AbortSignal): Promise<ExecutionResult> {
  const repo = goal.repo_path;
  await git(repo, ["rev-parse", "--is-inside-work-tree"]);
  const baseCommit = await git(repo, ["rev-parse", "HEAD"]);

  const branch = `factory/${goal.id}-${runId.slice(-4)}`;
  const worktreeDir = path.join(tmpdir(), "factory-wt", runId);
  mkdirSync(path.dirname(worktreeDir), { recursive: true });
  await git(repo, ["worktree", "add", "-b", branch, worktreeDir, baseCommit]);

  const produced = await producer({ goal, runId, worktreeDir, branch, signal });
  if (!produced.ok) throw new Error(`producer failed: ${produced.detail}`);

  await git(worktreeDir, ["add", "-A"]);
  const status = await git(worktreeDir, ["status", "--porcelain"]);
  if (!status) throw new Error("producer made no changes");
  await git(worktreeDir, [
    "-c", "user.name=factory", "-c", "user.email=factory@local",
    "commit", "-m", `factory: candidate for ${goal.id}`,
  ]);
  const headCommit = await git(worktreeDir, ["rev-parse", "HEAD"]);
  const diffStat = await git(worktreeDir, ["diff", "--stat", baseCommit, headCommit]);
  const patch = await git(worktreeDir, ["diff", baseCommit, headCommit]);

  const checks: VerificationCheck[] = [];
  const profile = goal.boundary.repoProfile ?? {};
  for (const [name, command] of [
    ["build", profile.buildCommand],
    ["test", profile.testCommand],
  ] as const) {
    if (!command) continue;
    const r = await exec(command, [], { cwd: worktreeDir, timeoutMs: VERIFY_TIMEOUT_MS, shell: true, signal });
    checks.push({ name, command, exitCode: r.code, outputTail: r.out.slice(-4000) });
  }

  return { branch, worktreeDir, baseCommit, headCommit, diffStat, patch, producerDetail: produced.detail, checks };
}
