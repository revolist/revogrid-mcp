import type { FastifyRequest } from 'fastify';

import type { Entitlement } from '@revogrid-mcp/content-model';

import type { AppConfig } from '../config/env.js';
import type { RequestContext } from '../types/catalog.js';

export function resolveRequestContext(
  request: FastifyRequest,
  config: AppConfig,
): RequestContext {
  const headerValue = request.headers['x-revogrid-entitlement'];
  const entitlement = normalizeEntitlement(headerValue, config.DEFAULT_ENTITLEMENT);

  return {
    entitlement
  };
}

function normalizeEntitlement(
  rawValue: string | string[] | undefined,
  fallback: Entitlement,
): Entitlement {
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

  switch (value) {
    case 'trial':
    case 'paid_pro':
    case 'internal_admin':
    case 'anonymous':
      return value;
    default:
      return fallback;
  }
}
