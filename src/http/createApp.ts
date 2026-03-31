import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import Fastify from 'fastify';

import { AppError, createLogger } from '@revogrid-mcp/shared';

import { resolveRequestContext } from '../auth/authenticator.js';
import type { AppConfig } from '../config/env.js';
import { createMcpServer } from '../mcp/createMcpServer.js';
import { registerSecurityHooks } from './middleware/security.js';
import type { AppServices } from '../types/catalog.js';

export function createApp(config: AppConfig, services: AppServices) {
  const logger = createLogger(config.LOG_LEVEL);
  const app = Fastify({
    logger: false
  });

  registerSecurityHooks(app, config);

  app.get('/health', () => ({
    status: 'ok',
    service: 'revogrid-mcp',
    backend: config.CONTENT_BACKEND
  }));

  app.route({
    method: ['GET', 'POST', 'DELETE'],
    url: '/mcp',
    handler: async (request, reply) => {
      const context = resolveRequestContext(request, config);
      const server = createMcpServer(services, context);
      const transport = new StreamableHTTPServerTransport({
        enableJsonResponse: true
      });

      reply.hijack();

      try {
        await server.connect(transport as unknown as Transport);
        await transport.handleRequest(request.raw, reply.raw, request.body);
      } finally {
        await transport.close();
      }
    }
  });

  app.setErrorHandler((error, _request, reply) => {
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
