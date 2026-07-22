# 09 Project DentOS Contract-Coverage Log

## Purpose

This log defines documentation completion through behavioral traceability. File size and artifact totals are informational observations only and can never make a release pass. A contract is complete only when its declaration, implementation boundary, authorization rule, state effect, audit behavior, and acceptance evidence agree.

## File Remediation Record

| File | Current responsibility | Completion evidence |
|---|---|---|
| `01_database_schema.md` | relational schema, constraints, indexes, triggers, permissions, and audit contracts | every referenced relation and column resolves; every mutable relation has its declared audit behavior; every lifecycle pair passes the nullability audit |
| `02_core_workflows_logic.md` | command state machines, conditional branches, queue effects, and rollback rules | every command names its precondition, success state, failure state, audit event, and background effect |
| `03_billing_and_ledger_math.md` | monetary facts, posting equations, settlement isolation, reversals, and reconciliations | every formula reconciles to source rows and every provisional financial rule carries its unresolved blocker ID |
| `04_reporting_analytics_queries.md` | report registry, parameters, source grain, SQL, columns, totals, and drill-down | every declared report leaf has executable SQL and a title-matched UAT case |
| `05_system_architecture_stack.md` | module boundaries, routes, middleware, workers, deployment, and build phases | every mutating or sensitive route names a permission and every phase has an explicit dependency boundary |
| `06_ui_and_menu_hierarchy.md` | original DentOS navigation, dense screen geometry, controls, permissions, validation, actions, and phase tags | every registry control has a build phase and a screen/label-matched UAT case |
| `07_acceptance_criteria.md` | release fixtures, phase gates, functional tests, denial tests, worker tests, and report tests | every declared contract identity is tested and every unresolved financial blocker names its resolving test |
| `08_live_screen_parity_audit.md` | clean-room scope, evidence labels, unresolved decisions, independence checks, and release certificate | legal wording scan passes and each `UNRESOLVED` item is cross-referenced from dependent specifications and UAT |
| `09_zero_shortcut_expansion_log.md` | behavioral coverage policy and remediation trace | the validator performs cross-file identity and relationship checks without target totals |

## Shortcut Scan Contract

The automated release scan must perform these behavioral checks:

1. The documentation package contains each named specification file and no retired audit filename.
2. No file contains a competitor product name, tenant URL, copied controller identifier, copied private route, copied selector, or language directing literal visual reproduction.
3. Every Markdown code fence is balanced and every prohibited omission phrase is absent.
4. Every `CREATE TABLE` relation referenced by a foreign key exists, and every foreign-key source column and target identifier exists.
5. Every index references a declared table and declared columns.
6. Every mutable table has create, update, or delete audit coverage according to its mutability contract; append-only audit storage is exempt from self-auditing.
7. Every lifecycle actor/timestamp pair satisfies the schema nullability rule and its paired-state check constraint.
8. Every permission code used by a route or UI control is declared in the permission catalog or is a named session/membership predicate.
9. Every route listed in document 05 or document 06 has a server permission declaration and a corresponding acceptance path in document 07.
10. Every report leaf declared in document 04 has an exact title-matched report UAT case in document 07.
11. Every control row declared in document 06 has an exact screen/label-matched control UAT case in document 07.
12. Every permission row declared in document 06 has a code-matched denied-route UAT case in document 07.
13. Every worker declared in document 02 has a name-matched UAT case covering claim identity, retry, idempotency, and terminal handling.
14. Every `UNRESOLVED-xx` marker in document 08 appears in documents 02, 03, or 04 wherever its provisional assumption is used and appears in the release-blocker section of document 07.
15. Every table and control-registry row has one valid build-phase tag, and Phase 1 tests have no dependency on a Phase 2 or Phase 3 completion gate.
16. The workspace package and the delivered Desktop package contain the same named files with matching SHA-256 hashes.

## Coverage Matrix

| Artifact type | Defined in | Referenced or enforced in | Tested in |
|---|---|---|---|
| Tables, columns, constraints, and triggers | `01_database_schema.md` | `02_core_workflows_logic.md`, `03_billing_and_ledger_math.md`, `04_reporting_analytics_queries.md`, `05_system_architecture_stack.md` | migration, state-machine, ledger, and audit cases in `07_acceptance_criteria.md` |
| Routes and commands | `05_system_architecture_stack.md` | control actions in `06_ui_and_menu_hierarchy.md` | workflow, denial, and atomic-control cases in `07_acceptance_criteria.md` |
| Permissions | `01_database_schema.md`, `06_ui_and_menu_hierarchy.md` | middleware and domain guards in `05_system_architecture_stack.md` | permission and direct-request cases in `07_acceptance_criteria.md` |
| Financial formulas | `03_billing_and_ledger_math.md` | report SQL in `04_reporting_analytics_queries.md` and route contracts in `05_system_architecture_stack.md` | ledger, reconciliation, and unresolved-decision cases in `07_acceptance_criteria.md` |
| Reports | `04_reporting_analytics_queries.md` | report tree and filters in `06_ui_and_menu_hierarchy.md` | exact title-matched report cases in `07_acceptance_criteria.md` |
| UI controls | `06_ui_and_menu_hierarchy.md` | routes, permissions, and state commands in `05_system_architecture_stack.md` | exact screen/label-matched control cases in `07_acceptance_criteria.md` |
| Background workers | `02_core_workflows_logic.md`, `05_system_architecture_stack.md` | outbox and job schema in `01_database_schema.md` | name-matched worker cases in `07_acceptance_criteria.md` |
| Evidence states and unresolved decisions | `08_live_screen_parity_audit.md` | provisional logic markers in `02_core_workflows_logic.md`, `03_billing_and_ledger_math.md`, `04_reporting_analytics_queries.md` | release-blocker and decision tests in `07_acceptance_criteria.md` |
| Build phases | `05_system_architecture_stack.md` | table tags in `01_database_schema.md` and control tags in `06_ui_and_menu_hierarchy.md` | phase release groups in `07_acceptance_criteria.md` |

## Meaning of Zero Shortcuts

`Zero shortcuts` means every declared contract has a matching implementation boundary and test. A longer file, a larger table catalog, or a larger test catalog is not evidence of completeness by itself. Missing cross-references, unguarded routes, untested report leaves, unaudited mutable state, unresolved lifecycle-pair defects, phase omissions, and provisional financial behavior without a blocker marker are release failures even when all documents are lengthy.

The unresolved items in document 08 remain hard release blockers for their dependent Phase 2 financial paths. They cannot be closed by selecting the documented provisional assumption; closure requires the named synthetic-fixture UAT evidence in document 07 and an approved decision record.
