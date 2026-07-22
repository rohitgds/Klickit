# Blueprint Index

All ten originals are present under `blueprints/original/` and verified against `blueprints/manifest.json` on 2026-07-21.

| # | File | Authority role | Size (bytes) |
|---|---|---|---|
| 01 | `01_database_schema.md` | Executable PostgreSQL data contract: schemas, tables, triggers, permissions, audit, outbox, indexes, phase tags | 436,008 |
| 02 | `02_core_workflows_logic.md` | Core workflows, state machines, command preconditions, transactions, rollback, outbox workers | 122,792 |
| 03 | `03_billing_and_ledger_math.md` | Financial facts, ledger mathematics, posting algorithms, reconciliation controls | 56,466 |
| 04 | `04_reporting_analytics_queries.md` | Analytics report registry, SQL contracts, drill-downs, export rules | 534,097 |
| 05 | `05_system_architecture_stack.md` | Architecture, stack, routes, deployment boundaries, security pipeline | 75,834 |
| 06 | `06_ui_and_menu_hierarchy.md` | UI shell, navigation, dense grid geometry, form fingerprints, keyboard flows | 222,698 |
| 07 | `07_acceptance_criteria.md` | Acceptance tests, release gates, financial decision blockers, UAT catalog | 1,312,049 |
| 08 | `08_live_screen_parity_audit.md` | Clean-room independence audit, evidence labels, release certificate gates | 25,480 |
| 09 | `09_zero_shortcut_expansion_log.md` | Cross-file traceability and zero-shortcut policy | 7,558 |
| 10 | `10_klickit_offline_first_roadmap.md` | KlickIt offline-first addendum; explicit newer decisions override earlier docs | 44,424 |

## Authority order

1. Accepted decision in `docs/DECISION_LOG.md`
2. Explicit newer decision in Blueprint 10
3. Detailed contract in Blueprints 01–09
4. Approved amendment under `blueprints/amendments/`

Original blueprint files are read-only. Do not edit them in place.

## Phase systems to keep separate

Three different “phase” vocabularies exist and must not be mixed without mapping:

| System | Where | Purpose |
|---|---|---|
| Build phases 1/2/3 | Blueprints 05–07 | Original release grouping |
| Delivery phases 0–18 | Blueprint 10 | KlickIt roadmap |
| Implementation phases 1–55 | `docs/MASTER_PHASE_PLAN.md` | Cursor execution plan |

## Product naming

- Shipping product name: **KlickIt**
- Blueprints 01–09 still use internal DentOS vocabulary (`dentos_data`, Fee Statement, Care Booking, etc.)
- **DrKlick** is migration reference only — never copied into shipping artifacts
- Blueprint 10 Phase 0 requires shipping terminology updates through amendments, not silent renames inside read-only originals

## Verification

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-blueprints.ps1
```

Expected result on 2026-07-21: all ten files report `OK`.
