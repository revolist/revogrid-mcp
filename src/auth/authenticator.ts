import type { FastifyRequest } from 'fastify';
import jsonwebtoken from 'jsonwebtoken';

import type { Entitlement } from '@revogrid-mcp/content-model';
import { AuthorizationError, ConfigurationError } from '@revogrid-mcp/shared';

import type { AppConfig } from '../config/env.js';
import type { RequestContext } from '../types/catalog.js';

export function resolveRequestContext(
  request: FastifyRequest,
  config: AppConfig,
): RequestContext {
  void request;
  void config;

  return {
    entitlement: 'anonymous'
  };
}

export function resolveProRequestContext(
  request: FastifyRequest,
  config: AppConfig,
): RequestContext {
  if (!config.ENABLE_PRO_ROUTE_AUTH) {
    return {
      entitlement: 'paid_pro'
    };
  }

  return {
    entitlement: resolveEntitlementFromAuthorization(request, config)
  };
}

function resolveEntitlementFromAuthorization(
  request: FastifyRequest,
  config: AppConfig,
): Entitlement {
  if (!config.AUTH_JWT_SECRET) {
    throw new ConfigurationError('ENABLE_PRO_ROUTE_AUTH requires AUTH_JWT_SECRET.');
  }

  const token = extractBearerToken(request.headers.authorization);
  if (!token) {
    throw new AuthorizationError('A valid bearer token is required for /pro.');
  }

  if (!isValidJwtToken(token, config.AUTH_JWT_SECRET)) {
    throw new AuthorizationError('A valid bearer token is required for /pro.');
  }

  return 'paid_pro';
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
