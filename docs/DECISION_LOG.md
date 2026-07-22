# Decision Log

Record only accepted decisions. Do not place secrets here.

| ID | Date | Decision | Reason | Affected blueprints/phases | Approved by |
|---|---|---|---|---|---|
| DEC-001 | Initial | New product is KlickIt; DrKlick is migration reference only | Independent implementation boundary | All | User |
| DEC-002 | Initial | Tauri is required unless a documented blocker is approved | Shared Windows desktop strategy | 12, 51 | User |
| DEC-003 | Initial | Review at major milestones; small phases may auto-continue after tests | Practical non-coder workflow | All | User |
| DEC-004 | Initial | Only exact phrase `APPROVE MILESTONE` proceeds | Prevent accidental continuation | All milestones | User |
| DEC-005 | Initial | Development uses synthetic data and preview/staging only | Patient and production safety | All pre-pilot | User |

| DEC-006 | Initial | Every service and local-stack component has equal portability priority | Owner may rebuild, sell, transfer accounts or use cheaper providers | All phases | User |
| DEC-007 | Initial | Equal priority does not mean identical migration effort | Avoid false portability claims | All provider decisions | User |
| DEC-008 | 2026-07-21 | First-run discovery uses read-only audit only; no product code in this session | Bootstrap prompt boundary | Phases 1–3 | Agent |
| DEC-009 | 2026-07-21 | Blueprint originals verified by SHA-256 on 2026-07-21 | Establishes authoritative requirement baseline | Phase 1 | Agent |
| DEC-010 | 2026-07-21 | Owner approved setup review checkpoint with `APPROVE MILESTONE` | Authorizes Phases 4–7 within Milestone 1 | Milestone 1 | User |
| DEC-011 | 2026-07-21 | Pin Node.js 24 for reproducible builds | Current winget LTS channel installs Node 24.18.0 | Phase 4 | Agent |
| DEC-012 | 2026-07-21 | Milestone 1 approved after local Supabase verification | Owner accepted setup deliverables | Milestone 1 | User |
| DEC-013 | 2026-07-21 | Freeze offline-first component boundaries in code and docs | Phase 8 architecture gate | Phase 8 | Agent |
| DEC-014 | 2026-07-21 | Compile Blueprint 01 SQL into ordered Supabase migrations via script | Portable rebuild and provider-neutral schema baseline | Phase 9 | Agent |
| DEC-015 | 2026-07-22 | Milestone 2 foundation delivered through Phase 16 with gateway-local PostgreSQL, sync contracts, LAN discovery and 72-hour policy enforcement | Gateway & Sync milestone endpoint ready for manual review | Phases 11–16, Milestone 2 | Agent |
| DEC-016 | 2026-07-22 | Milestone 2 approved after owner review | Authorizes Phase 17 within Milestone 3 | Milestone 2 | User |
| DEC-017 | 2026-07-22 | Milestone 3 foundation delivered through Phase 23 with identity, patient registry and synthetic DrKlick staging | Access & Patients milestone endpoint ready for manual review | Phases 17–23, Milestone 3 | Agent |
| DEC-018 | 2026-07-22 | Milestone 3 approved after owner review | Authorizes Phase 24 within Milestone 4 | Milestone 3 | User |
