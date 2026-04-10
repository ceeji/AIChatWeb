/**
 * Markdown 转 Word 文档工具
 *
 * 使用 docx 库将 Markdown 内容转换为 .docx 格式，触发浏览器下载。
 * 使用动态导入避免 SSR 构建问题。
 */

import { LocalTool } from "./types";

export const markdownToWordTool: LocalTool = {
  type: "local",
  name: "markdown_to_word",
  displayName: "生成 Word 文档",
  description:
    "将 Markdown 格式的文本转换为 Word（.docx）文件并触发浏览器下载。当用户要求将内容生成/导出/下载为 Word 文档时使用。",
  parameters: {
    type: "object",
    properties: {
      markdown: {
        type: "string",
        description: "要转换的完整 Markdown 内容",
      },
      filename: {
        type: "string",
        description: "下载文件名（不含扩展名），默认为 document",
        default: "document",
      },
    },
    required: ["markdown"],
  },
  execute: async (args) => {
    const markdown = String(args.markdown ?? "");
    const filename = String(args.filename ?? "document").replace(
      /\.docx$/i,
      "",
    );

    if (typeof window === "undefined") {
      return "此工具只能在浏览器端执行。";
    }

    try {
      const {
        Document,
        Paragraph,
        TextRun,
        HeadingLevel,
        Packer,
        BorderStyle,
        ShadingType,
      } = await import("docx");

      const children = buildParagraphs(markdown, {
        Paragraph,
        TextRun,
        HeadingLevel,
        BorderStyle,
        ShadingType,
      });

      const doc = new Document({ sections: [{ children }] });
      const blob = await Packer.toBlob(doc);
      triggerDownload(blob, `${filename}.docx`);

      return `Word 文档"${filename}.docx"已成功生成并开始下载。`;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return `生成 Word 文档时出错：${msg}`;
    }
  },
};

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

type DocxLib = {
  Paragraph: typeof import("docx").Paragraph;
  TextRun: typeof import("docx").TextRun;
  HeadingLevel: typeof import("docx").HeadingLevel;
  BorderStyle: typeof import("docx").BorderStyle;
  ShadingType: typeof import("docx").ShadingType;
};

function buildParagraphs(
  markdown: string,
  lib: DocxLib,
): import("docx").Paragraph[] {
  const { Paragraph, TextRun, HeadingLevel, BorderStyle, ShadingType } = lib;
  const lines = markdown.split("\n");
  const result: import("docx").Paragraph[] = [];
  const headingMap: Record<number, string> = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 代码块 ```
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      result.push(
        new Paragraph({
          children: [
            new TextRun({
              text: codeLines.join("\n"),
              font: "Courier New",
              size: 18,
            }),
          ],
          border: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          },
        }),
      );
      continue;
    }

    // 标题
    const hm = line.match(/^(#{1,6})\s+(.+)/);
    if (hm) {
      result.push(
        new Paragraph({
          text: hm[2],
          heading: (headingMap[hm[1].length] ?? HeadingLevel.HEADING_1) as any,
        }),
      );
      i++;
      continue;
    }

    // 水平线
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      result.push(
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" },
          },
        }),
      );
      i++;
      continue;
    }

    // 无序列表
    const ul = line.match(/^(\s*)[*\-+]\s+(.+)/);
    if (ul) {
      result.push(
        new Paragraph({
          children: inlineStyles(ul[2], TextRun, ShadingType),
          bullet: { level: Math.floor(ul[1].length / 2) },
        }),
      );
      i++;
      continue;
    }

    // 有序列表
    const ol = line.match(/^(\s*)\d+\.\s+(.+)/);
    if (ol) {
      result.push(
        new Paragraph({
          children: inlineStyles(ol[2], TextRun, ShadingType),
          numbering: {
            reference: "default-numbering",
            level: Math.floor(ol[1].length / 2),
          },
        }),
      );
      i++;
      continue;
    }

    // 空行
    if (line.trim() === "") {
      result.push(new Paragraph({ text: "" }));
      i++;
      continue;
    }

    // 普通段落
    result.push(
      new Paragraph({ children: inlineStyles(line, TextRun, ShadingType) }),
    );
    i++;
  }

  return result;
}

function inlineStyles(
  text: string,
  TextRun: typeof import("docx").TextRun,
  ShadingType: typeof import("docx").ShadingType,
): import("docx").TextRun[] {
  const runs: import("docx").TextRun[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index) }));
    }
    const token = match[0];
    if (token.startsWith("`")) {
      runs.push(
        new TextRun({
          text: token.slice(1, -1),
          font: "Courier New",
          size: 18,
          shading: { type: ShadingType.CLEAR, fill: "F5F5F5" },
        }),
      );
    } else if (token.startsWith("**")) {
      runs.push(new TextRun({ text: token.slice(2, -2), bold: true }));
    } else {
      runs.push(new TextRun({ text: token.slice(1, -1), italics: true }));
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex) }));
  }
  if (runs.length === 0) {
    runs.push(new TextRun({ text }));
  }
  return runs;
}
