import {
  NodeStreamableHTTPServerTransport,
  toNodeHandler,
  toWebRequest
} from '@modelcontextprotocol/node';
import {
  createMcpHandler,
  isLegacyRequest,
  type Transport
} from '@modelcontextprotocol/server';
import Fastify from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AppError, createLogger } from '@revogrid-mcp/shared';

import type { AppConfig } from '../config/env.js';
import { createMcpServer, type ToolObservation } from '../mcp/createMcpServer.js';
import { registerSecurityHooks } from './middleware/security.js';
import type { AppServices } from '../types/catalog.js';
import { runReindex } from '../services/reindexService.js';

type ReindexHookPayload = {
  updateSources?: boolean;
};

export function createApp(config: AppConfig, services: AppServices) {
  const logger = createLogger(config.LOG_LEVEL);
  let activeReindex: Promise<void> | null = null;
  let lastReindex: { status: 'never' | 'running' | 'succeeded' | 'failed'; completedAt?: string; error?: string } = {
    status: 'never'
  };
  const requestStats = {
    startedAt: new Date().toISOString(),
    healthRequests: 0,
    mcpRequestsTotal: 0,
    mcpRequestsSucceeded: 0,
    mcpRequestsFailed: 0,
    mcpRequestsByPath: {
      root: 0,
      pro: 0
    },
    tools: {} as Record<string, { count: number; totalLatencyMs: number; maxLatencyMs: number; zeroResults: number; internalResults: number; diagnostics: number }>
  };
  const app = Fastify({
    logger: false
  });

  registerSecurityHooks(app, config);

  const mcpHttpHandler = createMcpHandler(
    () => createMcpServer(services, (observation) => recordToolObservation(requestStats.tools, observation)),
    {
      legacy: 'reject',
      responseMode: 'auto',
      onerror: (error) => logger.error('mcp_handler_failed', { message: error.message })
    },
  );
  const handleModernMcpRequest = toNodeHandler(mcpHttpHandler, {
    onerror: (error) => logger.error('mcp_adapter_failed', { message: error.message })
  });

  app.addHook('onClose', async () => {
    await mcpHttpHandler.close();
  });

  app.get('/health', () => {
    requestStats.healthRequests += 1;

    return {
      status: 'ok',
      service: 'revogrid-mcp',
      backend: config.CONTENT_BACKEND
    };
  });

  app.get('/ready', async (_request, reply) => {
    const snapshot = await services.contentRepository.getSnapshot();
    if (!snapshot) return reply.status(503).send({ status: 'not-ready', service: 'revogrid-mcp' });
    return { status: 'ready', service: 'revogrid-mcp', snapshot };
  });

  app.get('/stats', async () => {
    const [packages, capabilities, snapshot] = await Promise.all([
      services.contentRepository.getPackages(),
      services.contentRepository.getCapabilities(),
      services.contentRepository.getSnapshot()
    ]);
    return ({
    service: 'revogrid-mcp',
    startedAt: requestStats.startedAt,
    backend: config.CONTENT_BACKEND,
    requests: {
      health: requestStats.healthRequests,
      mcpTotal: requestStats.mcpRequestsTotal,
      mcpSucceeded: requestStats.mcpRequestsSucceeded,
      mcpFailed: requestStats.mcpRequestsFailed,
      mcpByPath: requestStats.mcpRequestsByPath
    },
    catalog: {
      snapshot,
      snapshotAgeSeconds: snapshot ? Math.max(0, (Date.now() - Date.parse(snapshot.generatedAt)) / 1000) : null,
      packageCount: packages.length,
      capabilityCount: capabilities.length,
      publicCapabilityCount: capabilities.filter((item) => item.visibility === 'public').length
    },
    reindex: activeReindex ? { status: 'running' } : lastReindex,
    tools: Object.fromEntries(Object.entries(requestStats.tools).map(([tool, metrics]) => [tool, {
      count: metrics.count,
      averageLatencyMs: metrics.count > 0 ? Number((metrics.totalLatencyMs / metrics.count).toFixed(3)) : 0,
      maxLatencyMs: metrics.maxLatencyMs,
      zeroResultRate: metrics.count > 0 ? metrics.zeroResults / metrics.count : 0,
      internalResultRate: metrics.count > 0 ? metrics.internalResults / metrics.count : 0,
      diagnosticCount: metrics.diagnostics
    }]))
  });
  });

  const mcpHandler = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    requestStats.mcpRequestsTotal += 1;
    if (request.routeOptions.url === '/') {
      requestStats.mcpRequestsByPath.root += 1;
    }
    if (request.routeOptions.url === '/pro') {
      requestStats.mcpRequestsByPath.pro += 1;
    }

    reply.hijack();

    const rawRequest = request.raw as Parameters<typeof toWebRequest>[0];
    const webRequest = await toWebRequest(rawRequest, request.body);
    if (await isLegacyRequest(webRequest, request.body)) {
      const server = createMcpServer(services, (observation) =>
        recordToolObservation(requestStats.tools, observation));
      const transport = new NodeStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
      });
      try {
        await server.connect(transport as unknown as Transport);
        await transport.handleRequest(request.raw, reply.raw, request.body);
      } finally {
        await transport.close();
      }
    } else {
      await handleModernMcpRequest(
        request.raw as Parameters<typeof handleModernMcpRequest>[0],
        reply.raw,
        request.body,
      );
    }
    requestStats.mcpRequestsSucceeded += 1;
  };

  app.route({
    method: ['GET', 'POST', 'DELETE'],
    url: '/',
    handler: mcpHandler
  });

  app.route({
    method: ['GET', 'POST', 'DELETE'],
    url: '/pro',
    handler: mcpHandler
  });
  
  app.post('/hooks/reindex', async (request, reply) => {
    const token = request.headers['x-webhook-token'];
    
    if (!token || token !== config.WEBHOOK_TOKEN) {
      void reply.status(401).send({ error: 'Unauthorized: Invalid or missing webhook token' });
      return;
    }

    if (activeReindex) {
      return reply.status(409).send({
        status: 'in_progress',
        message: 'Re-indexing is already in progress'
      });
    }

    const payload = isRecord(request.body) ? (request.body as ReindexHookPayload) : {};
    lastReindex = { status: 'running' };
    activeReindex = runReindex({
      updateSources: payload.updateSources === true
    })
      .then(({ dataset, summary, sourceUpdate }) => {
        // Replace the unified catalog used by both MCP route aliases.
        services.contentRepository.updateDataset(dataset);
        logger.info('reindex_hook_completed', {
          sourceUpdate,
          summary
        });
        lastReindex = { status: 'succeeded', completedAt: new Date().toISOString() };
      })
      .catch((error: unknown) => {
        logger.error('reindex_hook_failed', {
          error: error instanceof Error ? error.message : String(error)
        });
        lastReindex = {
          status: 'failed',
          completedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error)
        };
      })
      .finally(() => {
        activeReindex = null;
      });

    return reply.status(202).send({
      status: 'accepted',
      message: 'Re-indexing started'
    });
  });

  app.setErrorHandler((error, _request, reply) => {
    requestStats.mcpRequestsFailed += 1;
    const handledError = error instanceof Error ? error : new Error('Unknown error');

    logger.error('request_failed', {
      message: handledError.message,
      stack: handledError.stack
    });

    if (error instanceof AppError) {
      void reply.status(error.statusCode).send({
        error: error.message
      });
      return;
    }

    void reply.status(500).send({
      error: 'Internal server error'
    });
  });

  return app;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function recordToolObservation(
  metricsByTool: Record<string, { count: number; totalLatencyMs: number; maxLatencyMs: number; zeroResults: number; internalResults: number; diagnostics: number }>,
  observation: ToolObservation,
): void {
  const metrics = metricsByTool[observation.tool] ?? {
    count: 0,
    totalLatencyMs: 0,
    maxLatencyMs: 0,
    zeroResults: 0,
    internalResults: 0,
    diagnostics: 0
  };
  metrics.count += 1;
  metrics.totalLatencyMs += observation.durationMs;
  metrics.maxLatencyMs = Math.max(metrics.maxLatencyMs, observation.durationMs);
  metrics.zeroResults += Number(observation.zeroResult);
  metrics.internalResults += Number(observation.internalResult);
  metrics.diagnostics += observation.diagnosticCount;
  metricsByTool[observation.tool] = metrics;
}
