import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import type { Align, ExportDoc, Run } from './model';
import { dataUrlToBytes, dataUrlType, imageSize } from '../images';

const ALIGN: Record<Align, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

function runs(rs: Run[], extra: { italics?: boolean; bold?: boolean; color?: string; size?: number } = {}): TextRun[] {
  return rs.map((r) =>
    r.br
      ? new TextRun({ text: '', break: 1 })
      : new TextRun({
          text: r.text,
          bold: r.bold || extra.bold,
          italics: r.italic || extra.italics,
          underline: r.underline ? {} : undefined,
          strike: r.strike,
          color: extra.color,
          size: extra.size,
        }),
  );
}

export async function articleDocx(d: ExportDoc, accent: string): Promise<Blob> {
  const color = accent.replace('#', '').toUpperCase();
  const children: Paragraph[] = [];
  const meta = [d.rubrique, d.issue, d.author && `Par ${d.author}`].filter(Boolean).join('  ·  ');
  if (meta) children.push(new Paragraph({ children: [new TextRun({ text: meta.toUpperCase(), bold: true, color, size: 17, font: 'Arial' })], spacing: { after: 120 } }));
  children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: d.title || 'Sans titre' })] }));
  if (d.chapo) children.push(new Paragraph({ children: [new TextRun({ text: d.chapo, bold: true, size: 26 })], spacing: { after: 240 } }));
  children.push(new Paragraph({ border: { bottom: { color, style: BorderStyle.SINGLE, size: 8, space: 1 } }, spacing: { after: 240 }, children: [] }));

  let listInstance = 0;
  for (const b of d.blocks) {
    switch (b.type) {
      case 'heading':
        children.push(new Paragraph({ heading: b.level <= 2 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, children: runs(b.runs) }));
        break;
      case 'paragraph':
        children.push(new Paragraph({ alignment: ALIGN[b.align], children: runs(b.runs) }));
        break;
      case 'quote':
        children.push(
          new Paragraph({
            style: 'Citation',
            children: runs(b.runs, { italics: true }),
          }),
        );
        break;
      case 'list':
        listInstance++;
        for (const it of b.items) {
          children.push(
            new Paragraph({
              children: runs(it.runs),
              ...(b.ordered
                ? { numbering: { reference: 'numeros', level: Math.min(it.depth, 2), instance: listInstance } }
                : { bullet: { level: Math.min(it.depth, 2) } }),
            }),
          );
        }
        break;
      case 'image': {
        try {
          const size = await imageSize(b.src);
          const maxW = 450;
          const w = Math.min(maxW, size.width);
          const h = Math.round((size.height / size.width) * w);
          const type = dataUrlType(b.src);
          children.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new ImageRun({ type, data: dataUrlToBytes(b.src), transformation: { width: w, height: h } })],
            }),
          );
          if (b.caption) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: b.caption, italics: true, size: 18, color: '666666' })] }));
        } catch {
          /* image illisible : ignorée */
        }
        break;
      }
      case 'hr':
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '*  *  *', color })] }));
        break;
    }
  }

  const doc = new Document({
    creator: d.author || 'Rédaction',
    title: d.title,
    styles: {
      default: {
        document: { run: { font: 'Georgia', size: 24 }, paragraph: { spacing: { after: 160, line: 320 } } },
        title: { run: { font: 'Georgia', size: 48, bold: true, color: '19191C' }, paragraph: { spacing: { after: 160 } } },
        heading1: { run: { font: 'Georgia', size: 30, bold: true, color: '19191C' }, paragraph: { spacing: { before: 280, after: 120 } } },
        heading2: { run: { font: 'Georgia', size: 26, bold: true, color: '19191C' }, paragraph: { spacing: { before: 240, after: 100 } } },
      },
      paragraphStyles: [
        {
          id: 'Citation',
          name: 'Citation',
          basedOn: 'Normal',
          run: { italics: true, color: '333333' },
          paragraph: { indent: { left: 567 }, border: { left: { color, style: BorderStyle.SINGLE, size: 18, space: 10 } } },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'numeros',
          levels: [0, 1, 2].map((level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [{ properties: {}, children }],
  });
  return Packer.toBlob(doc);
}
