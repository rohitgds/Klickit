# Shalimar Bagh Expansion Plan

Second-clinic deployment after Rohini pilot acceptance. Synthetic planning document only.

## Prerequisites

- Milestone 10 pilot acceptance recorded
- No open severity 1 or 2 defects
- Daily reconciliation stable at INR 0.00 variance
- Sale/handover checklist reviewed where applicable

## Deliverables

1. Second clinic gateway installation using `infrastructure/local-installer/install-gateway.ps1`
2. Shalimar clinic configuration and staff/device registration
3. Branch-specific patient numbering while preserving global patient identity
4. Cross-clinic safety-summary replication
5. Concurrent offline sync UAT between Rohini and Shalimar
6. Backup and restore drill for the second gateway

## Acceptance gate

- Both clinics operate concurrently
- Offline changes synchronize without data loss
- Patient identity remains single across branches
- Branch financial segregation passes reconciliation

## API reference

- `GET /pilot/expansion/shalimar` returns the machine-readable expansion contract
- `GET /pilot/handover/summary` lists operating runbooks and handover artifacts

## Out of scope for first expansion

Inventory, laboratory, advanced analytics, full CGHS claims, patient portal and automatic local failover remain post-pilot roadmap items per Blueprint 10.
