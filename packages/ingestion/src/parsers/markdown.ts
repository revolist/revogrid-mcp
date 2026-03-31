import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { stripHtml } from './html.js';

export type ParsedFrontmatter = {
  attributes: Record<string, string>;
  body: string;
};

export function parseFrontmatter(markdown: string): ParsedFrontmatter {
  if (!markdown.startsWith('---\n')) {
    return {
      attributes: {},
      body: markdown
    };
  }

  const endIndex = markdown.indexOf('\n---\n', 4);
  if (endIndex === -1) {
    return {
      attributes: {},
      body: markdown
    };
  }

  const rawFrontmatter = markdown.slice(4, endIndex);
  const attributeEntries: Array<[string, string]> = rawFrontmatter
    .split('\n')
    .map((line) => line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => [(match[1] ?? '').trim(), (match[2] ?? '').replace(/^['"]|['"]$/g, '').trim()]);
  const attributes: Record<string, string> = Object.fromEntries(
    attributeEntries,
  );

  return {
    attributes,
    body: markdown.slice(endIndex + 5)
  };
}

export async function resolveMarkdownIncludes(
  markdown: string,
  filePath: string,
): Promise<string> {
  const includePattern = /<!--@include:\s*(.+?)-->/g;
  let result = markdown;
  let match = includePattern.exec(markdown);

  while (match) {
    const includePath = match[1]?.trim();
    if (!includePath) {
      match = includePattern.exec(markdown);
      continue;
    }

    const absoluteIncludePath = path.resolve(path.dirname(filePath), includePath);
    const includedContent = await readFile(absoluteIncludePath, 'utf8').catch(() => '');
    result = result.replace(match[0], includedContent);
    match = includePattern.exec(markdown);
  }

  return result;
}

export function extractFirstHeading(markdown: string): string | undefined {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim();
}

export function extractExternalLinks(markdown: string): string[] {
  return [...markdown.matchAll(/\((https?:\/\/[^)]+)\)/g)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

export function extractCodeBlocks(markdown: string): string[] {
  return [...markdown.matchAll(/```[\w-]*\n([\s\S]*?)```/g)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

export function stripMarkdown(markdown: string): string {
  return stripHtml(
    markdown
      .replace(/^import\s.+$/gm, ' ')
      .replace(/^export\s.+$/gm, ' ')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
      .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
      .replace(/^#+\s+/gm, '')
      .replace(/[*_>~-]/g, ' ')
      .replace(/\{[^}]+\}/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}
