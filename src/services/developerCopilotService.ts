import type {
  CapabilityRecord,
  CatalogSnapshot,
  DocumentChunk,
  Framework,
  PackageRecord
} from '@revogrid-mcp/content-model';
import { normalizeText, unique } from '@revogrid-mcp/shared';

import type { ContentRepository } from '../repositories/contentRepository.js';
import type { CapabilityFilters, DeveloperCopilotService } from '../types/catalog.js';
import { decodePageCursor, encodePageCursor } from './pagination.js';

type CatalogIndex = {
  key: string;
  capabilities: CapabilityRecord[];
  publicCapabilities: CapabilityRecord[];
  capabilitiesByLookup: Map<string, CapabilityRecord[]>;
  capabilitiesByPackageAndName: Map<string, CapabilityRecord[]>;
  packages: PackageRecord[];
  packagesByName: Map<string, PackageRecord>;
};

export class DefaultDeveloperCopilotService implements DeveloperCopilotService {
  private cachedIndex?: CatalogIndex;
  private pendingIndex: { key: string; value: Promise<CatalogIndex> } | undefined;

  public constructor(private readonly repository: ContentRepository) {}

  public async listCapabilities(filters: CapabilityFilters) {
    const index = await this.getCatalogIndex();
    const cursorContext = {
      product: filters.product,
      packageName: filters.packageName,
      framework: filters.framework,
      version: filters.version,
      stability: filters.stability,
      tier: filters.tier,
      snapshot: index.key
    };
    const offset = decodePageCursor(filters.cursor, 'list_revogrid_capabilities', cursorContext);
    const capabilities = index.publicCapabilities
      .filter((item) => !filters.product || item.product === filters.product)
      .filter((item) => !filters.packageName || item.packageName === filters.packageName)
      .filter((item) => !filters.framework || item.frameworks.includes(filters.framework))
      .filter((item) => !filters.version || item.packageVersion === filters.version)
      .filter((item) => !filters.stability || item.stability === filters.stability)
      .filter((item) => !filters.tier || item.tier === filters.tier);
    const results = capabilities.slice(offset, offset + filters.limit);
    const nextOffset = offset + results.length;
    return {
      results: results.map((item) => ({
        id: item.id,
        name: item.name,
        aliases: item.aliases,
        product: item.product,
        packageName: item.packageName,
        packageVersion: item.packageVersion,
        tier: item.tier,
        requiresPro: item.requiresPro,
        stability: item.stability,
        frameworks: item.frameworks,
        symbolKind: item.symbolKind,
        resourceUri: `revogrid://capabilities/${encodeURIComponent(item.id)}`
      })),
      ...(nextOffset < capabilities.length
        ? { nextCursor: encodePageCursor(nextOffset, 'list_revogrid_capabilities', cursorContext) }
        : {})
    };
  }

