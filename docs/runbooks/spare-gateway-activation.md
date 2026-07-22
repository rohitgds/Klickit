# Spare Gateway Activation Runbook

Synthetic and pilot-prep only. Do not use on production without explicit owner approval.

## When to use

- Primary clinic gateway hardware failure
- Controlled BCP-001 recovery drill

## Steps

1. Stop the failed primary gateway service.
2. Install the same KlickIt software version on the spare machine using `infrastructure/local-installer/install-gateway.ps1`.
3. Restore the latest encrypted backup using `infrastructure/backup/run-restore-drill.ps1`.
4. Open a gateway incident:
   - `POST /resilience/incidents`
   - body: `{ "incidentType": "spare_activation", "spareGatewayCode": "SPARE-GW-01", "runbookReference": "docs/runbooks/spare-gateway-activation.md" }`
5. Verify:
   - `GET /resilience/recovery/status`
   - `GET /health`
   - Staff can log in and read patient records
6. Close the incident only after owner sign-off.

## Evidence

Record backup checksum, restore drill result and readiness drill `BCP-001` in `docs/MILESTONE9_EVIDENCE.md`.
