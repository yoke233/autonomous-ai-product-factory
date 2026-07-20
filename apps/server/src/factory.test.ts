import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDb, type DB } from "./db.js";
import { Store } from "./store.js";
import { Worker } from "./worker.js";
import { buildApi } from "./api.js";
import { stubProducer } from "./runner.js";

function makeTempRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "factory-repo-"));
  const git = (...args: string[]) => execFileSync("git", ["-C", dir, ...args]);
  git("init", "-q");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  writeFileSync(path.join(dir, "hello.txt"), "hello\n");
  git("add", "-A");
  git("commit", "-qm", "init");
  return dir;
}

describe("factory main loop (stub producer)", () => {
  let db: DB;
  let store: Store;
  let worker: Worker;
  let repo: string;

  beforeAll(async () => {
    db = await openDb();
    store = new Store(db);
    worker = new Worker(store, stubProducer);
    repo = makeTempRepo();
  });

  afterAll(async () => {
    worker.stop();
    await db.close();
  });

  it("drives RECEIVED → AWAITING_APPROVAL → DELIVERED with sealed candidate", async () => {
    const goal = await store.createGoal({
      repoPath: repo,
      goalText: "add a stub file",
      boundary: { deliveryMode: "ARTIFACT_ONLY", repoProfile: { testCommand: "git status" } },
    });
    expect(goal.status).toBe("RECEIVED");

    await worker.tick();

    const after = await store.getGoal(goal.id);
    expect(after?.status).toBe("AWAITING_APPROVAL");

    const candidate = await store.getCandidate(goal.id);
    expect(candidate?.patch).toContain("FACTORY_STUB.md");
    expect(candidate?.branch).toMatch(/^factory\//);

    const assessment = await store.getAssessment(goal.id);
    expect(assessment?.verdict).toBe("PASS");

    const app = buildApi(store, worker);
    const res = await app.inject({ method: "POST", url: `/api/goals/${goal.id}/approve` });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("DELIVERED");
    await app.close();
  });

  it("returns NO_SAFE_DELIVERY when verification fails", async () => {
    const goal = await store.createGoal({
      repoPath: repo,
      goalText: "another change",
      boundary: { deliveryMode: "ARTIFACT_ONLY", repoProfile: { testCommand: "exit 1" } },
    });
    await worker.tick();
    const after = await store.getGoal(goal.id);
    expect(after?.status).toBe("NO_SAFE_DELIVERY");
    const assessment = await store.getAssessment(goal.id);
    expect(assessment?.verdict).toBe("FAIL");
  });

  it("stale revision transition is rejected (CAS)", async () => {
    const goal = await store.createGoal({
      repoPath: repo,
      goalText: "cas check",
      boundary: { deliveryMode: "ARTIFACT_ONLY", repoProfile: {} },
    });
    const ok = await store.transitionGoal(goal.id, goal.revision, "CANCELLED");
    expect(ok).toBe(true);
    const stale = await store.transitionGoal(goal.id, goal.revision, "RUNNING");
    expect(stale).toBe(false);
  });
});
