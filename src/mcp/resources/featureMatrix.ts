import type { AppServices, RequestContext } from '../../types/catalog.js';
import { filterVisibleChunks, summarizeCatalogCoverage } from '../tools/shared.js';

export async function readFeatureMatrixResource(
  services: AppServices,
  context: RequestContext,
) {
  const features = await services.featureService.listFeatures(context.entitlement);
  const chunks = await services.contentRepository.getChunks();
  const visibleChunks = filterVisibleChunks(chunks, context);
  const chunkById = new Map(visibleChunks.map((chunk) => [chunk.id, chunk]));
  const coverage = summarizeCatalogCoverage(visibleChunks);

  return features.map((feature) => {
    const relatedChunkIds = feature.relatedChunkIds ?? [];
    const relatedExampleIds = feature.relatedExampleIds ?? [];
    const relatedChunks = relatedChunkIds
      .map((id) => chunkById.get(id))
      .filter((chunk): chunk is (typeof chunks)[number] => Boolean(chunk));
    const bySurface = relatedChunks.reduce<Record<string, number>>((acc, chunk) => {
      acc[chunk.surface] = (acc[chunk.surface] ?? 0) + 1;
      return acc;
    }, {});

    return {
      featureName: feature.featureName,
      supported: feature.supported,
      requiresPro: feature.requiresPro,
      stability: feature.stability,
      supportedFrameworks: feature.supportedFrameworks,
      notes: feature.notes,
      fallbackApproach: feature.fallbackApproach,
      relatedChunkSurfaceCounts: bySurface,
      relatedExampleChunkCount: relatedExampleIds.length,
      totalIndexedReferences: relatedChunkIds.length + relatedExampleIds.length,
      catalogCoverage: coverage
    };
  });
}
