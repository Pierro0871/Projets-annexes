import type { JSONContent } from '@tiptap/react';

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  br?: boolean;
}

export type Align = 'left' | 'center' | 'right' | 'justify';

export type Block =
  | { type: 'heading'; level: number; runs: Run[] }
  | { type: 'paragraph'; runs: Run[]; align: Align }
  | { type: 'quote'; runs: Run[] }
  | { type: 'list'; ordered: boolean; items: Array<{ runs: Run[]; depth: number }> }
  | { type: 'image'; src: string; caption: string }
  | { type: 'hr' };

export interface ExportDoc {
  title: string;
  chapo: string;
  author: string;
  rubrique: string;
  issue: string;
  blocks: Block[];
}

function inline(nodes: JSONContent[] | undefined): Run[] {
  const runs: Run[] = [];
  for (const n of nodes ?? []) {
    if (n.type === 'text') {
      const marks = new Set((n.marks ?? []).map((m) => m.type));
      runs.push({
        text: n.text ?? '',
        bold: marks.has('bold'),
        italic: marks.has('italic'),
        underline: marks.has('underline'),
        strike: marks.has('strike'),
      });
    } else if (n.type === 'hardBreak') {
      runs.push({ text: '', br: true });
    }
  }
  return runs;
}

function listItems(node: JSONContent, depth: number, out: Array<{ runs: Run[]; depth: number }>) {
  for (const li of node.content ?? []) {
    for (const child of li.content ?? []) {
      if (child.type === 'bulletList' || child.type === 'orderedList') listItems(child, depth + 1, out);
      else out.push({ runs: inline(child.content), depth });
    }
  }
}

export function toBlocks(doc: JSONContent | null): Block[] {
  const blocks: Block[] = [];
  for (const n of doc?.content ?? []) {
    switch (n.type) {
      case 'heading':
        blocks.push({ type: 'heading', level: (n.attrs?.level as number) ?? 2, runs: inline(n.content) });
        break;
      case 'paragraph':
        blocks.push({ type: 'paragraph', runs: inline(n.content), align: ((n.attrs?.textAlign as Align) ?? 'left') });
        break;
      case 'blockquote':
        for (const p of n.content ?? []) blocks.push({ type: 'quote', runs: inline(p.content) });
        break;
      case 'bulletList':
      case 'orderedList': {
        const items: Array<{ runs: Run[]; depth: number }> = [];
        listItems(n, 0, items);
        blocks.push({ type: 'list', ordered: n.type === 'orderedList', items });
        break;
      }
      case 'image':
        if (n.attrs?.src) blocks.push({ type: 'image', src: n.attrs.src as string, caption: (n.attrs.alt as string) || (n.attrs.title as string) || '' });
        break;
      case 'horizontalRule':
        blocks.push({ type: 'hr' });
        break;
      case 'codeBlock':
        blocks.push({ type: 'paragraph', runs: inline(n.content), align: 'left' });
        break;
    }
  }
  return blocks;
}

export function plainText(runs: Run[]): string {
  return runs.map((r) => (r.br ? '\n' : r.text)).join('');
}
