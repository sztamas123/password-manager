export const nodeEnvironments = ['development', 'test', 'production'] as const;

export type NodeEnvironment = (typeof nodeEnvironments)[number];

export interface EnvironmentVariables {
  API_PORT: number;
  DATABASE_URL: string;
  NODE_ENV: NodeEnvironment;
}

export function validateEnvironment(
  rawConfig: Record<string, unknown>,
): EnvironmentVariables {
  const nodeEnvironment = rawConfig.NODE_ENV ?? 'development';
  const port = Number(rawConfig.API_PORT ?? 3000);
  const databaseUrl = rawConfig.DATABASE_URL;

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

  return {
    API_PORT: port,
    DATABASE_URL: databaseUrl,
    NODE_ENV: nodeEnvironment as NodeEnvironment,
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
