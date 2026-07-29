# KeyNest browser extension

Manifest V3 extension for Chrome and Edge, built with WXT, React, and
TypeScript.

## Features

- detects login and registration forms;
- offers explicit, user-initiated autofill for matching credentials;
- uses the shared configurable password generator on registration forms;
- fills matching password-confirmation fields;
- captures submitted credentials and offers a one-click Save or Update prompt;
- offers context-aware in-page email and identity suggestions plus a popup
  fallback for checkout, billing, shipping, and contact forms;
- supports standard address autocomplete fields plus English and Romanian
  label fallbacks, including dependent country, region, and city selects;
- infers the website, item name, vault, and folder without asking the user.

New entries use the current page origin, a page-title or hostname-derived item
name, the last-used vault (falling back to the first vault), and no folder.
Entries with the same origin and username produce an Update prompt instead.
Identity autofill is started from the popup and covers names, email, phone, and
postal addresses. It deliberately excludes passwords, payment cards, CVV
fields, and form submission.

## Build and load

Start the API and web app first:

```bash
docker compose up -d --build
```

Install and build the extension:

```bash
npm --prefix extension install
npm --prefix extension run build
```

Then:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose `extension/.output/chrome-mv3`.

The default development API URL is `http://localhost:3001` and the web app URL
is `http://localhost:8080`. Both can be changed at build time:

```bash
cp extension/.env.example extension/.env
npm --prefix extension run build
```

The API URL can also be changed from the extension's sign-in form. Chrome 122
or newer is required.

## How it works

- The React popup owns sign-in, unlock, matching-login selection, and
  configurable password generation, and identity selection.
- The Manifest V3 service worker owns authentication, refresh rotation,
  Argon2id unlock, vault decryption, URL matching, and encrypted CRUD.
- The content script detects forms and renders isolated controls in closed
  shadow roots. It never receives the vault key or full vault.
- `@password-manager/crypto` is shared with the web client.
- `@password-manager/password-generator` is shared with both clients.

The extension uses strict scheme, hostname, and port matching. An HTTPS login
will therefore not be offered on an HTTP page, sibling subdomains do not match,
and deceptive hosts such as `example.com.evil.test` do not match `example.com`.
The only current affiliated-domain exception is the exact HTTPS-only group
`google.com`, `gmail.com`, `mail.google.com`, and `accounts.google.com`, which
supports Google's multi-step sign-in flow without enabling general subdomain
matching.

## Session and security boundaries

Authentication tokens, the encryption profile, and the unwrapped vault key are
stored in `browser.storage.session`. This memory-backed storage survives
Manifest V3 worker suspension but is cleared when the browser session ends.
Lock and sign-out remove unlocked state immediately.

Decrypted vault contents are kept only in the service worker's short-lived
memory cache. Persistent local storage contains only the configured server URL.
A submitted credential awaiting confirmation may remain in trusted session
storage for up to two minutes so its prompt survives navigation; Save, Update,
Not now, lock, or browser shutdown removes it. After two minutes it becomes
invalid and is removed on the next extension access.

Autofill always requires a user action. The service worker validates the
sender's real tab URL and will only return an entry matching that URL. Content
scripts are treated as untrusted callers and cannot request arbitrary
credentials.

Identity filling requires selecting an in-page suggestion or using the popup.
The selected identity is decrypted only in the extension and sent only to the
active HTTP(S) tab. It is not scoped to a website because addresses are
intentionally reusable across shops, so the user chooses when to release it.

The extension requires access to HTTP and HTTPS pages to detect forms. Like any
password manager, it cannot protect plaintext after autofill from malicious
scripts already running on that page, a compromised browser extension, or
malware on the unlocked device. Use HTTPS and only autofill on sites whose
address you trust.

The configured web app origin is excluded from form integration so the
extension cannot offer to store the master password. Set
`WXT_PUBLIC_WEB_APP_URL` correctly for non-default deployments.

## Verify

```bash
npm --prefix extension test
npm --prefix extension run typecheck
npm --prefix extension run lint
npm --prefix extension run format:check
npm --prefix extension run build
```

For a manual browser check, serve the local autofill fixture:

```bash
python3 -m http.server 4173 --directory extension/test-fixtures
```

Open `http://localhost:4173/autofill.html` with the built extension loaded and
unlocked. The page includes registration, standalone email, login, and 2FA
examples with their expected KeyNest behavior.
