/**
 * 生成任意文件并触发浏览器下载工具
 *
 * AI 生成任意文本内容（代码、数据、配置文件、CSV、JSON 等），
 * 通过此工具将内容打包为对应格式的文件触发浏览器下载。
 * 用户需在浏览器中找到下载提示完成保存。
 */

import { LocalTool } from "./types";

/** 根据文件名扩展自动猜测 MIME 类型 */
function guessMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const mimeMap: Record<string, string> = {
    // 文本 / 代码
    txt: "text/plain",
    md: "text/markdown",
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    js: "text/javascript",
    ts: "text/typescript",
    jsx: "text/javascript",
    tsx: "text/typescript",
    mjs: "text/javascript",
    cjs: "text/javascript",
    json: "application/json",
    jsonl: "application/jsonlines",
    xml: "text/xml",
    svg: "image/svg+xml",
    yaml: "text/yaml",
    yml: "text/yaml",
    toml: "text/toml",
    ini: "text/plain",
    conf: "text/plain",
    env: "text/plain",
    sh: "text/x-sh",
    bash: "text/x-sh",
    py: "text/x-python",
    rb: "text/x-ruby",
    go: "text/x-go",
    rs: "text/x-rust",
    java: "text/x-java",
    c: "text/x-c",
    cpp: "text/x-c++",
    h: "text/x-c",
    cs: "text/x-csharp",
    php: "text/x-php",
    sql: "text/x-sql",
    r: "text/x-r",
    swift: "text/x-swift",
    kt: "text/x-kotlin",
    dart: "text/x-dart",
    lua: "text/x-lua",
    // 数据
    csv: "text/csv",
    tsv: "text/tab-separated-values",
    // 其他文本型
    log: "text/plain",
    diff: "text/x-diff",
    patch: "text/x-diff",
    tex: "text/x-tex",
    latex: "text/x-latex",
    scss: "text/x-scss",
    sass: "text/x-sass",
    less: "text/x-less",
    graphql: "application/graphql",
    proto: "text/plain",
    dockerfile: "text/plain",
  };
  return mimeMap[ext] ?? "text/plain";
}

export const generateAndDownloadFileTool: LocalTool = {
  type: "local",
  name: "generate_and_download_file",
  displayName: "生成并下载文件",
  description:
    "将 AI 生成的任意文本内容保存为指定格式的文件，触发浏览器下载。" +
    "适用于代码文件（.ts/.py/.go 等）、数据文件（.csv/.json/.yaml 等）、" +
    "配置文件（.env/.toml/.ini 等）、SVG 图形、HTML 页面等任何文本内容。" +
    "注意：此工具仅支持文本内容，不支持二进制数据。" +
    "对于 Word 文档请使用 markdown_to_word 工具；对于图片请使用 html_svg_to_image 工具。",
  parameters: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "文件的完整文本内容，直接写入文件，不做任何转换。",
      },
      filename: {
        type: "string",
        description:
          "下载文件的完整文件名，必须包含扩展名，例如：script.py、data.csv、config.yaml、index.html。" +
          "文件名决定浏览器保存时的默认名称，也用于自动判断 MIME 类型。",
      },
      mime_type: {
        type: "string",
        description:
          "（可选）文件 MIME 类型，如 text/plain、text/csv、application/json。" +
          "不填时根据文件名扩展名自动判断。",
      },
    },
    required: ["content", "filename"],
  },

  execute: async (args) => {
    if (typeof window === "undefined") {
      return "此工具只能在浏览器端执行。";
    }

    const content = String(args.content ?? "");
    const filename = String(args.filename ?? "file.txt").trim();
    const mimeType =
      String(args.mime_type ?? "").trim() || guessMimeType(filename);

    if (!filename) {
      return "filename 参数不能为空。";
    }

    try {
      const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);

      const sizeKb = (blob.size / 1024).toFixed(1);

      return (
        `文件"${filename}"（${sizeKb} KB，${mimeType}）已生成，浏览器正在触发下载。` +
        `\n\n请提示用户：` +
        `\n- 电脑浏览器：请查看浏览器右上角或底部状态栏，会出现下载提示，点击即可保存文件。` +
        `\n- 手机浏览器：请查看浏览器顶部/底部的下载通知或弹窗，点击"下载"或"保存"按钮完成保存。` +
        `\n- 如果浏览器没有弹出下载提示，可能是被拦截，请检查浏览器的弹窗/下载权限设置。`
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return `文件生成失败：${msg}`;
    }
  },
};
