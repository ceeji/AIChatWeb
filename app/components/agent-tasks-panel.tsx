import React from "react";
import { useAgentTaskStore, AgentTask, TaskStatus } from "../store/agent-tasks";
import styles from "./agent-tasks-panel.module.scss";

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === "in-progress") {
    return <span className={styles["agent-task-spin"]} />;
  }
  if (status === "done") {
    return <span>✅</span>;
  }
  if (status === "failed") {
    return <span>❌</span>;
  }
  // pending
  return <span>⬜</span>;
}

function TaskItem({ task }: { task: AgentTask }) {
  return (
    <div
      className={`${styles["agent-task-item"]} ${styles[`status-${task.status}`]}`}
    >
      <div className={styles["agent-task-icon"]}>
        <StatusIcon status={task.status} />
      </div>
      <span className={styles["agent-task-content"]}>{task.content}</span>
      {task.status === "in-progress" && (
        <span
          className={`${styles["agent-task-badge"]} ${styles["badge-in-progress"]}`}
        >
          进行中
        </span>
      )}
      {task.status === "failed" && (
        <span
          className={`${styles["agent-task-badge"]} ${styles["badge-failed"]}`}
        >
          失败
        </span>
      )}
    </div>
  );
}

/**
 * 智能体任务面板
 *
 * 固定在 chat-input-panel 顶部，仅在有任务且未关闭时显示。
 * 用户可点击右上角关闭按钮隐藏；AI 再次调用 todowrite 时自动恢复显示。
 */
export function AgentTasksPanel() {
  const tasks = useAgentTaskStore((s) => s.tasks);
  const dismissed = useAgentTaskStore((s) => s.dismissed);
  const dismiss = useAgentTaskStore((s) => s.dismiss);

  if (tasks.length === 0 || dismissed) return null;

  return (
    <div className={styles["agent-tasks-panel"]}>
      <div className={styles["agent-tasks-header"]}>
        <div className={styles["agent-tasks-header-icon"]}>
          {/* 简单的 list 图标 SVG */}
          <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="3" width="3" height="2" rx="0.5" />
            <rect x="7" y="3.5" width="8" height="1" rx="0.5" />
            <rect x="2" y="7" width="3" height="2" rx="0.5" />
            <rect x="7" y="7.5" width="8" height="1" rx="0.5" />
            <rect x="2" y="11" width="3" height="2" rx="0.5" />
            <rect x="7" y="11.5" width="8" height="1" rx="0.5" />
          </svg>
        </div>
        <span className={styles["agent-tasks-header-title"]}>
          智能体执行计划（{tasks.filter((t) => t.status === "done").length}/
          {tasks.length}）
        </span>
        <button
          className={styles["agent-tasks-close-btn"]}
          title="关闭计划面板"
          onClick={dismiss}
        >
          ✕
        </button>
      </div>
      <div className={styles["agent-tasks-list"]}>
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
