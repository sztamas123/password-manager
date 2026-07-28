import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearVaultKey,
  createEncryptionContext,
  createEncryptionProfile,
  createResourceId,
  decryptJson,
  encryptJson,
  unlockVaultKey,
} from "./index.js";

const masterPassword = "a strong master password";

describe("client-side vault encryption", () => {
  it("wraps and unlocks a random vault key with Argon2id", async () => {
    const created = await createEncryptionProfile(masterPassword);
    const unlocked = await unlockVaultKey(masterPassword, created.profile);

    assert.deepEqual(unlocked, created.vaultKey);
    assert.equal(created.profile.kdfAlgorithm, "argon2id");
    assert.equal(created.profile.kdfMemoryKiB, 19_456);

    clearVaultKey(created.vaultKey);
    clearVaultKey(unlocked);
  });

  it("rejects an incorrect master password", async () => {
    const created = await createEncryptionProfile(masterPassword);

    await assert.rejects(
      unlockVaultKey("the wrong master password", created.profile),
    );

    clearVaultKey(created.vaultKey);
  });

  it("encrypts and decrypts JSON without exposing plaintext", async () => {
    const { vaultKey } = await createEncryptionProfile(masterPassword);
    const entryId = createResourceId();
    const vaultId = createResourceId();
    const context = createEncryptionContext("entry", entryId, vaultId);
    const entry = {
      name: "Email",
      password: "not-visible-on-the-server",
      username: "user@example.com",
    };
    const encryptedData = await encryptJson(vaultKey, context, entry);

    assert.equal(encryptedData.includes(entry.password), false);
    assert.deepEqual(
      await decryptJson(vaultKey, context, encryptedData),
      entry,
    );

    clearVaultKey(vaultKey);
  });

  it("uses a fresh nonce for every encryption", async () => {
    const { vaultKey } = await createEncryptionProfile(masterPassword);
    const vaultId = createResourceId();
    const context = createEncryptionContext("vault", vaultId, vaultId);
    const first = await encryptJson(vaultKey, context, { name: "Personal" });
    const second = await encryptJson(vaultKey, context, { name: "Personal" });

    assert.notEqual(first, second);
    clearVaultKey(vaultKey);
  });

  it("detects ciphertext tampering", async () => {
    const { vaultKey } = await createEncryptionProfile(masterPassword);
    const vaultId = createResourceId();
    const context = createEncryptionContext("vault", vaultId, vaultId);
    const encryptedData = await encryptJson(vaultKey, context, {
      name: "Personal",
    });
    const lastCharacter = encryptedData.at(-1);
    const tampered =
      encryptedData.slice(0, -1) + (lastCharacter === "A" ? "B" : "A");

    await assert.rejects(decryptJson(vaultKey, context, tampered));
    clearVaultKey(vaultKey);
  });

  it("prevents ciphertext from being swapped between resources", async () => {
    const { vaultKey } = await createEncryptionProfile(masterPassword);
    const vaultId = createResourceId();
    const source = createEncryptionContext(
      "entry",
      createResourceId(),
      vaultId,
    );
    const destination = createEncryptionContext(
      "entry",
      createResourceId(),
      vaultId,
    );
    const encryptedData = await encryptJson(vaultKey, source, {
      name: "Email",
    });

    await assert.rejects(decryptJson(vaultKey, destination, encryptedData));
    clearVaultKey(vaultKey);
  });

  it("normalizes canonically equivalent master passwords", async () => {
    const created = await createEncryptionProfile("café master password");
    const unlocked = await unlockVaultKey(
      "cafe\u0301 master password",
      created.profile,
    );

    assert.deepEqual(unlocked, created.vaultKey);
    clearVaultKey(created.vaultKey);
    clearVaultKey(unlocked);
  });
});
