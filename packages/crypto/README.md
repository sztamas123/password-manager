# Client crypto

Browser-compatible client-side vault encryption. This package is the only
component that handles master passwords, unwrapped vault keys, plaintext vault
data, encryption, or decryption. The backend does not depend on it.

## Design

1. `createEncryptionProfile` derives a 256-bit wrapping key from the master
   password and a random 128-bit salt using Argon2id.
2. It generates a separate random 256-bit vault key and wraps that key with
   AES-256-GCM.
3. Only the salt, KDF parameters, and wrapped vault key are uploaded to
   `POST /encryption/profile`.
4. Vault, folder, and entry JSON is encrypted with the vault key before it is
   sent to the API.
5. `unlockVaultKey` downloads the profile and unwraps the vault key locally.

Every AES-GCM operation uses a new random 96-bit nonce and a 128-bit tag.
Resource type, resource ID, and vault ID are authenticated but not encrypted.
Changing that context or the ciphertext causes decryption to fail.

## Usage

```ts
import {
  createEncryptionContext,
  createEncryptionProfile,
  createResourceId,
  encryptJson,
} from '@password-manager/crypto';

const { profile, vaultKey } = await createEncryptionProfile(masterPassword);

// Upload `profile` using an authenticated POST /encryption/profile request.
// Never send `masterPassword` or `vaultKey`.

const vaultId = createResourceId();
const encryptedData = await encryptJson(
  vaultKey,
  createEncryptionContext('vault', vaultId, vaultId),
  { name: 'Personal' },
);

// POST /vaults with { id: vaultId, encryptedData }.
```

An entry plaintext object can contain fields such as `name`, `username`,
`password`, `url`, and `notes`; the entire object is encrypted into one opaque
`encryptedData` value.

Call `clearVaultKey(vaultKey)` when locking the client. This overwrites the
provided byte array as a best effort, but JavaScript runtimes cannot guarantee
that every internal copy has been removed from memory.

## Verify

```bash
npm install
npm test
```

The tests cover key wrapping, incorrect master passwords, encryption
randomization, round trips, tamper detection, and ciphertext-swap prevention.
