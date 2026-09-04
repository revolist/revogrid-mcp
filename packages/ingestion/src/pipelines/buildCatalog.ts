import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  CapabilityRecord,
  DocumentChunk,
  FeatureRecord,
  MigrationNoteRecord,
  PackageRecord,
  SeedDataset,
  VersionRecord
} from '@revogrid-mcp/content-model';
import { SeedDatasetSchema } from '@revogrid-mcp/content-model';
import { normalizeText, sha256, tokenize, unique } from '@revogrid-mcp/shared';

import { stripHtml } from '../parsers/html.js';
import {
  extractCodeBlocks,
  extractExternalLinks,
  extractFirstHeading,
  parseFrontmatter,
  resolveMarkdownIncludes,
  stripMarkdown
} from '../parsers/markdown.js';
import {
  extractTypeInstructionDocument,
  type TypeInstructionDocument
} from '../parsers/typescript.js';
import { getApiSources } from '../sources/api.js';
import { getChangelogSources } from '../sources/changelog.js';
import { getDocsSources } from '../sources/docs.js';
import { getExampleSources } from '../sources/examples.js';
import { resolveSourceRoot } from '../sources/_shared.js';
import {
  buildPublishedPackageCatalog,
  type PublishedPackageCatalog,
  type PublicExport
} from '../sources/packageCatalog.js';
import type { SourceCategory, SourceFile, SourceRepository } from '../sources/types.js';

type PackageVersions = {
  revogrid: string;
  revogridPro: string;
};

type SourceDocument = {
  chunk: DocumentChunk;
  source: SourceFile;
  rawBody: string;
  resolvedContent: string;
  featureArtifacts: FeatureRecord[];
};

const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx']);
const TEXT_LIKE_EXTENSIONS = new Set(['.md', '.mdx', '.astro', '.vue', '.svelte', '.ts', '.tsx', '.js', '.jsx']);

export async function buildCatalogDataset(): Promise<SeedDataset> {
  const [revogridRoot, revogridProRoot] = await Promise.all([
    resolveSourceRoot(import.meta.url, 'revogrid'),
    resolveSourceRoot(import.meta.url, 'revogrid-pro')
  ]);
  const [docs, examples, changelog, api, packageVersions, packageCatalog] = await Promise.all([
    getDocsSources(),
    getExampleSources(),
    getChangelogSources(),
    getApiSources(),
    getPackageVersions(),
    buildPublishedPackageCatalog({ revogrid: revogridRoot, 'revogrid-pro': revogridProRoot })
  ]);

  const normalizedDocuments = (
    await Promise.all(
      deduplicateSources([...docs, ...examples, ...changelog, ...api]).map((source) =>
        normalizeSourceFile(source, packageVersions, packageCatalog),
      ),
    )
  )
    .filter((document): document is SourceDocument => Boolean(document))
    .sort((left, right) => left.chunk.id.localeCompare(right.chunk.id));
  const chunks = normalizedDocuments.map((document) => document.chunk);
  const capabilities = deriveCapabilities(chunks, packageCatalog);
  const canonicalPluginFeatures = deriveCanonicalPluginFeatures(chunks);
  const capabilityFeatures = deriveFeatureRecordsFromCapabilities(capabilities);
  const explicitFeatures = extractFeatureArtifacts(normalizedDocuments);

  return SeedDatasetSchema.parse({
    chunks,
    versions: deriveVersions(chunks, packageVersions),
    features: mergeFeatureRecords([...canonicalPluginFeatures, ...capabilityFeatures], explicitFeatures),
    migrations: deriveMigrations(normalizedDocuments, packageVersions.revogrid),
    packages: packageCatalog.packages,
    capabilities,
    snapshot: {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      sourceRevisions: packageCatalog.sourceRevisions,
      packageCount: packageCatalog.packages.length,
      capabilityCount: capabilities.length,
      publicExportCount: packageCatalog.exports.length,
      exampleCount: chunks.filter(isExampleChunk).length
    }
  });
}

const REQUIRED_PUBLISHED_PACKAGES = [
  '@revolist/revogrid',
  '@revolist/revogrid-pro',
  '@revolist/pivot',
  '@revolist/gantt',
  '@revolist/scheduler',
  '@revolist/kanban',
  '@revolist/revogrid-collaborative-editing',
  '@revolist/revogrid-enterprise'
] as const;

export function validateCatalogDataset(dataset: SeedDataset): void {
  const errors: string[] = [];
  const packageNames = new Set((dataset.packages ?? []).map((item) => item.name));
  for (const packageName of REQUIRED_PUBLISHED_PACKAGES) {
    if (!packageNames.has(packageName)) errors.push(`missing published package ${packageName}`);
  }
  for (const packageRecord of dataset.packages ?? []) {
    if (packageRecord.exportEntrypoints.length === 0) {
      errors.push(`package ${packageRecord.name} has no published entrypoint metadata`);
    }
    if (!(dataset.capabilities ?? []).some((item) => item.packageName === packageRecord.name)) {
      errors.push(`package ${packageRecord.name} has no public capabilities`);
    }
  }
  const representedExports = (dataset.capabilities ?? []).filter((item) => !item.id.startsWith('package:'));
  if (dataset.snapshot && representedExports.length < dataset.snapshot.publicExportCount) {
    errors.push(`only ${representedExports.length} of ${dataset.snapshot.publicExportCount} public exports are represented`);
  }
  if (!dataset.chunks.some((item) => item.docType === 'example' || item.docType === 'live-demo')) {
    errors.push('catalog has no indexed examples');
  }
  if (dataset.chunks.some((item) => item.sourcePath?.includes('/content/docs/guides/') && item.visibility !== 'public')) {
    errors.push('portal guides must be public');
  }
  const indexedExamples = dataset.chunks.filter(isExampleChunk).length;
  if (dataset.snapshot && indexedExamples !== dataset.snapshot.exampleCount) {
    errors.push(`snapshot declares ${dataset.snapshot.exampleCount} examples but indexed ${indexedExamples}`);
  }
  if (errors.length > 0) throw new Error(`Catalog coverage validation failed: ${errors.join('; ')}`);
}

