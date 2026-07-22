# Requirement Authority

## Resolution order

1. Explicit accepted decision in `docs/DECISION_LOG.md`
2. Explicit newer decision in Blueprint 10
3. Detailed contract in Blueprints 01–09
4. Approved amendment under `blueprints/amendments/`

A decision log entry cannot silently delete a safety, financial or clinical invariant. Any such change requires a clearly explained user decision, affected tests and an amendment.

## Product boundary

- **KlickIt** is the shipping product.
- **DrKlick / drklick.in** is authorised read-only migration reference only.
- Never copy DrKlick source code, private APIs, database identifiers, wording, visual design, routes, assets or protected implementation details.
- Blueprints 01–09 use internal DentOS vocabulary for domain contracts; shipping UI and documentation use KlickIt branding.

## Non-negotiable invariants (all phases)

- Posted clinical and financial history is immutable except through void, reversal, superseding document or authorised correction with audit.
- Money uses exact decimal rules from Blueprint 03; four financial facts are never interchangeable.
- Server-side permission is the security boundary; hidden UI is not security.
- Offline-first clinic operation with transactional outbox/inbox sync — no unsupervised last-write-wins.
- After 72 hours without successful cloud sync, clinic becomes read-only with no routine admin bypass.
- Synthetic data only until controlled migration; no live patient WhatsApp in development.

## Conflict handling

Stop and ask when:

- two authoritative requirements cannot both be true;
- required behavior is missing;
- a security or financial policy is uncertain;
- implementation would require guessing a generic workflow.

See `docs/BLUEPRINT_CONFLICTS.md` for the current conflict register.

## Release evidence

A requirement is accepted only when mapped in `docs/TRACEABILITY_MATRIX.md` with schema/API/permission/audit/tests where applicable, and when Blueprint 09 zero-shortcut scan rules are satisfied for that scope.
