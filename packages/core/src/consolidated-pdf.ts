import type { ConsolidatedReport } from "./consolidated.js";
import { consolidatedCounts } from "./consolidated.js";
/** Versioned, draft-only renderer. No inferred units, results, signatures or accreditation. */
export async function consolidatedPdf(report: ConsolidatedReport) {
  if (report.snapshot.template.version !== "1.0")
    throw new Error("Unsupported report template version");
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const C = {
    ink: rgb(0.09, 0.16, 0.2),
    muted: rgb(0.38, 0.45, 0.49),
    teal: rgb(0.04, 0.35, 0.34),
    mint: rgb(0.91, 0.96, 0.94),
    line: rgb(0.84, 0.89, 0.88),
    light: rgb(0.96, 0.97, 0.97),
    amber: rgb(0.6, 0.35, 0.1),
  };
  const W = 595.28,
    H = 841.89,
    M = 44,
    B = 752;
  let page = pdf.addPage([W, H]),
    y = 110;
  const ascii = (s: unknown) =>
    String(s ?? "").replace(
      /[^\x20-\x7e]/g,
      (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
    );
  const text = (
    s: unknown,
    x: number,
    top: number,
    size = 10,
    strong = false,
    color = C.ink,
  ) =>
    page.drawText(ascii(s), {
      x,
      y: H - top - size,
      size,
      font: strong ? bold : regular,
      color,
    });
  const rect = (
    x: number,
    top: number,
    w: number,
    h: number,
    color = C.light,
  ) => page.drawRectangle({ x, y: H - top - h, width: w, height: h, color });
  const line = (top: number) =>
    page.drawLine({
      start: { x: M, y: H - top },
      end: { x: W - M, y: H - top },
      color: C.line,
      thickness: 0.6,
    });
  const wrap = (value: unknown, width: number, size = 10, strong = false) => {
    const result: string[] = [];
    const font = strong ? bold : regular;
    for (const raw of String(value ?? "").split("\n")) {
      let current = "";
      for (const token of ascii(raw).match(/\s+|\S+/g) ?? [""]) {
        if (font.widthOfTextAtSize(current + token, size) <= width) {
          current += token;
          continue;
        }
        if (current) {
          result.push(current);
          current = "";
        }
        for (const c of token) {
          if (font.widthOfTextAtSize(current + c, size) > width && current) {
            result.push(current);
            current = "";
          }
          current += c;
        }
      }
      result.push(current);
    }
    return result;
  };
  const header = (label: string) => {
    rect(0, 0, W, 7, C.teal);
    text(report.snapshot.template.laboratory, M, 26, 12, true, C.teal);
    text(label, M, 49, 8, false, C.muted);
    text(
      report.status === "draft" ? "DRAFT FOR REVIEW" : "DRAFT / " + report.status.toUpperCase(),
      W - 170,
      28,
      9,
      true,
      C.amber,
    );
    line(76);
    y = 103;
  };
  const next = (label = "CONSOLIDATED TEST RECORD") => {
    page = pdf.addPage([W, H]);
    header(label);
  };
  const ensure = (height: number) => {
    if (y + height > B) next("CONSOLIDATED TEST RECORD / CONTINUED");
  };
  const heading = (s: string, n?: string) => {
    ensure(80);
    if (n) text(n, M, y, 10, true, C.teal);
    text(s, n ? M + 31 : M, y, 18, true);
    y += 35;
  };
  const paragraph = (s: unknown, size = 10, color = C.muted) => {
    for (const l of wrap(s, W - M * 2, size)) {
      ensure(size + 7);
      text(l, M, y, size, false, color);
      y += size + 6;
    }
    y += 9;
  };
  const row = (label: string, value: unknown) => {
    const lines = wrap(value, 335, 10);
    let offset = 0;
    do {
      const labelLines = wrap(label + (offset ? " (cont.)" : ""), 132, 9, true);
      ensure(Math.max(38, labelLines.length * 12 + 16));
      const take = Math.max(
        1,
        Math.min(lines.length - offset, Math.floor((B - y - 16) / 15)),
      );
      const height = Math.max(take * 15, labelLines.length * 12) + 16;
      rect(M, y, W - 2 * M, height, offset % 2 ? C.light : C.mint);
      labelLines.forEach((s, i) =>
        text(s, M + 12, y + 8 + i * 12, 9, true, C.teal),
      );
      lines
        .slice(offset, offset + take)
        .forEach((s, i) => text(s, M + 160, y + 8 + i * 15, 10));
      y += height + 3;
      offset += take;
    } while (offset < lines.length);
  };
  header(
    "REPORT TEMPLATE " +
      report.snapshot.template.version +
      " / CONTROLLED DRAFT",
  );
  text("LABORATORY", M, 116, 11, true, C.teal);
  text("Consolidated", M, 148, 35, true);
  text("test report", M, 190, 35, true);
  y = 250;
  paragraph(report.snapshot.title, 15, C.ink);
  const counts = consolidatedCounts(report.snapshot);
  const cardW = (W - 2 * M - 20) / 3;
  [
    ["SAMPLES", counts.samples],
    ["TESTS INCLUDED", counts.tests],
    ["OBSERVATIONS AUTHORIZED", counts.authorized],
  ].forEach(([label, value], i) => {
    const x = M + i * (cardW + 10);
    rect(x, y, cardW, 76, C.mint);
    text(label, x + 12, y + 12, 7, true, C.teal);
    text(value, x + 12, y + 31, 25, true, C.ink);
  });
  y += 101;
  row("REPORT / REVISION", report.number + " / R" + report.revision);
  row("CLIENT", report.snapshot.client.name);
  row(
    "PROJECT / SITE",
    report.snapshot.request.project + " / " + report.snapshot.request.site,
  );
  row("REQUEST", report.snapshot.request.number);
  row("CAPTURED AT", report.snapshot.capturedAt);
  y += 14;
  paragraph("DRAFT - NOT VALID FOR LABORATORY USE", 11, C.amber);
  paragraph(
    "Formula validation and final report issuance are pending. This document records selected observations and their review state at capture. It contains no validated test results or conformity decision.",
    10,
  );
  next("CLIENT & REPORT SCOPE");
  heading("Client & project", "01");
  row("CLIENT", report.snapshot.client.name);
  row("CONTACT", report.snapshot.client.contact);
  row(
    "EMAIL / PHONE",
    report.snapshot.client.email + " / " + report.snapshot.client.phone,
  );
  row("ADDRESS", report.snapshot.client.address);
  row("PROJECT", report.snapshot.request.project);
  row("SITE", report.snapshot.request.site);
  row("REQUESTED TESTS", report.snapshot.request.requestedTests);
  row("REQUEST DUE DATE", report.snapshot.request.dueDate);
  y += 15;
  heading("Scope & notes");
  paragraph(
    report.snapshot.summary ||
      "This draft includes only the samples and tests listed in the following schedule.",
  );
  paragraph(
    "Prepared by: " +
      report.snapshot.preparedBy +
      ". Creation / revision reason: " +
      report.reason,
  );
  paragraph(
    "Each test section preserves recorded values without adding units, rounding, calculated results or acceptance limits. Missing information is explicitly identified.",
  );
  next("SELECTED TEST SCHEDULE");
  heading("Tests in this report", "02");
  paragraph(
    counts.tests +
      " tests across " +
      counts.samples +
      " samples. " +
      counts.missingObservations +
      " tests have no observation values.",
  );
  report.snapshot.tests.forEach((t, i) => {
    row(
      String(i + 1).padStart(2, "0") + " / " + t.sampleNumber,
      t.method +
        " | " +
        t.material +
        " | " +
        t.assignmentNumber +
        " | " +
        t.status.replaceAll("_", " "),
    );
  });
  report.snapshot.tests.forEach((t, i) => {
    next("TEST " + String(i + 1).padStart(2, "0") + " / " + t.sampleNumber);
    heading(
      t.method.length > 48 ? "Test details" : t.method,
      String(i + 1).padStart(2, "0"),
    );
    if (t.method.length > 48) paragraph(t.method, 13, C.ink);
    row("SAMPLE", t.sampleNumber + " / " + t.description);
    row("MATERIAL / RECEIPT", t.material + " / " + t.receiptStatus);
    row("CONDITION / STORAGE", t.condition + " / " + t.storage);
    row("METHOD VERSION", t.methodVersion);
    row("ASSIGNMENT / VERSION", t.assignmentNumber + " / " + t.version);
    row("REVIEW STATE", t.status.replaceAll("_", " "));
    row("EQUIPMENT", t.equipment || "Not recorded");
    y += 15;
    heading("Recorded observations");
    const entries = Object.entries(t.observations);
    if (!entries.length) paragraph("No observations recorded.", 10, C.amber);
    entries.forEach(([key, value]) =>
      row(key, value === "" ? "[empty value]" : value),
    );
    y += 12;
    heading("Result status");
    paragraph(
      "Pending approved formula and laboratory validation. No calculated result, unit, limit or pass/fail conclusion is issued.",
      10,
      C.amber,
    );
    row("TECHNICIAN", t.technician || "Not recorded");
    row("REVIEWER", t.reviewer || "Not reviewed");
    row("SIGNATORY", t.signatory || "Not authorized");
  });
  next("REVIEW TRAIL & DOCUMENT CONTROL");
  heading("Review & document control", "03");
  row(
    "TEMPLATE",
    report.snapshot.template.name +
      " / " +
      report.snapshot.template.id +
      " / v" +
      report.snapshot.template.version,
  );
  row(
    "DOCUMENT",
    report.number + " / Revision " + report.revision + " / " + report.status,
  );
  row("PREPARED BY", report.snapshot.preparedBy);
  row("CAPTURED AT", report.snapshot.capturedAt);
  row("REASON", report.reason);
  y += 18;
  heading("Release status");
  paragraph("NOT ISSUED - DRAFT FOR REVIEW", 12, C.amber);
  paragraph(
    "Recorded reviewer and signatory names describe the observation workflow only. They are not digital signatures or approval of a final laboratory report. This draft is not intended for certification, compliance or acceptance decisions.",
  );
  paragraph(
    "Source records can change after this snapshot. Create a new revision to include updated observations; previous versions remain available.",
  );
  paragraph(
    "Non-ASCII characters and embedded control characters are represented as Unicode escapes to preserve the original data visibly. Original values are retained in the stored snapshot.",
    8,
  );
  y += 16;
  line(y);
  y += 18;
  paragraph("END OF CONSOLIDATED DRAFT", 10, C.teal);
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    page = p;
    line(786);
    text(report.number + " / R" + report.revision, M, 798, 8, true, C.muted);
    text(
      "DRAFT - NOT VALID FOR LABORATORY USE",
      M + 137,
      798,
      7,
      true,
      C.amber,
    );
    text(i + 1 + " / " + pages.length, W - M - 35, 798, 8, false, C.muted);
  });
  pdf.setTitle(report.snapshot.title);
  pdf.setAuthor(report.snapshot.template.laboratory);
  pdf.setSubject("Consolidated draft observation report");
  return pdf.save();
}
