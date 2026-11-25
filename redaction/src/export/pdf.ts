import { jsPDF } from 'jspdf';
import type { Align, Block, ExportDoc, Run } from './model';
import { imageSize } from '../images';

/** Les polices standard des PDF ne couvrent pas tout l'Unicode : on remplace les rares caractères absents. */
function clean(s: string): string {
  return s
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u0153/g, 'oe')
    .replace(/\u0152/g, 'OE')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/[\u00A0\u202F\u2009\u2007]/g, ' ')
    .replace(/\u2022/g, '-')
    .replace(/[^ -\u00FF\n]/g, '');
}

const PT = 0.3528; // 1 pt en mm

type FontName = 'times' | 'helvetica';

interface ParaStyle {
  font: FontName;
  size: number; // pt
  leading: number; // multiplicateur
  align: Align;
  color: [number, number, number];
  indentLeft?: number; // mm
  firstIndent?: number; // mm
  spaceBefore?: number; // mm
  spaceAfter?: number; // mm
  forceBold?: boolean;
  forceItalic?: boolean;
  dropCap?: { color: [number, number, number] };
  keepLines?: number; // lignes minimum à garder ensemble au début
  bar?: [number, number, number]; // barre verticale à gauche (citations)
}

interface Word {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  width: number;
  spaceBefore: boolean;
  br?: boolean;
}

interface Layout {
  margins: { top: number; bottom: number; left: number; right: number };
  columns: number;
  gutter: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

class Typesetter {
  doc: jsPDF;
  pageW: number;
  pageH: number;
  layout: Layout;
  col = 0;
  y: number;
  columnTop: number;
  onNewPage?: (page: number) => void;

  constructor(layout: Layout) {
    this.doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    this.pageW = this.doc.internal.pageSize.getWidth();
    this.pageH = this.doc.internal.pageSize.getHeight();
    this.layout = layout;
    this.y = layout.margins.top;
    this.columnTop = layout.margins.top;
  }

  get contentWidth() {
    const m = this.layout.margins;
    return this.pageW - m.left - m.right;
  }

  get colWidth() {
    const { columns, gutter } = this.layout;
    return (this.contentWidth - gutter * (columns - 1)) / columns;
  }

  colX(col = this.col) {
    return this.layout.margins.left + col * (this.colWidth + this.layout.gutter);
  }

  get bottom() {
    return this.pageH - this.layout.margins.bottom;
  }

  newPage() {
    this.doc.addPage();
    this.col = 0;
    this.y = this.layout.margins.top;
    this.columnTop = this.y;
    this.onNewPage?.(this.doc.getNumberOfPages());
  }

  nextColumn() {
    if (this.col + 1 < this.layout.columns) {
      this.col++;
      this.y = this.columnTop;
    } else {
      this.newPage();
    }
  }

  ensure(h: number) {
    if (this.y + h > this.bottom + 0.01) this.nextColumn();
  }

  /** Commence une zone en colonnes à la hauteur courante (après un en-tête pleine largeur). */
  startColumns(y: number) {
    this.col = 0;
    this.y = y;
    this.columnTop = y;
  }

  setFont(font: FontName, bold: boolean, italic: boolean, size: number) {
    const style = bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';
    this.doc.setFont(font, style);
    this.doc.setFontSize(size);
  }

  words(runs: Run[], st: ParaStyle): Word[] {
    const out: Word[] = [];
    let pendingSpace = false;
    for (const r of runs) {
      if (r.br) {
        out.push({ text: '', bold: false, italic: false, underline: false, strike: false, width: 0, spaceBefore: false, br: true });
        pendingSpace = false;
        continue;
      }
      const bold = !!(r.bold || st.forceBold);
      const italic = !!(r.italic || st.forceItalic);
      this.setFont(st.font, bold, italic, st.size);
      for (const part of clean(r.text).split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          pendingSpace = true;
          continue;
        }
        const last = out[out.length - 1];
        // mot collé au précédent (changement de style au milieu d'un mot)
        if (!pendingSpace && last && !last.br && out.length) {
          out.push({ text: part, bold, italic, underline: !!r.underline, strike: !!r.strike, width: this.doc.getTextWidth(part), spaceBefore: false });
        } else {
          out.push({ text: part, bold, italic, underline: !!r.underline, strike: !!r.strike, width: this.doc.getTextWidth(part), spaceBefore: out.length > 0 && pendingSpace });
        }
        pendingSpace = false;
      }
    }
    return out;
  }

