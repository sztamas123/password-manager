# Password Manager



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
- authenticated, owner-scoped vault, folder, and entry CRUD;
- Docker images for the API and PostgreSQL;
- unit tests, linting, and formatting.

> [!WARNING]
> Entry fields are plaintext during the current architecture phase. The API
> server and PostgreSQL can read `username`, `password`, `url`, and `notes`.
> Never store real credentials until client-side encryption is implemented.

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

## Vault API

All vault routes require the access token returned by register or login:

```text
Authorization: Bearer ACCESS_TOKEN
```

Vault routes:

```text
POST   /vaults
GET    /vaults
GET    /vaults/:vaultId
PATCH  /vaults/:vaultId
DELETE /vaults/:vaultId
```

Folder routes:

```text
POST   /vaults/:vaultId/folders
GET    /vaults/:vaultId/folders
GET    /vaults/:vaultId/folders/:folderId
PATCH  /vaults/:vaultId/folders/:folderId
DELETE /vaults/:vaultId/folders/:folderId
```

Entry routes:

```text
POST   /vaults/:vaultId/entries
GET    /vaults/:vaultId/entries
GET    /vaults/:vaultId/entries/:entryId
PATCH  /vaults/:vaultId/entries/:entryId
DELETE /vaults/:vaultId/entries/:entryId
```

Example vault request:

```bash
curl --request POST http://localhost:3000/vaults \
  --header "Authorization: Bearer ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{"name":"Personal"}'
```

Example entry request:

```bash
curl --request POST http://localhost:3000/vaults/VAULT_ID/entries \
  --header "Authorization: Bearer ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "name":"Example",
    "username":"user@example.com",
    "password":"development-only-value",
    "url":"https://example.com",
    "folderId":"OPTIONAL_FOLDER_ID"
  }'
```

Every database query is scoped to the authenticated owner. Requests for
another user’s vault resources return `404`. Deleting a folder leaves its
entries in the vault with `folderId: null`; deleting a vault cascades to its
folders and entries.

## Postman collection

Import both files from [`postman/`](./postman):

- `password-manager.postman_collection.json`
- `password-manager.postman_environment.json`

Select the **Password Manager Local** environment and run the numbered folders
in order. The collection captures access tokens and resource IDs
automatically. See [`postman/README.md`](./postman/README.md) for details.

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
- The current plaintext entry model intentionally implements CRUD before the
  client-side encryption phase. It does not satisfy the final zero-knowledge
  security model and must be treated as development-only.

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
│   │       ├── entries/
│   │       ├── folders/
│   │       ├── health/
│   │       ├── users/
│   │       └── vaults/
│   └── test/
├── .env.example
├── docker-compose.yml
└── CODEX.md
```
