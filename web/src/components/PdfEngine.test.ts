// @vitest-environment node
import { it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
it("parses actual multipage PDFs and rejects malformed input", async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage().drawText("Exact observation 001.2300", { font });
  pdf.addPage().drawText("Second page", { font });
  const task = getDocument({ data: await pdf.save(), useSystemFonts: true });
  try {
    const doc = await task.promise;
    expect(doc.numPages).toBe(2);
    const text = await (await doc.getPage(1)).getTextContent();
    expect(
      text.items.some((i: any) => i.str === "Exact observation 001.2300"),
    ).toBe(true);
  } finally {
    await task.destroy();
  }
  const invalid = getDocument({ data: new TextEncoder().encode("not a pdf") });
  try {
    await expect(invalid.promise).rejects.toThrow();
  } finally {
    await invalid.destroy();
  }
});