async function normalizeSourceFile(
  source: SourceFile,
  packageVersions: PackageVersions,
  packageCatalog: PublishedPackageCatalog,
): Promise<SourceDocument | null> {
  const extension = path.extname(source.absolutePath).toLowerCase();
  if (!TEXT_LIKE_EXTENSIONS.has(extension)) {
    return null;
  }

  const rawContent = await readFile(source.absolutePath, 'utf8');
  const resolvedContent = MARKDOWN_EXTENSIONS.has(extension)
    ? await resolveMarkdownIncludes(rawContent, source.absolutePath)
    : rawContent;
  const { attributes, body } = parseFrontmatter(resolvedContent);
  const typeInstructions = shouldExtractTypeInstructions(source, extension)
    ? extractTypeInstructionDocument(resolvedContent)
    : null;
  const rawTitle =
    attributes.title ??
    typeInstructions?.title ??
    extractFirstHeading(body) ??
    humanizePath(source.relativePath);
  const docType = detectDocType(source.category, source.relativePath, extension);
  const title = cleanTitle(rawTitle, source, docType);
  const framework = detectFramework(source.relativePath, title);
  const packageMetadata = resolvePackageMetadata(source, title, packageCatalog);
  const visibility = resolveVisibility(source, packageCatalog);
  const detectedSurface = detectSurface(source, title, resolvedContent);
  const surface = visibility === 'public'
    ? packageMetadata.product === 'pivot' || detectedSurface === 'pivot'
      ? 'pivot'
      : packageMetadata.product === 'core'
        ? 'core'
        : 'pro'
    : detectedSurface;
  const requiresPro = inferRequiresPro(source, title, resolvedContent, surface);
  const plainBody = normalizeBody(body, extension, typeInstructions);
  if (!plainBody) {
    return null;
  }

  const url = buildCanonicalUrl(source);
  const summary = summarizeBody(attributes.description ?? typeInstructions?.summary, plainBody);
  const featureArtifacts = parseFeatureArtifactsFromSource({
    body: body,
    path: source.relativePath,
    content: resolvedContent
  });

  return {
    source,
    rawBody: body,
    resolvedContent,
    featureArtifacts,
    chunk: {
      id: buildChunkId(source.repository, source.relativePath),
      title,
      body: plainBody,
      summary,
      framework,
      surface,
      docType,
      version: detectVersion(source, packageVersions),
      requiresPro,
      symbols: extractSymbols(title, resolvedContent, plainBody, typeInstructions?.symbols),
      stability: detectStability(resolvedContent),
      url,
      sourcePath: `${source.repository}/${source.relativePath}`.replace(/\\/g, '/'),
      exampleUrl: extractExampleUrl(source, resolvedContent, url),
      packageNames: extractPackageNames(resolvedContent),
      releaseDate: extractReleaseDate(attributes, body, source.relativePath),
      product: packageMetadata.product,
      packageName: packageMetadata.packageName,
      packageVersion: packageMetadata.packageVersion,
      visibility,
      symbolKind: packageMetadata.publicExport?.symbolKind,
      sourceRevision: packageMetadata.sourceRevision,
      signature: packageMetadata.publicExport?.signature,
      exportPath: packageMetadata.publicExport?.exportPath,
      authority: resolveAuthority(source, packageCatalog)
    }
  };
}

