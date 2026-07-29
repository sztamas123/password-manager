# Frontend

React, TypeScript, Tailwind CSS, and Vite client for the encrypted password
manager.

## Run locally

Start PostgreSQL and the API, then run the Vite development server:

```bash
docker compose up -d database api
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` to
`http://localhost:3001` by default in this workspace. Override the development
target with `VITE_DEV_API_TARGET` when needed.

The full Docker stack serves the frontend from <http://localhost:8080> by
default:

```bash
docker compose up -d --build
```

## Architecture

- `auth/` owns the signed-out, profile-setup, locked, and unlocked states.
- `lib/api-client.ts` keeps access and rotating refresh tokens in memory and
  retries one request after a successful refresh.
- `vault/` decrypts data only after unlock, searches decrypted data locally,
  and encrypts every mutation before calling the API.
- `@password-manager/crypto` owns Argon2id derivation and AES-256-GCM.

Authentication tokens and the unwrapped vault key are never written to
`localStorage`, `sessionStorage`, IndexedDB, cookies, or logs. Reloading the
page therefore requires signing in and unlocking again.

## Security boundaries

- Nginx serves the app and proxies `/api` as one origin, so the backend does
  not need permissive CORS.
- Production responses include a restrictive Content Security Policy. The
  policy allows `wasm-unsafe-eval` only because the established Argon2id
  library executes WebAssembly.
- Only `http:` and `https:` website values are treated as safe external URLs.
- Generated passwords use Nano ID's Web Crypto-backed secure and uniform
  random generator.
- Clipboard copies can be read by other local applications and clipboard
  managers. The app never copies a password without a user action.

A malicious browser extension, injected same-origin script, compromised build,
or malware on an unlocked device can still steal plaintext and keys. The web
client must be served over HTTPS outside localhost.

## Verify

```bash
npm test
npm run lint
npm run build
npm run format:check
```
