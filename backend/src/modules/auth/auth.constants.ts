export const ACCESS_TOKEN_AUDIENCE = 'password-manager-client';
export const ACCESS_TOKEN_ISSUER = 'password-manager-api';

export const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  parallelism: 1,
  timeCost: 2,
} as const;

export const REFRESH_TOKEN_BYTES = 64;

// This is an Argon2id hash of a non-secret placeholder. It makes failed
// logins perform password verification even when the email does not exist.
export const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$Dox+Tuzw6fvG7G97RS6vxQ$r5F8FOqXj8ce2qqZ27Jyq1zHcnsO4RVaOKQ8bprv+KU';
