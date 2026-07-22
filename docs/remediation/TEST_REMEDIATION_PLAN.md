# Test and CI Remediation Plan

**Track:** Critical remediation — P1  
**Status:** Part B partially delivered (migration verify fix)  
**Last updated:** 2026-07-22

## Blueprint requirements

| Source | Requirement |
|--------|-------------|
| BP07 | Evidence rules; no deleting failing tests |
| BP05 §18 | Testing strategy — unit, integration, UAT |
| Audit `21_BUILD_AND_TEST_REPORT.md` | Prior false PASS when Docker unavailable |

## Defects corrected (Part B)

| Defect | Fix |
|--------|-----|
| `verify-migrations.ps1` ignored `$LASTEXITCODE` | Rewritten with `Invoke-External`, docker preflight, count assertions, explicit `exit 1` |
| Audit reported migration PASS without Docker | Reports must be regenerated after fix; failures now nonzero |

## Remaining gaps

| Gap | Impact |
|-----|--------|
| CI does not run `verify:migrations` | Docker not available on default GitHub runner |
| No ESLint | Quality gate missing |
| No E2E | UI acceptance manual only |
| Web tests are helper-only | Not component/integration |
| Security auth lacks PG integration tests | Part D |

## Target architecture

1. **CI jobs split:**
   - `verify` (current): blueprints, typecheck, unit tests, build — no Docker
   - `verify-migrations` (new, optional): `runs-on: windows-latest` + Docker service OR `continue-on-error: false` local-only workflow_dispatch
2. **Migration verify:** Always exit nonzero on failure (fixed script)
3. **Test taxonomy documented** in `docs/TEST_LOG.md`: unit / integration / drill / UAT
4. **E2E smoke** (future): Playwright login → patient → booking → queue

## Files to change (future PRs)

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | Add `workflow_dispatch` job `verify-migrations` with Docker |
| `package.json` | Optional `"lint": "..."` when ESLint adopted |
| `apps/gateway/test/security-auth-integration.test.ts` | Part D |
| `scripts/verify-migrations.ps1` | ✅ Fixed 2026-07-22 |

## Tests for this plan itself

```powershell
# Must fail when Docker stopped:
npm run verify:migrations
echo $LASTEXITCODE  # expect nonzero

# Must pass when Docker + supabase running:
npm run verify:migrations
echo $LASTEXITCODE  # expect 0
```

## Rollback

- Revert CI workflow if Docker job blocks all PRs — use manual workflow only

## Risks

| Risk | Mitigation |
|------|------------|
| Flaky CI on Docker | Retry once; pin Supabase CLI version |
| False green audits | Regenerate reports from actual command exit codes only |

## Owner decisions required

- [ ] Approve GitHub Actions minutes for Docker-enabled migration job
- [ ] Approve Playwright devDependency for E2E phase

## Definition of done

- [x] `verify-migrations.ps1` exits nonzero on docker/supabase/SQL failure
- [ ] CI migration job documented and passing when Docker available
- [ ] `21_BUILD_AND_TEST_REPORT.md` reflects honest pass/fail/skip
- [ ] ESLint or equivalent added OR documented waiver in DECISION_LOG
- [ ] E2E smoke covers login + one clinical path OR explicit deferral with owner sign-off

## Regenerated reports (Part B)

After this commit, regenerate locally (when Docker available):

```powershell
npm run verify:migrations 2>&1 | Tee-Object audit-export/KlickIt_Independent_Review/_verify_migrations.log
npm run test 2>&1 | Tee-Object audit-export/KlickIt_Independent_Review/_test_run_full.log
```

Note: `audit-export/` is gitignored; reports live on reviewer machine only unless owner approves export commit.
