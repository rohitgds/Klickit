# Blueprint Conflicts and Clarifications

Blueprint 10 states that explicit newer decisions in that addendum take precedence, and affected earlier documents must be updated through approved amendments before implementation.

Do not mark a conflict resolved without a user-approved decision or an explicit Blueprint 10 override recorded in `docs/DECISION_LOG.md` and, where needed, `blueprints/amendments/`.

| ID | Files/sections | Conflict or ambiguity | Safety/financial impact | Proposed resolution | User decision | Amendment |
|---|---|---|---|---|---|---|
| BC-001 | BP01–09 vs BP10 naming | Blueprints say “Project DentOS”; shipping product is KlickIt | Branding and documentation only | Keep read-only originals; use KlickIt in shipping UI/docs; amend internal references only where implementation requires | Pending | Required before feature coding |
| BC-002 | BP05 topology vs BP10 §3–4 | BP05 describes cloud-only browser → API → PostgreSQL; BP10 requires clinic gateway + local PostgreSQL + sync | Architecture and all offline behavior | Treat BP10 as authority; amend BP05 delivery topology in amendments | Pending | Required before gateway work |
| BC-003 | BP05 messaging vs BP10 §15 | BP05 lists generic WhatsApp providers; BP10 freezes Pabbly Chatflow/Connect for pilot | Communications routing | Use MessagingProvider adapter with Pabbly implementation for pilot | Pending | Adapter boundary still required |
| BC-004 | BP03 UNRESOLVED-06 vs BP10 §13 | BP03 blocks split-tender collections; BP10 allows mixed tenders in one payment | Cashier workflow and reconciliation | Close for pilot with explicit FIN-DEC record and amended tests | Pending | Required before finance milestone |
| BC-005 | BP03/08 UNRESOLVED-01 vs BP10 §13 | Auto fee allocation blocked vs manual allocation/advance only | Patient balances and cashier errors | Close for pilot: manual allocation or unallocated advance | Pending | Required before finance milestone |
| BC-006 | BP03/08 UNRESOLVED-02 vs BP10 §13 | Document numbering scope blocked vs clinic/year numbering with January reset | Invoice traceability | Close for pilot with clinic + document type + year reset | Pending | Required before finance milestone |
| BC-007 | BP03 aging vs BP10 §13 | Day-90 bucket boundary differs (`90+` vs `91+`) | Aging reports | Pick one shared bucket function and test both UI and reports | Pending | Low risk but must reconcile |
| BC-008 | BP03/08 UNRESOLVED-04 vs BP10 §13 | Multi-doctor allocation blocked vs proportional split with manual adjustment | Doctor revenue reporting | Close for pilot with proportional rule + override | Pending | Required before finance milestone |
| BC-009 | BP03/08 UNRESOLVED-05 vs BP10 §13 | Refund of allocated funds blocked vs refund blocked until deallocation | Refund safety | Close for pilot: block refund beyond unallocated balance | Pending | Required before finance milestone |
| BC-010 | BP04 vs BP10 §2.2 | Full analytics catalog vs pilot operational reports only | Reporting scope | Disable advanced catalog until post-pilot | Pending | Scope gate only |
| BC-011 | BP06 odontogram vs BP10 §10.2 | Full graphical odontogram vs text/tooth-wise entries for pilot | Clinical UI scope | Text/tooth-wise entries in pilot; defer full canvas | Pending | UI scope only |
| BC-012 | BP01 schema vs BP10 §20 | BP01 has outbox/audit but not full sync inbox/conflict/device schema | Offline sync correctness | Extend schema through versioned migrations per BP10 | Pending | Required before sync phases |
| BC-013 | BP05/07 phase model vs BP10 §18 vs master plan | Three different phase numbering systems | Planning confusion only | Map explicitly in traceability; use 55-phase master plan for execution | Accepted via master plan | No blueprint edit needed |
| BC-014 | BP07/08 blocker markers vs BP10 pilot closures | UNRESOLVED/FIN-DEC markers still present while BP10 states pilot decisions | Release gate ambiguity | Record accepted pilot financial decisions in DECISION_LOG; update tests/amendments before finance milestone | Pending | Required before Phase 40 |

## Questions for owner review at Milestone 1

1. Confirm KlickIt remains the only shipping product name and DrKlick stays reference-only.
2. Confirm pilot financial rules from Blueprint 10 (manual allocation, clinic/year numbering, split tenders, proportional doctor split, refund guard, offline pending receipts).
3. Confirm first gateway stays simulated on this laptop until Rohini hardware is approved.
