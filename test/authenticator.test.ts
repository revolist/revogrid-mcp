import { describe, expect, it } from 'vitest';
import jsonwebtoken from 'jsonwebtoken';

import { resolveProRequestContext, resolveRequestContext } from '../src/auth/authenticator.js';
import { loadConfig } from '../src/config/env.js';

describe('request authenticator', () => {
  it('keeps the common MCP route anonymous even when auth headers are present', () => {
    const context = resolveRequestContext(
      {
        headers: {
          authorization: 'Bearer some-token'
        }
      } as never,
      loadConfig({}),
    );

    expect(context.entitlement).toBe('anonymous');
  });

  it('maps a valid bearer jwt token to paid_pro entitlement on /pro', () => {
    const secret = 'test-jwt-secret';
    const config = loadConfig({
      ENABLE_PRO_ROUTE_AUTH: 'true',
      AUTH_JWT_SECRET: secret
    });
    const token = jsonwebtoken.sign(
      {
        sub: 'user-123'
      },
      secret,
      {
        algorithm: 'HS256',
        expiresIn: '1m'
      },
    );

    const context = resolveProRequestContext(
      {
        headers: {
          authorization: `Bearer ${token}`
        }
      } as never,
      config,
    );

    expect(context.entitlement).toBe('paid_pro');
  });

  it('rejects /pro requests without a bearer token when auth is enabled', () => {
    const config = loadConfig({
      ENABLE_PRO_ROUTE_AUTH: 'true',
      AUTH_JWT_SECRET: 'test-jwt-secret'
    });

    expect(() =>
      resolveProRequestContext(
        {
          headers: {}
        } as never,
        config,
      ),
    ).toThrow('A valid bearer token is required for /pro.');
  });

  it('rejects /pro requests with an invalid bearer jwt token', () => {
    const config = loadConfig({
      ENABLE_PRO_ROUTE_AUTH: 'true',
      AUTH_JWT_SECRET: 'test-jwt-secret'
    });

    expect(() =>
      resolveProRequestContext(
        {
          headers: {
            authorization: 'Bearer not-a-valid-jwt'
          }
        } as never,
        config,
      ),
    ).toThrow('A valid bearer token is required for /pro.');
  });

  it('treats /pro as paid access when pro auth is disabled', () => {
    const context = resolveProRequestContext(
      {
        headers: {}
      } as never,
      loadConfig({}),
    );

    expect(context.entitlement).toBe('paid_pro');
  });
});
