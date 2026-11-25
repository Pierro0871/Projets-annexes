import { db, getSetting, type Article } from '../db';
import { saveAndShare } from '../native';
import { slugify } from '../util';
import { toBlocks, type ExportDoc } from './model';

export type ExportKind = 'pdf' | 'magazine' | 'docx';

export async function buildExportDoc(a: Article): Promise<{ doc: ExportDoc; accent: string }> {
  const rub = a.rubriqueId ? await db.rubriques.get(a.rubriqueId) : undefined;
  const issue = a.issueId ? await db.issues.get(a.issueId) : undefined;
  const author = a.author || (await getSetting('authorName', ''));
  return {
    accent: rub?.color ?? (await getSetting('accent', '#e4572e')),
    doc: {
      title: a.title,
      chapo: a.chapo,
      author,
      rubrique: rub?.name ?? '',
      issue: issue ? `N°${issue.number}${issue.title ? ' – ' + issue.title : ''}` : '',
      blocks: toBlocks(a.content),
    },
  };
}

export async function exportArticle(a: Article, kind: ExportKind) {
  const { doc, accent } = await buildExportDoc(a);
  const magazineName = await getSetting('magazineName', 'Mon magazine');
  const base = slugify(a.title || 'article');
  if (kind === 'docx') {
    const { articleDocx } = await import('./docx');
    await saveAndShare(`${base}.docx`, await articleDocx(doc, accent), 'Exporter en Word');
  } else {
    const { manuscriptPdf, magazinePdf } = await import('./pdf');
    const blob = kind === 'magazine' ? await magazinePdf(doc, { magazineName, accent }) : await manuscriptPdf(doc, { magazineName, accent });
    await saveAndShare(`${base}${kind === 'magazine' ? '-magazine' : ''}.pdf`, blob, 'Exporter en PDF');
  }
}
