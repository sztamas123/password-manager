export const nodeEnvironments = ['development', 'test', 'production'] as const;

export type NodeEnvironment = (typeof nodeEnvironments)[number];

export interface EnvironmentVariables {
  API_PORT: number;
  DATABASE_URL: string;
  JWT_ACCESS_TTL_SECONDS: number;
  JWT_SECRET: string;
  NODE_ENV: NodeEnvironment;
  REFRESH_TOKEN_TTL_DAYS: number;
}

export function validateEnvironment(
  rawConfig: Record<string, unknown>,
): EnvironmentVariables {
  const nodeEnvironment = rawConfig.NODE_ENV ?? 'development';
  const port = Number(rawConfig.API_PORT ?? 3000);
  const databaseUrl = rawConfig.DATABASE_URL;
  const jwtSecret = rawConfig.JWT_SECRET;
  const jwtAccessTtlSeconds = Number(
    rawConfig.JWT_ACCESS_TTL_SECONDS ?? 15 * 60,
  );
  const refreshTokenTtlDays = Number(rawConfig.REFRESH_TOKEN_TTL_DAYS ?? 30);

  if (
    typeof nodeEnvironment !== 'string' ||
    !nodeEnvironments.includes(nodeEnvironment as NodeEnvironment)
  ) {
    throw new Error(`NODE_ENV must be one of: ${nodeEnvironments.join(', ')}`);
  }

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('API_PORT must be an integer between 1 and 65535');
  }

  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required');
  }

  assertPostgresUrl(databaseUrl);
  assertSecret(jwtSecret);
  assertPositiveInteger(
    'JWT_ACCESS_TTL_SECONDS',
    jwtAccessTtlSeconds,
    60,
    86_400,
  );
  assertPositiveInteger('REFRESH_TOKEN_TTL_DAYS', refreshTokenTtlDays, 1, 365);

  return {
    API_PORT: port,
    DATABASE_URL: databaseUrl,
    JWT_ACCESS_TTL_SECONDS: jwtAccessTtlSeconds,
    JWT_SECRET: jwtSecret,
    NODE_ENV: nodeEnvironment as NodeEnvironment,
    REFRESH_TOKEN_TTL_DAYS: refreshTokenTtlDays,
  };
}

function assertPostgresUrl(databaseUrl: string): void {
  try {
    const url = new URL(databaseUrl);

    if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
      throw new Error();
    }
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL');
  }
}

function assertSecret(secret: unknown): asserts secret is string {
  if (
    typeof secret !== 'string' ||
    Buffer.byteLength(secret, 'utf8') < 32 ||
    secret === 'replace-me'
  ) {
    throw new Error('JWT_SECRET must contain at least 32 random bytes');
  }
}

function assertPositiveInteger(
  name: string,
  value: number,
  minimum: number,
  maximum: number,
): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}`,
    );
  }
}