  paragraph(runs: Run[], st: ParaStyle) {
    const lh = st.size * PT * st.leading;
    const words = this.words(runs, st);
    if (!words.length) {
      this.ensure(lh);
      this.y += lh * 0.6;
      return;
    }
    this.setFont(st.font, false, false, st.size);
    const space = this.doc.getTextWidth(' ');
    const indentLeft = st.indentLeft ?? 0;
    const width = (this.layout.columns > 1 ? this.colWidth : this.contentWidth) - indentLeft;

    // Lettrine
    let drop: { letter: string; size: number; w: number } | null = null;
    if (st.dropCap && words[0] && /^[\p{L}\p{N}]/u.test(words[0].text)) {
      const capH = 0.662;
      const bodyCap = st.size * PT * capH;
      const sizeMm = (2 * lh + bodyCap) / capH;
      const size = sizeMm / PT;
      const letter = words[0].text[0];
      this.setFont('times', true, false, size);
      drop = { letter, size, w: this.doc.getTextWidth(letter) + 1.6 };
      const rest = words[0].text.slice(1);
      this.setFont(st.font, words[0].bold, words[0].italic, st.size);
      words[0] = { ...words[0], text: rest, width: this.doc.getTextWidth(rest) };
    }

    const lineWidth = (i: number) => width - (i === 0 ? st.firstIndent ?? 0 : 0) - (drop && i < 3 ? drop.w : 0);

    // Découpage en lignes (algorithme glouton)
    const lines: Array<{ words: Word[]; forced: boolean }> = [];
    let cur: Word[] = [];
    let curW = 0;
    for (const w of words) {
      if (w.br) {
        lines.push({ words: cur, forced: true });
        cur = [];
        curW = 0;
        continue;
      }
      const add = (cur.length && w.spaceBefore ? space : 0) + w.width;
      if (cur.length && curW + add > lineWidth(lines.length) && w.spaceBefore) {
        lines.push({ words: cur, forced: false });
        cur = [{ ...w, spaceBefore: false }];
        curW = w.width;
      } else {
        cur.push(w);
        curW += add;
      }
    }
    lines.push({ words: cur, forced: true });

    if (st.spaceBefore && this.y > this.columnTop + 0.1) this.y += st.spaceBefore;
    const keep = Math.min(lines.length, Math.max(st.keepLines ?? 1, drop ? 3 : 1));
    this.ensure(lh * keep);

    lines.forEach((line, i) => {
      if (i >= keep) this.ensure(lh);
      const x0 = (this.layout.columns > 1 ? this.colX() : this.layout.margins.left) + indentLeft + (i === 0 ? st.firstIndent ?? 0 : 0) + (drop && i < 3 ? drop.w : 0);
      const baseline = this.y + st.size * PT * 0.8;
      const natural = line.words.reduce((s, w, j) => s + w.width + (j > 0 && w.spaceBefore ? space : 0), 0);
      const avail = lineWidth(i);
      const gaps = line.words.filter((w, j) => j > 0 && w.spaceBefore).length;
      let x = x0;
      let extra = 0;
      if (st.align === 'center') x += (avail - natural) / 2;
      else if (st.align === 'right') x += avail - natural;
      else if (st.align === 'justify' && !line.forced && gaps > 0) extra = (avail - natural) / gaps;

      this.doc.setTextColor(...st.color);
      line.words.forEach((w, j) => {
        if (j > 0 && w.spaceBefore) x += space + extra;
        this.setFont(st.font, w.bold, w.italic, st.size);
        if (w.text) this.doc.text(w.text, x, baseline);
        if (w.underline || w.strike) {
          this.doc.setDrawColor(...st.color);
          this.doc.setLineWidth(0.2);
          const ly = w.underline ? baseline + 0.6 : baseline - st.size * PT * 0.25;
          this.doc.line(x, ly, x + w.width, ly);
        }
        x += w.width;
      });

      if (drop && i === 0) {
        this.setFont('times', true, false, drop.size);
        this.doc.setTextColor(...st.dropCap!.color);
        this.doc.text(drop.letter, x0 - drop.w, baseline + 2 * lh);
        this.doc.setTextColor(...st.color);
      }
      if (st.bar) {
        this.doc.setDrawColor(...st.bar);
        this.doc.setLineWidth(0.8);
        const bx = (this.layout.columns > 1 ? this.colX() : this.layout.margins.left) + 0.5;
        this.doc.line(bx, this.y, bx, this.y + lh);
      }
      this.y += lh;
    });
    this.y += st.spaceAfter ?? 0;
  }

  async image(src: string, caption: string, maxH: number, captionStyle: ParaStyle) {
    let size: { width: number; height: number };
    try {
      size = await imageSize(src);
    } catch {
      return;
    }
    const w0 = this.layout.columns > 1 ? this.colWidth : this.contentWidth;
    let w = w0;
    let h = (size.height / size.width) * w;
    if (h > maxH) {
      h = maxH;
      w = (size.width / size.height) * h;
    }
    const capH = caption ? captionStyle.size * PT * captionStyle.leading * 2 : 0;
    this.y += 1.5;
    this.ensure(h + capH);
    const x = (this.layout.columns > 1 ? this.colX() : this.layout.margins.left) + (w0 - w) / 2;
    const fmt = /^data:image\/png/.test(src) ? 'PNG' : 'JPEG';
    try {
      this.doc.addImage(src, fmt, x, this.y, w, h);
    } catch {
      return;
    }
    this.y += h + 1.5;
    if (caption) this.paragraph([{ text: caption }], captionStyle);
    this.y += 2;
  }

