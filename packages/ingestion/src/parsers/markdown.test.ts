import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  parseFrontmatter,
  resolveMarkdownIncludes,
  stripMarkdown
} from './markdown.js';

describe('markdown parser helpers', () => {
  let fixtureRoot = '';

  beforeEach(async () => {
    fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'revogrid-mcp-markdown-'));
  });

  afterEach(async () => {
    await rm(fixtureRoot, { recursive: true, force: true });
  });

  it('parses simple frontmatter into attributes and body', () => {
    const result = parseFrontmatter([
      '---',
      'title: Example page',
      'description: Example summary',
      '---',
      '',
      '# Heading'
    ].join('\n'));

    expect(result.attributes).toEqual({
      title: 'Example page',
      description: 'Example summary'
    });
    expect(result.body).toContain('# Heading');
  });

  it('resolves markdown include directives relative to the current file', async () => {
    const baseFilePath = path.join(fixtureRoot, 'docs/guide/page.md');
    const includeFilePath = path.join(fixtureRoot, 'docs/guide/parts/_snippet.md');

    await mkdir(path.dirname(includeFilePath), { recursive: true });
    await writeFile(includeFilePath, 'Included content.');

    const resolved = await resolveMarkdownIncludes(
      'Before\n<!--@include: ./parts/_snippet.md-->\nAfter',
      baseFilePath,
    );

    expect(resolved).toContain('Included content.');
  });

  it('strips markdown, imports, and fenced code blocks into plain text', () => {
    const stripped = stripMarkdown([
      'import Demo from "./Demo.vue";',
      '',
      '# Title',
      '',
      'Body with `inlineCode` and [link](https://example.com).',
      '',
      '```ts',
      'const hidden = true;',
      '```'
    ].join('\n'));

    expect(stripped).toContain('Title');
    expect(stripped).toContain('inlineCode');
    expect(stripped).not.toContain('import Demo');
    expect(stripped).not.toContain('const hidden');
  });
});
