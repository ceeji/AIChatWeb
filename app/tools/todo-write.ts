/**
 * todowrite 工具
 *
 * AI 使用此工具来：
 * 1. 在任务开始时创建完整规划（所有步骤均为 pending）
 * 2. 在每个步骤开始时将其标记为 in-progress
 * 3. 在每个步骤完成后将其标记为 done / failed
 *
 * 不调用任何工具 = 任务完成，给出最终答案。
 */

import { LocalTool } from "./types";
import { useAgentTaskStore, AgentTask, TaskStatus } from "../store/agent-tasks";
import { useChatStore } from "../store/chat";

const VALID_STATUSES: TaskStatus[] = [
  "pending",
  "in-progress",
  "done",
  "failed",
];

export const todoWriteTool: LocalTool = {
  type: "local",
  name: "todowrite",
  displayName: "任务规划",
  description:
    "在执行复杂任务前，必须首先调用此工具创建任务计划，然后在每个步骤开始时更新状态为 in-progress，完成后更新为 done。" +
    "当所有必要步骤均完成、不再需要调用任何工具时，直接给出最终答案（不调用任何工具即代表任务完成）。",
  parameters: {
    type: "object",
    properties: {
      todos: {
        type: "string",
        description:
          'JSON 数组，格式为 [{"id":"1","content":"步骤描述","status":"pending|in-progress|done|failed"}, ...]。' +
          "每次调用会替换之前的全部任务列表，请务必包含所有步骤（包括已完成的）。",
      },
    },
    required: ["todos"],
  },

  execute: async (args) => {
    let tasks: AgentTask[];

    try {
      const raw = args.todos as string;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

      if (!Array.isArray(parsed)) {
        throw new Error("todos must be an array");
      }

      tasks = parsed.map((item: Record<string, unknown>, idx: number) => {
        const id = String(item.id ?? idx + 1);
        const content = String(item.content ?? "").trim();
        const status = VALID_STATUSES.includes(item.status as TaskStatus)
          ? (item.status as TaskStatus)
          : "pending";

        if (!content) throw new Error(`Task at index ${idx} has empty content`);
        return { id, content, status };
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return `错误：todos 格式不正确——${msg}。请使用 JSON 数组格式。`;
    }

    useAgentTaskStore
      .getState()
      .setTasks(useChatStore.getState().currentSession().id, tasks);

    const counts = {
      done: tasks.filter((t) => t.status === "done").length,
      inProgress: tasks.filter((t) => t.status === "in-progress").length,
      pending: tasks.filter((t) => t.status === "pending").length,
      failed: tasks.filter((t) => t.status === "failed").length,
    };

    const allDone =
      counts.pending === 0 && counts.inProgress === 0 && counts.failed === 0;

    return JSON.stringify({
      success: true,
      taskCount: tasks.length,
      summary: `已更新 ${tasks.length} 个步骤（完成 ${counts.done}，进行中 ${counts.inProgress}，待开始 ${counts.pending}，失败 ${counts.failed}）`,
      allCompleted: allDone,
      hint: allDone
        ? "所有步骤已完成，请直接给出最终答案，不要再调用任何工具。"
        : "请按计划继续执行下一个步骤。",
    });
  },
};
