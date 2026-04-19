import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import Fastify from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AppError, createLogger } from '@revogrid-mcp/shared';

import { resolveProRequestContext, resolveRequestContext } from '../auth/authenticator.js';
import type { AppConfig } from '../config/env.js';
import { createMcpServer } from '../mcp/createMcpServer.js';
import { FilteredContentRepository } from '../repositories/filteredContentRepository.js';
import { createServicesForRepository } from '../services/serviceFactory.js';
import { registerSecurityHooks } from './middleware/security.js';
import type { AppServices } from '../types/catalog.js';
import { runReindex } from '../services/reindexService.js';

export function createApp(config: AppConfig, services: AppServices) {
  const logger = createLogger(config.LOG_LEVEL);
  const publicServices = createServicesForRepository(
    new FilteredContentRepository(services.contentRepository, (chunk) => !chunk.requiresPro),
  );
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
    routeServices: AppServices,
    contextResolver: typeof resolveRequestContext,
  ) => {
    requestStats.mcpRequestsTotal += 1;
    if (request.routeOptions.url === '/') {
      requestStats.mcpRequestsByPath.root += 1;
    }
    if (request.routeOptions.url === '/pro') {
      requestStats.mcpRequestsByPath.pro += 1;
    }

    const context = contextResolver(request, config);
    const server = createMcpServer(routeServices, context);
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
    handler: (request, reply) => mcpHandler(request, reply, publicServices, resolveRequestContext)
  });

  app.route({
    method: ['GET', 'POST', 'DELETE'],
    url: '/pro',
    handler: (request, reply) => mcpHandler(request, reply, services, resolveProRequestContext)
  });
  
  app.post('/hooks/reindex', async (request, reply) => {
    const token = request.headers['x-webhook-token'];
    
    if (!token || token !== config.WEBHOOK_TOKEN) {
      void reply.status(401).send({ error: 'Unauthorized: Invalid or missing webhook token' });
      return;
    }

    try {
      const { dataset, summary } = await runReindex();
      
      // Update both public and private repositories if applicable
      // In this setup, services.contentRepository is the root content repository
      services.contentRepository.updateDataset(dataset);
      
      return {
        status: 'success',
        message: 'Re-indexing completed successfully',
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