  public async inspectApi(
    query: string,
    options: { packageName?: string | undefined; framework?: Framework | undefined; version?: string | undefined; includeInternal?: boolean | undefined },
  ) {
    const index = await this.getCatalogIndex();
    const qualified = splitQualifiedName(query);
    const effectiveOptions = {
      ...options,
      packageName: options.packageName ?? qualified.packageName
    };
    const lookupQuery = qualified.name;
    const normalized = normalizeText(lookupQuery);
    const capabilities = this.resolveFromIndex(lookupQuery, effectiveOptions, index);
    const internalCandidates = options.includeInternal && capabilities.length === 0
      ? (await this.getInternalCandidates(lookupQuery, effectiveOptions))
        .filter((chunk) => chunk.visibility === 'internal')
        .filter((chunk) => !effectiveOptions.packageName || chunk.packageName === effectiveOptions.packageName)
        .filter((chunk) => !effectiveOptions.framework || !chunk.framework || chunk.framework === effectiveOptions.framework)
        .filter((chunk) => !effectiveOptions.version || chunk.packageVersion === effectiveOptions.version)
        .filter((chunk) => normalizeText(chunk.title) === normalized || chunk.symbols.some((symbol) => normalizeText(symbol) === normalized))
        .slice(0, 20)
        .map((chunk): CapabilityRecord => {
          const packageRecord = chunk.packageName ? index.packagesByName.get(chunk.packageName) : undefined;
          return {
            id: `internal:${chunk.id}:${encodeURIComponent(lookupQuery)}`,
            name: lookupQuery,
            aliases: [lookupQuery],
            product: chunk.product ?? packageRecord?.product ?? 'core',
            packageName: chunk.packageName ?? packageRecord?.name ?? '@revolist/revogrid',
            packageVersion: chunk.packageVersion ?? packageRecord?.version ?? chunk.version ?? '0.0.0',
            tier: packageRecord?.tier ?? (chunk.requiresPro ? 'pro' : 'core'),
            requiresPro: chunk.requiresPro,
            visibility: 'internal',
            stability: chunk.stability ?? 'stable',
            frameworks: chunk.framework ? [chunk.framework] : ['vanilla'],
            symbolKind: chunk.symbolKind ?? 'unknown',
            ...(chunk.signature ? { signature: chunk.signature } : {}),
            configuration: [],
            configurationKeys: [],
            methods: [],
            events: [],
            dependencies: packageRecord?.dependencies ?? [],
            peerDependencies: packageRecord?.peerDependencies ?? [],
            relations: [],
            evidence: [{
              chunkId: chunk.id,
              repository: chunk.sourcePath?.startsWith('revogrid-pro/') ? 'revogrid-pro' : 'revogrid',
              ...(chunk.sourceRevision ? { revision: chunk.sourceRevision } : {}),
              ...(chunk.sourcePath ? { sourcePath: chunk.sourcePath } : {}),
              url: chunk.url,
              authority: chunk.authority ?? 30
            }],
            relatedExampleIds: []
          };
        })
      : [];
    if (capabilities.length === 0) capabilities.push(...internalCandidates);
    const productMatch = capabilities.filter((item) =>
      item.id.startsWith('package:') &&
      (normalizeText(item.product) === normalized || normalizeText(item.name) === normalized),
    );
    const directOwnerMatches = capabilities.filter((item) => item.product !== 'enterprise');
    const preferred = productMatch.length === 1
      ? productMatch
      : directOwnerMatches.length === 1
        ? directOwnerMatches
        : capabilities;
    const match = preferred[0];
    return preferred.length === 1 && match
      ? { match, candidates: [] }
      : { candidates: preferred };
  }

  public async planImplementation(input: {
    objective: string;
    capabilities: string[];
    framework: Framework;
    installedVersions?: Record<string, string> | undefined;
    targetVersions?: Record<string, string> | undefined;
    constraints?: string[] | undefined;
  }) {
    const index = await this.getCatalogIndex();
    const requested = unique(input.capabilities);
    const resolved: CapabilityRecord[] = [];
    const unresolved: string[] = [];
    for (const name of requested) {
      const candidates = this.resolveFromIndex(name, { framework: input.framework }, index);
      const match = selectPreferredMatch(name, candidates);
      if (match) resolved.push(match);
      else unresolved.push(name);
    }
    const packages = unique(resolved.map((item) => item.packageName));
    const warnings = unique([
      ...versionWarnings(resolved, input.installedVersions ?? {}),
      ...targetVersionWarnings(resolved, input.targetVersions ?? {})
    ]);

    return {
      objective: input.objective,
      framework: input.framework,
      packages: packages.map((packageName) => ({
        packageName,
        version: input.targetVersions?.[packageName] ?? resolved.find((item) => item.packageName === packageName)?.packageVersion,
        requiresPro: resolved.some((item) => item.packageName === packageName && item.requiresPro)
      })),
      imports: resolved.map((item) => ({
        packageName: item.packageName,
        symbol: item.name,
        importPath: item.exportPath ?? item.packageName
      })),
      pluginOrder: orderCapabilities(resolved),
      configuration: unique(resolved.flatMap((item) => item.configuration)),
      lifecycle: buildLifecycle(resolved),
      dataFlow: buildDataFlow(resolved),
      events: unique(resolved.flatMap((item) => item.events)),
      methods: unique(resolved.flatMap((item) => item.methods)),
      evidence: resolved.flatMap((item) => item.evidence).slice(0, 30),
      constraints: input.constraints ?? [],
      warnings,
      unresolved
    };
  }

