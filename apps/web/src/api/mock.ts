import type { Goal, GoalComment, GoalDetail, Intake } from "@/api/client";

/** 纯前端演示用的内存态 mock。approve/reject/cancel 会就地改状态，
 *  轮询（refetchInterval）会在下一拍反映出来。不追求持久化。 */

const REPO_SHOP = "D:\\project\\shop-api";
const REPO_WEB = "D:\\project\\web-console";

function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function mkGoal(
  id: string,
  repo: string,
  text: string,
  status: string,
  ageMin: number,
  extra?: { reason?: string; build?: string; test?: string },
): Goal {
  return {
    id,
    revision: 1,
    repo_path: repo,
    goal_text: text,
    boundary: {
      deliveryMode: "ARTIFACT_ONLY",
      repoProfile: {
        ...(extra?.build ? { buildCommand: extra.build } : {}),
        ...(extra?.test ? { testCommand: extra.test } : {}),
      },
    },
    status,
    outcome: extra?.reason ? { reason: extra.reason } : null,
    created_at: ago(ageMin + 30),
    updated_at: ago(ageMin),
  };
}

const goals: Goal[] = [
  mkGoal("g_1042", REPO_SHOP, "为 POST /orders 增加幂等键校验，重复提交返回既有订单而非重复下单", "AWAITING_APPROVAL", 2, {
    build: "pnpm build",
    test: "pnpm test",
  }),
  mkGoal("g_1041", REPO_WEB, "修复令牌刷新竞态导致的偶发登出", "AWAITING_APPROVAL", 14),
  mkGoal("g_1039", REPO_SHOP, "把订单列表查询重构为游标分页，去除深翻页的全表扫描", "RUNNING", 6, {
    build: "pnpm build",
    test: "pnpm test",
  }),
  mkGoal("g_1038", REPO_WEB, "报表导出支持 CSV 格式", "RECEIVED", 9),
  mkGoal("g_1035", REPO_SHOP, "抽取统一的时间格式化工具并替换散落实现", "DELIVERED", 180, {
    build: "pnpm build",
    test: "pnpm test",
  }),
  mkGoal("g_1030", REPO_SHOP, "迁移支付回调到新网关的签名校验", "NO_SAFE_DELIVERY", 320, {
    reason: "构建通过但集成测试无沙箱密钥，无法验证签名，判为无安全交付",
    build: "pnpm build",
    test: "pnpm test:integration",
  }),
  mkGoal("g_1028", REPO_WEB, "试验性灰度开关面板", "CANCELLED", 1440),
  mkGoal("g_1025", REPO_SHOP, "批量导入历史用户数据", "SYSTEM_FAULT", 2880, {
    reason: "worktree 创建失败：磁盘空间不足",
  }),
];

const DIFF_STAT_ORDERS = `src/routes/orders.ts    | 34 ++++++++++++++++---
src/lib/idempotency.ts  | 41 +++++++++++++++++++++++
test/orders.test.ts     | 28 +++++++++++++++
3 files changed, 98 insertions(+), 5 deletions(-)`;

const PATCH_ORDERS = `diff --git a/src/lib/idempotency.ts b/src/lib/idempotency.ts
new file mode 100644
--- /dev/null
+++ b/src/lib/idempotency.ts
@@ -0,0 +1,41 @@
+export async function withIdempotency(key: string, fn: () => Promise<Order>) {
+  const existing = await store.findByIdempotencyKey(key);
+  if (existing) return existing;
+  const order = await fn();
+  await store.saveIdempotencyKey(key, order.id);
+  return order;
+}`;

function detailFor(goal: Goal): GoalDetail {
  const hasCandidate = ["AWAITING_APPROVAL", "DELIVERED"].includes(goal.status);
  const hasCommands = Boolean(goal.boundary.repoProfile.buildCommand || goal.boundary.repoProfile.testCommand);

  const candidate = hasCandidate
    ? {
        branch: `factory/${goal.id}`,
        diff_stat: DIFF_STAT_ORDERS,
        patch: PATCH_ORDERS,
        head_commit: "3f9a1c8e5b2d47a09c1e",
      }
    : null;

  const assessment = hasCandidate
    ? hasCommands
      ? {
          verdict: "PASS",
          evidence: {
            checks: [
              { name: "build", command: "pnpm build", exitCode: 0, outputTail: "✓ built in 4.21s" },
              {
                name: "test",
                command: "pnpm test",
                exitCode: 0,
                outputTail: "Test Files  12 passed (12)\n     Tests  86 passed (86)",
              },
            ],
          },
        }
      : {
          verdict: "INCONCLUSIVE",
          evidence: { checks: [], notes: "工单未配置构建/测试命令，无法自动验证，需人工确认 diff。" },
        }
    : null;

  const events = [
    { id: 1, kind: "RECEIVED", message: "工单已受理", created_at: goal.created_at },
    { id: 2, kind: "RUN_STARTED", message: "执行者在隔离 worktree 中开工", created_at: ago(20) },
    ...(hasCandidate
      ? [{ id: 3, kind: "CANDIDATE_READY", message: "产出候选变更并封存 branch@commit", created_at: goal.updated_at }]
      : []),
    ...(goal.status === "NO_SAFE_DELIVERY"
      ? [{ id: 4, kind: "NO_SAFE_DELIVERY", message: String(goal.outcome?.["reason"] ?? ""), created_at: goal.updated_at }]
      : []),
    ...(goal.status === "SYSTEM_FAULT"
      ? [{ id: 4, kind: "SYSTEM_FAULT", message: String(goal.outcome?.["reason"] ?? ""), created_at: goal.updated_at }]
      : []),
  ];

  return { goal, runs: [], candidate, assessment, events };
}

