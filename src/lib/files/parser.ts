import { readFile } from "fs/promises";
import { PDFParse } from "pdf-parse";
import * as cheerio from "cheerio";

export type FileType = "pdf" | "txt" | "md" | "html";

export interface ParsedFile {
  type: FileType;
  filename: string;
  sizeBytes: number;
  text: string;
  meta: {
    pages?: number;        // PDF
    title?: string;         // HTML <title>
    headings?: string[];    // 提取的标题
    wordCount: number;
    charCount: number;
  };
}

export function inferFileType(filename: string): FileType | null {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "pdf") return "pdf";
  if (ext === "txt") return "txt";
  if (ext === "md" || ext === "markdown") return "md";
  if (ext === "html" || ext === "htm") return "html";
  return null;
}

export async function parseFile(filepath: string, originalFilename: string): Promise<ParsedFile> {
  const type = inferFileType(originalFilename);
  if (!type) {
    throw new Error(`不支持的文件类型: ${originalFilename}`);
  }

  const buffer = await readFile(filepath);
  let text = "";
  let meta: ParsedFile["meta"] = { wordCount: 0, charCount: 0 };

  switch (type) {
    case "txt":
    case "md":
      text = buffer.toString("utf-8");
      meta = extractMeta(text);
      break;

    case "html": {
      const html = buffer.toString("utf-8");
      const $ = cheerio.load(html);
      // 移除脚本、样式、注释
      $("script, style, noscript, iframe").remove();
      // 提取标题
      const title = $("title").first().text().trim() || undefined;
      // 提取正文(优先 main / article,否则 body)
      const mainEl = $("main, article").first();
      const bodyEl = mainEl.length ? mainEl : $("body");
      text = bodyEl.text().replace(/\s+/g, " ").trim();
      // 提取所有标题做"结构提示"
      const headings: string[] = [];
      $("h1, h2, h3").each((_, el) => {
        const t = $(el).text().trim();
        if (t) headings.push(t);
      });
      meta = { ...extractMeta(text), title, headings: headings.slice(0, 20) };
      break;
    }

    case "pdf": {
      // pdf-parse v2:用 PDFParse 类
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      text = result.text;
      // v2 result.pages 是 PageTextResult[],长度就是页数
      const pageCount = Array.isArray(result.pages) ? result.pages.length : (result.total || 0);
      meta = { ...extractMeta(text), pages: pageCount };
      parser.destroy();
      break;
    }
  }

  return {
    type,
    filename: originalFilename,
    sizeBytes: buffer.length,
    text,
    meta,
  };
}

function extractMeta(text: string): ParsedFile["meta"] {
  const trimmed = text.trim();
  // 中文按字符,英文按单词
  const cjkChars = (trimmed.match(/[一-鿿]/g) || []).length;
  const enWords = (trimmed.match(/[a-zA-Z]+/g) || []).length;
  return {
    wordCount: cjkChars + enWords,
    charCount: trimmed.length,
  };
}

/** 把多个文件内容拼成一段"参考资料"——给事实核查用 */
export function concatFilesAsContext(files: ParsedFile[]): string {
  if (files.length === 0) return "";
  const blocks = files.map((f, i) => {
    const head = `[参考文件 ${i + 1}] ${f.filename} (${f.meta.pages ? f.meta.pages + " 页 · " : ""}${f.meta.wordCount} 字)`;
    const tail = f.text.length > 3000 ? f.text.slice(0, 3000) + "\n...(截断)" : f.text;
    return `${head}\n${tail}`;
  });
  return blocks.join("\n\n");
}