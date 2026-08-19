import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export class UnsupportedDocumentError extends Error {}

const PLAIN_TEXT_TYPES = new Set(["text/plain", "text/markdown"]);
const PDF_TYPE = "application/pdf";
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const SUPPORTED_CONTENT_TYPES = [...PLAIN_TEXT_TYPES, PDF_TYPE, DOCX_TYPE];

async function extractPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Real extraction per format, not a placeholder that hands back the raw
 * bytes for anything that isn't plain text - a PDF or .docx's actual
 * readable content is what gets chunked and indexed, since that's what a
 * question is actually asking about.
 */
export async function extractText(buffer: Buffer, contentType: string): Promise<string> {
  if (PLAIN_TEXT_TYPES.has(contentType)) return buffer.toString("utf8");
  if (contentType === PDF_TYPE) return extractPdf(buffer);
  if (contentType === DOCX_TYPE) return extractDocx(buffer);
  throw new UnsupportedDocumentError(`unsupported document type: ${contentType || "unknown"}`);
}
