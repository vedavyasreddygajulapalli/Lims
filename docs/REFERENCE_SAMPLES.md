# Public reference sample provenance

Source: [BBMP-hosted concrete-cube report](https://account.bbmpgov.in/vssIFMS/Files/BA-L4L4-ifms357-80170049-4-QC11.pdf)

Report reference: CQC/LW No. 26/2018-19. Date: 01 October 2018.
Retrieved on 20 October 2026 from indexed text of the source. Direct PDF access timed out. This provenance limitation is displayed in the reference UI. The original PDF is not included or reproduced in the package.

Numeric fixture:

| Specimen | Failure load (kN) | Loaded area (mm²) | Reported strength (N/mm²) | Calculated display |
| -------- | ----------------: | ----------------: | ------------------------: | -----------------: |
| 1        |             519.3 |             22500 |                     23.08 |              23.08 |
| 2        |             524.6 |             22500 |                     23.32 |              23.32 |
| 3        |             498.3 |             22500 |                     22.15 |              22.15 |

Reference arithmetic: failure load in kN × 1000 ÷ loaded area in mm². Display uses two-decimal half-up rounding, which reproduces these published displayed values. This does not establish the report author's entire rounding procedure for other inputs. BigInt rational arithmetic avoids binary floating-point tie effects in this reference calculator.

This historical report is not a current standard, evidence of current accreditation or Sri Sainath's approved source workbook. No pass/fail threshold, compliance decision, report template or signature is copied. The workflow records used to populate the UI preview are separate synthetic fixtures.

The fixture and engine are versioned as `reference-1`. They must never be substituted silently for the laboratory's eventual source calculations.
