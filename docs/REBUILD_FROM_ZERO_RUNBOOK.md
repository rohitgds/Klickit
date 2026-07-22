# Rebuild KlickIt From Zero

A qualified developer must be able to rebuild a non-production environment from:

- a clean Git clone or Git bundle
- documented prerequisites
- versioned migrations
- infrastructure/configuration files
- synthetic seed data
- provider adapters
- `.env.example`
- setup scripts
- no Cursor chat history

## Clean rebuild evidence

1. Restore repository.
2. Install documented prerequisites.
3. Start local services.
4. Apply migrations.
5. load synthetic seed.
6. build web.
7. build Windows desktop.
8. start local gateway.
9. run automated tests.
10. open the application.
11. verify one offline and sync scenario.
12. record duration and undocumented steps.

The rebuild fails if a hidden provider-dashboard setting or personal credential is required.
