import type { Entitlement, Framework } from '@revogrid-mcp/content-model';
import { normalizeVersion } from '@revogrid-mcp/content-model';

import type { ContentRepository } from '../repositories/contentRepository.js';
import type {
  MigrationResolution,
  MigrationService,
  RevogridSearchService
} from '../types/catalog.js';

export class DefaultMigrationService implements MigrationService {
  public constructor(
    private readonly repository: ContentRepository,
    private readonly searchService: RevogridSearchService,
  ) {}

  public async resolveMigration(
    fromVersion: string,
    toVersion: string,
    options: {
      framework?: Framework | undefined;
      entitlement: Entitlement;
    },
  ): Promise<MigrationResolution> {
    const migrations = await this.repository.getMigrations();
    const source = normalizeVersion(fromVersion);
    const target = normalizeVersion(toVersion);

    const migration =
      migrations.find(
        (candidate) =>
          normalizeVersion(candidate.fromVersion) === source &&
          normalizeVersion(candidate.toVersion) === target &&
          (!candidate.framework || candidate.framework === options.framework),
      ) ?? null;

    if (!migration) {
      return {
        migration: null,
        docs: [],
        examples: []
      };
    }

    const filters = {
      framework: options.framework,
      limit: 5,
      entitlement: options.entitlement
    };

    const docs = await this.searchService.searchDocs(
      `upgrade ${migration.fromVersion} ${migration.toVersion}`,
      filters,
    );
    const examples = await this.searchService.findExamples('editable grid', filters);

    return {
      migration,
      docs: docs.filter((match) => migration.recommendedDocIds.includes(match.chunk.id)),
      examples: examples.filter((match) => migration.recommendedExampleIds.includes(match.chunk.id))
    };
  }
}
