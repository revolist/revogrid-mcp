import { buildCatalogDataset } from '@revogrid-mcp/ingestion';

import type { AppConfig } from '../config/env.js';
import type { ContentRepository } from '../repositories/contentRepository.js';
import { InMemoryContentRepository } from '../repositories/inMemoryContentRepository.js';
import { PostgresContentRepository } from '../repositories/postgresContentRepository.js';
import { DefaultFeatureMatrixService } from './featureService.js';
import { DefaultMigrationService } from './migrationService.js';
import { DefaultRevogridSearchService } from './searchService.js';
import type { AppServices } from '../types/catalog.js';

export async function createServices(config: AppConfig): Promise<AppServices> {
  const contentRepository = await createContentRepository(config);
  return createServicesForRepository(contentRepository);
}

export function createServicesForRepository(contentRepository: ContentRepository): AppServices {
  const searchService = new DefaultRevogridSearchService(contentRepository);
  const featureService = new DefaultFeatureMatrixService(contentRepository, searchService);
  const migrationService = new DefaultMigrationService(contentRepository, searchService);

  return {
    contentRepository,
    searchService,
    featureService,
    migrationService
  };
}

async function createContentRepository(config: AppConfig): Promise<ContentRepository> {
  if (config.CONTENT_BACKEND === 'postgres') {
    const { Pool } = await import('pg');
    return new PostgresContentRepository(
      new Pool({
        host: config.POSTGRES_HOST,
        port: config.POSTGRES_PORT,
        database: config.POSTGRES_DB,
        user: config.POSTGRES_USER,
        password: config.POSTGRES_PASSWORD
      }),
      config.PGVECTOR_TABLE,
    );
  }

  return new InMemoryContentRepository(await buildCatalogDataset());
}
