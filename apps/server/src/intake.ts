import { exec } from "./runner.js";
import type { IntakeDraft, IntakeMessage } from "./types.js";

export interface ClarifyResult {
  reply: string;
  draft: IntakeDraft | null;
}

/** 需求澄清 Agent：给定仓库与对话历史，返回下一条回复及（需求明确时的）工单草稿。 */
export type Clarifier = (repoPath: string, messages: IntakeMessage[]) => Promise<ClarifyResult>;

const CLARIFY_TIMEOUT_MS = 5 * 60 * 1000;

function buildPrompt(messages: IntakeMessage[]): string {
  const transcript = messages
    .map((m) => `[${m.role === "user" ? "用户" : "你"}] ${m.text}`)
    .join("\n\n");
  return [
    `你是"自主产品工厂"的需求澄清 Agent。当前工作目录就是用户要改动的 git 仓库，`,
    `你可以用只读工具（Read/Glob/Grep）自行查看仓库；能自己查明的信息不要问用户。`,
    ``,
    `你的目标：用尽量少的往返把需求澄清到可以开工，然后产出工单草稿。规则：`,
    `- 一次最多问 1-2 个关键问题；可以合理默认的细节不要问。`,
    `- 当目标、范围、验收方式已明确时，立即给出草稿，不要继续追问。`,
    `- goalText 必须自包含（执行者看不到本对话），写清改什么、怎样算完成。`,
    `- buildCommand/testCommand 是在仓库根目录可直接运行的验证命令；从仓库里查实际存在的`,
    `  命令（如 package.json 的 scripts），查不到就省略，不要编造。`,
    ``,
    `对话记录：`,
    `<transcript>`,
    transcript,
    `</transcript>`,
    ``,
    `现在输出你的下一条回复。严格输出一个 JSON 对象（不要 markdown 代码块、不要其他文字）：`,
    `{"reply": "给用户的回复", "draft": null}`,
    `或需求已明确时：`,
    `{"reply": "给用户的总结确认", "draft": {"goalText": "...", "buildCommand": "...", "testCommand": "..."}}`,
  ].join("\n");
}

/** 从模型输出中容错解析 ClarifyResult；解析失败时把原文当作纯回复。 */
export function parseClarifyOutput(out: string): ClarifyResult {
  const trimmed = out.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const obj = JSON.parse(trimmed.slice(start, end + 1)) as {
        reply?: unknown;
        draft?: { goalText?: unknown; buildCommand?: unknown; testCommand?: unknown } | null;
      };
      if (typeof obj.reply === "string") {
        const d = obj.draft;
        const draft: IntakeDraft | null =
          d && typeof d.goalText === "string" && d.goalText.trim()
            ? {
                goalText: d.goalText,
                ...(typeof d.buildCommand === "string" && d.buildCommand ? { buildCommand: d.buildCommand } : {}),
                ...(typeof d.testCommand === "string" && d.testCommand ? { testCommand: d.testCommand } : {}),
              }
            : null;
        return { reply: obj.reply, draft };
      }
    } catch {
      // fallthrough
    }
  }
  return { reply: trimmed.slice(-4000) || "(空回复)", draft: null };
}

/** stub Clarifier：第二条用户消息后即产出草稿，供测试。 */
export const stubClarifier: Clarifier = async (_repoPath, messages) => {
  const userMsgs = messages.filter((m) => m.role === "user");
  if (userMsgs.length < 2) return { reply: "验收标准是什么？", draft: null };
  return { reply: "需求已明确，草稿见右侧。", draft: { goalText: userMsgs.map((m) => m.text).join("\n") } };
};

/** claude Clarifier：headless 只读模式，cwd 指向目标仓库，可自行阅读代码。 */
export const claudeClarifier: Clarifier = async (repoPath, messages) => {
  const r = await exec(
    "claude",
    ["-p", "--disallowedTools", "Bash", "Edit", "Write", "NotebookEdit", "WebSearch", "WebFetch", "Task"],
    { cwd: repoPath, timeoutMs: CLARIFY_TIMEOUT_MS, shell: true, stdin: buildPrompt(messages) },
  );
  if (r.code !== 0) throw new Error(`clarifier exited ${r.code}: ${r.out.slice(-2000)}`);
  return parseClarifyOutput(r.out);
};
