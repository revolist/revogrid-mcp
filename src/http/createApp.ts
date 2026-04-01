import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import Fastify from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AppError, createLogger } from '@revogrid-mcp/shared';

import { resolveRequestContext } from '../auth/authenticator.js';
import type { AppConfig } from '../config/env.js';
import { createMcpServer } from '../mcp/createMcpServer.js';
import { registerSecurityHooks } from './middleware/security.js';
import type { AppServices } from '../types/catalog.js';

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
      mcp: 0
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

  const mcpHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    requestStats.mcpRequestsTotal += 1;
    if (request.routeOptions.url === '/') {
      requestStats.mcpRequestsByPath.root += 1;
    }
    if (request.routeOptions.url === '/mcp') {
      requestStats.mcpRequestsByPath.mcp += 1;
    }

    const context = resolveRequestContext(request, config);
    const server = createMcpServer(services, context);
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
    url: '/mcp',
    handler: mcpHandler
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
