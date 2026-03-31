import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { AppError } from '@revogrid-mcp/shared';

import type { AppConfig } from '../../config/env.js';

type RateLimitBucket = {
  count: number;
  expiresAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

export function registerSecurityHooks(app: FastifyInstance, config: AppConfig): void {
  app.addHook('onRequest', async (request, reply) => {
    validateOrigin(request, config);
    enforceRateLimit(request, reply, config);
  });
}

function validateOrigin(request: FastifyRequest, config: AppConfig): void {
  if (!config.ENABLE_ORIGIN_VALIDATION) {
    return;
  }

  const origin = request.headers.origin;
  if (!origin) {
    return;
  }

  if (!config.ALLOWED_ORIGINS.includes(origin)) {
    throw new AppError(`Origin "${origin}" is not allowed.`, 403);
  }
}

function enforceRateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
  config: AppConfig,
): void {
  if (!config.ENABLE_RATE_LIMITING) {
    return;
  }

  // TODO: replace this per-process limiter with Redis or an API gateway policy in production.
  const key = request.ip;
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.expiresAt <= now) {
    rateLimitBuckets.set(key, {
      count: 1,
      expiresAt: now + config.RATE_LIMIT_WINDOW_MS
    });
    return;
  }

  if (bucket.count >= config.RATE_LIMIT_MAX) {
    reply.header('retry-after', Math.ceil((bucket.expiresAt - now) / 1000));
    throw new AppError('Rate limit exceeded.', 429);
  }

  bucket.count += 1;
}
