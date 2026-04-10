/**
 * 最小 MCP JSON-RPC 客户端
 *
 * 在浏览器中通过服务端代理（/api/mcp-proxy）调用远程 MCP server。
 * 完成 MCP 握手流程：initialize → notifications/initialized → tools/call
 */

const MCP_PROXY_PATH = "/api/mcp-proxy";
const MCP_PROTOCOL_VERSION = "2024-11-05";

interface McpResponse {
  jsonrpc: string;
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

async function proxyRequest(
  serverUrl: string,
  method: string,
  params: Record<string, unknown>,
  apiKeyEnvVar?: string,
): Promise<McpResponse> {
  const resp = await fetch(MCP_PROXY_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serverUrl, method, params, apiKeyEnvVar }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`MCP proxy error ${resp.status}: ${text}`);
  }

  return resp.json() as Promise<McpResponse>;
}

/**
 * 调用远程 MCP server 上的指定工具
 *
 * @param serverUrl    MCP server HTTP 地址
 * @param mcpToolName  MCP server 上的工具名
 * @param args         工具参数
 * @param apiKeyEnvVar 服务端环境变量名（用于 Authorization header）
 * @returns            工具返回的文本结果
 */
export async function callMcpTool(
  serverUrl: string,
  mcpToolName: string,
  args: Record<string, unknown>,
  apiKeyEnvVar?: string,
): Promise<string> {
  // 1. MCP 握手：initialize
  const initResp = await proxyRequest(
    serverUrl,
    "initialize",
    {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      clientInfo: { name: "aichat-web", version: "1.0" },
    },
    apiKeyEnvVar,
  );

  if (initResp.error) {
    throw new Error(`MCP initialize failed: ${initResp.error.message}`);
  }

  // 2. 通知握手完成
  await proxyRequest(
    serverUrl,
    "notifications/initialized",
    {},
    apiKeyEnvVar,
  ).catch(() => {
    // 部分 server 不要求 initialized 通知，忽略错误
  });

  // 3. 工具调用
  const callResp = await proxyRequest(
    serverUrl,
    "tools/call",
    { name: mcpToolName, arguments: args },
    apiKeyEnvVar,
  );

  if (callResp.error) {
    throw new Error(`MCP tools/call failed: ${callResp.error.message}`);
  }

  return extractMcpResult(callResp.result);
}

/**
 * 从 MCP tools/call 响应中提取文本内容
 */
function extractMcpResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return String(result ?? "");
  }

  const r = result as Record<string, unknown>;

  // MCP 标准格式：{ content: [{ type: "text", text: "..." }] }
  if (Array.isArray(r.content)) {
    const texts = (r.content as Array<{ type?: string; text?: string }>)
      .filter((item) => item.type === "text" && item.text)
      .map((item) => item.text as string);
    if (texts.length > 0) return texts.join("\n");
  }

  // 兜底：序列化整个结果
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}
