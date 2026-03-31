import {
  GetMigrationNotesInputSchema,
  GetMigrationNotesOutputSchema
} from '@revogrid-mcp/content-model';

import type { AppServices, RequestContext } from '../../types/catalog.js';
import { formatExampleResult, formatSearchResult } from '../../services/resultFormatting.js';
import { filterVisibleMatches } from './shared.js';

export async function handleGetMigrationNotes(
  rawInput: unknown,
  services: AppServices,
  context: RequestContext,
) {
  const input = GetMigrationNotesInputSchema.parse(rawInput);
  const resolution = await services.migrationService.resolveMigration(
    input.fromVersion,
    input.toVersion,
    {
      framework: input.framework,
      entitlement: context.entitlement
    },
  );

  if (!resolution.migration) {
    return GetMigrationNotesOutputSchema.parse({
      fromVersion: input.fromVersion,
      toVersion: input.toVersion,
      framework: input.framework,
      breakingChanges: [],
      renamedSymbols: [],
      changedDefaults: [],
      packageChanges: [],
      recommendedDocs: [],
      recommendedExamples: []
    });
  }

  return GetMigrationNotesOutputSchema.parse({
    fromVersion: resolution.migration.fromVersion,
    toVersion: resolution.migration.toVersion,
    framework: input.framework,
    breakingChanges: resolution.migration.breakingChanges,
    renamedSymbols: resolution.migration.renamedSymbols,
    changedDefaults: resolution.migration.changedDefaults,
    packageChanges: resolution.migration.packageChanges,
    recommendedDocs: filterVisibleMatches(resolution.docs, context).map(formatSearchResult),
    recommendedExamples: filterVisibleMatches(resolution.examples, context).map(formatExampleResult)
  });
}
