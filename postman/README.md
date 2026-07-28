# Postman

## Import

1. Open Postman.
2. Select **Import**.
3. Import `password-manager.postman_collection.json`.
4. Import `password-manager.postman_environment.json`.
5. Select **Password Manager Local** from the environment selector.

Start the API before sending requests:

```bash
docker compose up -d --build
```

The local environment targets `http://localhost:3001`, matching this
workspace's ignored `.env`.

## Run

The numbered folders are designed to run in order. Use the collection runner
to run the whole collection, or open folders and send requests one at a time.

Test scripts automatically save:

- `accessToken`
- `refreshToken`
- `vaultId`
- `folderId`
- `entryId`

The collection uses a stable `postman@example.com` development account so
repeated runs do not create a new user each time. Registration accepts either
`201` on the first run or `409` when the account already exists; login then
continues the workflow.

The encryption-profile request accepts `201` on its first run or `409` once the
profile exists. Vault, folder, and entry requests use client-generated UUIDs
and opaque `pm.v1` envelopes.

> [!IMPORTANT]
> The Postman values are format-valid placeholders for testing the API storage
> contract; they are not cryptographically generated ciphertext. Run
> `npm --prefix packages/crypto test` to exercise real Argon2id key derivation,
> AES-256-GCM encryption, decryption, tamper detection, and context binding.

To remove that test account and all related data:

```bash
docker compose exec database \
  psql -U password_manager -d password_manager \
  -c "DELETE FROM users WHERE email = 'postman@example.com';"
```

Do not place real credentials directly in Postman. A real client must encrypt
them locally with `packages/crypto` before making an API request.
