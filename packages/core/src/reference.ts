import { z } from "zod";
/** Historical numeric fixture only. No lab method is approved by this module. */
export const referenceSource = {
  id: "bbmp-cqc-2018-10-01",
  version: "reference-1",
  title: "Concrete cube report · CQC/LW No. 26/2018-19",
  date: "2018-10-01",
  url: "https://account.bbmpgov.in/vssIFMS/Files/BA-L4L4-ifms357-80170049-4-QC11.pdf",
  provenance:
    "Numeric values retrieved from the indexed public report. Direct PDF retrieval timed out. This is an arithmetic reference, not a current method or accreditation assertion.",
  areaMm2: "22500",
  rows: [
    { specimen: "1", loadKn: "519.3", expected: "23.08" },
    { specimen: "2", loadKn: "524.6", expected: "23.32" },
    { specimen: "3", loadKn: "498.3", expected: "22.15" },
  ],
} as const;
const positiveDecimal = z
  .string()
  .regex(
    /^(?:0|[1-9]\d{0,7})(?:\.\d{1,6})?$/,
    "Enter a positive decimal, up to 6 decimal places",
  )
  .refine((v) => /[1-9]/.test(v), "Value must be greater than zero");
export const referenceInput = z
  .object({ loadKn: positiveDecimal, areaMm2: positiveDecimal })
  .strict();
export type ReferenceInput = z.infer<typeof referenceInput>;
function fraction(value: string): [bigint, bigint] {
  const [integer, decimal = ""] = value.split(".");
  return [BigInt(integer + decimal), 10n ** BigInt(decimal.length)];
}
export function referenceStrength(raw: unknown) {
  const input = referenceInput.parse(raw);
  const [load, loadScale] = fraction(input.loadKn);
  const [area, areaScale] = fraction(input.areaMm2);
  const numerator = load * 1000n * areaScale;
  const denominator = loadScale * area;
  // Fixed 2-place half-up display is explicit reference behavior, not a lab rounding policy.
  const scaled = numerator * 100n;
  const rounded = (scaled * 2n + denominator) / (2n * denominator);
  const displayed = `${rounded / 100n}.${String(rounded % 100n).padStart(2, "0")}`;
  return {
    sourceVersion: referenceSource.version,
    input,
    formula: "load (kN) × 1000 ÷ area (mm²)",
    exactNumerator: numerator.toString(),
    exactDenominator: denominator.toString(),
    displayed,
    unit: "N/mm²",
    rounding: "2 decimals · half up",
    referenceOnly: true as const,
  };
}
export function verifyReference() {
  return referenceSource.rows.map((row) => ({
    ...row,
    ...referenceStrength({
      loadKn: row.loadKn,
      areaMm2: referenceSource.areaMm2,
    }),
    matches:
      referenceStrength({
        loadKn: row.loadKn,
        areaMm2: referenceSource.areaMm2,
      }).displayed === row.expected,
  }));
}
