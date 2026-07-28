import {
  AES_GCM_NONCE_BYTES,
  AES_KEY_BYTES,
  CIPHERTEXT_PATTERN,
  CIPHERTEXT_PREFIX,
} from "./constants.js";
import { decodeBase64Url, encodeBase64Url } from "./encoding.js";
import type { EncryptionContext } from "./types.js";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

export async function encryptJson<T>(
  vaultKey: Uint8Array,
  context: EncryptionContext,
  value: T,
): Promise<string> {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error("The value is not JSON serializable");
  }

  const plaintext = textEncoder.encode(serialized);

  try {
    return await encryptBytes(vaultKey, serializeContext(context), plaintext);
  } finally {
    plaintext.fill(0);
  }
}

export async function decryptJson<T>(
  vaultKey: Uint8Array,
  context: EncryptionContext,
  encryptedData: string,
): Promise<T> {
  const plaintext = await decryptBytes(
    vaultKey,
    serializeContext(context),
    encryptedData,
  );

  try {
    return JSON.parse(textDecoder.decode(plaintext)) as T;
  } finally {
    plaintext.fill(0);
  }
}

export function createEncryptionContext(
  resourceType: EncryptionContext["resourceType"],
  resourceId: string,
  vaultId: string,
): EncryptionContext {
  assertIdentifier(resourceId, "resourceId");
  assertIdentifier(vaultId, "vaultId");

  if (resourceType === "vault" && resourceId !== vaultId) {
    throw new Error("A vault context must use its own ID as vaultId");
  }

  return { resourceId, resourceType, vaultId };
}

export function createResourceId(): string {
  return crypto.randomUUID();
}

export function clearVaultKey(vaultKey: Uint8Array): void {
  vaultKey.fill(0);
}

export async function encryptBytes(
  rawKey: Uint8Array,
  associatedData: string,
  plaintext: Uint8Array,
): Promise<string> {
  const key = await importAesKey(rawKey, ["encrypt"]);
  const nonce = crypto.getRandomValues(new Uint8Array(AES_GCM_NONCE_BYTES));
  const encrypted = await crypto.subtle.encrypt(
    {
      additionalData: textEncoder.encode(associatedData),
      iv: nonce,
      name: "AES-GCM",
      tagLength: 128,
    },
    key,
    toWebCryptoBytes(plaintext),
  );

  return [
    CIPHERTEXT_PREFIX,
    encodeBase64Url(nonce),
    encodeBase64Url(new Uint8Array(encrypted)),
  ].join(".");
}

export async function decryptBytes(
  rawKey: Uint8Array,
  associatedData: string,
  encryptedData: string,
): Promise<Uint8Array> {
  if (!CIPHERTEXT_PATTERN.test(encryptedData)) {
    throw new Error("Unsupported ciphertext format");
  }

  const [, , encodedNonce, encodedCiphertext] = encryptedData.split(".");
  const nonce = toWebCryptoBytes(decodeBase64Url(encodedNonce));
  const ciphertext = toWebCryptoBytes(decodeBase64Url(encodedCiphertext));
  const key = await importAesKey(rawKey, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    {
      additionalData: textEncoder.encode(associatedData),
      iv: nonce,
      name: "AES-GCM",
      tagLength: 128,
    },
    key,
    ciphertext,
  );

  return new Uint8Array(plaintext);
}

function serializeContext(context: EncryptionContext): string {
  return [
    "password-manager",
    "v1",
    context.resourceType,
    context.resourceId,
    context.vaultId,
  ].join(":");
}

async function importAesKey(
  rawKey: Uint8Array,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  if (rawKey.byteLength !== AES_KEY_BYTES) {
    throw new Error("Vault keys must contain exactly 256 bits");
  }

  return crypto.subtle.importKey(
    "raw",
    toWebCryptoBytes(rawKey),
    "AES-GCM",
    false,
    usages,
  );
}

function assertIdentifier(value: string, field: string): void {
  if (!/^[A-Za-z0-9-]{1,128}$/u.test(value)) {
    throw new Error(`${field} contains unsupported characters`);
  }
}

function toWebCryptoBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(value);
}
