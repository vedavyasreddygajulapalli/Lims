# Record links and maintenance

| Record            | Parent references                | Controls                                                                                            |
| ----------------- | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| Client            | None                             | Unique CLI number                                                                                   |
| TRF               | clientId                         | Client must exist; unique TRF number                                                                |
| Sample            | trfId                            | TRF must exist; receipt condition and storage; unique SMP number                                    |
| Assignment        | sampleId, methodId, technicianId | Accepted sample; matching material; active technician; unique sample/method pair; unique TST number |
| Observation draft | Stored on assignment             | Assigned technician only; expected version; correction reason; original text retained               |
| Audit event       | actorId, entity, entityId        | Created in the same transaction as the changed record                                               |

Client ownership is derived through Sample → TRF → Client, avoiding duplicate editable client references. Parents are immutable in this milestone, and no delete endpoint is exposed. IDs are database ObjectIds; display numbers are separately controlled counters.

Number counters are initialized before accepting work. Multi-record operations require MongoDB transactions. Observation updates include the expected version in the database query, with version increment and audit insertion in the same transaction.

Module boundaries:

- `server/src/domain.ts`: input schemas, permissions and domain checks.
- `server/src/models.ts`: persistence and numbering.
- `server/src/security.ts`: password and token primitives.
- `server/src/app.ts`: authenticated API routes and transactional operations.
- `web/src/main.tsx`: initial register UI.
- `server/test`: independent rule tests and full API/database scenarios.

As method modules are added, separate method code, source mappings and reference-case fixtures by immutable version. Split the initial frontend into feature components as workflows grow; do not introduce formulas in UI components. Calculated results and report snapshots will have dedicated collections in the next milestone; they are not represented as fabricated values in this foundation.
