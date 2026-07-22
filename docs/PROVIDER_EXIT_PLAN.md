# Provider Exit Plan

For every provider document:

1. capability supplied
2. account, billing and recovery owners
3. data and configuration stored
4. secrets required
5. export method
6. import/restore method
7. expected downtime and cost
8. provider-specific code
9. cancellation restrictions
10. account-transfer process
11. test evidence
12. rollback plan

## Migration classes

- Class A: configuration only, such as DNS and environment variables.
- Class B: standard data, such as PostgreSQL and S3-compatible files.
- Class C: identity, WhatsApp numbers/templates, code signing or other provider-controlled resources.

Before production, perform one non-production export/restore or replacement rehearsal and record counts, hashes, time, cost and manual work.
