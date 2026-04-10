/**
 * 网页抓取工具（本地执行，无需外部 API key）
 *
 * 通过服务端代理（/api/fetch-url）抓取页面，避免浏览器跨域限制。
 * 支持两种返回格式：
 *   - raw：原始 HTML/文本
 *   - md（默认）：将 HTML 转为 Markdown（使用 turndown，本地运行）
 *
 * 二进制文件（图片/视频/PDF 等）将返回错误。
 */

import { LocalTool } from "./types";

/** 返回内容最大字符数，超出后截断并提示 AI */
const MAX_CHARS_MD = 20000;
const MAX_CHARS_RAW = 60000;

export const fetchWebpageTool: LocalTool = {
  type: "local",
  name: "fetch_webpage",
  displayName: "抓取网页",
  description:
    "抓取指定 URL 的网页内容并返回给 AI。适合需要读取某篇文章、文档、商品页面或任意公开网页的场景。" +
    "不支持需要登录的页面和二进制文件（图片/PDF/视频等）。" +
    "默认返回 Markdown 格式，也可指定 raw 返回原始 HTML。",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "要抓取的完整 URL，必须以 http:// 或 https:// 开头",
      },
      format: {
        type: "string",
        enum: ["md", "raw"],
        description:
          "返回格式：md（默认，将 HTML 转为 Markdown，更适合 AI 阅读）；raw（返回原始 HTML/文本）",
        default: "md",
      },
    },
    required: ["url"],
  },

  execute: async (args) => {
    const url = args.url as string;
    const format = (args.format as string) ?? "md";

    // 构造 API 地址（与 openai.ts / mcp-client.ts 保持一致的环境变量用法）
    const BASE_URL = process.env.BASE_URL;
    const mode = process.env.BUILD_MODE;
    const apiBase = (mode === "export" ? (BASE_URL ?? "") : "") + "/api";

    const res = await fetch(`${apiBase}/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = (await res.json()) as {
      content?: string;
      contentType?: string;
      url?: string;
      error?: string;
    };

    if (data.error) {
      throw new Error(data.error);
    }

    const html = data.content ?? "";
    const finalUrl = data.url ?? url;

    if (format === "raw") {
      const truncated =
        html.length > MAX_CHARS_RAW ? html.slice(0, MAX_CHARS_RAW) : html;
      const note =
        html.length > MAX_CHARS_RAW
          ? `\n\n[内容已截断，原始长度 ${html.length} 字符，仅返回前 ${MAX_CHARS_RAW} 字符]`
          : "";
      return `URL: ${finalUrl}\nContent-Type: ${data.contentType ?? ""}\n\n${truncated}${note}`;
    }

    // md 格式：用 turndown 将 HTML 转为 Markdown
    const TurndownService = (await import("turndown")).default;
    const td = new TurndownService({
      headingStyle: "atx",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
    });

    // 移除脚本、样式、导航等无关节点
    td.remove([
      "script",
      "style",
      "noscript",
      "nav",
      "header",
      "footer",
      "aside",
    ]);

    let md: string;
    try {
      md = td.turndown(html);
    } catch {
      // 如果不是 HTML（纯文本/JSON），直接返回原文
      md = html;
    }

    const truncated = md.length > MAX_CHARS_MD ? md.slice(0, MAX_CHARS_MD) : md;
    const note =
      md.length > MAX_CHARS_MD
        ? `\n\n[内容已截断，转换后 ${md.length} 字符，仅返回前 ${MAX_CHARS_MD} 字符]`
        : "";

    return `URL: ${finalUrl}\n\n${truncated}${note}`;
  },
};
