/**
 * 服务端网页抓取代理
 *
 * 浏览器无法直接跨域请求，通过此服务端路由代理抓取，
 * 同时做基础 SSRF 防护（仅允许公网 http/https）。
 */

import { NextRequest, NextResponse } from "next/server";

/** 视为二进制、不可读取的 Content-Type 前缀 */
const BINARY_PREFIXES = [
  "image/",
  "video/",
  "audio/",
  "application/pdf",
  "application/zip",
  "application/x-",
  "application/octet-stream",
  "font/",
];

/** 私有/回环 IP 段（SSRF 防护） */
const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

function isPrivateHost(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some((p) => p.test(hostname));
}

export async function POST(req: NextRequest) {
  let url: string;
  try {
    ({ url } = await req.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 },
    );
  }

  // 验证 URL 格式与协议
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json(
      { error: "Only http and https protocols are supported" },
      { status: 400 },
    );
  }

  // SSRF 防护：禁止访问私有/回环地址
  if (isPrivateHost(parsed.hostname)) {
    return NextResponse.json(
      { error: "Access to private/internal addresses is not allowed" },
      { status: 403 },
    );
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s 超时

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AIChatBot/1.0; +https://github.com/Nanjiren01/AIChatWeb)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type") ?? "";

    // 检测二进制内容
    const isBinary = BINARY_PREFIXES.some((prefix) =>
      contentType.toLowerCase().includes(prefix),
    );
    if (isBinary) {
      return NextResponse.json(
        {
          error: `Binary content not supported (Content-Type: ${contentType})`,
        },
        { status: 415 },
      );
    }

    const content = await response.text();

    return NextResponse.json({
      content,
      contentType,
      status: response.status,
      url: response.url, // 实际 URL（可能经过重定向）
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error
        ? e.name === "AbortError"
          ? "Request timed out (15s)"
          : e.message
        : "Fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
