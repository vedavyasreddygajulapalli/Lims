# Non-formula acceptance checks

## Completed in this workspace

- All navigation screens opened in DOM interaction tests; empty search and modal keyboard focus verified.
- New client → new test request → new accepted sample → technician assignment → exact raw observation strings → independent review → method signatory → draft snapshot → valid PDF bytes.
- Draft revision and manager reopening preserve old snapshot values.
- Role-denied creates, inactive technician assignment, unknown signatory scope, stale payments and overpayments rejected in the demo adapter.
- Source review: responsive sidebar, horizontally scrolling tables, single-column mobile forms, constrained modal width and height.
- Demo validation and permission gaps fixed; formulas unchanged.

These checks do not establish visual correctness, database durability or production readiness.

## Run the database checks

Use a dedicated test MongoDB replica set or test Atlas project. Configure `TEST_MONGODB_URI` through the runner's secret settings or a secure local environment variable; never commit credentials or put them in the public preview. The test user must be allowed to create, read, write and drop temporary databases in that dedicated test environment.

Run `npm ci`, `npm run build`, then `npm test` from the application source root. Without `TEST_MONGODB_URI`, the suite starts a local MongoDB replica set. With it, the suite creates a unique `lims_test_<random UUID>` database, checks transaction support, and cleans up only that generated database. It never uses the database named in the connection string. An interrupted test run may leave a database with this prefix for manual cleanup.

The API cases cover role checks, links, immutable raw strings, concurrent version conflicts, unique numbering, audit records, independent-connection persistence, equipment, review/authorization, report creation/revision/withdrawal, partial payments, account deactivation and password-change session revocation. They are currently BLOCKED by local MongoDB `open: Operation not permitted`; no external test connection is configured.

## Visual browser acceptance — still pending

Use the supported browser integration or review the public demo manually at 390px, 768px and 1440px widths. Check every menu page, sidebar opening/closing, long names, horizontal tables, form validation, loading/errors, modal scrolling and keyboard focus. Test the download in a real browser. The current managed workspace has no supported browser tool; no visual pass is claimed.

## Public preview

The public Site remains a synthetic in-memory demo. Changes reset on page reload. Do not enter real customer records or credentials. Persistent production hosting and Render deployment are deferred; database test access alone does not deploy the live backend.
