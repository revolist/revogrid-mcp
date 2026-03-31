import type { Entitlement, Framework } from '@revogrid-mcp/content-model';
import { normalizeText } from '@revogrid-mcp/shared';

import type { ContentRepository } from '../repositories/contentRepository.js';
import type {
  FeatureMatrixService,
  FeatureResolution,
  RevogridSearchService
} from '../types/catalog.js';

export class DefaultFeatureMatrixService implements FeatureMatrixService {
  public constructor(
    private readonly repository: ContentRepository,
    private readonly searchService: RevogridSearchService,
  ) {}

  public async listFeatures(entitlement: Entitlement) {
    void entitlement;
    return this.repository.getFeatures();
  }

  public async resolveFeature(
    featureName: string,
    options: {
      framework?: Framework | undefined;
      version?: string | undefined;
      entitlement: Entitlement;
    },
  ): Promise<FeatureResolution> {
    const features = await this.repository.getFeatures();
    const normalizedName = normalizeText(featureName);

    const feature =
      features.find((candidate) => normalizeText(candidate.featureName) === normalizedName) ??
      features.find((candidate) =>
        candidate.aliases.some((alias) => normalizeText(alias) === normalizedName),
      ) ??
      null;

    if (!feature) {
      return {
        feature: null,
        docs: [],
        examples: []
      };
    }

    const filters = {
      framework: options.framework,
      version: options.version,
      limit: 3,
      entitlement: options.entitlement
    };

    const docs = await this.searchService.searchDocs(feature.featureName, filters);
    const examples = await this.searchService.findExamples(feature.featureName, filters);

    return {
      feature,
      docs: docs.filter((match) => feature.relatedChunkIds.includes(match.chunk.id)),
      examples: examples.filter((match) => feature.relatedExampleIds.includes(match.chunk.id))
    };
  }
}
