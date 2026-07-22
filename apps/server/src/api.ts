import { existsSync } from "node:fs";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import type { Store } from "./store.js";
import type { Worker } from "./worker.js";
import { stubClarifier, type Clarifier } from "./intake.js";

const NewGoalBody = z.object({
  repoPath: z.string().min(1),
  goalText: z.string().min(1),
  repoProfile: z
    .object({
      buildCommand: z.string().optional(),
      testCommand: z.string().optional(),
    })
    .default({}),
});

const NewIntakeBody = z.object({ repoPath: z.string().min(1) });
const IntakeMessageBody = z.object({ text: z.string().min(1) });
const IntakeStartBody = z.object({
  goalText: z.string().min(1),
  buildCommand: z.string().optional(),
  testCommand: z.string().optional(),
});

export function buildApi(store: Store, worker: Worker, clarifier: Clarifier = stubClarifier): FastifyInstance {
  const app = Fastify();
  /** 正在等待澄清 Agent 回复的 intake，拒绝并发消息。 */
  const clarifying = new Set<string>();

  app.post("/api/intakes", async (req, reply) => {
    const parsed = NewIntakeBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!existsSync(parsed.data.repoPath)) return reply.code(400).send({ error: "仓库路径不存在" });
    return reply.code(201).send(await store.createIntake(parsed.data.repoPath));
  });

  app.get("/api/intakes/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const intake = await store.getIntake(id);
    if (!intake) return reply.code(404).send({ error: "not found" });
    return intake;
  });

  app.post("/api/intakes/:id/messages", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = IntakeMessageBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const intake = await store.getIntake(id);
    if (!intake) return reply.code(404).send({ error: "not found" });
    if (intake.status !== "OPEN") return reply.code(409).send({ error: "该会话已开工" });
    if (clarifying.has(id)) return reply.code(409).send({ error: "Agent 正在思考，请等待回复" });

    clarifying.add(id);
    try {
      const messages = [...intake.messages, { role: "user" as const, text: parsed.data.text, at: new Date().toISOString() }];
      const result = await clarifier(intake.repo_path, messages);
      messages.push({ role: "agent", text: result.reply, at: new Date().toISOString() });
      // 消息与草稿在澄清成功后才落库：失败时用户重发即可，不会留下悬空的单边消息。
      await store.updateIntakeConversation(id, messages, result.draft);
      return await store.getIntake(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(502).send({ error: `澄清 Agent 调用失败：${message.slice(0, 1000)}` });
    } finally {
      clarifying.delete(id);
    }
  });

  app.post("/api/intakes/:id/start", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = IntakeStartBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const intake = await store.getIntake(id);
    if (!intake) return reply.code(404).send({ error: "not found" });
    if (intake.status !== "OPEN") return reply.code(409).send({ error: "该会话已开工" });
    const goal = await store.createGoal({
      repoPath: intake.repo_path,
      goalText: parsed.data.goalText,
      boundary: {
        deliveryMode: "ARTIFACT_ONLY",
        repoProfile: {
          ...(parsed.data.buildCommand ? { buildCommand: parsed.data.buildCommand } : {}),
          ...(parsed.data.testCommand ? { testCommand: parsed.data.testCommand } : {}),
        },
      },
    });
    await store.markIntakeStarted(id, goal.id);
    return reply.code(201).send(goal);
  });

  app.post("/api/goals", async (req, reply) => {
    const parsed = NewGoalBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { repoPath, goalText, repoProfile } = parsed.data;
    const goal = await store.createGoal({
      repoPath,
      goalText,
      boundary: {
        deliveryMode: "ARTIFACT_ONLY",
        repoProfile: {
          ...(repoProfile.buildCommand ? { buildCommand: repoProfile.buildCommand } : {}),
          ...(repoProfile.testCommand ? { testCommand: repoProfile.testCommand } : {}),
        },
      },
    });
    return reply.code(201).send(goal);
  });

  app.get("/api/goals", async () => store.listGoals());

  app.get("/api/goals/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const goal = await store.getGoal(id);
    if (!goal) return reply.code(404).send({ error: "not found" });
    const [runs, candidate, assessment, events] = await Promise.all([
      store.getRuns(id),
      store.getCandidate(id),
      store.getAssessment(id),
      store.getEvents(id),
    ]);
    return { goal, runs, candidate, assessment, events };
  });

  app.post("/api/goals/:id/approve", async (req, reply) => {
    const { id } = req.params as { id: string };
    const goal = await store.getGoal(id);
    if (!goal) return reply.code(404).send({ error: "not found" });
    if (goal.status !== "AWAITING_APPROVAL")
      return reply.code(409).send({ error: `cannot approve in status ${goal.status}` });
    const [candidate, assessment] = await Promise.all([store.getCandidate(id), store.getAssessment(id)]);
    if (!candidate || assessment?.candidate_id !== candidate.id || assessment.verdict !== "PASS")
      return reply.code(409).send({ error: "candidate does not have a PASS assessment" });
    const ok = await store.transitionGoal(id, goal.revision, "DELIVERED", {
      deliveryMode: "ARTIFACT_ONLY",
      branch: candidate.branch,
      headCommit: candidate.head_commit,
    });
    if (!ok) return reply.code(409).send({ error: "revision conflict, retry" });
    await store.addEvent(id, "goal.delivered", `已接收代码产物：分支 ${candidate.branch}`);
    return store.getGoal(id);
  });

  app.post("/api/goals/:id/reject", async (req, reply) => {
    const { id } = req.params as { id: string };
    const goal = await store.getGoal(id);
    if (!goal) return reply.code(404).send({ error: "not found" });
    if (goal.status !== "AWAITING_APPROVAL")
      return reply.code(409).send({ error: `cannot reject in status ${goal.status}` });
    const ok = await store.transitionGoal(id, goal.revision, "NO_SAFE_DELIVERY", { reason: "rejected by operator" });
    if (!ok) return reply.code(409).send({ error: "revision conflict, retry" });
    await store.addEvent(id, "goal.rejected", "操作者否决了候选");
    return store.getGoal(id);
  });

  app.post("/api/goals/:id/cancel", async (req, reply) => {
    const { id } = req.params as { id: string };
    const goal = await store.getGoal(id);
    if (!goal) return reply.code(404).send({ error: "not found" });
    const terminal = ["DELIVERED", "NO_SAFE_DELIVERY", "CANCELLED", "SYSTEM_FAULT"];
    if (terminal.includes(goal.status)) return reply.code(409).send({ error: `already terminal: ${goal.status}` });
    const ok = await store.transitionGoal(id, goal.revision, "CANCELLED", { reason: "cancelled by operator" });
    if (!ok) return reply.code(409).send({ error: "revision conflict, retry" });
    worker.cancel(id);
    await store.addEvent(id, "goal.cancelled", "操作者取消了 Goal");
    return store.getGoal(id);
  });

  return app;
}