  rule(color: [number, number, number], width = 0.3, full = false) {
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(width);
    const x = full || this.layout.columns === 1 ? this.layout.margins.left : this.colX();
    const w = full || this.layout.columns === 1 ? this.contentWidth : this.colWidth;
    this.doc.line(x, this.y, x + w, this.y);
  }
}

const INK: [number, number, number] = [25, 25, 28];
const GREY: [number, number, number] = [110, 110, 118];

export interface PdfOptions {
  magazineName: string;
  accent: string;
}

// ---------------- Manuscrit (une colonne, sobre) ----------------

export async function manuscriptPdf(d: ExportDoc, o: PdfOptions): Promise<Blob> {
  const t = new Typesetter({ margins: { top: 25, bottom: 25, left: 25, right: 25 }, columns: 1, gutter: 0 });
  const accent = hexToRgb(o.accent);
  const meta = [d.rubrique, d.issue, d.author && `Par ${d.author}`].filter(Boolean).join('  ·  ');
  if (meta) t.paragraph([{ text: meta.toUpperCase() }], { font: 'helvetica', size: 8.5, leading: 1.3, align: 'left', color: accent, spaceAfter: 3, forceBold: true });
  t.paragraph([{ text: d.title || 'Sans titre' }], { font: 'times', size: 22, leading: 1.15, align: 'left', color: INK, forceBold: true, spaceAfter: 4 });
  if (d.chapo) t.paragraph([{ text: d.chapo }], { font: 'times', size: 13, leading: 1.4, align: 'left', color: INK, forceBold: true, spaceAfter: 4 });
  t.y += 2;
  t.rule(accent, 0.5);
  t.y += 6;
  await body(t, d.blocks, {
    p: { font: 'times', size: 12, leading: 1.5, align: 'left', color: INK, spaceAfter: 2.5 },
    h: (level) => ({ font: 'times', size: level <= 2 ? 15 : 13, leading: 1.3, align: 'left', color: INK, forceBold: true, spaceBefore: 4, spaceAfter: 1.5, keepLines: 3 }),
    quote: { font: 'times', size: 12, leading: 1.5, align: 'left', color: INK, forceItalic: true, indentLeft: 8, spaceAfter: 2.5, bar: accent },
    li: (depth) => ({ font: 'times', size: 12, leading: 1.5, align: 'left', color: INK, indentLeft: 6 + depth * 6, spaceAfter: 1 }),
    caption: { font: 'helvetica', size: 8.5, leading: 1.35, align: 'center', color: GREY, forceItalic: true },
    imageMaxH: 130,
    accent,
  });
  footer(t, (i, n) => [d.title || '', `${i} / ${n}`]);
  return t.doc.output('blob');
}

// ---------------- Magazine (deux colonnes, lettrine) ----------------

