import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config/env.js';

describe('app config', () => {
  it('requires an explicit webhook token', () => {
    expect(() => loadConfig({})).toThrow('WEBHOOK_TOKEN is required.');
  });

  it('rejects an empty webhook token', () => {
    expect(() => loadConfig({ WEBHOOK_TOKEN: '' })).toThrow('WEBHOOK_TOKEN is required.');
  });
});
