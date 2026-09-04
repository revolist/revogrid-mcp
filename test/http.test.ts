import { Socket } from 'node:net';
import { Duplex } from 'node:stream';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/reindexService.js', () => ({
  runReindex: vi.fn()
}));

import { loadConfig } from '../src/config/env.js';
import { createApp } from '../src/http/createApp.js';
import { InMemoryContentRepository } from '../src/repositories/inMemoryContentRepository.js';
import { runReindex } from '../src/services/reindexService.js';
import { createServices, createServicesForRepository } from '../src/services/serviceFactory.js';

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

  it('reports catalog snapshot readiness', async () => {
    const response = await app.inject({ method: 'GET', url: '/ready' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ready',
      service: 'revogrid-mcp',
      snapshot: { schemaVersion: 2, packageCount: 8 }
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
    const body = response.json();
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      id: 1
    });
  });

  it.each([
    ['/', '2025-11-25'],
    ['/pro', '2024-11-05']
  ])('negotiates supported protocol %s on %s', async (url, protocolVersion) => {
    const response = await app.inject({
      method: 'POST',
      url,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
      },
      payload: {
        ...initializePayload,
        id: `initialize-${url}-${protocolVersion}`,
        params: { ...initializePayload.params, protocolVersion }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      result: { protocolVersion }
    });
  });

  it('serves the modern 2026 protocol on the same endpoint', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2026-07-28',
        'mcp-method': 'server/discover'
      },
      payload: {
        jsonrpc: '2.0',
        id: 'discover-modern',
        method: 'server/discover',
        params: {
          _meta: {
            'io.modelcontextprotocol/protocolVersion': '2026-07-28',
            'io.modelcontextprotocol/clientCapabilities': {}
          }
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      result: { supportedVersions: expect.arrayContaining(['2026-07-28']) }
    });
  });

  it.each(['/', '/pro'])('lists the bundled tools over %s', async (url) => {
    const initializeResponse = await app.inject({
      method: 'POST',
      url,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
      },
      payload: initializePayload
    });

    expect(initializeResponse.statusCode).toBe(200);
    expect(initializeResponse.headers['mcp-session-id']).toBeUndefined();

    const response = await app.inject({
      method: 'POST',
      url,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2024-11-05'
      },
      payload: {
        jsonrpc: '2.0',
        id: `tools-${url}`,
        method: 'tools/list',
        params: {}
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      id: `tools-${url}`,
      result: {
        tools: expect.arrayContaining([
          expect.objectContaining({ name: 'search_revogrid_docs' }),
          expect.objectContaining({ name: 'find_examples' }),
          expect.objectContaining({ name: 'resolve_feature_matrix' }),
          expect.objectContaining({ name: 'get_migration_notes' }),
          expect.objectContaining({
            name: 'list_revogrid_capabilities',
            outputSchema: expect.any(Object),
            annotations: expect.objectContaining({ readOnlyHint: true, destructiveHint: false })
          }),
          expect.objectContaining({ name: 'inspect_revogrid_api' }),
          expect.objectContaining({ name: 'plan_revogrid_implementation' }),
          expect.objectContaining({ name: 'validate_revogrid_usage' })
        ])
      }
    });
    expect(body.result.tools).toHaveLength(8);
    expect(body.result.tools.every((tool: { annotations?: Record<string, boolean> }) =>
      tool.annotations?.readOnlyHint === true &&
      tool.annotations?.destructiveHint === false &&
      tool.annotations?.openWorldHint === false,
    )).toBe(true);
    expect(body.result.tools.find((tool: { name: string }) => tool.name === 'search_revogrid_docs'))
      .toMatchObject({
        inputSchema: {
          properties: { query: { description: expect.any(String) } }
        }
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

  it('advertises developer catalog resource templates', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2025-11-25'
      },
      payload: { jsonrpc: '2.0', id: 21, method: 'resources/templates/list', params: {} }
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('revogrid://capabilities/{id}');
    expect(response.body).toContain('revogrid://symbols/{qualifiedName}');
    expect(response.body).toContain('revogrid://packages/{packageName}');
    expect(response.body).toContain('revogrid://examples/{id}');
  });

  it('returns validated structured capability results with resource links', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
      },
      payload: {
        jsonrpc: '2.0',
        id: 23,
        method: 'tools/call',
        params: {
          name: 'list_revogrid_capabilities',
          arguments: { product: 'pivot', limit: 1 }
        }
      }
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.result.structuredContent.results).toHaveLength(1);
    expect(body.result.structuredContent.results[0]).not.toHaveProperty('evidence');
    expect(body.result.content[0].text).toMatch(/^list_revogrid_capabilities: 1 result/);
    expect(body.result.content[0].text).not.toContain('"results"');
    expect(body.result.content).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'resource_link', uri: expect.stringContaining('revogrid://capabilities/') })
    ]));
  });

  it('returns an actionable tool error for an invalid pagination cursor', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
      },
      payload: {
        jsonrpc: '2.0',
        id: 24,
        method: 'tools/call',
        params: {
          name: 'search_revogrid_docs',
          arguments: { query: 'pivot', cursor: 'invalid' }
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      result: {
        isError: true,
        content: [expect.objectContaining({
          text: expect.stringContaining('Retry without cursor')
        })]
      }
    });
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

  it.each([
    ['kanban', 'kanban'],
    ['scheduler', 'event scheduler']
  ])('resolves the Pro %s feature from the canonical root endpoint', async (query, featureName) => {
    const response = await app.inject({
      method: 'POST',
      url: '/',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
      },
      payload: {
        jsonrpc: '2.0',
        id: `feature-${query}`,
        method: 'tools/call',
        params: {
          name: 'resolve_feature_matrix',
          arguments: {
            featureName: query
          }
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain(`\"featureName\":\"${featureName}\"`);
    expect(response.body).toContain('\"supported\":true');
    expect(response.body).toContain('\"requiresPro\":true');
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

describe('reindex webhook', () => {
  const config = loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    CONTENT_BACKEND: 'memory',
    ENABLE_RATE_LIMITING: 'false',
    ENABLE_ORIGIN_VALIDATION: 'false',
    WEBHOOK_TOKEN: 'test-webhook-token'
  });
  const dataset = {
    chunks: [],
    versions: [],
    features: [],
    migrations: []
  };
  const result = {
    dataset,
    summary: {
      writtenTo: '/tmp/catalog.json',
      persistedToPostgres: false,
      totalSourceFiles: 0,
      sourceFilesByCategory: {
        docs: 0,
        examples: 0,
        changelog: 0,
        api: 0
      },
      sourceFilesByRepository: {},
      sourceRoots: [],
      chunkCount: 0,
      chunksByDocType: {},
      chunksBySurface: {},
      chunksByFramework: {},
      requiresProChunkCount: 0,
      typedApiChunkCount: 0
    }
  };
  const mockedRunReindex = vi.mocked(runReindex);

  beforeEach(() => {
    mockedRunReindex.mockReset();
  });

  it('accepts a reindex before background work completes', async () => {
    let completeReindex!: (value: typeof result) => void;
    const pendingReindex = new Promise<typeof result>((resolve) => {
      completeReindex = resolve;
    });
    mockedRunReindex.mockReturnValue(pendingReindex);

    const repository = new InMemoryContentRepository(dataset);
    const updateDataset = vi.spyOn(repository, 'updateDataset');
    const app = createApp(config, createServicesForRepository(repository));
    await app.ready();

    const responsePromise = app.inject({
      method: 'POST',
      url: '/hooks/reindex',
      headers: {
        'x-webhook-token': 'test-webhook-token'
      },
      payload: {
        updateSources: true
      }
    });
    const settledBeforeCompletion = await Promise.race([
      responsePromise.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 500))
    ]);

    completeReindex(result);
    const response = await responsePromise;
    await vi.waitFor(() => expect(updateDataset).toHaveBeenCalledWith(dataset));

    expect(settledBeforeCompletion).toBe(true);
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      status: 'accepted',
      message: 'Re-indexing started'
    });
    expect(mockedRunReindex).toHaveBeenCalledWith({ updateSources: true });

    await app.close();
  });

  it('rejects an overlapping reindex without starting duplicate work', async () => {
    let completeReindex!: (value: typeof result) => void;
    const pendingReindex = new Promise<typeof result>((resolve) => {
      completeReindex = resolve;
    });
    mockedRunReindex.mockReturnValue(pendingReindex);

    const app = createApp(
      config,
      createServicesForRepository(new InMemoryContentRepository(dataset))
    );
    await app.ready();

    const firstResponse = await app.inject({
      method: 'POST',
      url: '/hooks/reindex',
      headers: {
        'x-webhook-token': 'test-webhook-token'
      }
    });
    const secondResponse = await app.inject({
      method: 'POST',
      url: '/hooks/reindex',
      headers: {
        'x-webhook-token': 'test-webhook-token'
      }
    });

    completeReindex(result);

    expect(firstResponse.statusCode).toBe(202);
    expect(secondResponse.statusCode).toBe(409);
    expect(secondResponse.json()).toEqual({
      status: 'in_progress',
      message: 'Re-indexing is already in progress'
    });
    expect(mockedRunReindex).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it('keeps the reindex trigger protected', async () => {
    const app = createApp(
      config,
      createServicesForRepository(new InMemoryContentRepository(dataset))
    );
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/hooks/reindex',
      headers: {
        'x-webhook-token': 'wrong-token'
      }
    });

    expect(response.statusCode).toBe(401);
    expect(mockedRunReindex).not.toHaveBeenCalled();

    await app.close();
  });
});
