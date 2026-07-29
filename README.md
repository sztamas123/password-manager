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
- authenticated, owner-scoped encrypted vault, folder, and entry CRUD;
- a browser-compatible Argon2id and AES-256-GCM client crypto package;
- per-user encryption profiles containing only KDF parameters and a wrapped
  random vault key;
- a responsive React and Tailwind web client with login, registration,
  master-password setup/unlock, encrypted vault CRUD, local search, and a
  secure password generator;
- same-origin API proxying and production browser security headers;
- Docker images for the web client, API, and PostgreSQL;
- unit tests, linting, and formatting.

The API and PostgreSQL never receive vault names, usernames, passwords, URLs,
notes, the master password, or unwrapped encryption keys. They store opaque
authenticated ciphertext and the metadata needed to organize and synchronize
it.

## Start with Docker

Create the local environment file and start the stack:

```bash
cp .env.example .env
openssl rand -hex 32
docker compose up --build
```

Paste the generated value into `JWT_SECRET` in `.env` before starting Docker.
The web client is available at <http://localhost:8080> and the health endpoint
at <http://localhost:3000/health> when using the example ports. Local overrides
in `.env` take precedence.

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

Clients generate every resource ID before encryption. That ID is part of the
AES-GCM authenticated data, so a ciphertext copied to another resource cannot
be decrypted there. Create and update bodies use this shape:

```json
{
  "id": "CLIENT_GENERATED_UUID",
  "encryptedData": "pm.v1.BASE64URL_NONCE.BASE64URL_CIPHERTEXT_AND_TAG"
}
```

Entries may additionally contain an optional plaintext `folderId`; this is
structural metadata, not vault content:

```json
{
  "id": "CLIENT_GENERATED_UUID",
  "encryptedData": "pm.v1.BASE64URL_NONCE.BASE64URL_CIPHERTEXT_AND_TAG",
  "folderId": "OPTIONAL_FOLDER_UUID"
}
```

Every database query is scoped to the authenticated owner. Requests for
another user’s vault resources return `404`. Deleting a folder leaves its
entries in the vault with `folderId: null`; deleting a vault cascades to its
folders and entries.

## Client-side encryption

The client has two separate password flows:

- the authentication password is sent over TLS to `/auth/register` or
  `/auth/login` and is hashed by the server;
- the master password never leaves the client and derives a wrapping key with
  Argon2id.

On first setup, the client generates a random 256-bit vault key, wraps it with
the master-password-derived key, and uploads this non-secret profile:

```text
POST /encryption/profile
GET  /encryption/profile
```

The profile contains the Argon2id salt and cost parameters plus the wrapped
vault key. It does not contain either password or an unwrapped key. The random
vault key encrypts vault, folder, and entry JSON using AES-256-GCM. Keeping it
separate from the derived wrapping key permits a future master-password change
to rewrap one key instead of re-encrypting every item.

The browser-compatible implementation and usage example are in
[`packages/crypto`](./packages/crypto). To install and test it:

```bash
npm --prefix packages/crypto install
npm --prefix packages/crypto test
```

## Web client

The Phase 5 frontend lives in [`frontend/`](./frontend). It provides:

- registration and login;
- separate master-password setup and unlock;
- vault creation, rename, and deletion;
- folder creation and filtering;
- encrypted login creation, editing, copying, and deletion;
- local search over decrypted names, usernames, websites, and notes;
- a fixed-strength password generator.

The frontend keeps authentication tokens and the unwrapped vault key only in
memory. A page reload signs the user out by design. During local development,
Vite proxies `/api` to the backend. The Docker deployment uses an Nginx
same-origin proxy and does not require permissive CORS.

Run it outside Docker:

```bash
docker compose up -d database api
npm --prefix frontend install
npm --prefix frontend run dev
```

Open <http://localhost:5173>. See [`frontend/README.md`](./frontend/README.md)
for the architecture and security boundaries.

## Postman collection

Import both files from [`postman/`](./postman):

- `password-manager.postman_collection.json`
- `password-manager.postman_environment.json`

Select the **Password Manager Local** environment and run the numbered folders
in order. The collection captures access tokens and resource IDs
automatically. See [`postman/README.md`](./postman/README.md) for details.

## Security notes

- Passwords are hashed with Argon2id using 19 MiB of memory, two iterations,
  and one lane. Plaintext passwords are never persisted.
- The client uses the same conservative Argon2id baseline for master-key
  derivation. Parameters are stored per account so they can be raised later.
- Vault data uses AES-256-GCM with a fresh random 96-bit nonce and a 128-bit
  authentication tag. Authenticated resource context prevents ciphertext from
  being moved between IDs, types, or vaults without detection.
- A weak master password remains vulnerable to offline guessing if the
  database is stolen. Use a long, unique master password; there is deliberately
  no server-side recovery of a forgotten one.
- Zero knowledge does not protect an unlocked or malware-compromised client.
  A compromised frontend deployment could capture the master password, so
  production clients require HTTPS, a controlled release pipeline, and strong
  defenses against script injection.
- JavaScript can overwrite key byte arrays on lock, but cannot guarantee that
  runtimes have removed every internal copy from memory.
- The server still learns account IDs, resource IDs, relationships, sizes,
  timestamps, counts, and access patterns. It can also delete or replay old
  ciphertext. AES-GCM detects modification, but rollback detection belongs
  with the later synchronization design.
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
- Production deployments must use TLS and a secret manager.
- Clipboard managers and other local applications may retain copied
  credentials. Copying always requires a user action.

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
npm --prefix packages/crypto test
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
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
├── packages/
│   └── crypto/
│       ├── src/
│       └── README.md
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   └── nginx.conf
├── postman/
├── .env.example
├── docker-compose.yml
└── CODEX.md
```
