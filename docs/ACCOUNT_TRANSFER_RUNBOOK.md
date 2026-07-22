# Account and Subscription Transfer Runbook

Production services should be owned by the business or a business-controlled account, not only by a developer's personal email.

Record for every service:

- legal/account owner
- primary and backup admin
- billing contact
- recovery email/phone
- MFA ownership
- renewal date and plan
- project/account IDs
- data region
- cancellation effect
- export location

Never record passwords or recovery codes.

## Transfer sequence

1. Inventory resources and ownership.
2. Create or confirm receiving business account.
3. Add receiving admins with least privilege.
4. Verify billing and recovery.
5. Export configuration and data.
6. Transfer project/repository/domain where supported.
7. Rotate secrets and signing credentials.
8. Update CI/CD and environment references.
9. Test staging.
10. Cut over production with approval.
11. Reconcile data and file counts.
12. Remove old access only after acceptance.
