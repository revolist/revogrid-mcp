import 'dotenv/config';

import { createLogger } from '@revogrid-mcp/shared';

import { loadConfig } from './config/env.js';
import { createApp } from './http/createApp.js';
import { createServices } from './services/serviceFactory.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.LOG_LEVEL);
  const services = await createServices(config);
  const app = createApp(config, services);

  await app.listen({
    host: config.HOST,
    port: config.PORT
  });

  logger.info('revogrid_mcp_started', {
    host: config.HOST,
    port: config.PORT,
    backend: config.CONTENT_BACKEND
  });
}

void bootstrap();
