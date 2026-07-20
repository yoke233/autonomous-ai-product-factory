import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import type { Store } from "./store.js";
import type { Worker } from "./worker.js";

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

export function buildApi(store: Store, worker: Worker): FastifyInstance {
  const app = Fastify();

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
    const candidate = await store.getCandidate(id);
    const ok = await store.transitionGoal(id, goal.revision, "DELIVERED", {
      deliveryMode: "ARTIFACT_ONLY",
      branch: candidate?.branch,
      headCommit: candidate?.head_commit,
    });
    if (!ok) return reply.code(409).send({ error: "revision conflict, retry" });
    await store.addEvent(id, "goal.delivered", `已批准交付：分支 ${candidate?.branch ?? "?"}`);
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
