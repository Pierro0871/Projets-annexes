import Dexie, { type EntityTable } from 'dexie';
import type { JSONContent } from '@tiptap/react';

export type Status = 'idee' | 'brouillon' | 'relecture' | 'pret' | 'publie';

export interface Article {
  id: string;
  title: string;
  chapo: string; // chapô / accroche
  content: JSONContent | null;
  wordCount: number;
  wordGoal: number | null;
  status: Status;
  rubriqueId: string | null;
  issueId: string | null;
  deadline: string | null; // YYYY-MM-DD
  author: string;
  createdAt: number;
  updatedAt: number;
}

export interface Idea {
  id: string;
  text: string;
  rubriqueId: string | null;
  pinned: boolean;
  articleId: string | null; // si l'idée a été transformée en article
  createdAt: number;
}

export type SourceType = 'lien' | 'citation' | 'contact' | 'interview' | 'note';

export interface Source {
  id: string;
  articleId: string | null;
  type: SourceType;
  title: string;
  content: string;
  url: string;
  createdAt: number;
}

export interface Media {
  id: string;
  articleId: string;
  dataUrl: string;
  width: number;
  height: number;
  caption: string;
  credit: string;
  createdAt: number;
}

export interface Issue {
  id: string;
  number: string;
  title: string;
  closingDate: string | null; // bouclage
  publishDate: string | null; // parution
  notes: string;
  createdAt: number;
}

export interface Rubrique {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface Version {
  id: string;
  articleId: string;
  title: string;
  chapo: string;
  content: JSONContent | null;
  wordCount: number;
  label: string;
  createdAt: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

export const db = new Dexie('redaction') as Dexie & {
  articles: EntityTable<Article, 'id'>;
  ideas: EntityTable<Idea, 'id'>;
  sources: EntityTable<Source, 'id'>;
  media: EntityTable<Media, 'id'>;
  issues: EntityTable<Issue, 'id'>;
  rubriques: EntityTable<Rubrique, 'id'>;
  versions: EntityTable<Version, 'id'>;
  settings: EntityTable<Setting, 'key'>;
};

db.version(1).stores({
  articles: 'id, status, rubriqueId, issueId, deadline, updatedAt',
  ideas: 'id, createdAt, rubriqueId',
  sources: 'id, articleId, type, createdAt',
  media: 'id, articleId, createdAt',
  issues: 'id, closingDate, publishDate, createdAt',
  rubriques: 'id, order',
  versions: 'id, articleId, createdAt',
  settings: 'key',
});

export const TABLES = ['articles', 'ideas', 'sources', 'media', 'issues', 'rubriques', 'versions', 'settings'] as const;

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export const DEFAULT_RUBRIQUES: Array<Pick<Rubrique, 'name' | 'color'>> = [
  { name: 'Édito', color: '#e4572e' },
  { name: 'Reportage', color: '#2e86ab' },
  { name: 'Portrait', color: '#a23b72' },
  { name: 'Culture', color: '#f1a208' },
  { name: 'Chronique', color: '#3bb273' },
];

db.on('populate', async (tx) => {
  await tx.table('rubriques').bulkAdd(
    DEFAULT_RUBRIQUES.map((r, i) => ({ id: uid(), name: r.name, color: r.color, order: i })),
  );
});

export function newArticle(partial: Partial<Article> = {}): Article {
  const now = Date.now();
  return {
    id: uid(),
    title: '',
    chapo: '',
    content: null,
    wordCount: 0,
    wordGoal: null,
    status: 'brouillon',
    rubriqueId: null,
    issueId: null,
    deadline: null,
    author: '',
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export async function deleteArticle(id: string) {
  await db.transaction('rw', [db.articles, db.sources, db.media, db.versions, db.ideas], async () => {
    await db.articles.delete(id);
    await db.sources.where('articleId').equals(id).delete();
    await db.media.where('articleId').equals(id).delete();
    await db.versions.where('articleId').equals(id).delete();
    await db.ideas.filter((i) => i.articleId === id).modify({ articleId: null });
  });
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const s = await db.settings.get(key);
  return (s?.value as T) ?? fallback;
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value });
}

const MAX_VERSIONS = 60;

export async function snapshotVersion(article: Article, label = '') {
  await db.versions.add({
    id: uid(),
    articleId: article.id,
    title: article.title,
    chapo: article.chapo,
    content: article.content,
    wordCount: article.wordCount,
    label,
    createdAt: Date.now(),
  });
  const all = await db.versions.where('articleId').equals(article.id).sortBy('createdAt');
  const auto = all.filter((v) => !v.label);
  if (all.length > MAX_VERSIONS && auto.length) {
    const excess = all.length - MAX_VERSIONS;
    await db.versions.bulkDelete(auto.slice(0, excess).map((v) => v.id));
  }
}
