/**
 * 工具注册中心（Tool Registry）
 *
 * 如何添加自定义工具：
 * 1. 在 app/tools/ 目录下创建新文件，实现 LocalTool 或 RemoteMcpTool 接口
 * 2. 在本文件末尾调用 registerTool(yourTool) 注册
 */

import { ToolDefinition } from "./types";
import { exaSearchTool } from "./exa-search";
import { markdownToWordTool } from "./markdown-to-word";
import { fetchWebpageTool } from "./fetch-webpage";
import { todoWriteTool } from "./todo-write";

// ────────────────────────────────────────────────────────────
// 模型黑名单：包含这些子串的模型名不支持智能体模式
// ────────────────────────────────────────────────────────────
export const AGENT_MODE_UNSUPPORTED_MODELS: string[] = [
  "whisper",
  "dall-e",
  "tts-",
  "midjourney",
  "mj-",
  "stable-diffusion",
  "sd-",
  "sora",
  "vision", // gpt-4-vision-preview 等纯图像分析模型
  // 中文图像/视频生成类模型
  "视频",
  "即梦",
  "图", // 包含"图"字的图像生成模型（文生图、图生图等）
];

/**
 * 判断当前配置是否支持智能体模式
 */
export function isAgentModeSupported(
  model: string,
  contentType: string,
  imageMode: string,
): boolean {
  // 图像类 contentType 不支持
  if (contentType === "Image") return false;

  // 有图像模式（如 IMAGINE/BLEND/DESCRIBE）不支持
  if (imageMode && imageMode !== "") return false;

  // 黑名单模型不支持
  const modelLower = model.toLowerCase();
  if (
    AGENT_MODE_UNSUPPORTED_MODELS.some((keyword) =>
      modelLower.includes(keyword.toLowerCase()),
    )
  ) {
    return false;
  }

  return true;
}

// ────────────────────────────────────────────────────────────
// 工具注册表
// ────────────────────────────────────────────────────────────
const registry = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition): void {
  if (registry.has(tool.name)) {
    console.warn(
      `[ToolRegistry] Tool "${tool.name}" is already registered and will be overwritten.`,
    );
  }
  registry.set(tool.name, tool);
}

export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name);
}

export function getAllTools(): ToolDefinition[] {
  return Array.from(registry.values());
}

// ────────────────────────────────────────────────────────────
// 注册内置工具
// 在此处添加 registerTool(yourTool) 来注册自定义工具
// ────────────────────────────────────────────────────────────
registerTool(todoWriteTool); // 必须第一个注册，便于系统提示引导规划优先
registerTool(exaSearchTool);
registerTool(markdownToWordTool);
registerTool(fetchWebpageTool);
