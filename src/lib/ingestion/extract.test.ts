import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { extractText, UnsupportedDocumentError } from "./extract";

async function realPdf(lines: string[]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let y = page.getHeight() - 50;
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 14, font });
    y -= 20;
  }
  return Buffer.from(await pdf.save());
}

async function realDocx(paragraphs: string[]): Promise<Buffer> {
  const doc = new Document({
    sections: [{ children: paragraphs.map((text) => new Paragraph({ children: [new TextRun(text)] })) }],
  });
  return Packer.toBuffer(doc);
}

describe("extractText", () => {
  it("extracts plain text unchanged", async () => {
    const text = await extractText(Buffer.from("Hello, world.\nSecond line."), "text/plain");
    expect(text).toBe("Hello, world.\nSecond line.");
  });

  it("extracts markdown as plain text (no markup stripping - the raw source is what gets chunked)", async () => {
    const text = await extractText(Buffer.from("# Heading\n\nSome **bold** text."), "text/markdown");
    expect(text).toContain("Heading");
    expect(text).toContain("bold");
  });

  it("extracts real text from a real, genuinely-encoded PDF", async () => {
    const pdf = await realPdf(["Refund Policy", "Refunds are processed within seven business days."]);
    const text = await extractText(pdf, "application/pdf");
    expect(text).toContain("Refund Policy");
    expect(text).toContain("seven business days");
  });

  it("extracts real text from a real, genuinely-encoded DOCX", async () => {
    const docx = await realDocx(["Onboarding Guide", "New hires get access within one business day."]);
    const text = await extractText(docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(text).toContain("Onboarding Guide");
    expect(text).toContain("one business day");
  });

  it("rejects an unsupported content type", async () => {
    await expect(extractText(Buffer.from("data"), "image/png")).rejects.toBeInstanceOf(UnsupportedDocumentError);
  });

  it("rejects a PDF-typed buffer that isn't actually a valid PDF, instead of crashing", async () => {
    await expect(extractText(Buffer.from("not a real pdf"), "application/pdf")).rejects.toThrow();
  });
});