  public async validateUsage(input: {
    framework?: Framework | undefined;
    imports: Array<{ packageName: string; symbols: string[] }>;
    features?: string[] | undefined;
    configuration?: Array<{ capability: string; packageName?: string | undefined; keys: string[] }> | undefined;
    installedVersions?: Record<string, string> | undefined;
    sourceSnippet?: string | undefined;
  }) {
    const index = await this.getCatalogIndex();
    const capabilities = index.capabilities;
    const packages = index.packages;
    const diagnostics: Array<Record<string, unknown>> = [];

    for (const imported of input.imports) {
      const packageRecord = index.packagesByName.get(imported.packageName);
      if (!packageRecord) {
        diagnostics.push(diagnostic('unknown-package', 'error', `Unknown RevoGrid package ${imported.packageName}.`));
        continue;
      }
      for (const symbol of imported.symbols) {
        const normalizedSymbol = normalizeText(symbol);
        const matches = index.capabilitiesByPackageAndName.get(
          packageSymbolKey(imported.packageName, normalizedSymbol),
        ) ?? [];
        if (matches.length === 0) {
          const owners = (index.capabilitiesByLookup.get(normalizedSymbol) ?? [])
            .filter((item) => item.visibility === 'public')
            .map((item) => item.packageName);
          diagnostics.push(diagnostic(
            'invalid-import',
            'error',
            owners.length > 0
              ? `${symbol} is exported by ${unique(owners).join(', ')}, not ${imported.packageName}.`
              : `${symbol} is not a supported public export of ${imported.packageName}.`,
          ));
          continue;
        }
        diagnostics.push(...capabilityDiagnostics(matches[0], input.framework, input.imports, packageRecord.dependencies));
      }
    }

    for (const feature of input.features ?? []) {
      const candidates = this.resolveFromIndex(
        feature,
        input.framework ? { framework: input.framework } : {},
        index,
      );
      const match = selectPreferredMatch(feature, candidates);
      if (!match && candidates.length === 0) {
        diagnostics.push(diagnostic('unknown-capability', 'warning', `No exact supported capability matched ${feature}.`));
      } else if (!match) {
        diagnostics.push(diagnostic('ambiguous-capability', 'warning', `${feature} matches multiple packages; specify a package.`));
      } else {
        diagnostics.push(...capabilityDiagnostics(match, input.framework, input.imports));
      }
    }

    for (const configured of input.configuration ?? []) {
      const options = {
        ...(configured.packageName ? { packageName: configured.packageName } : {}),
        ...(input.framework ? { framework: input.framework } : {})
      };
      const candidates = this.resolveFromIndex(configured.capability, options, index);
      const match = selectPreferredMatch(configured.capability, candidates);
      if (!match) {
        diagnostics.push(diagnostic(
          candidates.length > 0 ? 'ambiguous-configuration' : 'unknown-configuration-target',
          'error',
          `Cannot validate configuration for ${configured.capability}; provide an exact exported capability and package.`,
        ));
        continue;
      }
      const knownKeys = new Set(match.configurationKeys.map(normalizeText));
      for (const key of configured.keys) {
        if (!knownKeys.has(normalizeText(key))) {
          diagnostics.push(diagnostic(
            'unknown-config-key',
            'error',
            `${key} is not a documented configuration key for ${match.name}.`,
          ));
        }
      }
    }

    diagnostics.push(...versionWarnings(capabilities, input.installedVersions ?? {}).map((message) =>
      diagnostic('version-mismatch', 'warning', message),
    ));

    if (input.sourceSnippet) {
      for (const packageName of extractRevolistImports(input.sourceSnippet)) {
        if (!packages.some((item) => item.name === packageName)) {
          diagnostics.push(diagnostic('unknown-package', 'error', `Source imports unknown package ${packageName}.`));
        }
      }
    }

    return { valid: !diagnostics.some((item) => item.severity === 'error'), diagnostics };
  }

  public async getCapability(id: string) {
    return (await this.getCatalogIndex()).capabilitiesByLookup.get(normalizeText(id))
      ?.find((item) => item.id === id) ?? null;
  }

  public async getPackage(name: string) {
    return (await this.getCatalogIndex()).packagesByName.get(name) ?? null;
  }

  public async getExample(id: string) {
    const chunk = this.repository.getChunkById
      ? await this.repository.getChunkById(id)
      : (await this.repository.getChunks()).find((item) => item.id === id) ?? null;
    return chunk && ['example', 'live-demo'].includes(chunk.docType) ? chunk : null;
  }

  public getSnapshot() {
    return this.repository.getSnapshot();
  }

