import { createHash } from 'node:crypto';
import { z } from 'zod';

import { parseEnv } from '@revogrid-mcp/shared';

const DEFAULT_WEBHOOK_TOKEN = 'dev-webhook-token';

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
  ENABLE_ORIGIN_VALIDATION: booleanFromEnv.default(false),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  ENABLE_RATE_LIMITING: booleanFromEnv.default(false),
  RATE_LIMIT_MAX: integerFromEnv.default(60),
  RATE_LIMIT_WINDOW_MS: integerFromEnv.default(60_000),
  ENABLE_PRO_ROUTE_AUTH: booleanFromEnv.default(false),
  AUTH_JWT_SECRET: z.string().optional(),
  WEBHOOK_TOKEN: z.string().default(DEFAULT_WEBHOOK_TOKEN),
  SOURCE_UPDATE_GITHUB_TOKEN: z.string().optional(),
  GITHUB_TOKEN: z.string().optional()
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = parseEnv(AppEnvSchema, env);

  // Derive WEBHOOK_TOKEN from AUTH_JWT_SECRET if not explicitly provided
  let webhookToken = parsed.WEBHOOK_TOKEN;
  if (webhookToken === DEFAULT_WEBHOOK_TOKEN && parsed.AUTH_JWT_SECRET) {
    webhookToken = createHash('sha256')
      .update(parsed.AUTH_JWT_SECRET + 'reindex-webhook-salt')
      .digest('hex');
  }

  return {
    ...parsed,
    WEBHOOK_TOKEN: webhookToken,
    ALLOWED_ORIGINS: parsed.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  };
}
