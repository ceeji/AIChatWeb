/**
 * MCP 代理服务端路由
 *
 * 解决浏览器直连远程 MCP server 的 CORS 问题。
 * 同时在服务端安全读取 API key 环境变量，不暴露给浏览器。
 *
 * 请求格式: POST /api/mcp-proxy
 * {
 *   serverUrl: string,     // 目标 MCP server URL
 *   method: string,        // MCP JSON-RPC 方法名
 *   params: object,        // 方法参数
 *   apiKeyEnvVar?: string, // 可选：从哪个环境变量读取 API key
 * }
 */

import { NextRequest, NextResponse } from "next/server";

const MAX_TIMEOUT_MS = 30_000;

export async function POST(req: NextRequest) {
  let body: {
    serverUrl: string;
    method: string;
    params: Record<string, unknown>;
    apiKeyEnvVar?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { serverUrl, method, params, apiKeyEnvVar } = body;

  if (!serverUrl || !method) {
    return NextResponse.json(
      { error: "Missing serverUrl or method" },
      { status: 400 },
    );
  }

  // 安全读取 API key（只在服务端，不暴露给浏览器）
  let authHeader: string | undefined;
  if (apiKeyEnvVar) {
    const apiKey = process.env[apiKeyEnvVar];
    if (apiKey) {
      authHeader = `Bearer ${apiKey}`;
    }
  }

  const rpcPayload = {
    jsonrpc: "2.0",
    id: 1,
    method,
    params,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAX_TIMEOUT_MS);

  try {
    const upstream = await fetch(serverUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(rpcPayload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const contentType = upstream.headers.get("content-type") ?? "";

    if (contentType.includes("text/event-stream")) {
      // SSE 响应：聚合所有 data 行
      const text = await upstream.text();
      const result = parseSseToJsonRpc(text);
      return NextResponse.json(result);
    } else {
      // 普通 JSON 响应
      const json = await upstream.json();
      return NextResponse.json(json);
    }
  } catch (e: unknown) {
    clearTimeout(timer);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Upstream request failed: ${message}` },
      { status: 502 },
    );
  }
}

/**
 * 将 SSE 流文本聚合成最后一个完整的 JSON-RPC 响应对象
 */
function parseSseToJsonRpc(sseText: string): unknown {
  const lines = sseText.split("\n");
  let lastResult: unknown = null;
  for (const line of lines) {
    if (line.startsWith("data:")) {
      const data = line.slice(5).trim();
      if (data && data !== "[DONE]") {
        try {
          lastResult = JSON.parse(data);
        } catch {
          // ignore non-JSON data lines
        }
      }
    }
  }
  return lastResult ?? { error: "No valid data in SSE stream" };
}
