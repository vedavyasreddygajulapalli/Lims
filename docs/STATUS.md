# Development status — v0.3

## Implemented

- React + TypeScript + Tailwind dashboard and shared accessible controls.
- Client → test request → sample → method/technician assignment relationships.
- Exact raw observation strings, version checks, audit records and locked submitted observations.
- Technician submission, independent reviewer acceptance/return, separate method-scoped signatory authorization and manager reopening.
- Equipment register and assignment with active/current calibration checks.
- Draft report snapshots, revision/withdrawal history and watermarked PDF download. Reopening supersedes current drafts. These are observation drafts, never issued laboratory reports.
- Quality cases with required closure evidence; controlled document reference register.
- INR billing ledger with integer-paise amounts, partial/full payments and overpayment protection. No funds transfer, tax calculation or statutory invoice.
- User activation/deactivation, role and method-scope changes, session revocation, self-edit protection and password change.
- Explicit readiness screen for unconfigured services.
- Synthetic interactive preview with separate demo personas. Data resets on reload. Live production build excludes demo adapter/persona controls.

## Verification

Build passes. 22 unit tests, 9 DOM UI tests and 4 demo workflow tests pass, including independent review → draft creation and billing → partial payment. Three published reference calculator outputs remain unchanged and match exactly. PDF pagination is exercised with 80 observations.

GitHub Actions verified real MongoDB integration on 20 October 2026: 26 backend tests (including 4 API/database scenarios) and 13 UI/demo tests passed. Build and dependency installation passed. Evidence: https://github.com/vedavyasreddygajulapalli/Lims/actions/runs/39468928229. The local workspace restriction remains, but no longer blocks CI verification.

DOM interaction tests are not visual browser testing. Desktop/mobile visual review, live database transactions and user acceptance remain required.

## Pending before operational use

1. Original formulas, rounding rules, source sheets and expected intermediate/final outputs from the laboratory. No production formula was added or changed.
2. Original report layout, final result locking/issuance, digital signatures and verification policy.
3. Persistent backend deployment, secrets, backups and a tested restore. Render remains deferred.
4. Email/WhatsApp provider setup, password recovery, document/file storage and instrument integrations.
5. Laboratory-specific access, retention, migration and acceptance decisions; real user tests.
6. Visual browser checks and production-environment acceptance.

Additional limits: operation lists and linked choices load the latest/first 200 records; document entries are references rather than uploads. Quality ownership uses names, not a personnel workflow. Equipment assignment is optional until method requirements are supplied. Draft PDFs escape non-ASCII characters explicitly. Audit history is application-managed, not cryptographically immutable. Access changes require another administrator for the acting account. Existing v0.2 database users require version/methodIds defaults before access updates. The synthetic preview is public at the owner's request; external messaging is not configured.

This is a development preview, not a production-ready LIMS or accreditation claim.

## Acceptance follow-up

Shared user validation and demo role enforcement now match the corresponding API rules. Inactive technicians are excluded from assignment choices; empty operation searches show feedback; navigation groups and modal width constraints were cleaned up. The test runner accepts a secure `TEST_MONGODB_URI` and isolates each run in a fresh test database. See `ACCEPTANCE.md` for exact coverage and outstanding access.
