# Traceability Matrix

A requirement is not complete until all applicable columns are mapped. This file starts with the highest-priority cross-cutting items discovered during first-run blueprint audit.

| Requirement ID/source | Phase | Schema/migration | Domain/API | Permission | Audit event | Provider/portability boundary | Automated test | Manual evidence | Status |
|---|---:|---|---|---|---|---|---|---|---|
| BP10 §3 Clinic Gateway + local PostgreSQL | 10–11 | Gateway/device tables (amend BP01) | Local Fastify API | Clinic-scoped auth | Gateway lifecycle | LocalGatewayRuntime adapter | Gateway health test | Simulated laptop gateway | Planned |
| BP10 §4 architecture topology | 8 | N/A | `@klickit/domain` boundaries | N/A | N/A | All provider adapters | Architecture tests | `GET /architecture` | Complete |
| BP01 identity/access + permissions | 9 | dentos_data identity tables | N/A | Permission seed | Audit triggers | PostgreSQL 16+ migrations | Migration tests + db reset | 88 permissions seeded | Complete |
| BP10 sync foundation | 9 | dentos_runtime sync tables | Sync contracts later | Device approval later | Sync events | LocalGatewayRuntime | db reset | Studio/table checks | Complete |
| BP10 §8.4 Conflict engine | 15 | Conflict queue | Merge/reject commands | Conflict resolver role | Conflict decisions | Domain-only logic | Conflict merge test | SYNC-002/SYNC-003 | Planned |
| BP10 §3.2 72-hour offline read-only | 16 | Device sync state | Write gate middleware | No admin bypass | Offline timeout | Local gateway policy | OFF-003 | Manual outage drill | Planned |
| BP01/BP05 org/clinic/staff/users | 17 | Core identity tables | CRUD commands | Membership scope | User/admin changes | AuthProvider adapter | Identity CRUD tests | Staff setup checklist | Planned |
| BP05 auth pipeline + permissions | 18 | Permission tables | Route guards | Server-side only | Permission denials | AuthProvider | Denied-action tests | Role matrix review | Planned |
| BP10 §9.2 Offline cached login | 19 | Device/session tables | Offline auth flow | Approved devices | Login events | Local verifier cache | Offline login test | OFF-001 | Planned |
| BP02 §2 Patient Registry + duplicates | 20 | Patient tables | Register/search/duplicate | Registration override | Patient create/merge | N/A | Duplicate detection test | PAT search UAT | Planned |
| BP02/BP07 medical history/allergies/consent | 21 | Clinical support tables | Profile commands | Clinical read/write | Consent changes | N/A | Consent tests | PAT-005 evidence | Planned |
| BP10 §7.1 Global patient UUID + merge | 22 | Global identity tables | Merge queue | Admin merge | Merge audit | N/A | Merge workflow test | Duplicate merge UAT | Planned |
| BP10 §16.2 DrKlick demographic staging | 23 | Staging tables | Import validation | Migration role | Import audit | Read-only source refs | Import validation test | Synthetic dry run | Planned |
| BP02/BP06 scheduler + booking states | 24–26 | Scheduling tables | Booking commands | Scheduler permissions | Booking history | N/A | State machine tests | Scheduler UAT | Planned |
| BP02 Clinical Queue | 27 | Queue tables | Queue transitions | Queue permissions | Queue events | N/A | Queue flow test | DSH queue UAT | Planned |
| BP10 §10 FDI tooth-wise records | 30–32 | Clinical record tables | Encounter/note commands | Clinical roles | Note lock/amend | N/A | Completed-note lock test | Clinical UAT | Planned |
| BP10 §12 Images/PDF sync | 33 | File metadata tables | Upload/sync commands | File permissions | File events | ObjectStorageProvider | Hash/resume test | FILE-* scenarios | Planned |
| BP10 §10.4 Treatment plans/acceptance | 35–36 | Plan tables | Plan/accept commands | Plan permissions | Acceptance audit | N/A | OTP/signature tests | Plan UAT | Planned |
| BP10 §11 Prescription signing PIN | 38 | Prescription tables | Sign commands | Doctor-only sign | Rx revisions | N/A | Immutable revision test | Rx UAT | Planned |
| BP03/BP10 §13 Financial posting | 40–46 | Ledger tables | ISSUE/POST/APPLY/REFUND | Finance permissions | Financial audit | N/A | FIN-DEC + INR 0.00 tests | Finance UAT | Planned |
| BP10 §15 Pabbly WhatsApp + recalls | 47–50 | Message tables | Messaging adapter | Comms permissions | Message events | MessagingProvider | Webhook test | Approved test numbers only | Planned |
| BP10 §19 Pilot drills + BP09 scan | 53–55 | All | End-to-end | All | All | All providers inventoried | CI + acceptance suite | Milestone evidence packs | Planned |

See `docs/BLUEPRINT_INDEX.md` and `docs/BLUEPRINT_CONFLICTS.md` for authority and unresolved items.
