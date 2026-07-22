# Cursor Memory Validation

Validated during Phase 5 on 2026-07-21 after Milestone 1 setup review approval.

## Required startup reads

| File | Status |
|---|---|
| `AGENTS.md` | Present |
| `docs/CURRENT_STATUS.md` | Present |
| `docs/MASTER_PHASE_PLAN.md` | Present |
| `docs/DECISION_LOG.md` | Present |
| `docs/KNOWN_ISSUES.md` | Present |

## Governance rules

| Rule file | Status |
|---|---|
| `.cursor/rules/00-governance.mdc` | Present |
| `.cursor/rules/01-blueprint-authority.mdc` | Present |
| `.cursor/rules/02-phase-workflow.mdc` | Present |
| `.cursor/rules/03-secrets-production-safety.mdc` | Present |
| `.cursor/rules/04-database-finance.mdc` | Present |
| `.cursor/rules/05-offline-sync.mdc` | Present |
| `.cursor/rules/06-testing-quality.mdc` | Present |
| `.cursor/rules/07-ui-accessibility.mdc` | Present |
| `.cursor/rules/08-communications.mdc` | Present |
| `.cursor/rules/09-user-explanations.mdc` | Present |
| `.cursor/rules/10-provider-portability.mdc` | Present |

## Commands

All expected command files are present under `.cursor/commands/`:

- `status`, `continue`, `test-current-phase`, `milestone-review`
- `audit-blueprints`, `setup-services`, `portability-audit`
- `rebuild-check`, `exit-plan`, `account-transfer-check`
- `record-feedback`, `recover`, `release-check`

## Portability and provider docs

Required portability documents are present under `docs/` including charter, provider inventory, exit plan, rebuild runbook, sale checklist, and portability test log.

## Session workflow

1. Read startup files listed in `AGENTS.md`.
2. Take the next incomplete numbered phase from `docs/MASTER_PHASE_PLAN.md`.
3. Implement one bounded phase, test, update docs, commit.
4. Stop at milestone endpoints until the owner sends `APPROVE MILESTONE`.

## Result

Phase 5 validation: **passed**
