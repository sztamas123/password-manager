# Password Manager

A self-hosted password manager built incrementally according to
[`CODEX.md`](./CODEX.md).

## Current scope

Phase 1 is limited to the backend foundation:

- NestJS API
- Prisma and PostgreSQL
- Docker-based local infrastructure
- Health module
- Users module

Only the project scaffold exists for now. Application logic, database models,
endpoints, and dependency installation are intentionally deferred.

## Structure

```text
.
├── backend/
│   ├── prisma/
│   │   └── migrations/
│   ├── src/
│   │   ├── common/
│   │   ├── config/
│   │   ├── database/
│   │   └── modules/
│   │       ├── health/
│   │       └── users/
│   └── test/
├── infrastructure/
│   └── docker/
│       └── postgres/
├── .env.example
├── docker-compose.yml
└── CODEX.md
```

