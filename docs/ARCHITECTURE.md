# Architecture and UI maintenance

## Packages and boundaries

| Location                         | Responsibility                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/core/src/inputs.ts`    | Canonical role and input contracts, used by the server and demo adapter                  |
| `packages/core/src/reference.ts` | Immutable historical fixture, positive decimal validation and exact reference arithmetic |
| `packages/core/src/dashboard.ts` | Dashboard response contract and pure demo summarization                                  |
| `server/src/app.ts`              | Middleware and router composition only                                                   |
| `server/src/routes/`             | Auth, users, registers, observations, audit, dashboard and reference API boundaries      |
| `server/src/services/`           | Transactional register creation and safe literal search                                  |
| `server/src/models.ts`           | MongoDB schema, reference and counter definitions                                        |
| `server/src/middleware/`         | Centralized error handling                                                               |
| `web/src/app/`                   | App state, role-aware navigation and feature composition                                 |
| `web/src/components/`            | Shared layout and reusable controls                                                      |
| `web/src/features/`              | Authentication, dashboard, registers and reference calculator                            |
| `web/src/lib/`                   | API client, typed record helpers and request state                                       |
| `web/src/demo/`                  | Explicitly separate synthetic fixtures and volatile adapter                              |
| `web/src/styles/`                | Shared Tailwind utility recipes; theme and document base styles in style.css             |

## Design system

Muted green palette, white cards, restrained borders, clear hierarchy, consistent spacing and a compact sidebar. Shared PageHeader, Card, Button, Field, Select, Badge, Notice, DataTable, Pagination and Modal components avoid parallel styles per screen. Dialogs restore focus, support Escape and cycle keyboard focus. Reduced-motion preferences are respected.

A mobile navigation drawer and responsive grids are implemented. Tables scroll within their containers. Loading, empty, error and saved states are explicit. Browser visual acceptance remains required.

## Data flow

Live UI → same-origin API client → authenticated router → validated service → MongoDB transaction → response.

Demo UI → explicit demo adapter → in-memory synthetic records. There is no silent fallback from API errors to demo data. The demo flag is fixed at build time; the normal production build removes the adapter and fixtures.

Reference calculations share one pure implementation between the API and the standalone demo. Live calculations execute through the authenticated reference endpoint. They are not written to assignments, approved reports or laboratory results.

## Source fidelity

Laboratory assignments still reject calculation execution. A separate `/reference` namespace performs test arithmetic only. The API cannot activate a laboratory method by adopting a public example. Original source-to-code mapping and laboratory acceptance are separate future gates.

## Next maintenance work

Split persistence models further as feature-specific collections grow. Replace remaining dynamic persistence boundary types with individual service contracts when implementing method-specific workflows. Add account lifecycle controls, method-authorized signatories, report snapshots and external integrations. Avoid building multiple competing dashboards or duplicate calculation implementations.

## Tailwind UI implementation

The UI uses Tailwind CSS v4 with its Vite plugin. Reusable recipes centralize responsive, descendant and state utilities for shared controls and layout. Tailwind Merge resolves variant conflicts. Semantic marker classes exist only to address descendants; their styling is supplied by compiled Tailwind utilities. Global document typography and theme tokens remain in the base layer. No legacy component stylesheets or runtime CSS CDN are loaded.

## Observation workflow and operations (v0.3)

`packages/core` owns pure workflow transitions, operation validation, integer-paise ledger rules and draft PDF generation. `server/src/routes/workflow.ts` performs transactional state changes and audit writes; `operations.ts` manages operational registers. Assignment `draftReportId` serializes draft creation/revision/reopening through the assignment document, avoiding unique-key replacement within transactions. Reports retain immutable snapshots. Independent review and method-scoped authorization operate on observations only while formulas are pending.

The web `features/operations` directory shares cards, forms, modals and notices with existing registers. The demo adapter calls the same pure rules but remains an in-memory UI demonstration, not a substitute for API integration tests. Compile-time demo boundaries exclude persona switching from the live build. PDF rendering is lazy-loaded.
