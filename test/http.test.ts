import { Socket } from 'node:net';
import { Duplex } from 'node:stream';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config/env.js';
import { createApp } from '../src/http/createApp.js';
import { createServices } from '../src/services/serviceFactory.js';

if (typeof Duplex.prototype.destroySoon !== 'function') {
  Duplex.prototype.destroySoon = Duplex.prototype.destroy;
}

if (typeof Socket.prototype.destroySoon !== 'function') {
  Socket.prototype.destroySoon = Socket.prototype.destroy;
}

if (!Object.prototype.hasOwnProperty.call(Object.prototype, 'destroySoon')) {
  Object.defineProperty(Object.prototype, 'destroySoon', {
    configurable: true,
    enumerable: false,
    value() {
      if (typeof this.destroy === 'function') {
        this.destroy();
      }
    }
  });
}

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

describe('http integration', () => {
  const config = loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    CONTENT_BACKEND: 'memory',
    ENABLE_RATE_LIMITING: 'false',
    ENABLE_ORIGIN_VALIDATION: 'false',
    WEBHOOK_TOKEN: 'test-webhook-token'
  });

  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    const services = await createServices(config);
    app = createApp(config, services);
    await app.ready();
  }, 30000);

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

  it('reports mcp request statistics on /stats', async () => {
    await app.inject({
      method: 'POST',
      url: '/',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
      },
      payload: initializePayload
    });

    await app.inject({
      method: 'POST',
      url: '/pro',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
      },
      payload: initializePayload
    });

    const response = await app.inject({
      method: 'GET',
      url: '/stats'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      service: 'revogrid-mcp',
      backend: 'memory',
      requests: {
        health: 1,
        mcpTotal: 2,
        mcpSucceeded: 2,
        mcpFailed: 0,
        mcpByPath: {
          root: 1,
          pro: 1
        }
      }
    });
  });

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

  it('serves catalog resources from the unified endpoint', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
      },
      payload: {
        jsonrpc: '2.0',
        id: 2,
        method: 'resources/read',
        params: {
          uri: 'revogrid://catalog/coverage'
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('requiresProChunkCount');
    expect(response.body).toContain('revogrid-pro');
  });

  it('returns labeled Pro docs from the canonical root endpoint without a token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
      },
      payload: {
        jsonrpc: '2.0',
        id: 22,
        method: 'tools/call',
        params: {
          name: 'search_revogrid_docs',
          arguments: {
            query: 'pivot feature'
          }
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('"requiresPro":true');
    expect(response.body).toContain('pro.rv-grid.com');
  });

  it('keeps /pro as a token-free compatibility alias', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/pro',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: 'Bearer stale-client-token'
      },
      payload: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'search_revogrid_docs',
          arguments: {
            query: 'pivot feature'
          }
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('"requiresPro":true');
    expect(response.body).toContain('pro.rv-grid.com');
  });
});