function parseFeatureArtifactsFromSource(params: {
  path: string;
  body: string;
  content: string;
}): FeatureRecord[] {
  const normalizedPath = params.path.replace(/\\/g, '/').toLowerCase();
  if (!isFeatureArtifactPath(normalizedPath)) {
    return [];
  }

  const featureNotes = extractFeatureSectionBody(params.body);
  const titleBasedFallback = deriveFeatureNameFromTitle(
    (params.body.match(/^#+\s*(.+)$/m)?.[1] ?? params.body.split('\n')[0] ?? '').trim() || '',
  );
  const directRecords = parseFeatureMatrixMarkdown(params.content, normalizedPath);
  if (directRecords.length > 0) {
    return directRecords;
  }

  if (!titleBasedFallback) {
    return [];
  }

  return [
    {
      featureName: titleBasedFallback,
      supported: true,
      requiresPro: params.path.includes('/pro/') || params.path.toLowerCase().includes('pivot'),
      supportedFrameworks: detectFrameworksFromText(featureNotes),
      notes: [`Feature matrix entry from ${params.path}: ${featureNotes}`],
      relatedChunkIds: [],
      relatedExampleIds: [],
      aliases: [titleBasedFallback]
    }
  ];
}

function extractFeatureSectionBody(value: string): string {
  return value
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .slice(0, 40)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveFeatureNameFromTitle(value: string): string | null {
  const normalized = normalizeText(value)
    .replace(/feature$|features$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || null;
}

function isFeatureArtifactPath(normalizedPath: string): boolean {
  return (
    normalizedPath.endsWith('.feature.md') ||
    normalizedPath.endsWith('.features.md') ||
    normalizedPath.endsWith('.feature-matrix.md') ||
    normalizedPath.endsWith('_feature.md') ||
    normalizedPath.endsWith('_features.md') ||
    normalizedPath.includes('/features/') ||
    (normalizedPath.includes('features') && normalizedPath.includes('matrix'))
  );
}

function parseFeatureMatrixMarkdown(content: string, sourcePath: string): FeatureRecord[] {
  const rows = parseFeatureMatrixRows(content);
  if (rows.length > 0) {
    return rows
      .map((row) => buildFeatureRecordFromFeatureRow(row, sourcePath))
      .filter((value): value is FeatureRecord => value !== null);
  }

  const records = parseFeatureBullets(content)
    .map((entry) => buildFeatureRecordFromFeatureRow(entry, sourcePath))
    .filter((value): value is FeatureRecord => value !== null);

  return records;
}

type FeatureMatrixRow = {
  name: string;
  supported: boolean;
  notes: string[];
  requiresPro: boolean;
};

function parseFeatureMatrixRows(content: string): FeatureMatrixRow[] {
  const lines = content.split('\n').map((line) => line.trimEnd());
  const headerLineIndex = lines.findIndex((line, index) => {
    const nextLine = lines[index + 1];
    return isTableLine(line) && Boolean(nextLine && isSeparatorLine(nextLine));
  });

  if (headerLineIndex < 0) {
    return [];
  }

  const headerLine = lines[headerLineIndex];
  if (!headerLine) {
    return [];
  }
  const headerColumns = splitMarkdownTableLine(headerLine);
  if (headerColumns.length < 2) {
    return [];
  }

  const statusColumns = headerColumns.map((column) => ({
    isProSignal: /pro|enterprise/i.test(column),
    isNotesColumn: /notes|description|comment|details/i.test(column)
  }));

  const rows: FeatureMatrixRow[] = [];
  for (let index = headerLineIndex + 2; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }
    if (!isTableLine(line) || line.startsWith('|---')) {
      continue;
    }

    const cells = splitMarkdownTableLine(line);
    if (cells.length <= 1) {
      continue;
    }

    const firstCell = cells[0];
    if (!firstCell) {
      continue;
    }
    const name = cleanFeatureNameFromLine(firstCell);
    if (!name) {
      continue;
    }

    const statusCells = cells.slice(1);
    const matrixSupport = assessMatrixSupport(statusCells);
    if (!matrixSupport.hasValue) {
      continue;
    }

    const notes = cells
      .slice(1)
      .map((column, columnIndex) => {
        const statusColumn = statusColumns[columnIndex + 1];
        if (!statusColumn || statusColumn.isProSignal) {
          return '';
        }

        if (statusColumn.isNotesColumn) {
          return column.trim();
        }

        const normalized = cleanCellText(column);
        return parseSupportText(normalized).known ? '' : cleanCellText(column);
      })
      .filter(Boolean);

    const requiresPro = matrixSupport.hasProSupport || statusColumns.some((statusColumn, columnIndex) => {
      if (!statusColumn.isProSignal || columnIndex === 0) {
        return false;
      }
      const normalizedStatus = cleanCellText(statusCells[columnIndex - 1] ?? '');
      return normalizedStatus && isSupportedStatus(normalizedStatus);
    }) || /pro|enterprise/i.test(name);

    rows.push({
      name,
      supported: matrixSupport.supported,
      requiresPro,
      notes
    });
  }

  return rows;
}

function parseFeatureBullets(content: string): FeatureMatrixRow[] {
  const rows: FeatureMatrixRow[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(
      /^\s*[-*+]\s*(?:\[(?<checkbox>[xX ])\]\s*)?(?<name>[^\s].+?)(?:\s*[-:]\s*(?<note>.+))?$/,
    );
    if (!match?.groups?.name) {
      continue;
    }

    const name = cleanFeatureNameFromLine(match.groups.name);
    const checkbox = match.groups.checkbox?.trim().toLowerCase();
    const rawSupport = match.groups.note ?? '';
    const note = match.groups.note?.trim() ?? '';
    const noteValue = note ? [note] : [];
    const normalized = normalizeText(name);
    if (!normalized) {
      continue;
    }

    const supports = checkbox === 'x' ? true : checkbox === ' ' ? false : null;
    const supportHint = parseSupportText(rawSupport);

    rows.push({
      name,
      supported: supports ?? (supportHint.known ? supportHint.supported : true),
      requiresPro: /pro|enterprise/i.test(note) || /pro|enterprise/i.test(normalized),
      notes: noteValue
    });
  }

  return rows;
}

type MatrixSupportSummary = {
  hasValue: boolean;
  supported: boolean;
  hasProSupport: boolean;
};

function assessMatrixSupport(cells: string[]): MatrixSupportSummary {
  let hasSupportValue = false;
  let hasSupported = false;
  let hasProSupport = false;

  for (const rawCell of cells) {
    const normalized = cleanCellText(rawCell);
    const parsed = parseSupportText(normalized);
    if (!parsed.known) {
      continue;
    }

    hasSupportValue = true;
    if (parsed.supported) {
      hasSupported = true;
      hasProSupport ||= /pro|enterprise/i.test(normalized);
    }
  }

  if (!hasSupportValue) {
    return { hasValue: false, supported: true, hasProSupport: false };
  }

  return {
    hasValue: true,
    supported: hasSupported,
    hasProSupport
  };
}

function parseSupportText(value: string): { supported: boolean; known: boolean } {
  const normalized = cleanCellText(value).toLowerCase();
  const normalizedForSupport = normalized.replace(/[\s·•\-_]+/g, ' ');

  if (
    /\b(no|false|unsupported|not supported)\b/.test(normalizedForSupport) ||
    normalizedForSupport.includes('✗') ||
    normalizedForSupport === 'x' ||
    normalizedForSupport === 'n' ||
    normalizedForSupport === 'no'
  ) {
    return { supported: false, known: true };
  }

  if (/\b(yes|supported|enabled|true)\b/.test(normalizedForSupport) || normalizedForSupport.includes('✓') || normalizedForSupport.includes('✔')) {
    return { supported: true, known: true };
  }

  if (normalizedForSupport.includes('partial') || normalizedForSupport.includes('limited')) {
    return { supported: true, known: true };
  }

  return { supported: false, known: false };
}

function splitMarkdownTableLine(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((value) => value.trim())
    .map(cleanCellText);
}

function cleanCellText(value: string): string {
  return stripMarkdown(value.replace(/`/g, ' ')).trim();
}

function isSupportedStatus(text: string): boolean {
  const support = parseSupportText(text);
  return support.known && support.supported;
}

function cleanFeatureNameFromLine(value: string): string {
  return stripMarkdown(value)
    .replace(/^[-*+]\s*/, '')
    .replace(/^\*\*|(\*\*)$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildFeatureRecordFromFeatureRow(
  row: FeatureMatrixRow,
  sourcePath: string,
): FeatureRecord | null {
  const featureName = normalizeText(row.name);
  if (!featureName) {
    return null;
  }

  const titleName = row.name.trim();
  return {
    featureName: titleName,
    supported: row.supported,
    requiresPro: row.requiresPro || sourcePath.includes('/pro/') || sourcePath.includes('pivot'),
    stability: 'stable',
    supportedFrameworks: detectFrameworksFromText(`${titleName} ${row.notes.join(' ')}`),
    notes: row.notes.length > 0 ? row.notes : [`Reference: ${sourcePath}`],
    relatedChunkIds: [],
    relatedExampleIds: [],
    aliases: [titleName.toLowerCase(), normalizeText(titleName).replace(/\s+/g, '-')]
  };
}

function detectFrameworksFromText(value: string): Array<Exclude<DocumentChunk['framework'], undefined> | 'vanilla'> {
  const normalized = normalizeText(value).toLowerCase();
  const frameworks: Array<Exclude<DocumentChunk['framework'], undefined> | 'vanilla'> = [];
  if (normalized.includes('react')) {
    frameworks.push('react');
  }
  if (normalized.includes('vue')) {
    frameworks.push('vue');
  }
  if (normalized.includes('angular')) {
    frameworks.push('angular');
  }
  if (normalized.includes('svelte')) {
    frameworks.push('svelte');
  }

  return frameworks.length > 0 ? frameworks : ['vanilla'];
}

function isSeparatorLine(value: string): boolean {
  return /^\s*\|?\s*[-:|\s]+$/i.test(value.trim());
}

function isTableLine(value: string): boolean {
  return value.includes('|') && value.trim().startsWith('|') && value.trim().endsWith('|');
}

async function getPackageVersions(): Promise<PackageVersions> {
  const [revogridRoot, revogridProRoot] = await Promise.all([
    resolveSourceRoot(import.meta.url, 'revogrid'),
    resolveSourceRoot(import.meta.url, 'revogrid-pro')
  ]);

  const [revogridPackageJson, revogridProPackageJson, revogridProPackage, revogridEnterprisePackage] = await Promise.all([
    readJsonFile<{ version?: string }>(path.join(revogridRoot.rootPath, 'package.json')),
    readJsonFile<{ version?: string }>(path.join(revogridProRoot.rootPath, 'package.json')),
    readJsonFileIfPresent<{ version?: string }>(
      path.join(revogridProRoot.rootPath, 'packages/pro/package.json'),
    ),
    readJsonFileIfPresent<{ version?: string }>(
      path.join(revogridProRoot.rootPath, 'packages/enterprise/package.json'),
    )
  ]);

  return {
    revogrid: revogridPackageJson.version ?? '0.0.0',
    revogridPro:
      revogridProPackageJson.version ??
      revogridProPackage?.version ??
      revogridEnterprisePackage?.version ??
      '0.0.0'
  };
}

async function readJsonFile<TPayload extends object>(filePath: string): Promise<TPayload> {
  const contents = await readFile(filePath, 'utf8');
  return JSON.parse(contents) as TPayload;
}

async function readJsonFileIfPresent<TPayload extends object>(filePath: string): Promise<TPayload | null> {
  try {
    return await readJsonFile<TPayload>(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function deduplicateSources(sources: SourceFile[]): SourceFile[] {
  const uniqueSources = new Map<string, SourceFile>();

  for (const source of sources) {
    const key = `${source.repository}:${source.relativePath}`;
    if (!uniqueSources.has(key)) {
      uniqueSources.set(key, source);
    }
  }

  return [...uniqueSources.values()].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function deriveVersions(chunks: DocumentChunk[], packageVersions: PackageVersions): VersionRecord[] {
  const latestVersions = new Set([packageVersions.revogrid, packageVersions.revogridPro]);
  const byVersion = new Map<string, VersionRecord>();

  for (const chunk of chunks) {
    if (!chunk.version) {
      continue;
    }

    const existing = byVersion.get(chunk.version);
    if (!existing) {
      byVersion.set(chunk.version, {
        version: chunk.version,
        label: chunk.version,
        latest: latestVersions.has(chunk.version),
        releaseDate: chunk.releaseDate,
        surfaces: [chunk.surface]
      });
      continue;
    }

    existing.latest ||= latestVersions.has(chunk.version);
    existing.releaseDate ??= chunk.releaseDate;
    existing.surfaces = unique([...existing.surfaces, chunk.surface]);
  }

  return [...byVersion.values()].sort((left, right) => compareVersionsDesc(left.version, right.version));
}

function deriveFeatureRecordsFromCapabilities(capabilities: CapabilityRecord[]): FeatureRecord[] {
  return capabilities.map((capability) => ({
    featureName: capability.id === 'package:@revolist/scheduler' ? 'event scheduler' : capability.name,
    supported: true,
    requiresPro: capability.requiresPro,
    stability: capability.stability,
    supportedFrameworks: capability.frameworks,
    notes: [`Public export from ${capability.packageName}@${capability.packageVersion}.`],
    relatedChunkIds: capability.evidence.map((item) => item.chunkId),
    relatedExampleIds: capability.relatedExampleIds,
    fallbackApproach: capability.requiresPro
      ? 'Use adjacent RevoGrid Core patterns if the required Pro package or license is unavailable.'
      : undefined,
    aliases: capability.aliases
  }));
}

function deriveCanonicalPluginFeatures(chunks: DocumentChunk[]): FeatureRecord[] {
  const plugins = new Map<string, 'pro' | 'enterprise'>();

  for (const chunk of chunks) {
    const match = chunk.sourcePath?.match(
      /^revogrid-pro\/packages\/(pro|enterprise)\/plugins\/([^/]+)\//,
    );
    const tier = match?.[1];
    const slug = match?.[2];
    if ((tier !== 'pro' && tier !== 'enterprise') || !slug) {
      continue;
    }

    if (!plugins.has(slug)) {
      plugins.set(slug, tier);
    }
  }

  return [...plugins.entries()]
    .map(([slug, tier]) => {
      const relatedChunks = chunks
        .filter((chunk) => isChunkRelatedToPlugin(chunk, slug))
        .sort(comparePluginReferencePriority);
      const featureName = slug.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
      const frameworks = unique(
        relatedChunks
          .map((chunk) => chunk.framework)
          .filter((framework): framework is NonNullable<DocumentChunk['framework']> => Boolean(framework)),
      );
      const aliases = [slug, featureName, `${featureName} plugin`];
      if (slug === 'event-scheduler') {
        aliases.push('scheduler');
      }

      return {
        featureName,
        supported: true,
        requiresPro: true,
        stability: resolvePluginStability(relatedChunks),
        supportedFrameworks: frameworks.length > 0 ? frameworks : ['vanilla'],
        notes: [`Indexed from the RevoGrid ${tier === 'enterprise' ? 'Enterprise' : 'Pro'} ${slug} plugin.`],
        relatedChunkIds: relatedChunks.filter(isDocChunk).map((chunk) => chunk.id),
        relatedExampleIds: relatedChunks.filter(isExampleChunk).map((chunk) => chunk.id),
        fallbackApproach: 'Use adjacent RevoGrid Core patterns if the required Pro package or license is unavailable.',
        aliases: unique(aliases)
      } satisfies FeatureRecord;
    })
    .sort((left, right) => left.featureName.localeCompare(right.featureName));
}

function deriveCapabilities(
  chunks: DocumentChunk[],
  packageCatalog: PublishedPackageCatalog,
): CapabilityRecord[] {
  const packageMap = new Map(packageCatalog.packages.map((record) => [record.name, record]));
  const chunksBySymbol = new Map<string, DocumentChunk[]>();
  const chunksBySource = new Map<string, DocumentChunk[]>();
  for (const chunk of chunks) {
    if (chunk.sourcePath) appendToMap(chunksBySource, chunk.sourcePath.replace(/^revogrid(?:-pro)?\//, ''), chunk);
    for (const symbol of chunk.symbols) appendToMap(chunksBySymbol, normalizeText(symbol), chunk);
  }

  const exportedCapabilities: CapabilityRecord[] = packageCatalog.exports.map((publicExport) => {
    const packageRecord = packageMap.get(publicExport.packageName);
    if (!packageRecord) {
      throw new Error(`Public export ${publicExport.name} has no package record for ${publicExport.packageName}`);
    }
    const related = unique([
      ...(chunksBySource.get(publicExport.sourcePath) ?? []),
      ...(chunksBySymbol.get(normalizeText(publicExport.name)) ?? [])
    ])
      .filter((chunk) => chunk.packageName === publicExport.packageName)
      .sort((left, right) => (right.authority ?? 50) - (left.authority ?? 50))
      .slice(0, 12);
    const dependencies = unique([
      ...packageRecord.dependencies,
      ...extractRelatedSymbols(related, /(?:plugin|provider|service|manager)$/i),
    ]);
    const configuration = extractRelatedSymbols(related, /(?:config|options|props)$/i);
    const relatedExampleIds = related.filter(isExampleChunk).map((chunk) => chunk.id);
    const extendedSymbols = [...(publicExport.signature?.matchAll(/\bextends\s+([A-Za-z_$][\w$]*)/g) ?? [])]
      .map((match) => match[1])
      .filter((value): value is string => Boolean(value));

    return {
      id: buildCapabilityId(publicExport.packageName, publicExport.name),
      name: publicExport.name,
      aliases: unique([
        publicExport.name,
        splitIdentifierName(publicExport.name),
        splitIdentifierName(publicExport.name).replace(/\s+(plugin|component)$/, '')
      ]),
      product: packageRecord.product,
      packageName: packageRecord.name,
      packageVersion: packageRecord.version,
      tier: packageRecord.tier,
      requiresPro: packageRecord.requiresPro,
      visibility: 'public',
      stability: related.some((chunk) => chunk.stability === 'deprecated') ? 'deprecated' : 'stable',
      frameworks: unique(
        related.map((chunk) => chunk.framework).filter((value): value is NonNullable<typeof value> => Boolean(value)),
      ).length > 0
        ? unique(related.map((chunk) => chunk.framework).filter((value): value is NonNullable<typeof value> => Boolean(value)))
        : ['vanilla'],
      symbolKind: publicExport.symbolKind,
      exportPath: publicExport.exportPath,
      signature: publicExport.signature,
      configuration,
      configurationKeys: publicExport.configurationKeys ?? [],
      methods: unique([
        ...(publicExport.methods ?? []),
        ...extractRelatedSymbols(related, /^(?:get|set|add|remove|update|apply|clear|open|close|export|import)/i)
      ]),
      events: unique([
        ...(publicExport.events ?? []),
        ...extractRelatedSymbols(related, /(?:event|before|after|change|changed)$/i)
      ]),
      dependencies,
      peerDependencies: packageRecord.peerDependencies,
      relations: [
        ...dependencies
          .filter((dependency) => dependency.startsWith('@revolist/'))
          .map((dependency) => ({ type: 'dependsOn' as const, targetId: `package:${dependency}` })),
        ...configuration.map((symbol) => ({
          type: 'configuredBy' as const,
          targetId: buildCapabilityId(packageRecord.name, symbol)
        })),
        ...extendedSymbols.map((symbol) => ({
          type: 'extends' as const,
          targetId: buildCapabilityId(packageRecord.name, symbol)
        })),
        ...relatedExampleIds.map((id) => ({ type: 'demonstratedBy' as const, targetId: id }))
      ],
      evidence: related.map((chunk) => ({
        chunkId: chunk.id,
        repository: chunk.sourcePath?.startsWith('revogrid-pro/') ? 'revogrid-pro' : 'revogrid',
        ...(chunk.sourceRevision ? { revision: chunk.sourceRevision } : {}),
        ...(chunk.sourcePath ? { sourcePath: chunk.sourcePath } : {}),
        url: chunk.url,
        authority: chunk.authority ?? 50
      })),
      relatedExampleIds
    };
  });
  const packageCapabilities: CapabilityRecord[] = packageCatalog.packages.map((packageRecord) => {
    const capabilityName = packageRecord.product;
    const related = chunks
      .filter((chunk) => chunk.product === packageRecord.product && chunk.visibility === 'public')
      .sort((left, right) => (right.authority ?? 50) - (left.authority ?? 50))
      .slice(0, 12);
    return {
      id: `package:${packageRecord.name}`,
      name: capabilityName,
      aliases: unique([
        capabilityName,
        packageRecord.name,
        `${packageRecord.product} grid`,
        ...(packageRecord.product === 'scheduler' ? ['event scheduler'] : [])
      ]),
      product: packageRecord.product,
      packageName: packageRecord.name,
      packageVersion: packageRecord.version,
      tier: packageRecord.tier,
      requiresPro: packageRecord.requiresPro,
      visibility: 'public',
      stability: 'stable',
      frameworks: ['react', 'vue', 'angular', 'svelte', 'vanilla'],
      symbolKind: 'plugin',
      exportPath: packageRecord.name,
      configuration: [],
      configurationKeys: [],
      methods: [],
      events: [],
      dependencies: packageRecord.dependencies,
      peerDependencies: packageRecord.peerDependencies,
      relations: [
        ...packageRecord.dependencies
          .filter((dependency) => dependency.startsWith('@revolist/'))
          .map((dependency) => ({ type: 'dependsOn' as const, targetId: `package:${dependency}` })),
        ...related.filter(isExampleChunk).map((chunk) => ({
          type: 'demonstratedBy' as const,
          targetId: chunk.id
        }))
      ],
      evidence: related.map((chunk) => ({
        chunkId: chunk.id,
        repository: chunk.sourcePath?.startsWith('revogrid-pro/') ? 'revogrid-pro' : 'revogrid',
        ...(chunk.sourceRevision ? { revision: chunk.sourceRevision } : {}),
        ...(chunk.sourcePath ? { sourcePath: chunk.sourcePath } : {}),
        url: chunk.url,
        authority: chunk.authority ?? 50
      })),
      relatedExampleIds: related.filter(isExampleChunk).map((chunk) => chunk.id)
    };
  });
  return [...packageCapabilities, ...exportedCapabilities].sort((left, right) =>
    left.packageName.localeCompare(right.packageName) || left.name.localeCompare(right.name),
  );
}

function appendToMap<TKey, TValue>(map: Map<TKey, TValue[]>, key: TKey, value: TValue): void {
  const values = map.get(key);
  if (values) values.push(value);
  else map.set(key, [value]);
}

function resolvePackageMetadata(
  source: SourceFile,
  title: string,
  packageCatalog: PublishedPackageCatalog,
): {
  product: PackageRecord['product'];
  packageName: string;
  packageVersion: string;
  sourceRevision?: string;
  publicExport?: PublicExport;
} {
  const pathValue = source.relativePath.replace(/\\/g, '/');
  const publicExport = packageCatalog.exports.find((candidate) =>
    candidate.sourcePath === pathValue,
  );
  const inferredProduct = inferProduct(pathValue, title, source.repository);
  const packageRecord = packageCatalog.packages.find((candidate) =>
    candidate.name === publicExport?.packageName || candidate.product === inferredProduct,
  ) ?? packageCatalog.packages.find((candidate) => candidate.product === (source.repository === 'revogrid' ? 'core' : 'pro'));

  return {
    product: packageRecord?.product ?? (source.repository === 'revogrid' ? 'core' : 'pro'),
    packageName: packageRecord?.name ?? (source.repository === 'revogrid' ? '@revolist/revogrid' : '@revolist/revogrid-pro'),
    packageVersion: packageRecord?.version ?? '0.0.0',
    ...(packageRecord?.sourceRevision ? { sourceRevision: packageRecord.sourceRevision } : {}),
    ...(publicExport ? { publicExport } : {})
  };
}

function inferProduct(
  sourcePath: string,
  title: string,
  repository: SourceRepository,
): PackageRecord['product'] {
  if (repository === 'revogrid') return 'core';
  const value = `${sourcePath} ${title}`.toLowerCase();
  if (value.includes('collaborative')) return 'collaboration';
  if (value.includes('/pivot') || value.includes('pivot')) return 'pivot';
  if (value.includes('/gantt') || value.includes('gantt')) return 'gantt';
  if (value.includes('event-scheduler') || value.includes('/scheduler') || value.includes('scheduler')) return 'scheduler';
  if (value.includes('/kanban') || value.includes('kanban')) return 'kanban';
  if (sourcePath.startsWith('packages/enterprise/')) return 'enterprise';
  return 'pro';
}

function resolveVisibility(
  source: SourceFile,
  packageCatalog: PublishedPackageCatalog,
): DocumentChunk['visibility'] {
  if (source.category === 'docs' || source.category === 'examples') return 'public';
  if (source.relativePath.includes('/content/docs/api/')) return 'public';
  return packageCatalog.publicSourcePaths.has(`${source.repository}:${source.relativePath}`)
    ? 'public'
    : 'internal';
}

function resolveAuthority(source: SourceFile, packageCatalog: PublishedPackageCatalog): number {
  if (packageCatalog.publicSourcePaths.has(`${source.repository}:${source.relativePath}`)) return 100;
  if (source.relativePath.includes('/content/docs/api/')) return 90;
  if (source.category === 'docs') return 80;
  if (source.category === 'examples') return 70;
  return 30;
}

function extractRelatedSymbols(chunks: DocumentChunk[], pattern: RegExp): string[] {
  return unique(chunks.flatMap((chunk) => chunk.symbols).filter((symbol) => pattern.test(symbol))).slice(0, 24);
}

function buildCapabilityId(packageName: string, name: string): string {
  return `${packageName}:${name}`.replace(/[^a-z0-9:@/-]+/gi, '-').toLowerCase();
}

function splitIdentifierName(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').toLowerCase();
}

function isChunkRelatedToPlugin(chunk: DocumentChunk, slug: string): boolean {
  const sourcePath = chunk.sourcePath?.toLowerCase();
  if (!sourcePath?.startsWith('revogrid-pro/')) {
    return false;
  }

  return (
    sourcePath.includes(`/plugins/${slug}/`) ||
    sourcePath.includes(`/content/docs/guides/${slug}/`) ||
    sourcePath.includes(`/components/${slug}/`) ||
    sourcePath.includes(`/src/components/${slug}/`) ||
    sourcePath.includes(`/content/demo/${slug}.`) ||
    sourcePath.includes(`/content/docs/api/${slug}.`)
  );
}

function comparePluginReferencePriority(left: DocumentChunk, right: DocumentChunk): number {
  return pluginReferencePriority(left) - pluginReferencePriority(right) || left.id.localeCompare(right.id);
}

function pluginReferencePriority(chunk: DocumentChunk): number {
  const sourcePath = chunk.sourcePath?.toLowerCase() ?? '';
  if (chunk.docType === 'guide' && sourcePath.includes('/content/docs/guides/')) {
    return 0;
  }
  if (chunk.docType === 'api' && sourcePath.includes('/content/docs/api/')) {
    return 1;
  }
  if (isExampleChunk(chunk)) {
    return 2;
  }
  return 3;
}

function resolvePluginStability(chunks: DocumentChunk[]): DocumentChunk['stability'] {
  if (chunks.some((chunk) => chunk.stability === 'stable')) {
    return 'stable';
  }
  if (chunks.some((chunk) => chunk.stability === 'experimental')) {
    return 'experimental';
  }
  return 'deprecated';
}

function extractFeatureArtifacts(documents: SourceDocument[]): FeatureRecord[] {
  const featureRecords: FeatureRecord[] = [];

  for (const document of documents) {
    if (document.featureArtifacts.length === 0) {
      continue;
    }

    const chunk = document.chunk;
    for (const artifact of document.featureArtifacts) {
      featureRecords.push({
        ...artifact,
        relatedChunkIds: unique([...(artifact.relatedChunkIds || []), chunk.id]),
        relatedExampleIds: artifact.relatedExampleIds
      });
    }
  }

  return featureRecords;
}

function mergeFeatureRecords(
  inferred: FeatureRecord[],
  explicit: FeatureRecord[],
): FeatureRecord[] {
  const featureMap = new Map<string, FeatureRecord>();

  for (const feature of [...inferred, ...explicit]) {
    const key = normalizeText(feature.featureName);
    const existing = featureMap.get(key);

    if (!existing) {
      featureMap.set(key, {
        ...feature,
        aliases: unique(feature.aliases),
        relatedChunkIds: feature.relatedChunkIds ?? [],
        relatedExampleIds: feature.relatedExampleIds ?? []
      });
      continue;
    }

    existing.supported ||= feature.supported;
    existing.requiresPro ||= feature.requiresPro;
    existing.stability ??= feature.stability;
    existing.supportedFrameworks = unique([...existing.supportedFrameworks, ...(feature.supportedFrameworks ?? ['vanilla'])]);
    existing.relatedChunkIds = unique([...existing.relatedChunkIds, ...(feature.relatedChunkIds ?? [])]);
    existing.relatedExampleIds = unique([...existing.relatedExampleIds, ...(feature.relatedExampleIds ?? [])]);
    existing.aliases = unique([...existing.aliases, ...feature.aliases]);
    existing.notes = unique([...(existing.notes ?? []), ...(feature.notes ?? [])]);
    existing.fallbackApproach = existing.fallbackApproach ?? feature.fallbackApproach;
  }

  return [...featureMap.values()].sort((left, right) => left.featureName.localeCompare(right.featureName));
}

function deriveMigrations(
  documents: SourceDocument[],
  currentCoreVersion: string,
): MigrationNoteRecord[] {
  return documents
    .filter((document) => document.chunk.docType === 'migration' || document.chunk.surface === 'migration')
    .map((document) => {
      const migrationVersion = extractMigrationVersion(document.source.relativePath);
      const toVersion = migrationVersion ? `${migrationVersion}.x` : currentCoreVersion;
      const fromVersion = migrationVersion ? `${Math.max(migrationVersion - 1, 0)}.x` : 'previous';

      return {
        id: document.chunk.id,
        fromVersion,
        toVersion,
        framework: document.chunk.framework,
        breakingChanges: extractMigrationBreakingChanges(document.rawBody),
        renamedSymbols: extractRenamedSymbols(document.rawBody),
        changedDefaults: extractChangedDefaults(document.rawBody),
        packageChanges: buildPackageChanges(document.rawBody, toVersion),
        recommendedDocIds: [document.chunk.id],
        recommendedExampleIds: []
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeBody(
  content: string,
  extension: string,
  typeInstructions?: TypeInstructionDocument | null,
): string {
  if (typeInstructions?.body) {
    return typeInstructions.body;
  }

  if (MARKDOWN_EXTENSIONS.has(extension) || extension === '.astro' || extension === '.vue' || extension === '.svelte') {
    return stripMarkdown(content);
  }

  return stripHtml(content);
}

function summarizeBody(frontmatterDescription: string | undefined, body: string): string {
  return (frontmatterDescription ?? firstSentence(body)).slice(0, 220);
}

function shouldExtractTypeInstructions(source: SourceFile, extension: string): boolean {
  if (!(extension === '.ts' || extension === '.tsx')) {
    return false;
  }

  const relativePath = source.relativePath.replace(/\\/g, '/');
  return (
    source.category === 'api' &&
    (relativePath.startsWith('src/types/') ||
      relativePath.startsWith('release/plugins/') ||
      relativePath.startsWith('packages/pro/plugins/') ||
      relativePath.startsWith('packages/enterprise/plugins/'))
  );
}

function buildChunkId(repository: SourceRepository, relativePath: string): string {
  return `${repository}-${relativePath
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()}`;
}

function humanizePath(relativePath: string): string {
  return path
    .basename(relativePath, path.extname(relativePath))
    .replace(/[-_.]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function cleanTitle(
  rawTitle: string,
  source: SourceFile,
  docType: DocumentChunk['docType'],
): string {
  const title = rawTitle.replace(/\s+/g, ' ').trim();
  const normalizedTitle = normalizeText(title);
  if (!['framework', 'examples', 'example', 'installation', 'getting started'].includes(normalizedTitle)) {
    return title;
  }

  const normalizedPath = source.relativePath.replace(/\\/g, '/');
  const segments = normalizedPath.split('/').filter(Boolean);
  const parent = segments.at(-2);
  const parentTitle = parent ? humanizePath(parent) : '';

  if (normalizedTitle === 'examples' || normalizedTitle === 'example') {
    return parentTitle ? `${parentTitle} Examples` : `${docType === 'live-demo' ? 'Demo' : 'Code'} Examples`;
  }

  if (normalizedTitle === 'framework') {
    return parentTitle && parentTitle !== 'Parts' ? `${parentTitle} Framework Guide` : 'Framework Integration Guide';
  }

  if (normalizedTitle === 'installation' || normalizedTitle === 'getting started') {
    return parentTitle ? `${parentTitle} ${title}` : title;
  }

  return title;
}

function detectFramework(relativePath: string, title: string): DocumentChunk['framework'] {
  const normalizedPath = relativePath.replace(/\\/g, '/').toLowerCase();
  const value = `${normalizedPath} ${title}`.toLowerCase();

  if (hasFrameworkSignal(value, normalizedPath, 'react')) {
    return 'react';
  }
  if (hasFrameworkSignal(value, normalizedPath, 'vue') || normalizedPath.includes('vue3') || normalizedPath.includes('vue2')) {
    return 'vue';
  }
  if (hasFrameworkSignal(value, normalizedPath, 'angular')) {
    return 'angular';
  }
  if (hasFrameworkSignal(value, normalizedPath, 'svelte')) {
    return 'svelte';
  }
  if (normalizedPath.includes('/js/') || normalizedPath.includes('/jsx/') || value.includes('javascript') || value.includes('standalone')) {
    return 'vanilla';
  }

  return undefined;
}

function hasFrameworkSignal(value: string, normalizedPath: string, framework: string): boolean {
  return (
    new RegExp(`(^|[/._-])${framework}($|[/._-])`).test(normalizedPath) ||
    new RegExp(`\\b${framework}\\b`).test(value)
  );
}

function detectSurface(source: SourceFile, title: string, content: string): DocumentChunk['surface'] {
  const value = `${source.relativePath} ${title} ${content}`.toLowerCase();
  const normalizedPath = source.relativePath.replace(/\\/g, '/').toLowerCase();
  const documentIdentity = `${normalizedPath} ${title.toLowerCase()}`;

  if (source.category === 'changelog') {
    return value.includes('migration') || source.relativePath.includes('/migrations/') ? 'migration' : 'changelog';
  }
  if (source.category === 'docs' || source.category === 'examples') {
    if (documentIdentity.includes('pivot')) return 'pivot';
    return source.repository === 'revogrid-pro' ? 'pro' : 'core';
  }
  if (documentIdentity.includes('columntype')) {
    return 'columntype';
  }
  if (documentIdentity.includes('pivot')) {
    return 'pivot';
  }
  if (
    documentIdentity.includes('plugin') ||
    normalizedPath.includes('release/plugins') ||
    normalizedPath.includes('/plugins/')
  ) {
    return 'plugin';
  }
  if (
    normalizedPath.includes('/src/') ||
    normalizedPath.includes('/test/') ||
    normalizedPath.includes('/scripts/') ||
    normalizedPath.endsWith('.ts') ||
    normalizedPath.endsWith('.tsx') ||
    normalizedPath.endsWith('.js') ||
    normalizedPath.endsWith('.jsx') ||
    normalizedPath.endsWith('.vue') ||
    normalizedPath.endsWith('.svelte') ||
    normalizedPath.endsWith('.astro')
  ) {
    return 'internal';
  }
  if (source.repository === 'revogrid-pro') {
    return 'pro';
  }

  return 'core';
}

function detectDocType(
  category: SourceCategory,
  relativePath: string,
  extension: string,
): DocumentChunk['docType'] {
  if (category === 'changelog' || relativePath.includes('/migrations/')) {
    return 'migration';
  }
  if (category === 'api' || relativePath.includes('/guide/types/') || relativePath.includes('/content/docs/api/')) {
    return 'api';
  }
  if (relativePath.includes('/faq/')) {
    return 'faq';
  }
  if (category === 'examples') {
    return MARKDOWN_EXTENSIONS.has(extension) ? 'live-demo' : 'example';
  }

  return 'guide';
}

function inferRequiresPro(
  source: SourceFile,
  title: string,
  content: string,
  surface: DocumentChunk['surface'],
): boolean {
  const normalizedPath = source.relativePath.replace(/\\/g, '/').toLowerCase();
  const value = `${normalizedPath} ${title} ${content}`.toLowerCase();

  if (source.requiresPro || source.repository === 'revogrid-pro' || surface === 'pivot') {
    return true;
  }

  if (normalizedPath.includes('.pro.') || normalizedPath.includes('/pro/')) {
    return true;
  }

  return value.includes('@revolist/revogrid-pro') && (source.category === 'examples' || source.category === 'api');
}

function detectVersion(source: SourceFile, packageVersions: PackageVersions): string {
  return source.repository === 'revogrid' ? packageVersions.revogrid : packageVersions.revogridPro;
}

function buildCanonicalUrl(source: SourceFile): string {
  const normalizedPath = source.relativePath.replace(/\\/g, '/');

  if (source.repository === 'revogrid') {
    if (normalizedPath.startsWith('docs/')) {
      return `https://rv-grid.com/${trimIndex(stripExtension(normalizedPath.replace(/^docs\//, '')))}`
        .replace(/\/$/, '');
    }

    if (normalizedPath.startsWith('src/types/')) {
      return `https://rv-grid.com/guide/types/${path.basename(normalizedPath, path.extname(normalizedPath))}`;
    }
  }

  if (source.repository === 'revogrid-pro') {
    if (normalizedPath.startsWith('apps/portal/src/content/docs/')) {
      return `https://pro.rv-grid.com/${trimIndex(stripExtension(normalizedPath.replace(/^apps\/portal\/src\/content\/docs\//, '')))}`
        .replace(/\/$/, '');
    }

    if (normalizedPath.startsWith('apps/portal/src/content/demo/')) {
      return `https://pro.rv-grid.com/demo/${trimIndex(stripExtension(normalizedPath.replace(/^apps\/portal\/src\/content\/demo\//, '')))}`
        .replace(/\/$/, '');
    }

    if (normalizedPath.startsWith('examples/core/src/core-examples/')) {
      const slug = normalizedPath.split('/')[4] ?? 'demo';
      return `https://pro.rv-grid.com/demo/${slug}`;
    }

    if (normalizedPath.startsWith('examples/components/src/components/')) {
      const slug = normalizedPath.split('/')[4] ?? 'demo';
      return `https://pro.rv-grid.com/demo/${slug}`;
    }

    if (normalizedPath.startsWith('release/plugins/')) {
      return `https://pro.rv-grid.com/api/${normalizedPath.split('/')[2] ?? 'plugin'}`;
    }

    if (normalizedPath.startsWith('packages/pro/plugins/') || normalizedPath.startsWith('packages/enterprise/plugins/')) {
      const segments = normalizedPath.split('/');
      const pluginIndex = segments.indexOf('plugins');
      return `https://pro.rv-grid.com/api/${segments[pluginIndex + 1] ?? 'plugin'}`;
    }

    if (
      normalizedPath.startsWith('apps/portal/src/components/') ||
      normalizedPath.startsWith('apps/demos/src/components/')
    ) {
      const segments = normalizedPath.split('/');
      const componentIndex = segments.indexOf('components');
      return `https://pro.rv-grid.com/demo/${segments[componentIndex + 1] ?? 'demo'}`;
    }

    if (normalizedPath.startsWith('apps/demos/src/catalog/')) {
      return 'https://pro.rv-grid.com/demo';
    }

    if (normalizedPath.startsWith('packages/')) {
      const packageSlug = normalizedPath.split('/')[1] ?? 'revogrid-pro';
      return `https://pro.rv-grid.com/api/${packageSlug}`;
    }
  }

  return 'https://rv-grid.com';
}

function trimIndex(relativeUrl: string): string {
  return relativeUrl.replace(/\/index$/, '').replace(/\/+/g, '/');
}

function stripExtension(filePath: string): string {
  return filePath.replace(/\.[^.]+$/, '');
}

function extractExampleUrl(
  source: SourceFile,
  content: string,
  fallbackUrl: string,
): string | undefined {
  const links = extractExternalLinks(content);
  const firstExternalExample = links.find((link) => link.includes('codesandbox') || link.includes('stackblitz'));
  if (firstExternalExample) {
    return firstExternalExample;
  }

  return source.category === 'examples' ? fallbackUrl : undefined;
}

function extractPackageNames(content: string): string[] | undefined {
  const packages = unique(
    [...content.matchAll(/@revolist\/[a-z0-9-]+/gi)]
      .map((match) => match[0]?.trim())
      .filter((value): value is string => Boolean(value)),
  );

  return packages.length > 0 ? packages : undefined;
}

function extractSymbols(
  title: string,
  content: string,
  body: string,
  preferredSymbols: string[] = [],
): string[] {
  const inlineCode = [...content.matchAll(/`([^`]+)`/g)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
  const codeBlocks = extractCodeBlocks(content);
  const tokens = tokenize([title, body, ...inlineCode, ...codeBlocks].join(' '))
    .filter((token) => token.length > 2)
    .slice(0, 100);
  const identifiers = unique(
    [...content.matchAll(/\b[A-Za-z_][A-Za-z0-9_]{2,}\b/g)]
      .map((match) => match[0])
      .filter((value): value is string => Boolean(value)),
  );

  return unique([...preferredSymbols, ...identifiers.slice(0, 40), ...tokens]).slice(0, 80);
}

function detectStability(content: string): DocumentChunk['stability'] {
  const value = content.toLowerCase();
  if (value.includes('deprecated')) {
    return 'deprecated';
  }
  if (value.includes('experimental')) {
    return 'experimental';
  }
  return 'stable';
}

function extractReleaseDate(
  attributes: Record<string, string>,
  body: string,
  relativePath: string,
): string | undefined {
  const candidates = [
    attributes.date,
    attributes.releaseDate,
    body.match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0],
    relativePath.match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0]
  ];

  return candidates.find((value): value is string => Boolean(value));
}

function firstSentence(body: string): string {
  return body.split(/(?<=[.!?])\s+/)[0]?.trim() ?? body.slice(0, 180);
}

function isDocChunk(chunk: DocumentChunk): boolean {
  return chunk.docType === 'guide' || chunk.docType === 'api';
}

function isExampleChunk(chunk: DocumentChunk): boolean {
  return chunk.docType === 'example' || chunk.docType === 'live-demo';
}

function extractMigrationVersion(value: string): number | null {
  const match = value.match(/v(\d+)/i);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

function extractMigrationBreakingChanges(rawBody: string): string[] {
  return unique([
    ...extractBulletLinesFromHeading(rawBody, /^#+\s+Properties Changes/i),
    ...extractBulletLinesFromHeading(rawBody, /^#+\s+Methods Changes/i),
    ...extractBulletLinesFromHeading(rawBody, /^#+\s+Events Changes/i),
    ...extractInlineChangeSentences(rawBody)
  ]).slice(0, 20);
}

function extractRenamedSymbols(rawBody: string): Array<{ from: string; to: string }> {
  const explicitPairs = uniquePairs([
    ...extractRegexPairs(rawBody, /`?([A-Za-z_][A-Za-z0-9_]*)`?\s*->\s*`?([A-Za-z_][A-Za-z0-9_]*)`?/g),
    ...extractRegexPairs(rawBody, /before:\s*`?([^`\n]+?)`?\s*[\r\n]+(?:-+\s*)?now:\s*`?([^`\n]+?)`?/gi)
  ]);

  return explicitPairs.slice(0, 20);
}

function extractChangedDefaults(rawBody: string): string[] {
  return unique(
    [...rawBody.matchAll(/- \*\*`([^`]+)`\*\*:[\s\S]*?\*\*Default\*\*:\s*`?([^`\n]+)`?/gi)]
      .map((match) => {
        const name = match[1]?.trim();
        const value = match[2]?.trim();
        return name && value ? `${name}: ${value}` : null;
      })
      .filter((value): value is string => Boolean(value)),
  ).slice(0, 20);
}

function buildPackageChanges(rawBody: string, toVersion: string): string[] {
  const packageMentions = unique(
    [...rawBody.matchAll(/@revolist\/[a-z0-9-]+/gi)]
      .map((match) => match[0])
      .filter((value): value is string => Boolean(value)),
  );

  if (packageMentions.length === 0) {
    return [`Upgrade RevoGrid packages to the ${toVersion} release line.`];
  }

  return packageMentions.slice(0, 5).map((packageName) => `Review ${packageName} for ${toVersion} upgrade changes.`);
}

function extractBulletLinesFromHeading(rawBody: string, headingPattern: RegExp): string[] {
  const lines = rawBody.split('\n');
  const results: string[] = [];
  let capture = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!capture && headingPattern.test(line)) {
      capture = true;
      continue;
    }

    if (!capture) {
      continue;
    }

    if (line.startsWith('#')) {
      break;
    }

    if (line.startsWith('- ')) {
      results.push(line.replace(/^- /, '').replace(/[*`]/g, '').trim());
    }
  }

  return results;
}

