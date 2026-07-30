import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import Fastify from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AppError, createLogger } from '@revogrid-mcp/shared';

import type { AppConfig } from '../config/env.js';
import { createMcpServer } from '../mcp/createMcpServer.js';
import { registerSecurityHooks } from './middleware/security.js';
import type { AppServices } from '../types/catalog.js';
import { runReindex } from '../services/reindexService.js';

type ReindexHookPayload = {
  updateSources?: boolean;
};

export function createApp(config: AppConfig, services: AppServices) {
  const logger = createLogger(config.LOG_LEVEL);
  const requestStats = {
    startedAt: new Date().toISOString(),
    healthRequests: 0,
    mcpRequestsTotal: 0,
    mcpRequestsSucceeded: 0,
    mcpRequestsFailed: 0,
    mcpRequestsByPath: {
      root: 0,
      pro: 0
    }
  };
  const app = Fastify({
    logger: false
  });

  registerSecurityHooks(app, config);

  app.get('/health', () => {
    requestStats.healthRequests += 1;

    return {
      status: 'ok',
      service: 'revogrid-mcp',
      backend: config.CONTENT_BACKEND
    };
  });

  app.get('/stats', () => ({
    service: 'revogrid-mcp',
    startedAt: requestStats.startedAt,
    backend: config.CONTENT_BACKEND,
    requests: {
      health: requestStats.healthRequests,
      mcpTotal: requestStats.mcpRequestsTotal,
      mcpSucceeded: requestStats.mcpRequestsSucceeded,
      mcpFailed: requestStats.mcpRequestsFailed,
      mcpByPath: requestStats.mcpRequestsByPath
    }
  }));

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

    const server = createMcpServer(services);
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true
    });

    reply.hijack();

    try {
      await server.connect(transport as unknown as Transport);
      await transport.handleRequest(request.raw, reply.raw, request.body);
      requestStats.mcpRequestsSucceeded += 1;
    } finally {
      await transport.close();
    }
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

    try {
      const payload = isRecord(request.body) ? (request.body as ReindexHookPayload) : {};
      const { dataset, summary, sourceUpdate } = await runReindex({
        updateSources: payload.updateSources === true
      });
      
      // Replace the unified catalog used by both MCP route aliases.
      services.contentRepository.updateDataset(dataset);
      
      return {
        status: 'success',
        message: 'Re-indexing completed successfully',
        sourceUpdate,
        summary
      };
    } catch (error) {
      logger.error('reindex_hook_failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      void reply.status(500).send({ error: 'Re-indexing failed' });
    }
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
