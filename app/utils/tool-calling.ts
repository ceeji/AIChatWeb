/**
 * 工具调用核心逻辑
 *
 * 包含：
 * - buildToolSystemPrompt: 生成注入 AI 的 system prompt
 * - detectAllToolCalls: 从 AI 回复中提取所有工具调用
 * - executeToolsParallel: 并行执行所有工具调用
 */

import { ToolDefinition, ParsedToolCall, ToolResult } from "../tools/types";
import { getTool, getAllTools } from "../tools/index";
import { callMcpTool } from "./mcp-client";

// ────────────────────────────────────────────────────────────
// System Prompt 构建
// ────────────────────────────────────────────────────────────

/**
 * 生成工具调用 system prompt 片段，注入到消息最前面
 */
export function buildToolSystemPrompt(tools: ToolDefinition[]): string {
  if (tools.length === 0) return "";

  const toolList = tools
    .map((tool) => {
      const params = JSON.stringify(tool.parameters, null, 2);
      return `### ${tool.name}\n说明：${tool.description}\n参数 Schema：\n\`\`\`json\n${params}\n\`\`\``;
    })
    .join("\n\n");

  return `# 工具调用指南

你是一个可以调用外部工具的智能助手。当需要使用工具时，请使用以下格式输出（不要包含任何其他内容，只输出 tool_call 标签）：

<tool_call>
{"name": "工具名称", "arguments": {"参数名": "参数值"}}
</tool_call>

**重要规则：**
1. 一次可以同时调用多个工具，每个工具调用独立使用一个 <tool_call> 标签
2. 如果不需要调用工具，直接正常回答用户
3. 工具调用成功后，你会收到结果，再据此给出最终回答
4. 不要编造工具调用结果，等待实际执行结果
5. 如果工具调用返回错误，根据错误信息判断是重试还是直接告知用户

## 可用工具列表

${toolList}

---
`;
}

// ────────────────────────────────────────────────────────────
// 工具调用检测与解析
// ────────────────────────────────────────────────────────────

const TOOL_CALL_REGEX = /<tool_call>([\s\S]*?)<\/tool_call>/g;

/**
 * 从 AI 响应文本中提取所有工具调用
 */
export function detectAllToolCalls(text: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  let match: RegExpExecArray | null;

  // 重置 regex 状态（lastIndex）
  TOOL_CALL_REGEX.lastIndex = 0;

  while ((match = TOOL_CALL_REGEX.exec(text)) !== null) {
    const rawJson = match[1].trim();
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed && typeof parsed.name === "string" && parsed.name.length > 0) {
        calls.push({
          name: parsed.name,
          arguments: parsed.arguments ?? {},
        });
      }
    } catch (e) {
      console.warn("[ToolCalling] Failed to parse tool_call JSON:", rawJson, e);
    }
  }

  return calls;
}

/**
 * 检查文本中是否含有任何工具调用
 */
export function hasToolCalls(text: string): boolean {
  TOOL_CALL_REGEX.lastIndex = 0;
  return TOOL_CALL_REGEX.test(text);
}

/**
 * 从 AI 响应中去除所有 <tool_call> 标签（保留其他内容）
 */
export function removeToolCallTags(text: string): string {
  return text.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "").trim();
}

// ────────────────────────────────────────────────────────────
// 工具执行
// ────────────────────────────────────────────────────────────

/**
 * 并行执行所有工具调用，返回结果数组
 * 每个工具调用独立 try/catch，失败不影响其他工具
 */
export async function executeToolsParallel(
  calls: ParsedToolCall[],
): Promise<ToolResult[]> {
  const results = await Promise.all(
    calls.map(async (call): Promise<ToolResult> => {
      const tool = getTool(call.name);
      if (!tool) {
        return {
          name: call.name,
          result: `错误：找不到名为 "${call.name}" 的工具。可用工具：${getAllTools()
            .map((t) => t.name)
            .join(", ")}`,
          isError: true,
        };
      }

      try {
        let result: string;

        if (tool.type === "local") {
          result = await tool.execute(call.arguments);
        } else {
          // remote-mcp
          result = await callMcpTool(
            tool.serverUrl,
            tool.mcpToolName,
            call.arguments,
            tool.apiKeyEnvVar,
          );
        }

        return { name: call.name, result, isError: false };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[ToolCalling] Tool "${call.name}" execution failed:`, e);
        return {
          name: call.name,
          result: `工具执行出错：${msg}`,
          isError: true,
        };
      }
    }),
  );

  return results;
}

/**
 * 将工具执行结果格式化为注入给 AI 的 user 消息内容
 */
export function formatToolResults(results: ToolResult[]): string {
  const parts = results.map((r) => {
    const status = r.isError ? "（执行失败）" : "（执行成功）";
    return `<tool_result name="${r.name}"${r.isError ? ' error="true"' : ""}>\n${r.result}\n</tool_result>`;
  });

  return `以下是工具调用的执行结果，请根据这些结果继续回答用户的问题：\n\n${parts.join("\n\n")}`;
}
