import type { ReportAppendix } from "./files.js";
export async function appendReportFiles(
  base: Uint8Array,
  reportNumber: string,
  revision: number,
  files: { meta: ReportAppendix; bytes: Uint8Array }[],
) {
  if (!files.length) return base;
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.load(base);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let count = 0;
  for (const { meta, bytes } of files) {
    let pages: any[] = [];
    let img: any;
    if (meta.mime === "application/pdf") {
      const source = await PDFDocument.load(bytes);
      count += source.getPageCount();
      if (count > 100) throw new Error("Appendices exceed 100 pages");
      for (const page of source.getPages())
        if (!page.node.Contents())
          page.drawRectangle({ x: 0, y: 0, width: 1, height: 1, opacity: 0 });
      pages = await pdf.embedPages(source.getPages());
    } else {
      count++;
      if (count > 100) throw new Error("Appendices exceed 100 pages");
      if (meta.mime === "image/png") img = await pdf.embedPng(bytes);
      else if (meta.mime === "image/jpeg") img = await pdf.embedJpg(bytes);
      else throw new Error("Appendices support PDF, PNG and JPG");
      pages = [img];
    }
    for (let i = 0; i < pages.length; i++) {
      const content = pages[i];
      const p = pdf.addPage([595.28, 841.89]);
      const scale = Math.min(507 / content.width, 680 / content.height);
      const w = content.width * scale,
        h = content.height * scale;
      if (img)
        p.drawImage(content, {
          x: (595.28 - w) / 2,
          y: 90 + (680 - h) / 2,
          width: w,
          height: h,
        });
      else
        p.drawPage(content, {
          x: (595.28 - w) / 2,
          y: 90 + (680 - h) / 2,
          width: w,
          height: h,
        });
      const title = (
        "APPENDIX · " +
        meta.name +
        " · v" +
        meta.revision
      ).replace(/[^\x20-\x7e]/g, "?");
      p.drawText(title.slice(0, 85), {
        x: 44,
        y: 800,
        size: 9,
        font,
        color: rgb(0.04, 0.35, 0.34),
      });
      p.drawText("DRAFT - NOT VALID FOR LABORATORY USE", {
        x: 44,
        y: 44,
        size: 10,
        font,
        color: rgb(0.6, 0.35, 0.1),
      });
      p.drawText(
        reportNumber +
          " / R" +
          revision +
          " | Appendix " +
          (i + 1) +
          " of " +
          pages.length,
        { x: 44, y: 27, size: 8, font },
      );
    }
  }
  return pdf.save();
}
