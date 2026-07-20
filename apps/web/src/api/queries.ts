import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api, type Goal, type GoalComment, type GoalDetail } from "@/api/client";

/** 收件箱/工单列表：服务端权威、后台每 2 秒轮询。 */
export function useGoals(): UseQueryResult<Goal[]> {
  return useQuery({
    queryKey: ["goals"],
    queryFn: api.listGoals,
    refetchInterval: 2000,
  });
}

/** 单个工单详情：仅在选中时启用，运行中每 2 秒轮询。 */
export function useGoal(id: string | null): UseQueryResult<GoalDetail> {
  return useQuery({
    queryKey: ["goal", id],
    queryFn: () => api.getGoal(id as string),
    enabled: id != null,
    refetchInterval: 2000,
  });
}

/** 工单评论线程：后台每 2 秒轮询，用于拉到执行器的回执。 */
export function useGoalComments(id: string | null): UseQueryResult<GoalComment[]> {
  return useQuery({
    queryKey: ["comments", id],
    queryFn: () => api.listComments(id as string),
    enabled: id != null,
    refetchInterval: 2000,
  });
}

/** 发送评论给执行器：成功后失效评论线程。 */
export function usePostComment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => api.postComment(id, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", id] }),
  });
}

type GoalMutationKind = "approve" | "reject" | "cancel";

/** 批准 / 否决 / 取消：成功后失效列表与该工单详情，触发即时刷新。 */
export function useGoalAction(kind: GoalMutationKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api[kind](id),
    onSuccess: (_goal, id) => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["goal", id] });
    },
  });
}
