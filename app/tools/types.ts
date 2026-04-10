/**
 * 工具定义类型系统
 *
 * LocalTool: 纯 JS 函数实现，直接在浏览器中执行
 * RemoteMcpTool: 通过服务端代理转发到远程 MCP server 执行
 */

/** JSON Schema 参数描述 */
export interface ToolParameter {
  type: "object";
  properties: Record<
    string,
    {
      type: string;
      description: string;
      enum?: string[];
      default?: unknown;
    }
  >;
  required?: string[];
}

/** 本地 JS 函数工具 */
export interface LocalTool {
  type: "local";
  /** 给 AI 使用的工具名（snake_case，唯一） */
  name: string;
  /** UI 显示名，不需要体现品牌 */
  displayName: string;
  description: string;
  parameters: ToolParameter;
  /** 执行函数，返回给 AI 的字符串结果 */
  execute: (args: Record<string, unknown>) => Promise<string>;
}

/** 远程 MCP server 工具（通过服务端代理调用） */
export interface RemoteMcpTool {
  type: "remote-mcp";
  /** 给 AI 使用的工具名（可与 mcpToolName 不同） */
  name: string;
  /** UI 显示名，不需要体现品牌 */
  displayName: string;
  description: string;
  parameters: ToolParameter;
  /** MCP server 的 HTTP 地址 */
  serverUrl: string;
  /** MCP server 上实际的工具名 */
  mcpToolName: string;
  /** 服务端环境变量名，用于读取 API key（只在服务端读取，不暴露给浏览器） */
  apiKeyEnvVar?: string;
}

export type ToolDefinition = LocalTool | RemoteMcpTool;

export interface ParsedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  result: string;
  isError: boolean;
}
