# Sri Sainath Laboratory LIMS — development v0.3

MERN + TypeScript + Tailwind CSS v4 with a shared core package, reusable UI components and a modern laboratory dashboard.

**Development build. Not released for live laboratory reporting.** The reference calculator uses published historical numeric examples; the laboratory's own methods remain unconfigured until its source sheets and acceptance evidence are supplied.

## Review the UI now

Open the [public preview](https://sri-sainath-lims-preview.vedavyasreddy-gajula.chatgpt.site). For a local standalone copy, run `npm run preview:build` and open the generated `Sri_Sainath_LIMS_Preview.html`. This self-contained demo requires no server or MongoDB. It includes sample intake charts, material distribution, recent requests, attention items, searchable registers, forms, observation rows, audit history and the reference calculator.

The preview's workflow records are **synthetic** and visibly labelled. Changes exist only in memory and reset on reload. Public numeric fixtures appear only in the reference workspace. The preview is not a working production database, login-security demonstration or authorized report system.

## Implemented in this version

- Responsive navigation, dashboard and feature pages; design tokens and shared buttons, fields, cards, badges, tables, pagination and keyboard-aware dialogs.
- Database-derived dashboard totals and seven-day intake data. Empty databases produce empty/zero states rather than fabricated trends.
- Server-side literal search in clients, TRFs, samples and assignments; page-level search in audit history. Reference fields display readable linked labels.
- Client → TRF → sample → assignment links and transaction-backed audit events.
- Cookie sessions, password hashing, role checks and admin-created accounts.
- Assigned-technician observation entry with original string preservation, reasons and expected-version checks.
- Reference-only compressive strength calculator, three published sample comparisons, explicit rounding and inspectable exact quotient.
- Page CSV exports with spreadsheet-formula injection protection.
- Separate live and demo adapters; production builds exclude synthetic fixtures.

## Run the full MERN app

Requirements: Node.js 24, npm and a MongoDB replica set (or an appropriate development Atlas cluster). Transactions require a replica set. Use a separate development database.

```bash
npm ci
npm run build
cp server/.env.example server/.env
```

Set `MONGODB_URI` and `APP_ORIGIN=http://localhost:5173` in `server/.env`. Set a bootstrap email and password of at least 12 characters, then:

```bash
npm run bootstrap
```

Remove bootstrap credentials after account creation. Start these in separate terminals:

```bash
npm run dev:server
npm run dev:web
```

Open `http://localhost:5173` (exact origin). Sign in, create the team and add linked records. No default credentials are provided.

## Commands

```bash
npm run build             # shared core, API and production UI
npm run test:unit         # 22 domain / arithmetic / workflow checks
npm run test -w web       # 13 UI/demo checks
npm run test:integration  # full API/database scenarios; isolated MongoDB replica set
npm test                 # all suites (requires MongoDB process support)
npm run preview:build    # regenerate the standalone HTML demo
```

The test MongoDB instance may need to download its binary on first use. It does not connect to the laboratory database.

## Verification and limits

- Production build passed.
- 26 backend tests and 13 UI/demo tests passed in GitHub Actions.
- All 3 published numeric fixtures matched to two decimal places.
- The compiled self-contained preview rendered in a DOM runtime without external assets.
- Real MongoDB API integration passed in [CI](https://github.com/vedavyasreddygajulapalli/Lims/actions/runs/39468928229).
- DOM tests do not verify pixel layout. Desktop/mobile browser visual review is still pending; the public demo is hosted; production backend deployment is deferred.

## Deployment

Use one HTTPS origin for the frontend and `/api` behind a reverse proxy. Set `APP_ORIGIN` and `NODE_ENV=production`. Express does not serve the frontend assets. Review proxy trust, rate limiting, database roles and restore-tested backups for the actual deployment. No proxy is trusted by default.

Never deploy the demo build as an operational laboratory system. Technical review, report authorization, PDF issuance and laboratory method validation remain future work. See the documents in `docs/` for architecture, provenance and next steps.

## Tailwind migration

Tailwind CSS v4 is compiled through `@tailwindcss/vite`. Shared component utility recipes live in `web/src/styles/utilities.ts`; `tw()` resolves variants and merges conflicting utilities using `tailwind-merge`. The four legacy component stylesheets have been removed. `web/src/style.css` contains the Tailwind import, theme tokens and document-wide base styles. Responsive and state variants are compiled locally; no Tailwind CDN is required.

Production build, all five UI interaction tests and the standalone preview were rebuilt after migration. Visual browser acceptance remains pending.

## v0.3 update

Added connected observation review, draft reports/PDFs, equipment, quality cases, billing ledger, document references and account/access controls. See `docs/STATUS.md` for tested behavior and remaining gates. Formula implementation and final report issuance remain blocked pending the laboratory source sheets. Render deployment remains deferred. The hosted preview uses synthetic, temporary data and separate demo personas.
