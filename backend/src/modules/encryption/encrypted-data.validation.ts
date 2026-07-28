export const ENCRYPTED_DATA_PATTERN =
  /^pm\.v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$/;

export const WRAPPED_VAULT_KEY_PATTERN =
  /^pm\.v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{64}$/;

export const MAX_ENCRYPTED_DATA_LENGTH = 100_000;
