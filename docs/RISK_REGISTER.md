# Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Trigger/stop condition | Status |
|---|---|---|---|---|---|---|
| R-001 | AI invents generic behavior | Medium | High | Blueprint traceability and mandatory clarification | Unmapped requirement | Open |
| R-002 | Offline sync duplicates or loses records | Medium | Critical | Outbox/inbox, idempotency, replay and conflict tests | Any reconciliation mismatch | Open |
| R-003 | Financial balances diverge | Medium | Critical | Numeric money, transactional posting and INR 0.00 reconciliation | Any non-zero variance | Open |
| R-004 | Secret exposure | Low | Critical | OAuth/CLI, ignored env files, secret scan | Key in chat/Git/log | Open |
| R-005 | Real patient data used in development | Low | Critical | Synthetic-only rule | Patient data detected | Open |
| R-006 | Live WhatsApp sends test messages to patients | Low | High | Approved recipient allow-list | Non-approved recipient | Open |
| R-007 | DrKlick implementation copied | Low | High | Clean-room boundary and audit | Copied wording/code/private route | Open |
| R-008 | Local gateway hardware unavailable | High | Medium | Laptop simulation first | Hardware-dependent test | Open |

| R-009 | Provider/account lock-in prevents transfer or sale | Medium | High | Adapters, provider inventory, exit drills and business-owned accounts | Service added without exit path | Open |
| R-010 | Build depends on Cursor/MCP/chat history | Medium | High | Clean-clone scripts and rebuild drill | Another developer cannot build | Open |
| R-011 | Third-party license blocks commercial sale | Low | High | SBOM/license register and review | Unknown/incompatible license | Open |
| R-012 | Production service owned only by a personal account | Medium | High | Account-transfer runbook and backup admins | No business recovery/admin path | Open |
| R-013 | Node 24 used via winget LTS channel | Low | Low | Pin in `.node-version`, CI, and package engines | Build/test drift | Open |
| R-014 | OneDrive synced project path causes file locks | Low | Medium | Move repo to non-synced path if locks appear | Docker/Rust build failures | Open |
| R-015 | Blueprint 10 pilot closures not yet recorded as formal financial decisions | Medium | High | Owner confirms BC-004–BC-009 at Milestone 1; amend tests before finance phases | Finance work starts without DEC entries | Open |