  private async getCatalogIndex(): Promise<CatalogIndex> {
    const snapshot = await this.repository.getSnapshot();
    const key = snapshotKey(snapshot);
    if (this.cachedIndex?.key === key) return this.cachedIndex;
    if (this.pendingIndex?.key === key) return this.pendingIndex.value;

    const value = Promise.all([
      this.repository.getCapabilities(),
      this.repository.getPackages()
    ]).then(([capabilities, packages]) => buildCatalogIndex(key, capabilities, packages));
    this.pendingIndex = { key, value };
    try {
      this.cachedIndex = await value;
      return this.cachedIndex;
    } finally {
      if (this.pendingIndex?.value === value) this.pendingIndex = undefined;
    }
  }

  private resolveFromIndex(
    query: string,
    options: { packageName?: string | undefined; framework?: Framework | undefined; version?: string | undefined; includeInternal?: boolean | undefined },
    index: CatalogIndex,
  ): CapabilityRecord[] {
    return (index.capabilitiesByLookup.get(normalizeText(query)) ?? [])
      .filter((item) => options.includeInternal || item.visibility === 'public')
      .filter((item) => !options.packageName || item.packageName === options.packageName)
      .filter((item) => !options.framework || item.frameworks.includes(options.framework))
      .filter((item) => !options.version || item.packageVersion === options.version)
      .sort(compareCapabilities);
  }

  private async getInternalCandidates(
    query: string,
    options: { packageName?: string | undefined; framework?: Framework | undefined; version?: string | undefined },
  ): Promise<DocumentChunk[]> {
    if (!this.repository.findLexicalCandidates) return this.repository.getChunks();
    return this.repository.findLexicalCandidates(query, {
      visibility: 'internal',
      ...(options.packageName ? { packageName: options.packageName } : {}),
      ...(options.framework ? { framework: options.framework } : {}),
      ...(options.version ? { version: options.version } : {})
    }, 50);
  }
}

function buildCatalogIndex(
  key: string,
  capabilities: CapabilityRecord[],
  packages: PackageRecord[],
): CatalogIndex {
  const sorted = [...capabilities].sort(compareCapabilities);
  const capabilitiesByLookup = new Map<string, CapabilityRecord[]>();
  const capabilitiesByPackageAndName = new Map<string, CapabilityRecord[]>();
  for (const capability of sorted) {
    for (const lookup of unique([capability.id, capability.name, ...capability.aliases]).map(normalizeText)) {
      appendMapValue(capabilitiesByLookup, lookup, capability);
    }
    if (capability.visibility === 'public') {
      appendMapValue(
        capabilitiesByPackageAndName,
        packageSymbolKey(capability.packageName, normalizeText(capability.name)),
        capability,
      );
    }
  }
  return {
    key,
    capabilities: sorted,
    publicCapabilities: sorted.filter((item) => item.visibility === 'public'),
    capabilitiesByLookup,
    capabilitiesByPackageAndName,
    packages: [...packages],
    packagesByName: new Map(packages.map((item) => [item.name, item]))
  };
}

function appendMapValue(
  index: Map<string, CapabilityRecord[]>,
  key: string,
  value: CapabilityRecord,
): void {
  const values = index.get(key);
  if (values) values.push(value);
  else index.set(key, [value]);
}

function snapshotKey(snapshot: CatalogSnapshot | null): string {
  if (!snapshot) return `uncached:${Date.now()}:${Math.random()}`;
  return `${snapshot.schemaVersion}:${snapshot.generatedAt}:${JSON.stringify(snapshot.sourceRevisions)}`;
}

function packageSymbolKey(packageName: string, normalizedName: string): string {
  return `${packageName}\u0000${normalizedName}`;
}

function splitQualifiedName(query: string): { packageName?: string; name: string } {
  const separator = query.lastIndexOf('#');
  if (separator <= 0 || separator === query.length - 1) return { name: query };
  return { packageName: query.slice(0, separator), name: query.slice(separator + 1) };
}

function selectPreferredMatch(query: string, capabilities: CapabilityRecord[]): CapabilityRecord | undefined {
  const normalized = normalizeText(splitQualifiedName(query).name);
  const productMatches = capabilities.filter((item) =>
    item.id.startsWith('package:') &&
    (normalizeText(item.product) === normalized || normalizeText(item.name) === normalized),
  );
  if (productMatches.length === 1) return productMatches[0];
  const directOwners = capabilities.filter((item) => item.product !== 'enterprise');
  if (directOwners.length === 1) return directOwners[0];
  return capabilities.length === 1 ? capabilities[0] : undefined;
}

