import { argon2id } from "hash-wasm";
import {
  AES_KEY_BYTES,
  DEFAULT_KDF_PARAMETERS,
  KDF_SALT_BYTES,
  MAX_KDF_ITERATIONS,
  MAX_KDF_MEMORY_KIB,
  MAX_KDF_PARALLELISM,
  MINIMUM_MASTER_PASSWORD_LENGTH,
  WRAPPED_KEY_CONTEXT,
} from "./constants.js";
import { decodeBase64Url, encodeBase64Url } from "./encoding.js";
import { decryptBytes, encryptBytes } from "./encryption.js";
import {
  ENCRYPTION_VERSION,
  KDF_ALGORITHM,
  type CreatedEncryptionProfile,
  type EncryptionProfile,
  type KdfParameters,
} from "./types.js";

export async function createEncryptionProfile(
  masterPassword: string,
  parameters: KdfParameters = DEFAULT_KDF_PARAMETERS,
): Promise<CreatedEncryptionProfile> {
  assertMasterPassword(masterPassword);
  assertKdfParameters(parameters);

  const salt = crypto.getRandomValues(new Uint8Array(KDF_SALT_BYTES));
  const vaultKey = crypto.getRandomValues(new Uint8Array(AES_KEY_BYTES));
  const wrappingKey = await deriveWrappingKey(masterPassword, salt, parameters);

  try {
    const wrappedVaultKey = await encryptBytes(
      wrappingKey,
      WRAPPED_KEY_CONTEXT,
      vaultKey,
    );

    return {
      profile: {
        version: ENCRYPTION_VERSION,
        kdfAlgorithm: KDF_ALGORITHM,
        kdfSalt: encodeBase64Url(salt),
        kdfMemoryKiB: parameters.memoryKiB,
        kdfIterations: parameters.iterations,
        kdfParallelism: parameters.parallelism,
        wrappedVaultKey,
      },
      vaultKey,
    };
  } catch (error: unknown) {
    vaultKey.fill(0);
    throw error;
  } finally {
    wrappingKey.fill(0);
  }
}

export async function unlockVaultKey(
  masterPassword: string,
  profile: EncryptionProfile,
): Promise<Uint8Array> {
  assertMasterPassword(masterPassword);
  assertProfile(profile);

  const salt = decodeBase64Url(profile.kdfSalt);
  const wrappingKey = await deriveWrappingKey(masterPassword, salt, {
    memoryKiB: profile.kdfMemoryKiB,
    iterations: profile.kdfIterations,
    parallelism: profile.kdfParallelism,
  });

  try {
    const vaultKey = await decryptBytes(
      wrappingKey,
      WRAPPED_KEY_CONTEXT,
      profile.wrappedVaultKey,
    );

    if (vaultKey.byteLength !== AES_KEY_BYTES) {
      vaultKey.fill(0);
      throw new Error("The wrapped vault key has an invalid length");
    }

    return vaultKey;
  } finally {
    wrappingKey.fill(0);
  }
}

async function deriveWrappingKey(
  masterPassword: string,
  salt: Uint8Array,
  parameters: KdfParameters,
): Promise<Uint8Array> {
  const result = await argon2id({
    password: masterPassword.normalize("NFC"),
    salt,
    parallelism: parameters.parallelism,
    iterations: parameters.iterations,
    memorySize: parameters.memoryKiB,
    hashLength: AES_KEY_BYTES,
    outputType: "binary",
  });

  if (!(result instanceof Uint8Array)) {
    throw new Error("Argon2id returned an unexpected output format");
  }

  return result;
}

function assertMasterPassword(masterPassword: string): void {
  if (masterPassword.normalize("NFC").length < MINIMUM_MASTER_PASSWORD_LENGTH) {
    throw new Error(
      `Master passwords must contain at least ${MINIMUM_MASTER_PASSWORD_LENGTH} characters`,
    );
  }
}

function assertProfile(profile: EncryptionProfile): void {
  if (
    profile.version !== ENCRYPTION_VERSION ||
    profile.kdfAlgorithm !== KDF_ALGORITHM
  ) {
    throw new Error("Unsupported encryption profile");
  }

  const salt = decodeBase64Url(profile.kdfSalt);
  if (salt.byteLength !== KDF_SALT_BYTES) {
    throw new Error("Encryption profile salt must contain 128 bits");
  }

  assertKdfParameters({
    memoryKiB: profile.kdfMemoryKiB,
    iterations: profile.kdfIterations,
    parallelism: profile.kdfParallelism,
  });
}

function assertKdfParameters(parameters: KdfParameters): void {
  if (
    !Number.isInteger(parameters.memoryKiB) ||
    parameters.memoryKiB < DEFAULT_KDF_PARAMETERS.memoryKiB ||
    parameters.memoryKiB > MAX_KDF_MEMORY_KIB
  ) {
    throw new Error("Unsupported Argon2id memory cost");
  }

  if (
    !Number.isInteger(parameters.iterations) ||
    parameters.iterations < DEFAULT_KDF_PARAMETERS.iterations ||
    parameters.iterations > MAX_KDF_ITERATIONS
  ) {
    throw new Error("Unsupported Argon2id iteration count");
  }

  if (
    !Number.isInteger(parameters.parallelism) ||
    parameters.parallelism < DEFAULT_KDF_PARAMETERS.parallelism ||
    parameters.parallelism > MAX_KDF_PARALLELISM
  ) {
    throw new Error("Unsupported Argon2id parallelism");
  }
}
