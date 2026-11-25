import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newArticle, type Article, type Issue, type Rubrique, type Status } from '../db';
import { STATUSES } from '../constants';
import { useNav } from '../nav';
import { Dot, Empty, Fab, Header, Icon, StatusBadge } from '../ui';
import { normalize, relativeDeadline, timeAgo } from '../util';

type Sort = 'recent' | 'deadline' | 'title';

export function ArticlesScreen() {
  const nav = useNav();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [status, setStatus] = useState<Status | 'all' | 'actifs'>('actifs');
  const [rubrique, setRubrique] = useState<string | 'all'>('all');
  const [sort, setSort] = useState<Sort>('recent');

  const articles = useLiveQuery(() => db.articles.toArray(), []);
  const rubriques = useLiveQuery(() => db.rubriques.orderBy('order').toArray(), []);
  const issues = useLiveQuery(() => db.issues.toArray(), []);

  const create = async () => {
    const a = newArticle({ rubriqueId: rubrique !== 'all' ? rubrique : null });
    await db.articles.add(a);
    nav.push({ name: 'article', id: a.id });
  };

  if (!articles || !rubriques || !issues) return null;

  const q = normalize(query.trim());
  const filtered = articles
    .filter((a) => (status === 'all' ? true : status === 'actifs' ? a.status !== 'publie' : a.status === status))
    .filter((a) => rubrique === 'all' || a.rubriqueId === rubrique)
    .filter((a) => !q || normalize(`${a.title} ${a.chapo}`).includes(q) || normalize(JSON.stringify(a.content ?? '')).includes(q))
    .sort((a, b) => {
      if (sort === 'title') return (a.title || '~').localeCompare(b.title || '~', 'fr');
      if (sort === 'deadline') return (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999');
      return b.updatedAt - a.updatedAt;
    });

  const counts = new Map<string, number>();
  for (const a of articles) counts.set(a.status, (counts.get(a.status) ?? 0) + 1);
  const totalWords = articles.filter((a) => a.status !== 'publie').reduce((s, a) => s + a.wordCount, 0);

  return (
    <div className="screen">
      <Header
        large
        title="Articles"
        subtitle={articles.length ? `${articles.length} article${articles.length > 1 ? 's' : ''} · ${totalWords.toLocaleString('fr-FR')} mots en cours` : undefined}
        actions={
          <button className="icon-btn" onClick={() => setSearchOpen((v) => !v)} aria-label="Rechercher">
            <Icon name={searchOpen ? 'close' : 'search'} />
          </button>
        }
      />
      {searchOpen && (
        <div className="pad">
          <input className="input search" autoFocus placeholder="Titre, chapô ou texte…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      )}

      <div className="chips scroll-x">
        <button className={`chip ${status === 'actifs' ? 'on' : ''}`} onClick={() => setStatus('actifs')}>En cours</button>
        {STATUSES.map((s) => (
          <button key={s.id} className={`chip ${status === s.id ? 'on' : ''}`} style={{ '--c': s.color } as React.CSSProperties} onClick={() => setStatus(s.id)}>
            <Dot color={s.color} /> {s.label} {counts.get(s.id) ? <span className="chip-count">{counts.get(s.id)}</span> : null}
          </button>
        ))}
        <button className={`chip ${status === 'all' ? 'on' : ''}`} onClick={() => setStatus('all')}>Tous</button>
      </div>

      <div className="toolbar-row">
        <select className="select-inline" value={rubrique} onChange={(e) => setRubrique(e.target.value)}>
          <option value="all">Toutes les rubriques</option>
          {rubriques.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select className="select-inline" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="recent">Modifiés récemment</option>
          <option value="deadline">Par échéance</option>
          <option value="title">Par titre</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        articles.length === 0 ? (
          <Empty icon="doc" title="Aucun article pour l'instant" text="Appuie sur + pour commencer ton premier article." action={<button className="btn primary" onClick={create}>Nouvel article</button>} />
        ) : (
          <Empty icon="search" title="Aucun article ne correspond" text="Change les filtres ou la recherche." />
        )
      ) : (
        <div className="list">
          {filtered.map((a) => (
            <ArticleCard key={a.id} a={a} rubriques={rubriques} issues={issues} onOpen={() => nav.push({ name: 'article', id: a.id })} />
          ))}
        </div>
      )}
      <Fab onClick={create} label="Nouvel article" />
    </div>
  );
}

export function ArticleCard({ a, rubriques, issues, onOpen, hideIssue }: { a: Article; rubriques: Rubrique[]; issues: Issue[]; onOpen: () => void; hideIssue?: boolean }) {
  const rub = rubriques.find((r) => r.id === a.rubriqueId);
  const issue = issues.find((i) => i.id === a.issueId);
  const dl = a.status !== 'publie' ? relativeDeadline(a.deadline) : null;
  const pct = a.wordGoal ? Math.min(100, Math.round((a.wordCount / a.wordGoal) * 100)) : null;
  return (
    <button className="card article-card" onClick={onOpen} style={{ '--rub': rub?.color ?? 'var(--line)' } as React.CSSProperties}>
      <div className="card-top">
        {rub ? <span className="rub-label" style={{ color: rub.color }}>{rub.name}</span> : <span className="rub-label muted">Sans rubrique</span>}
        {issue && !hideIssue && <span className="issue-tag">N°{issue.number}</span>}
        <span className="spacer" />
        <StatusBadge status={a.status} small />
      </div>
      <div className="card-title">{a.title || <span className="muted">Sans titre</span>}</div>
      {a.chapo && <div className="card-excerpt">{a.chapo}</div>}
      <div className="card-meta">
        <span>{a.wordCount.toLocaleString('fr-FR')} mots{a.wordGoal ? ` / ${a.wordGoal.toLocaleString('fr-FR')}` : ''}</span>
        {dl && <span className={`deadline ${dl.tone}`}><Icon name="clock" size={13} /> {dl.text}</span>}
        <span className="spacer" />
        <span className="muted">{timeAgo(a.updatedAt)}</span>
      </div>
      {pct !== null && (
        <div className="progress"><div style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--ok)' : 'var(--accent)' }} /></div>
      )}
    </button>
  );
}
