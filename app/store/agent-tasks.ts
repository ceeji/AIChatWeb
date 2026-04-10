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
  /** 用户手动关闭了面板 */
  dismissed: boolean;
  /** 设置（替换）整个任务列表；同时重置 dismissed 以便重新显示 */
  setTasks: (tasks: AgentTask[]) => void;
  /** 清空（新对话开始或关闭智能体模式时调用） */
  clearTasks: () => void;
  /** 用户点击关闭按钮，隐藏面板 */
  dismiss: () => void;
}

export const useAgentTaskStore = create<AgentTaskState>((set) => ({
  tasks: [],
  dismissed: false,
  setTasks: (tasks) => set({ tasks, dismissed: false }),
  clearTasks: () => set({ tasks: [], dismissed: false }),
  dismiss: () => set({ dismissed: true }),
}));