export async function magazinePdf(d: ExportDoc, o: PdfOptions): Promise<Blob> {
  const accent = hexToRgb(o.accent);
  const t = new Typesetter({ margins: { top: 20, bottom: 22, left: 16, right: 16 }, columns: 1, gutter: 7 });
  t.onNewPage = () => {
    // bandeau courant sur les pages suivantes
    t.doc.setFont('helvetica', 'bold');
    t.doc.setFontSize(7.5);
    t.doc.setTextColor(...accent);
    t.doc.text(clean((d.rubrique || o.magazineName).toUpperCase()), t.layout.margins.left, 13);
    t.doc.setTextColor(...GREY);
    t.doc.setFont('helvetica', 'normal');
    t.doc.text(clean(d.title), t.pageW - t.layout.margins.right, 13, { align: 'right' });
    t.doc.setDrawColor(...accent);
    t.doc.setLineWidth(0.3);
    t.doc.line(t.layout.margins.left, 15, t.pageW - t.layout.margins.right, 15);
  };

  // En-tête pleine largeur
  t.doc.setFillColor(...accent);
  t.doc.rect(t.layout.margins.left, t.y, 14, 1.6, 'F');
  t.y += 5;
  if (d.rubrique) t.paragraph([{ text: d.rubrique.toUpperCase() }], { font: 'helvetica', size: 9, leading: 1.3, align: 'left', color: accent, forceBold: true, spaceAfter: 2 });
  t.paragraph([{ text: d.title || 'Sans titre' }], { font: 'times', size: 32, leading: 1.05, align: 'left', color: INK, forceBold: true, spaceAfter: 4 });
  if (d.chapo) t.paragraph([{ text: d.chapo }], { font: 'times', size: 14, leading: 1.35, align: 'left', color: INK, forceItalic: true, spaceAfter: 3 });
  if (d.author) t.paragraph([{ text: 'Par ' }, { text: d.author, bold: true }], { font: 'helvetica', size: 8.5, leading: 1.3, align: 'left', color: GREY, spaceAfter: 2 });
  t.y += 2;
  t.rule(INK, 0.25, true);
  t.y += 6;

  t.layout.columns = 2;
  t.startColumns(t.y);
  await body(t, d.blocks, {
    p: { font: 'times', size: 10, leading: 1.38, align: 'justify', color: INK, firstIndent: 4 },
    h: (level) => ({ font: 'helvetica', size: level <= 2 ? 10.5 : 9.5, leading: 1.3, align: 'left', color: accent, forceBold: true, spaceBefore: 4, spaceAfter: 1.5, keepLines: 4 }),
    quote: { font: 'times', size: 13, leading: 1.3, align: 'left', color: accent, forceItalic: true, indentLeft: 4, spaceBefore: 3, spaceAfter: 4, bar: accent },
    li: (depth) => ({ font: 'times', size: 10, leading: 1.38, align: 'left', color: INK, indentLeft: 4 + depth * 4, spaceAfter: 0.5 }),
    caption: { font: 'helvetica', size: 7, leading: 1.3, align: 'left', color: GREY, forceItalic: true },
    imageMaxH: 110,
    accent,
    dropCap: true,
    firstParaNoIndent: true,
  });
  // fin d'article : petit carré
  t.doc.setFillColor(...accent);
  t.doc.rect(t.colX() + t.colWidth - 2.2, Math.min(t.y + 1, t.bottom - 2.2), 2.2, 2.2, 'F');

  footer(t, (i) => [`${o.magazineName}${d.issue ? '  ·  ' + d.issue : ''}`, String(i)]);
  return t.doc.output('blob');
}

interface BodyStyles {
  p: ParaStyle;
  h: (level: number) => ParaStyle;
  quote: ParaStyle;
  li: (depth: number) => ParaStyle;
  caption: ParaStyle;
  imageMaxH: number;
  accent: [number, number, number];
  dropCap?: boolean;
  firstParaNoIndent?: boolean;
}

async function body(t: Typesetter, blocks: Block[], s: BodyStyles) {
  let firstPara = true;
  let afterHeading = false;
  for (const b of blocks) {
    switch (b.type) {
      case 'heading':
        t.paragraph(b.runs, s.h(b.level));
        afterHeading = true;
        continue;
      case 'paragraph': {
        const empty = !b.runs.some((r) => r.text.trim());
        if (empty) {
          t.y += s.p.size * PT * 0.5;
          continue;
        }
        const st: ParaStyle = { ...s.p, align: b.align === 'left' ? s.p.align : b.align };
        if ((firstPara && s.firstParaNoIndent) || afterHeading) st.firstIndent = 0;
        if (firstPara && s.dropCap) st.dropCap = { color: s.accent };
        t.paragraph(b.runs, st);
        firstPara = false;
        break;
      }
      case 'quote':
        t.paragraph([{ text: '« ' }, ...b.runs, { text: ' »' }], s.quote);
        break;
      case 'list':
        b.items.forEach((it, i) => {
          const marker = b.ordered ? `${i + 1}. ` : '- ';
          t.paragraph([{ text: marker, bold: b.ordered }, ...it.runs], s.li(it.depth));
        });
        t.y += 1.5;
        break;
      case 'image':
        await t.image(b.src, b.caption, s.imageMaxH, s.caption);
        break;
      case 'hr':
        t.y += 2;
        t.ensure(4);
        t.doc.setFillColor(...s.accent);
        {
          const cx = (t.layout.columns > 1 ? t.colX() + t.colWidth / 2 : t.pageW / 2);
          [-4, 0, 4].forEach((dx) => t.doc.circle(cx + dx, t.y + 1, 0.5, 'F'));
        }
        t.y += 5;
        break;
    }
    afterHeading = false;
  }
}

function footer(t: Typesetter, text: (page: number, total: number) => [string, string]) {
  const n = t.doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    t.doc.setPage(i);
    const [left, right] = text(i, n);
    t.doc.setFont('helvetica', 'normal');
    t.doc.setFontSize(7.5);
    t.doc.setTextColor(...GREY);
    const y = t.pageH - 11;
    t.doc.text(clean(left).slice(0, 90), t.layout.margins.left, y);
    t.doc.text(right, t.pageW - t.layout.margins.right, y, { align: 'right' });
  }
}
