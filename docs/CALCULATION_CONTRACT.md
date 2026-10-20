# Calculation fidelity contract

User requirement: reproduce the provided calculations exactly. Preserve formulas, constants, units, intermediate rounding, final rounding, lookup behavior and result presentation. Do not silently simplify, correct or replace source calculations.

## Current implementation

All methods are `awaiting_source`; versions are `unconfigured`. No laboratory calculator is registered. The assignment calculation endpoint always rejects execution. A separately labelled reference calculator now reproduces three historical public examples; see REFERENCE_SAMPLES.md. Catalogue activation is intentionally not exposed to administrators. Method activation and its evidence records are a future implementation step after source inspection.

Raw observations are stored as strings, so `001.2300`, `1.23` and `1.230` remain distinct source entries. This is not a choice of calculation arithmetic. The arithmetic and rounding strategy must be decided from the supplied workbook, including Excel behavior where relevant. Arbitrary decimal arithmetic is not assumed to reproduce Excel's binary arithmetic.

## Required evidence per method

- Original source filename, file checksum and unmodified version.
- Workbook sheets, named ranges, external links and VBA functions, if any.
- Method reference and revision as supplied by the laboratory.
- Each input's source cell, data type, unit and validity rules.
- Formula text, constants, lookup sources and evaluation order.
- Full intermediate values, formatting and display precision.
- Missing-input, invalid-input and repeat-measurement behavior.
- Expected final values and the corresponding report fields.
- Checked source examples and reviewer approval.

## Discrepancy handling

Preserve the source, log the differing input and output, and block that calculator from operational use. Ask the laboratory to resolve the discrepancy. If a source correction is authorized, retain the old source and issue a separate version; never overwrite the source definition or silently change historical results.

## Release conditions

Source-to-code mapping complete; approved reference cases pass at intermediate and final stages; invalid inputs tested; report reproduction approved; laboratory technical acceptance retained. Future formula changes must not recalculate issued reports.
