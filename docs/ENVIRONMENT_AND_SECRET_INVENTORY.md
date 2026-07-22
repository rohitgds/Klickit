# Environment and Secret Inventory

Do not record secret values.

| Variable/credential name | Capability | Local | Staging | Production | Provider store | Rotation owner | Rotation procedure | Needed by phase |
|---|---|---|---|---|---|---|---|---|
| GATEWAY_DATABASE_URL | Clinic-local PostgreSQL connection | Yes | Yes | Yes | Clinic gateway env / secret store | Clinic owner | Update gateway service env and restart | 11 |
| DATABASE_URL | Generic PostgreSQL fallback for tooling | Yes | Optional | Optional | Dev `.env.local` | Dev owner | Update local env | 11 |
| GATEWAY_HOST | Gateway HTTP bind address | Yes | Yes | Yes | Gateway config | Clinic owner | Update config and restart gateway | 11, 13 |
| GATEWAY_PORT | Gateway HTTP port | Yes | Yes | Yes | Gateway config | Clinic owner | Update config and restart gateway | 11, 13 |
| GATEWAY_LAN_DISCOVERY | Enable LAN discovery beacon | Yes | Yes | Yes | Gateway config | Clinic owner | Toggle config | 13 |
| KLICKIT_GATEWAY_CODE | Clinic gateway identity code | Yes | Yes | Yes | Gateway config | Clinic owner | Provision new gateway record | 11 |
| KLICKIT_SOFTWARE_VERSION | Reported gateway/desktop version | Yes | Yes | Yes | Build metadata | Release owner | Ship new build | 11, 16 |
| KLICKIT_CLOUD_SYNC_URL | Cloud sync receiver base URL | Optional | Yes | Yes | Gateway config | Cloud owner | Update URL and verify sync | 14 |

Every production credential must be business-controlled and rotatable.
