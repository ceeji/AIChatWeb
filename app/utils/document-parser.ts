/**
 * Document parser: converts uploaded files (md, pdf, docx, pptx) to Markdown text
 * for attaching to chat messages. All parsing is done client-side.
 */

export const MAX_PARSED_CHARS = 100_000;

export type ParseProgress = {
  phase: "reading" | "parsing";
  /** 0–1 */
  ratio: number;
};

export type ParseResult = {
  content: string;
  parsedChars: number;
  truncated: boolean;
};

// ─────────────────────────────────────────────
// Individual parsers
// ─────────────────────────────────────────────

async function parseMarkdown(file: File): Promise<ParseResult> {
  const text = await file.text();
  return truncate(text);
}

async function parsePdf(
  file: File,
  onProgress?: (p: ParseProgress) => void,
): Promise<ParseResult> {
  onProgress?.({ phase: "reading", ratio: 0 });

  // Dynamic import so pdfjs-dist is not in the initial bundle
  const pdfjsLib = await import("pdfjs-dist");

  // Use local worker file served from /public — no CDN dependency
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  onProgress?.({ phase: "parsing", ratio: 0 });

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const parts: string[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/ +/g, " ")
      .trim();
    if (pageText) {
      parts.push(`## Page ${i}\n\n${pageText}`);
    }
    onProgress?.({ phase: "parsing", ratio: i / totalPages });
  }

  return truncate(parts.join("\n\n"));
}

async function parseDocx(
  file: File,
  onProgress?: (p: ParseProgress) => void,
): Promise<ParseResult> {
  onProgress?.({ phase: "reading", ratio: 0.2 });

  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();

  onProgress?.({ phase: "parsing", ratio: 0.5 });

  // extractRawText gives clean plain text without HTML noise
  const result = await mammoth.extractRawText({ arrayBuffer });

  onProgress?.({ phase: "parsing", ratio: 1 });

  return truncate(result.value);
}

async function parsePptx(
  file: File,
  onProgress?: (p: ParseProgress) => void,
): Promise<ParseResult> {
  onProgress?.({ phase: "reading", ratio: 0.1 });

  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  // Collect slide files sorted by slide number
  const slideEntries = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)![0]);
      const nb = parseInt(b.match(/\d+/)![0]);
      return na - nb;
    });

  const parts: string[] = [];
  const total = slideEntries.length;

  for (let i = 0; i < total; i++) {
    const xml = await zip.files[slideEntries[i]].async("string");
    // Extract all <a:t> text nodes
    const texts: string[] = [];
    const re = /<a:t[^>]*>([^<]*)<\/a:t>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
      const t = m[1].trim();
      if (t) texts.push(t);
    }
    if (texts.length > 0) {
      parts.push(`## Slide ${i + 1}\n\n${texts.join(" ")}`);
    }
    onProgress?.({ phase: "parsing", ratio: (i + 1) / total });
  }

  return truncate(parts.join("\n\n"));
}

async function parseCsv(file: File): Promise<ParseResult> {
  const text = await file.text();
  return truncate(text);
}

async function parseExcel(
  file: File,
  onProgress?: (p: ParseProgress) => void,
): Promise<ParseResult> {
  onProgress?.({ phase: "reading", ratio: 0.2 });

  // Dynamic import keeps xlsx out of the initial bundle
  const XLSX = await import("xlsx");

  const arrayBuffer = await file.arrayBuffer();
  onProgress?.({ phase: "parsing", ratio: 0.5 });

  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  const parts: string[] = [];
  const sheetNames = workbook.SheetNames;

  sheetNames.forEach((name, idx) => {
    const sheet = workbook.Sheets[name];
    // Convert each sheet to CSV
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim()) {
      parts.push(`## Sheet: ${name}\n\n${csv}`);
    }
    onProgress?.({
      phase: "parsing",
      ratio: 0.5 + 0.5 * ((idx + 1) / sheetNames.length),
    });
  });

  return truncate(parts.join("\n\n"));
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function truncate(text: string): ParseResult {
  const clean = text.trim();
  if (clean.length <= MAX_PARSED_CHARS) {
    return { content: clean, parsedChars: clean.length, truncated: false };
  }
  const truncated = clean.slice(0, MAX_PARSED_CHARS);
  return { content: truncated, parsedChars: MAX_PARSED_CHARS, truncated: true };
}

function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

// ─────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────

export async function parseDocument(
  file: File,
  onProgress?: (p: ParseProgress) => void,
): Promise<ParseResult> {
  const ext = getExtension(file.name);

  switch (ext) {
    case "md":
    case "markdown":
    case "txt":
      return parseMarkdown(file);
    case "pdf":
      return parsePdf(file, onProgress);
    case "docx":
      return parseDocx(file, onProgress);
    case "pptx":
      return parsePptx(file, onProgress);
    case "csv":
      return parseCsv(file);
    case "xlsx":
    case "xls":
      return parseExcel(file, onProgress);
    default:
      throw new Error(`Unsupported file type: .${ext}`);
  }
}

/**
 * Format the document block that gets appended to the prompt.
 * Visible to the LLM, hidden from the user UI via attr.userText.
 */
export function formatDocumentBlock(
  filename: string,
  content: string,
  truncated: boolean,
): string {
  const truncatedNote = truncated
    ? "\n\n> ⚠️ 内容过长，已截断至前10万字。"
    : "";
  return `[附件: ${filename}]\n\n${content}${truncatedNote}`;
}
