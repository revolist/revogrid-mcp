import { z } from 'zod';

import { parseEnv } from '@revogrid-mcp/shared';

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value === 'true';
  }

  return false;
}, z.boolean());

const integerFromEnv = z.preprocess((value) => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.length > 0) {
    return Number.parseInt(value, 10);
  }

  return undefined;
}, z.number().int().positive());

const AppEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: integerFromEnv.default(8787),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CONTENT_BACKEND: z.enum(['memory', 'postgres']).default('memory'),
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: integerFromEnv.default(5432),
  POSTGRES_DB: z.string().default('revogrid_mcp'),
  POSTGRES_USER: z.string().default('postgres'),
  POSTGRES_PASSWORD: z.string().default('postgres'),
  PGVECTOR_TABLE: z.string().default('document_chunks'),
  REINDEX_OUTPUT: z.string().default('data/catalog.json'),
  REVOGRID_SOURCE_ROOT: z.string().optional(),
  REVOGRID_PRO_SOURCE_ROOT: z.string().optional(),
  DEFAULT_ENTITLEMENT: z.enum(['anonymous', 'trial', 'paid_pro', 'internal_admin']).default('anonymous'),
  ENABLE_ORIGIN_VALIDATION: booleanFromEnv.default(false),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  ENABLE_RATE_LIMITING: booleanFromEnv.default(false),
  RATE_LIMIT_MAX: integerFromEnv.default(60),
  RATE_LIMIT_WINDOW_MS: integerFromEnv.default(60_000),
  ENABLE_AUTH_PLACEHOLDER: booleanFromEnv.default(false)
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = parseEnv(AppEnvSchema, env);

  return {
    ...parsed,
    ALLOWED_ORIGINS: parsed.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  };
}
