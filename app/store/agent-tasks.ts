/**
 * Agent 任务列表状态（无需持久化，会话级别）
 *
 * 由 todowrite 工具写入，AgentTasksPanel 读取展示。
 */

import { create } from "zustand";

export type TaskStatus = "pending" | "in-progress" | "done" | "failed";

export interface AgentTask {
  id: string;
  content: string;
  status: TaskStatus;
}

interface AgentTaskState {
  tasks: AgentTask[];
  /** 设置（替换）整个任务列表 */
  setTasks: (tasks: AgentTask[]) => void;
  /** 清空（新对话开始或关闭智能体模式时调用） */
  clearTasks: () => void;
}

export const useAgentTaskStore = create<AgentTaskState>((set) => ({
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  clearTasks: () => set({ tasks: [] }),
}));
