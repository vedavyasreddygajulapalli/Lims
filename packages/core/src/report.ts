export interface DraftSnapshot {
  assignmentNumber: string;
  sampleNumber: string;
  method: string;
  methodVersion: string;
  observations: Record<string, string>;
  technician: string;
  reviewer: string;
  signatory: string;
}
export interface DraftReport {
  number: string;
  revision: number;
  status: string;
  createdAt: string;
  snapshot: DraftSnapshot;
  reason: string;
}
/** Always a draft; never represents an accredited report or validated result. */
export async function draftReportPdf(report: DraftReport) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ascii = (s: string) =>
    s.replace(
      /[^\x20-\x7E]/g,
      (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
    );
  const lines = [
    `Report: ${report.number}  Revision: ${report.revision}`,
    `State: ${report.status}  Created: ${report.createdAt}`,
    `Assignment: ${report.snapshot.assignmentNumber}`,
    `Sample: ${report.snapshot.sampleNumber}`,
    `Method: ${report.snapshot.method} (${report.snapshot.methodVersion})`,
    "",
    `Technician: ${report.snapshot.technician}`,
    `Reviewer: ${report.snapshot.reviewer}`,
    `Signatory: ${report.snapshot.signatory}`,
    "",
    "Original observation values:",
    ...Object.entries(report.snapshot.observations).flatMap(([k, v]) => [
      `${k}: ${v}`,
    ]),
    "",
    `Revision / creation reason: ${report.reason}`,
    "",
    "No validated calculation results are included.",
    "This draft must not be used as a laboratory test report.",
  ];
  const wrapped = lines.flatMap((line) => {
    const s = ascii(line);
    const parts: string[] = [];
    let part = "";
    for (const char of s) {
      if (font.widthOfTextAtSize(part + char, 10) > 505) {
        parts.push(part);
        part = "";
      }
      part += char;
    }
    parts.push(part);
    return parts;
  });
  let pageIndex = 0;
  while (wrapped.length) {
    pageIndex++;
    const page = pdf.addPage([595, 842]);
    page.drawText("SRI SAINATH LABORATORY", {
      x: 45,
      y: 790,
      size: 16,
      font: bold,
      color: rgb(0.13, 0.35, 0.28),
    });
    page.drawText("DRAFT - NOT VALID FOR LABORATORY USE", {
      x: 45,
      y: 762,
      size: 12,
      font: bold,
      color: rgb(0.7, 0.25, 0.18),
    });
    page.drawLine({
      start: { x: 45, y: 748 },
      end: { x: 550, y: 748 },
      color: rgb(0.8, 0.85, 0.8),
    });
    wrapped
      .splice(0, 43)
      .forEach((line, i) =>
        page.drawText(line, { x: 45, y: 725 - i * 15, size: 10, font }),
      );
    page.drawText(
      `Draft snapshot | Page ${pageIndex} | Non-ASCII characters use Unicode escapes`,
      { x: 45, y: 37, size: 8, font },
    );
  }
  return pdf.save();
}
