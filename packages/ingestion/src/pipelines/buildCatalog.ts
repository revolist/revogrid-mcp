import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  DocumentChunk,
  FeatureRecord,
  MigrationNoteRecord,
  SeedDataset,
  VersionRecord
} from '@revogrid-mcp/content-model';
import { SeedDatasetSchema } from '@revogrid-mcp/content-model';
import { normalizeText, sha256, tokenize, unique } from '@revogrid-mcp/shared';

import { embedChunks } from '../embeddings/embedChunks.js';
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
const FEATURE_STOP_WORDS = new Set(['index', 'overview', 'guide', 'api', 'docs', 'installation']);

export async function buildCatalogDataset(): Promise<SeedDataset> {
  const [docs, examples, changelog, api, packageVersions] = await Promise.all([
    getDocsSources(),
    getExampleSources(),
    getChangelogSources(),
    getApiSources(),
    getPackageVersions()
  ]);

  const normalizedDocuments = (
    await Promise.all(
      deduplicateSources([...docs, ...examples, ...changelog, ...api]).map((source) =>
        normalizeSourceFile(source, packageVersions),
      ),
    )
  )
    .filter((document): document is SourceDocument => Boolean(document))
    .sort((left, right) => left.chunk.id.localeCompare(right.chunk.id));
  const derivedFeatures = deriveFeatures(normalizedDocuments.map((document) => document.chunk));
  const explicitFeatures = extractFeatureArtifacts(normalizedDocuments);

  return SeedDatasetSchema.parse({
    chunks: normalizedDocuments.map((document) => document.chunk),
    versions: deriveVersions(normalizedDocuments.map((document) => document.chunk), packageVersions),
    features: mergeFeatureRecords(derivedFeatures, explicitFeatures),
    migrations: deriveMigrations(normalizedDocuments, packageVersions.revogrid)
  });
}

export function getCatalogEmbeddings(dataset: SeedDataset) {
  return embedChunks(dataset.chunks);
}

async function normalizeSourceFile(
  source: SourceFile,
  packageVersions: PackageVersions,
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
  const surface = detectSurface(source, title, resolvedContent);
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
      releaseDate: extractReleaseDate(attributes, body, source.relativePath)
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

  const statusColumns = headerColumns.map((column, columnIndex) => ({
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

  const [revogridPackageJson, revogridProPackageJson] = await Promise.all([
    readJsonFile<{ version?: string }>(path.join(revogridRoot.rootPath, 'package.json')),
    readJsonFile<{ version?: string }>(path.join(revogridProRoot.rootPath, 'package.json'))
  ]);

  return {
    revogrid: revogridPackageJson.version ?? '0.0.0',
    revogridPro: revogridProPackageJson.version ?? '0.0.0'
  };
}

async function readJsonFile<TPayload extends object>(filePath: string): Promise<TPayload> {
  const contents = await readFile(filePath, 'utf8');
  return JSON.parse(contents) as TPayload;
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

function deriveFeatures(chunks: DocumentChunk[]): FeatureRecord[] {
  const groups = new Map<string, FeatureRecord>();

  for (const chunk of chunks) {
    if (chunk.docType === 'migration' || chunk.surface === 'migration' || chunk.surface === 'changelog') {
      continue;
    }

    const featureName = normalizeFeatureName(chunk);
    if (!featureName || FEATURE_STOP_WORDS.has(featureName)) {
      continue;
    }

    const existing = groups.get(featureName);
    if (!existing) {
      groups.set(featureName, {
        featureName,
        supported: true,
        requiresPro: chunk.requiresPro,
        stability: chunk.stability,
        supportedFrameworks: chunk.framework ? [chunk.framework] : ['vanilla'],
        notes: chunk.summary ? [chunk.summary] : [],
        relatedChunkIds: isDocChunk(chunk) ? [chunk.id] : [],
        relatedExampleIds: isExampleChunk(chunk) ? [chunk.id] : [],
        fallbackApproach: chunk.requiresPro
          ? 'Search public RevoGrid core docs for adjacent patterns if Pro access is unavailable.'
          : undefined,
        aliases: unique([featureName, ...chunk.symbols.map((symbol) => normalizeText(symbol)).slice(0, 8)])
      });
      continue;
    }

    existing.requiresPro ||= chunk.requiresPro;
    existing.stability ??= chunk.stability;
    existing.supportedFrameworks = unique([...existing.supportedFrameworks, chunk.framework ?? 'vanilla']);
    existing.notes = unique([...(existing.notes ?? []), ...(chunk.summary ? [chunk.summary] : [])]).slice(0, 4);
    existing.relatedChunkIds = unique([...existing.relatedChunkIds, ...(isDocChunk(chunk) ? [chunk.id] : [])]);
    existing.relatedExampleIds = unique([
      ...existing.relatedExampleIds,
      ...(isExampleChunk(chunk) ? [chunk.id] : [])
    ]);
    existing.aliases = unique([
      ...existing.aliases,
      ...chunk.symbols.map((symbol) => normalizeText(symbol)).slice(0, 6)
    ]);
  }

  return [...groups.values()]
    .sort((left, right) => left.featureName.localeCompare(right.featureName))
    .map((feature) => ({
      ...feature,
      aliases: unique(feature.aliases)
    }));
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

  if (source.category === 'changelog') {
    return value.includes('migration') || source.relativePath.includes('/migrations/') ? 'migration' : 'changelog';
  }
  if (value.includes('columntype')) {
    return 'columntype';
  }
  if (value.includes('pivot')) {
    return 'pivot';
  }
  if (value.includes('plugin') || normalizedPath.includes('release/plugins') || normalizedPath.includes('/plugins/')) {
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

function normalizeFeatureName(chunk: DocumentChunk): string | null {
  if (chunk.surface === 'pivot') {
    return 'pivot';
  }
  if (chunk.symbols.some((symbol) => normalizeText(symbol) === 'beforeedit')) {
    return 'beforeedit';
  }
  if (chunk.surface === 'columntype') {
    return 'custom column type';
  }

  const normalizedTitle = normalizeText(chunk.title)
    .replace(/\b(demo|guide|api|example|data grid|table|react|vue|angular|svelte)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalizedTitle || null;
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
