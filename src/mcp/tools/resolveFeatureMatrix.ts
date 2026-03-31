import {
  ResolveFeatureMatrixInputSchema,
  ResolveFeatureMatrixOutputSchema
} from '@revogrid-mcp/content-model';

import type { AppServices, RequestContext } from '../../types/catalog.js';
import { formatExampleResult, formatSearchResult } from '../../services/resultFormatting.js';
import { filterVisibleMatches } from './shared.js';

export async function handleResolveFeatureMatrix(
  rawInput: unknown,
  services: AppServices,
  context: RequestContext,
) {
  const input = ResolveFeatureMatrixInputSchema.parse(rawInput);
  const resolution = await services.featureService.resolveFeature(input.featureName, {
    framework: input.framework,
    version: input.version,
    entitlement: context.entitlement
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
    bestDocs: filterVisibleMatches(resolution.docs, context).map(formatSearchResult),
    bestExamples: filterVisibleMatches(resolution.examples, context).map(formatExampleResult),
    fallbackApproach: resolution.feature.fallbackApproach
  });
}
