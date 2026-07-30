import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config/env.js';

describe('app config', () => {
  it('requires an explicit webhook token', () => {
    expect(() => loadConfig({})).toThrow('WEBHOOK_TOKEN is required.');
  });

  it('rejects an empty webhook token', () => {
    expect(() => loadConfig({ WEBHOOK_TOKEN: '' })).toThrow('WEBHOOK_TOKEN is required.');
  });

  it('does not expose removed Pro route auth settings', () => {
    const config = loadConfig({
      WEBHOOK_TOKEN: 'test-webhook-token',
      ENABLE_PRO_ROUTE_AUTH: 'true',
      AUTH_JWT_SECRET: 'legacy-secret'
    });

    expect(config).not.toHaveProperty('ENABLE_PRO_ROUTE_AUTH');
    expect(config).not.toHaveProperty('AUTH_JWT_SECRET');
  });
});
