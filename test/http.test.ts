import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config/env.js';
import { createApp } from '../src/http/createApp.js';
import { createServices } from '../src/services/serviceFactory.js';

describe('http integration', () => {
  const config = loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    CONTENT_BACKEND: 'memory',
    ENABLE_RATE_LIMITING: 'false',
    ENABLE_ORIGIN_VALIDATION: 'false'
  });

  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    const services = await createServices(config);
    app = createApp(config, services);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responds on /health', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'revogrid-mcp',
      backend: 'memory'
    });
  });

  const initializePayload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'vitest',
        version: '0.0.0'
      }
    }
  };

  it('initializes the MCP server over /', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
      },
      payload: initializePayload
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      jsonrpc: '2.0',
      id: 1
    });
  });

  it('keeps /mcp as a compatibility alias', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
      },
      payload: initializePayload
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      jsonrpc: '2.0',
      id: 1
    });
  });
});
