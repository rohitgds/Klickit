# KlickIt Data Export Contract

The owner must be able to export business data without depending on one provider.

Required export families include organizations, clinics, users/roles, patients, medical alerts, consent, appointments, queue history, encounters, tooth records, plans, prescriptions, bills, payments, allocations, recalls, communication metadata, files, audit and configuration.

Required formats:

- PostgreSQL logical backup
- CSV or JSON for business-readable tables
- file/object manifest with provider-neutral keys
- file checksums
- schema version and data dictionary
- export summary with counts and failures

Exports must not contain plaintext passwords, API keys or private signing keys.
