/**
 * 联网搜索工具（通过 Exa MCP server）
 *
 * UI 显示名：联网搜索（不体现 Exa 品牌）
 * 后端需要配置环境变量：EXA_API_KEY=your_key_here
 *
 * Exa MCP server: https://mcp.exa.ai/mcp
 */

import { RemoteMcpTool } from "./types";

export const exaSearchTool: RemoteMcpTool = {
  type: "remote-mcp",
  name: "web_search",
  displayName: "联网搜索",
  description:
    "搜索互联网上的实时信息。当用户需要最新资讯、新闻、价格、天气、近期事件等当前知识库中未收录的信息时使用。",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "要搜索的关键词或问题，使用清晰简洁的搜索词",
      },
      numResults: {
        type: "number",
        description: "返回结果数量，默认 5，最大 10",
        default: 5,
      },
    },
    required: ["query"],
  },
  serverUrl: "https://mcp.exa.ai/mcp",
  mcpToolName: "web_search_exa",
  apiKeyEnvVar: "EXA_API_KEY",
};
