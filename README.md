# Password Manager

A self-hosted password manager built incrementally according to
[`CODEX.md`](./CODEX.md).

## Phase 1

The backend foundation includes:

- a NestJS API with validated environment configuration;
- Prisma ORM backed by PostgreSQL;
- a database-aware `GET /health` endpoint;
- an initial `User` model containing identity metadata only;
- Docker images for the API and PostgreSQL;
- unit tests, linting, and formatting.

Authentication, password hashing, vault data, and encryption belong to later
phases and are intentionally not implemented.

## Start with Docker

Create the local environment file and start the stack:

```bash
cp .env.example .env
docker compose up --build
```

The health endpoint is available at <http://localhost:3000/health>.

Apply database migrations in another terminal:

```bash
docker compose exec api npm run prisma:migrate:deploy
```

Stop the stack with:

```bash
docker compose down
```

The PostgreSQL data volume is retained between runs.

## Local backend development

Start PostgreSQL, install backend dependencies, migrate the database, and run
the API:

```bash
cp .env.example .env
docker compose up -d database
npm --prefix backend install
npm --prefix backend run prisma:migrate:dev
npm --prefix backend run start:dev
```

Useful verification commands:

```bash
npm --prefix backend run lint
npm --prefix backend test
npm --prefix backend run build
```

## Structure

```text
.
├── backend/
│   ├── prisma/
│   │   └── migrations/
│   ├── src/
│   │   ├── config/
│   │   ├── database/
│   │   ├── generated/
│   │   └── modules/
│   │       ├── health/
│   │       └── users/
│   └── test/
├── .env.example
├── docker-compose.yml
└── CODEX.md
```
