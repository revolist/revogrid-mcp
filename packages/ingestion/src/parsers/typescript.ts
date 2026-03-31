import { stripHtml } from './html.js';

export type TypeInstructionDocument = {
  body: string;
  symbols: string[];
  title?: string;
  summary?: string;
};

type ExportKind = 'interface' | 'type' | 'class' | 'function' | 'enum';

type ExportBlock = {
  doc: string;
  kind: ExportKind;
  name: string;
  signature: string;
  body?: string;
};

type MemberInstruction = {
  name: string;
  type: string;
  doc?: string;
};

const EXPORT_PATTERN =
  /(?:\/\*\*([\s\S]*?)\*\/\s*)?export\s+(?:declare\s+)?(interface|type|class|function|enum)\s+([A-Za-z_][A-Za-z0-9_]*)\s*([^{=\n]*)(?:=\s*([^;]+);|\{([\s\S]*?)\})?/g;

const INTERFACE_MEMBER_PATTERN =
  /(?:\/\*\*([\s\S]*?)\*\/\s*)?([A-Za-z_][A-Za-z0-9_]*)\??:\s*([^;]+);/g;

export function extractTypeInstructionDocument(source: string): TypeInstructionDocument {
  const blocks = extractExportBlocks(source);
  const symbols = blocks.map((block) => block.name);
  const primaryBlock = blocks[0];
  const sections = blocks.flatMap(formatBlock);
  const body = [
    symbols.length > 0 ? `Exported symbols: ${symbols.join(', ')}.` : '',
    ...sections
  ]
    .filter(Boolean)
    .join('\n\n')
    .trim();

  return {
    body,
    symbols,
    ...(primaryBlock?.name ? { title: primaryBlock.name } : {}),
    ...(primaryBlock ? { summary: summarizeBlock(primaryBlock) } : {})
  };
}

function extractExportBlocks(source: string): ExportBlock[] {
  const blocks: ExportBlock[] = [];

  for (const match of source.matchAll(EXPORT_PATTERN)) {
    const kind = (match[2] ?? '').trim() as ExportKind;
    const name = (match[3] ?? '').trim();
    if (!kind || !name) {
      continue;
    }

    const body = match[6]?.trim();
    blocks.push({
      doc: normalizeDocComment(match[1]),
      kind,
      name,
      signature: stripHtml(`${match[4] ?? ''} ${match[5] ?? ''}`.trim())
        .replace(/\s+/g, ' ')
        .trim(),
      ...(body ? { body } : {})
    });
  }

  return blocks;
}

function formatBlock(block: ExportBlock): string[] {
  const lines = [`${capitalize(block.kind)} ${block.name}${block.signature ? ` ${block.signature}` : ''}`.trim()];

  if (block.doc) {
    lines.push(block.doc);
  }

  const members = block.kind === 'interface' ? extractInterfaceMembers(block.body ?? '') : [];
  if (members.length > 0) {
    lines.push(
      ['Key fields:', ...members.map((member) => formatMember(member))].join('\n'),
    );
  }

  return [lines.join('\n')];
}

function summarizeBlock(block: ExportBlock): string {
  if (block.doc) {
    return block.doc.slice(0, 220);
  }

  return `${capitalize(block.kind)} ${block.name}${block.signature ? ` ${block.signature}` : ''}`.slice(0, 220);
}

function extractInterfaceMembers(body: string): MemberInstruction[] {
  const members: MemberInstruction[] = [];

  for (const match of body.matchAll(INTERFACE_MEMBER_PATTERN)) {
    const name = (match[2] ?? '').trim();
    const type = stripHtml((match[3] ?? '').trim()).replace(/\s+/g, ' ');
    if (!name || !type) {
      continue;
    }

    const doc = normalizeDocComment(match[1]);
    members.push({
      name,
      type,
      ...(doc ? { doc } : {})
    });
  }

  return members.slice(0, 20);
}

function formatMember(member: MemberInstruction): string {
  return member.doc
    ? `- ${member.name}: ${member.type}. ${member.doc}`
    : `- ${member.name}: ${member.type}`;
}

function normalizeDocComment(value: string | undefined): string {
  return (value ?? '')
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').trim())
    .filter((line) => line.length > 0 && !line.startsWith('@'))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
