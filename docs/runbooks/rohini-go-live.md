# Rohini Controlled Go-Live Runbook

Synthetic and staging only until explicit production approval is recorded.

## Preconditions

- Milestone 9 readiness drills passed
- Go-live checklist complete in `POST /pilot/release-candidate/checklist`
- Rollback plan reviewed: `docs/runbooks/rohini-rollback.md`
- No open severity 1 or 2 issues in `GET /pilot/issues`

## Release candidate

1. Create candidate: `POST /pilot/release-candidate` with `{ "releaseCode": "ROHINI-RC-01" }`
2. Mark checklist items complete through gateway checklist API
3. Confirm `GET /pilot/release-candidate` shows `checklistEvaluation.ready: true`

## Daily operations during pilot

1. Record daily reconciliation: `POST /pilot/reconciliation/daily`
2. Require INR 0.00 variance before closing each day
3. Verify backup run and restore drill status from Milestone 9 routes
4. Review sync dashboard and unresolved issues

## Production approval gate

Production remains blocked in non-production environments.

Only after owner review:

1. Set `APP_ENV=production` on the approved gateway host
2. `POST /pilot/release-candidate/approve-production`
3. Confirm `GET /pilot/production-gate` returns `allowed: true`

Do not connect live WhatsApp or real patient data without separate owner approval.
