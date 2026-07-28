import type { KdfParameters } from "./types.js";

export const DEFAULT_KDF_PARAMETERS: Readonly<KdfParameters> = Object.freeze({
  memoryKiB: 19_456,
  iterations: 2,
  parallelism: 1,
});

export const MINIMUM_MASTER_PASSWORD_LENGTH = 12;

export const CIPHERTEXT_PREFIX = "pm.v1";
export const CIPHERTEXT_PATTERN =
  /^pm\.v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$/;

export const MAX_KDF_MEMORY_KIB = 1_048_576;
export const MAX_KDF_ITERATIONS = 10;
export const MAX_KDF_PARALLELISM = 4;

export const AES_KEY_BYTES = 32;
export const AES_GCM_NONCE_BYTES = 12;
export const KDF_SALT_BYTES = 16;

export const WRAPPED_KEY_CONTEXT = "password-manager:v1:wrapped-vault-key";
