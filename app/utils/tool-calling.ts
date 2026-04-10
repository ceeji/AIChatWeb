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

  const hasTodoWrite = tools.some((t) => t.name === "todowrite");

  const toolList = tools
    .map((tool) => {
      const params = JSON.stringify(tool.parameters, null, 2);
      return `### ${tool.name}\n说明：${tool.description}\n参数 Schema：\n\`\`\`json\n${params}\n\`\`\``;
    })
    .join("\n\n");

  const planningSection = hasTodoWrite
    ? `
**任务规划要求（必须遵守）：**
- 接到复杂任务后，**第一步必须调用 todowrite 工具**列出完整执行计划，所有步骤初始状态为 pending
- 每个步骤开始前，调用 todowrite 将该步骤状态更新为 in-progress（同时保留其他步骤）
- 每个步骤完成后，调用 todowrite 将该步骤状态更新为 done（同时保留其他步骤）
- 当所有步骤均为 done/failed、不再需要调用任何工具时，**直接输出最终答案**，不要再调用任何工具
- todowrite 每次调用必须包含**全部步骤**（包括已完成的），不要只传当前步骤
`
    : "";

  return `# 智能体模式（Agent Mode）

你当前运行在 **智能体循环（Agentic Loop）** 中：
1. 你接收用户的请求
2. 分析是否需要调用工具来获取信息或执行操作
3. 如需调用工具，以规定格式输出工具调用，系统会自动执行并将结果返回给你（工具调用中的中间参数，不要在工具调用外重复输出，如果有必要，只要总结两句i在做什么即可）
4. 你根据工具结果继续思考，直到可以给出最终答案
5. 整个循环最多可以迭代 15 次，请合理规划步骤
${planningSection}
**工具调用格式**（严格遵守，不得修改标签格式）：

<tool_call>
{"name": "工具名称", "arguments": {"参数名": "参数值"}}
</tool_call>

**重要规则：**
1. 一次可以同时调用多个工具，每个调用使用独立的 <tool_call> 标签
2. 在输出 <tool_call> 之前，你可以先用自然语言简要说明你要做什么（例如"让我来搜索一下..."）
3. 一旦开始输出 <tool_call>，之后不要再输出其他文本，等待工具执行结果
4. 如果不需要任何工具，直接正常回答用户
5. 不要编造工具调用结果，必须等待实际执行返回的内容
6. 工具执行失败时，根据错误信息判断是重试、换用其他工具，还是直接告知用户

**长期任务指南：**
- 复杂任务可以分多步完成，每步使用不同的工具
- 如果一个工具返回结果不完整，可以继续调用其他工具补充
- 对于需要多次迭代的任务（如搜索→阅读→总结），请逐步推进，并及时调用 todowrite 工具更新任务状态（如果可用），以便用户了解进度
- 给出最终答案前，确认已收集到足够信息

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

/**
 * 截取文本中用于 UI 显示的部分，过滤掉 <tool_call> 标签及其内容。
 *
 * @param text      原始文本（onUpdate 传入的累积流 / onFinish 传入的完整文本）
 * @param streaming 是否处于流式传输中途（animateResponseText 正在逐字符输出）
 *
 * 行为：
 * - 完整的 <tool_call>{ 序列出现时，截断其及后续所有内容（精准匹配，不误伤普通 XML 标签）
 * - streaming=true 时，额外检测尾部尚未闭合的 <tool_call> 前缀：
 *   采用"最短可区分前缀"策略——只有在累积文本末尾出现了足以唯一确认是 <tool_call>
 *   开头的字符串（即 "<tool_call" 及其各级前缀）时才截断，普通 XML 标签（如
 *   <thinking>、<br>）在第一个与 <tool_call> 不同的字符出现后立刻恢复显示，
 *   不会被永久隐藏。
 */
export function getDisplayContent(text: string, streaming = false): string {
  // 1. 完整标签（后跟可选空白和 {，确认是 JSON 工具调用而非普通 XML 标签）
  const FULL_RE = /<tool_call>\s*\{/;
  const fullMatch = FULL_RE.exec(text);
  if (fullMatch) return text.slice(0, fullMatch.index).trimEnd();

  // 2. streaming 中途：检测尾部不完整前缀，防止字符动画逐字母暴露
  //    只截断 "<tool_call>" 各级前缀（即 "<", "<t", …, "<tool_call"）。
  //    一旦出现非前缀字符（如 "<th"、"<tool_r"），前缀不再匹配，内容立刻恢复。
  if (streaming) {
    const prefix = "<tool_call>";
    for (let len = prefix.length - 1; len >= 1; len--) {
      if (text.endsWith(prefix.slice(0, len))) {
        return text.slice(0, text.length - len).trimEnd();
      }
    }
  }

  return text;
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
    return `如有需要，及时调用 todowrite 工具更新任务状态。\n\n<tool_result name="${r.name}"${r.isError ? ' error="true"' : ""}>\n${r.result}\n</tool_result>`;
  });

  return `${parts.join("\n\n")}`;
}
