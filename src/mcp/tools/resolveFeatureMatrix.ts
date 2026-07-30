import {
  ResolveFeatureMatrixInputSchema,
  ResolveFeatureMatrixOutputSchema
} from '@revogrid-mcp/content-model';

import type { AppServices } from '../../types/catalog.js';
import { formatExampleResult, formatSearchResult } from '../../services/resultFormatting.js';

export async function handleResolveFeatureMatrix(
  rawInput: unknown,
  services: AppServices,
) {
  const input = ResolveFeatureMatrixInputSchema.parse(rawInput);
  const resolution = await services.featureService.resolveFeature(input.featureName, {
    framework: input.framework,
    version: input.version
  });

  if (!resolution.feature) {
    return ResolveFeatureMatrixOutputSchema.parse({
      featureName: input.featureName,
      supported: false,
      requiresPro: false,
      supportedFrameworks: [],
      notes: ['No exact feature match was found in the current catalog.'],
      bestDocs: [],
      bestExamples: [],
      fallbackApproach: 'Use search_revogrid_docs to inspect related symbols or examples.'
    });
  }

  return ResolveFeatureMatrixOutputSchema.parse({
    featureName: resolution.feature.featureName,
    supported: resolution.feature.supported,
    requiresPro: resolution.feature.requiresPro,
    stability: resolution.feature.stability,
    supportedFrameworks: resolution.feature.supportedFrameworks,
    notes: resolution.feature.notes ?? [],
    bestDocs: resolution.docs.map(formatSearchResult),
    bestExamples: resolution.examples.map(formatExampleResult),
    fallbackApproach: resolution.feature.fallbackApproach
  });
}
