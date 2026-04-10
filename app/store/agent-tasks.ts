/**
 * Agent 任务列表状态（无需持久化，会话级别）
 *
 * 由 todowrite 工具写入，AgentTasksPanel 读取展示。
 * 任务按 sessionId 独立存储，切换对话后面板能正确反映各自的任务列表。
 */

import { create } from "zustand";

export type TaskStatus = "pending" | "in-progress" | "done" | "failed";

export interface AgentTask {
  id: string;
  content: string;
  status: TaskStatus;
}

interface SessionTaskState {
  tasks: AgentTask[];
  dismissed: boolean;
}

interface AgentTaskState {
  /** 按 sessionId 存储各会话的任务状态 */
  sessions: Record<string, SessionTaskState>;
  /** 设置（替换）指定会话的整个任务列表；同时重置 dismissed 以便重新显示 */
  setTasks: (sessionId: string, tasks: AgentTask[]) => void;
  /** 清空指定会话的任务（关闭智能体模式或删除对话时调用） */
  clearTasks: (sessionId: string) => void;
  /** 用户点击关闭按钮，隐藏指定会话的面板 */
  dismiss: (sessionId: string) => void;
  /** 获取指定会话的任务列表（无则返回空数组） */
  getSessionTasks: (sessionId: string) => AgentTask[];
  /** 获取指定会话的 dismissed 状态 */
  getSessionDismissed: (sessionId: string) => boolean;
}

export const useAgentTaskStore = create<AgentTaskState>((set, get) => ({
  sessions: {},

  setTasks: (sessionId, tasks) =>
    set((state) => ({
      sessions: {
        ...state.sessions,
        [sessionId]: { tasks, dismissed: false },
      },
    })),

  clearTasks: (sessionId) =>
    set((state) => {
      const next = { ...state.sessions };
      delete next[sessionId];
      return { sessions: next };
    }),

  dismiss: (sessionId) =>
    set((state) => ({
      sessions: {
        ...state.sessions,
        [sessionId]: {
          tasks: state.sessions[sessionId]?.tasks ?? [],
          dismissed: true,
        },
      },
    })),

  getSessionTasks: (sessionId) => get().sessions[sessionId]?.tasks ?? [],
  getSessionDismissed: (sessionId) =>
    get().sessions[sessionId]?.dismissed ?? false,
}));
