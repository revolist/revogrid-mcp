import { Duplex } from 'node:stream';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import jsonwebtoken from 'jsonwebtoken';

import { loadConfig } from '../src/config/env.js';
import { createApp } from '../src/http/createApp.js';
import { createServices } from '../src/services/serviceFactory.js';

if (typeof Duplex.prototype.destroySoon !== 'function') {
  Duplex.prototype.destroySoon = Duplex.prototype.destroy;
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

  it('keeps common MCP resources free of pro surfaces', async () => {
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
          uri: 'revogrid://versions/all'
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain('"pro"');
    expect(response.body).not.toContain('"pivot"');
  });

  it('keeps common MCP search results free of pro docs', async () => {
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
    expect(response.body).not.toContain('"requiresPro":true');
    expect(response.body).not.toContain('pro.rv-grid.com');
  });

  it('exposes combined community and pro docs over /pro when auth is disabled', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/pro',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
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

describe('/pro auth integration', () => {
  const secret = 'test-jwt-secret';
  const config = loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    CONTENT_BACKEND: 'memory',
    ENABLE_RATE_LIMITING: 'false',
    ENABLE_ORIGIN_VALIDATION: 'false',
    ENABLE_PRO_ROUTE_AUTH: 'true',
    AUTH_JWT_SECRET: secret
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

  it('rejects /pro requests without a valid bearer token when auth is enabled', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/pro',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
      },
      payload: initializePayload
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: 'A valid bearer token is required for /pro.'
    });
  });

  it('accepts /pro requests with a valid bearer token when auth is enabled', async () => {
    const token = jsonwebtoken.sign({ sub: 'user-123' }, secret, {
      algorithm: 'HS256',
      expiresIn: '1m'
    });

    const response = await app.inject({
      method: 'POST',
      url: '/pro',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${token}`
      },
      payload: {
        jsonrpc: '2.0',
        id: 4,
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
