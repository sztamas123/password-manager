# Password Manager

A self-hosted password manager built incrementally according to
[`CODEX.md`](./CODEX.md).

## Implemented

The backend currently includes:

- a NestJS API with validated environment configuration;
- Prisma ORM backed by PostgreSQL;
- a database-aware `GET /health` endpoint;
- registration and login with normalized email addresses;
- Argon2id password hashing;
- short-lived JWT access tokens;
- rotating, hashed refresh tokens with replay-family revocation;
- rate limiting on authentication endpoints;
- Docker images for the API and PostgreSQL;
- unit tests, linting, and formatting.

Vault data and client-side encryption belong to later phases and are
intentionally not implemented.

## Start with Docker

Create the local environment file and start the stack:

```bash
cp .env.example .env
openssl rand -hex 32
docker compose up --build
```

Paste the generated value into `JWT_SECRET` in `.env` before starting Docker.
The health endpoint is available at <http://localhost:3000/health> when using
the example ports. Local overrides in `.env` take precedence.

Apply database migrations in another terminal:

```bash
docker compose exec api npm run prisma:migrate:deploy
```

Stop the stack with:

```bash
docker compose down
```

The PostgreSQL data volume is retained between runs.

## Authentication API

Register:

```bash
curl --request POST http://localhost:3000/auth/register \
  --header "Content-Type: application/json" \
  --data '{"email":"user@example.com","password":"correct horse battery staple"}'
```

Login:

```bash
curl --request POST http://localhost:3000/auth/login \
  --header "Content-Type: application/json" \
  --data '{"email":"user@example.com","password":"correct horse battery staple"}'
```

Refresh:

```bash
curl --request POST http://localhost:3000/auth/refresh \
  --header "Content-Type: application/json" \
  --data '{"refreshToken":"TOKEN_RETURNED_BY_REGISTER_OR_LOGIN"}'
```

Register, login, and refresh return a 15-minute JWT access token and a rotating
refresh token. Every successful refresh invalidates the submitted token and
returns a new one.

## Authentication security

- Passwords are hashed with Argon2id using 19 MiB of memory, two iterations,
  and one lane. Plaintext passwords are never persisted.
- Refresh tokens contain 64 random bytes. Only their SHA-256 hashes are stored,
  because high-entropy random tokens do not need slow password hashing.
- Reusing a rotated refresh token revokes the active tokens in that token
  family.
- Login errors do not distinguish an unknown email from an incorrect password,
  and both paths perform Argon2 verification.
- Access JWTs expire after 15 minutes by default. They cannot be individually
  revoked before expiry; the short lifetime limits that exposure.
- The built-in rate limiter is in-memory and suitable for the current
  single-instance deployment. A shared store is required before scaling to
  multiple API instances.
- Production deployments must use TLS and a secret manager. The authentication
  password introduced here is separate from the future client-side vault
  encryption key.

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
│   │       ├── auth/
│   │       ├── health/
│   │       └── users/
│   └── test/
├── .env.example
├── docker-compose.yml
└── CODEX.md
```
