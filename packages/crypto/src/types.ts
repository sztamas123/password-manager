export const ENCRYPTION_VERSION = 1 as const;
export const KDF_ALGORITHM = "argon2id" as const;

export interface KdfParameters {
  memoryKiB: number;
  iterations: number;
  parallelism: number;
}

export interface EncryptionProfile {
  version: typeof ENCRYPTION_VERSION;
  kdfAlgorithm: typeof KDF_ALGORITHM;
  kdfSalt: string;
  kdfMemoryKiB: number;
  kdfIterations: number;
  kdfParallelism: number;
  wrappedVaultKey: string;
}

export type ResourceType = "vault" | "folder" | "entry";

export interface EncryptionContext {
  resourceType: ResourceType;
  resourceId: string;
  vaultId: string;
}

export interface CreatedEncryptionProfile {
  profile: EncryptionProfile;
  vaultKey: Uint8Array;
}
