import { describe, expect, it } from 'vitest';
import jsonwebtoken from 'jsonwebtoken';

import { resolveRequestContext } from '../src/auth/authenticator.js';
import { loadConfig } from '../src/config/env.js';

describe('request authenticator', () => {
  it('maps a valid bearer jwt token to paid_pro entitlement', () => {
    const secret = 'test-jwt-secret';
    const config = loadConfig({
      ENABLE_AUTH_PLACEHOLDER: 'true',
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

    const context = resolveRequestContext(
      {
        headers: {
          authorization: `Bearer ${token}`
        }
      } as never,
      config,
    );

    expect(context.entitlement).toBe('paid_pro');
  });

  it('treats requests without a bearer token as anonymous when jwt auth is enabled', () => {
    const config = loadConfig({
      ENABLE_AUTH_PLACEHOLDER: 'true',
      AUTH_JWT_SECRET: 'test-jwt-secret'
    });

    const context = resolveRequestContext(
      {
        headers: {}
      } as never,
      config,
    );

    expect(context.entitlement).toBe('anonymous');
  });

  it('treats requests with an invalid bearer jwt token as anonymous', () => {
    const config = loadConfig({
      ENABLE_AUTH_PLACEHOLDER: 'true',
      AUTH_JWT_SECRET: 'test-jwt-secret'
    });

    const context = resolveRequestContext(
      {
        headers: {
          authorization: 'Bearer not-a-valid-jwt'
        }
      } as never,
      config,
    );

    expect(context.entitlement).toBe('anonymous');
  });
});