function compareCapabilities(left: CapabilityRecord, right: CapabilityRecord): number {
  return left.packageName.localeCompare(right.packageName) || left.name.localeCompare(right.name);
}

function orderCapabilities(capabilities: CapabilityRecord[]): string[] {
  return [...capabilities]
    .sort((left, right) => left.dependencies.length - right.dependencies.length || compareCapabilities(left, right))
    .map((item) => item.id);
}

function buildLifecycle(capabilities: CapabilityRecord[]): string[] {
  const ordered = orderCapabilities(capabilities);
  return [
    ...unique(capabilities.map((item) => `Install ${item.packageName}@${item.packageVersion}.`)),
    ...ordered.map((id) => `Import and register ${id} after its declared dependencies.`),
    ...unique(capabilities.flatMap((item) => item.configuration)).map((name) => `Apply the exported ${name} configuration contract.`),
    ...unique(capabilities.flatMap((item) => item.events)).map((name) => `Handle the documented ${name} event where required.`)
  ];
}

function buildDataFlow(capabilities: CapabilityRecord[]): string[] {
  return unique(capabilities.flatMap((item) => item.relations)
    .filter((relation) => relation.type === 'configuredBy' || relation.type === 'dependsOn' || relation.type === 'demonstratedBy')
    .map((relation) => `${relation.type}:${relation.targetId}`));
}

function versionWarnings(capabilities: CapabilityRecord[], installed: Record<string, string>): string[] {
  const warnings: string[] = [];
  for (const [packageName, installedVersion] of Object.entries(installed)) {
    const expected = capabilities.find((item) => item.packageName === packageName)?.packageVersion;
    if (expected && major(expected) !== major(installedVersion)) {
      warnings.push(`${packageName} ${installedVersion} differs from indexed major version ${expected}.`);
    }
  }
  return unique(warnings);
}

function targetVersionWarnings(capabilities: CapabilityRecord[], targets: Record<string, string>): string[] {
  const warnings: string[] = [];
  for (const [packageName, targetVersion] of Object.entries(targets)) {
    const indexed = capabilities.find((item) => item.packageName === packageName)?.packageVersion;
    if (!indexed) warnings.push(`No resolved capability establishes a target for ${packageName}.`);
    else if (major(indexed) !== major(targetVersion)) {
      warnings.push(`${packageName} target ${targetVersion} is outside indexed major version ${indexed}.`);
    }
  }
  return warnings;
}

function major(version: string): string {
  return version.replace(/^[^0-9]*/, '').split('.')[0] ?? version;
}

function diagnostic(code: string, severity: 'error' | 'warning', message: string) {
  return { code, severity, message };
}

function capabilityDiagnostics(
  capability: CapabilityRecord | undefined,
  framework: Framework | undefined,
  imports: Array<{ packageName: string; symbols: string[] }>,
  packageDependencies: string[] = [],
) {
  if (!capability) return [];
  const diagnostics: Array<Record<string, unknown>> = [];
  if (framework && !capability.frameworks.includes(framework)) {
    diagnostics.push(diagnostic('framework-incompatible', 'error', `${capability.name} is not cataloged for ${framework}.`));
  }
  if (capability.stability === 'deprecated') {
    diagnostics.push(diagnostic('deprecated-api', 'warning', `${capability.name} is deprecated.`));
  }
  if (capability.requiresPro) {
    diagnostics.push(diagnostic('requires-pro', 'warning', `${capability.name} requires the ${capability.tier} package/license tier.`));
  }
  const importedPackages = new Set(imports.map((item) => item.packageName));
  for (const dependency of unique([...capability.dependencies, ...packageDependencies]).filter((item) => item.startsWith('@revolist/'))) {
    if (!importedPackages.has(dependency)) {
      diagnostics.push(diagnostic('missing-dependency', 'warning', `${capability.name} depends on ${dependency}.`));
    }
  }
  return diagnostics;
}

function extractRevolistImports(source: string): string[] {
  return unique([...source.matchAll(/(?:from\s+|import\s*)['"](@revolist\/[a-z0-9-]+)['"]/gi)].map((match) => match[1]).filter(Boolean) as string[]);
}