const intakes = new Map<string, Intake>();
let intakeSeq = 1;
let goalSeq = 100;
let commentSeq = 1;

const commentsByGoal = new Map<string, GoalComment[]>([
  [
    "g_1039",
    [
      { id: commentSeq++, author: "system", text: "执行者已在隔离 worktree 中开工。", created_at: ago(6) },
      {
        id: commentSeq++,
        author: "executor",
        text: "正在把 offset 分页改为基于 (created_at, id) 的游标。有个问题：现有 API 是否需要保持向后兼容 page/size 参数？",
        created_at: ago(4),
      },
    ],
  ],
  [
    "g_1042",
    [
      {
        id: commentSeq++,
        author: "executor",
        text: "已完成幂等键校验并补了并发重复提交的测试，候选变更待你批准。",
        created_at: ago(2),
      },
    ],
  ],
]);

/** 模拟执行器收到人类留言后的回执：轮询会在下一拍拉到。 */
function scheduleExecutorReply(goalId: string, humanText: string) {
  setTimeout(() => {
    const list = commentsByGoal.get(goalId);
    if (!list) return;
    list.push({
      id: commentSeq++,
      author: "executor",
      text: `收到你的说明：「${humanText.slice(0, 24)}${humanText.length > 24 ? "…" : ""}」，我会据此调整并在下一版候选中体现。`,
      created_at: new Date().toISOString(),
    });
  }, 1500);
}

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 220));
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export const mockApi = {
  listGoals: () => delay(clone(goals)),
  getGoal: (id: string) => {
    const g = goals.find((x) => x.id === id);
    if (!g) return Promise.reject(new Error("not found"));
    return delay(clone(detailFor(g)));
  },
  createGoal: () => Promise.reject(new Error("mock: 未实现")),
  listComments: (id: string) => delay(clone(commentsByGoal.get(id) ?? [])),
  postComment: (id: string, text: string) => {
    const list = commentsByGoal.get(id) ?? [];
    const comment: GoalComment = { id: commentSeq++, author: "human", text, created_at: new Date().toISOString() };
    list.push(comment);
    commentsByGoal.set(id, list);
    scheduleExecutorReply(id, text);
    return delay(clone(comment));
  },
  approve: (id: string) => transition(id, "DELIVERED"),
  reject: (id: string) => transition(id, "CANCELLED"),
  cancel: (id: string) => transition(id, "CANCELLED"),
  getIntake: (id: string) => {
    const i = intakes.get(id);
    if (!i) return Promise.reject(new Error("not found"));
    return delay(clone(i));
  },
  createIntake: (repoPath: string) => {
    const id = `i_${intakeSeq++}`;
    const now = new Date().toISOString();
    const intake: Intake = {
      id,
      repo_path: repoPath || REPO_SHOP,
      messages: [],
      draft: null,
      status: "OPEN",
      goal_id: null,
      created_at: now,
      updated_at: now,
    };
    intakes.set(id, intake);
    return delay(clone(intake));
  },
  sendIntakeMessage: (id: string, text: string) => {
    const intake = intakes.get(id);
    if (!intake) return Promise.reject(new Error("not found"));
    const now = new Date().toISOString();
    intake.messages.push({ role: "user", text, at: now });
    intake.messages.push({
      role: "agent",
      text:
        "我读了仓库的相关代码。为把需求收敛成自包含工单，请确认：改动只涉及后端接口层吗？是否需要覆盖并发重复提交的测试？下面给出一版草稿，你可以直接改。",
      at: now,
    });
    intake.draft = {
      goalText: text.trim() + "（在接口层实现，附带并发重复提交的回归测试）",
      buildCommand: "pnpm build",
      testCommand: "pnpm test",
    };
    intake.updated_at = now;
    return delay(clone(intake));
  },
  startIntake: (id: string, body: { goalText: string; buildCommand?: string; testCommand?: string }) => {
    const intake = intakes.get(id);
    if (!intake) return Promise.reject(new Error("not found"));
    const goal = mkGoal(`g_${++goalSeq}`, intake.repo_path, body.goalText, "RECEIVED", 0, {
      ...(body.buildCommand ? { build: body.buildCommand } : {}),
      ...(body.testCommand ? { test: body.testCommand } : {}),
    });
    goals.unshift(goal);
    intake.status = "STARTED";
    intake.goal_id = goal.id;
    intake.updated_at = new Date().toISOString();
    return delay(clone(goal));
  },
};

function transition(id: string, to: string): Promise<Goal> {
  const g = goals.find((x) => x.id === id);
  if (!g) return Promise.reject(new Error("not found"));
  g.status = to;
  g.updated_at = new Date().toISOString();
  return delay(clone(g));
}