function extractInlineChangeSentences(rawBody: string): string[] {
  return unique(
    rawBody
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /old|new|renamed|deprecated|updated/i.test(line))
      .map((line) => stripMarkdown(line)),
  ).slice(0, 10);
}

function extractRegexPairs(rawBody: string, pattern: RegExp): Array<{ from: string; to: string }> {
  return [...rawBody.matchAll(pattern)]
    .map((match) => {
      const from = match[1]?.trim();
      const to = match[2]?.trim();
      return from && to ? { from: stripMarkdown(from), to: stripMarkdown(to) } : null;
    })
    .filter((pair): pair is { from: string; to: string } => Boolean(pair));
}

function uniquePairs(values: Array<{ from: string; to: string }>): Array<{ from: string; to: string }> {
  const seen = new Set<string>();
  const pairs: Array<{ from: string; to: string }> = [];

  for (const value of values) {
    const key = `${value.from}:${value.to}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    pairs.push(value);
  }

  return pairs;
}

function compareVersionsDesc(left: string, right: string): number {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue !== rightValue) {
      return rightValue - leftValue;
    }
  }

  return 0;
}

export function createContentFingerprint(chunk: DocumentChunk): string {
  return sha256(
    JSON.stringify({
      title: chunk.title,
      body: chunk.body,
      summary: chunk.summary,
      framework: chunk.framework,
      surface: chunk.surface,
      docType: chunk.docType,
      version: chunk.version,
      requiresPro: chunk.requiresPro,
      symbols: chunk.symbols,
      url: chunk.url,
      sourcePath: chunk.sourcePath,
      exampleUrl: chunk.exampleUrl,
      packageNames: chunk.packageNames,
      releaseDate: chunk.releaseDate
    }),
  );
}
