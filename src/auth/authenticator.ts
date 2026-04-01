import type { FastifyRequest } from 'fastify';
import jsonwebtoken from 'jsonwebtoken';

import type { Entitlement } from '@revogrid-mcp/content-model';
import { ConfigurationError } from '@revogrid-mcp/shared';

import type { AppConfig } from '../config/env.js';
import type { RequestContext } from '../types/catalog.js';

export function resolveRequestContext(
  request: FastifyRequest,
  config: AppConfig,
): RequestContext {
  if (config.ENABLE_AUTH_PLACEHOLDER) {
    return {
      entitlement: resolveEntitlementFromAuthorization(request, config)
    };
  }

  const headerValue = request.headers['x-revogrid-entitlement'];
  const entitlement = normalizeEntitlement(headerValue, config.DEFAULT_ENTITLEMENT);

  return {
    entitlement
  };
}

function resolveEntitlementFromAuthorization(
  request: FastifyRequest,
  config: AppConfig,
): Entitlement {
  if (!config.AUTH_JWT_SECRET) {
    throw new ConfigurationError('ENABLE_AUTH_PLACEHOLDER requires AUTH_JWT_SECRET.');
  }

  const token = extractBearerToken(request.headers.authorization);
  return token && isValidJwtToken(token, config.AUTH_JWT_SECRET) ? 'paid_pro' : 'anonymous';
}

function normalizeEntitlement(
  rawValue: string | string[] | undefined,
  fallback: Entitlement,
): Entitlement {
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  const normalizedFallback = fallback === 'paid_pro' ? 'paid_pro' : 'anonymous';

  switch (value) {
    case 'paid_pro':
    case 'anonymous':
      return value;
    default:
      return normalizedFallback;
  }
}

function extractBearerToken(
  authorizationHeader: string | undefined,
): string | undefined {
  if (!authorizationHeader) {
    return undefined;
  }

  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return undefined;
  }

  return token;
}

function isValidJwtToken(token: string, secret: string): boolean {
  try {
    jsonwebtoken.verify(token, secret, {
      algorithms: ['HS256']
    });
    return true;
  } catch {
    return false;
  }
}
