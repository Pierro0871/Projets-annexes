import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { generateHTML } from '@tiptap/core';
import { db, uid, type Article, type Media, type Source, type Version } from '../db';
import { SOURCE_TYPES, STATUSES, sourceInfo } from '../constants';
import { AutoTextarea, confirmDialog, Dot, Empty, Field, Icon, Sheet, toast } from '../ui';
import { formatDate, formatDateTime, readingTime, timeAgo } from '../util';
import { editorExtensions } from './Editor';
import { pickFile } from '../native';
import { loadAndResize } from '../images';
import { useNav } from '../nav';

// ---------------- Infos ----------------

export function InfoPanel({ article, chars, update }: { article: Article; chars: number; update: (p: Partial<Article>) => void }) {
  const rubriques = useLiveQuery(() => db.rubriques.orderBy('order').toArray(), []);
  const issues = useLiveQuery(() => db.issues.orderBy('createdAt').reverse().toArray(), []);
  const idea = useLiveQuery(() => db.ideas.filter((i) => i.articleId === article.id).first(), [article.id]);
  const [newIssue, setNewIssue] = useState(false);

  return (
    <div className="pad form">
      <Field label="Statut">
        <div className="status-picker">
          {STATUSES.map((s) => (
            <button key={s.id} className={article.status === s.id ? 'on' : ''} style={{ '--c': s.color } as React.CSSProperties} onClick={() => update({ status: s.id })}>
              {s.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Rubrique">
        <div className="chips wrap">
          <button className={`chip ${!article.rubriqueId ? 'on' : ''}`} onClick={() => update({ rubriqueId: null })}>Aucune</button>
          {rubriques?.map((r) => (
            <button key={r.id} className={`chip ${article.rubriqueId === r.id ? 'on' : ''}`} onClick={() => update({ rubriqueId: r.id })}>
              <Dot color={r.color} /> {r.name}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Numéro du magazine">
        <div className="row">
          <select className="input" value={article.issueId ?? ''} onChange={(e) => update({ issueId: e.target.value || null })}>
            <option value="">Non attribué</option>
            {issues?.map((i) => (
              <option key={i.id} value={i.id}>N°{i.number}{i.title ? ` – ${i.title}` : ''}</option>
            ))}
          </select>
          <button className="btn ghost" onClick={() => setNewIssue(true)}>Nouveau</button>
        </div>
      </Field>

      <div className="grid2">
        <Field label="Échéance">
          <input className="input" type="date" value={article.deadline ?? ''} onChange={(e) => update({ deadline: e.target.value || null })} />
        </Field>
        <Field label="Objectif (mots)">
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="ex. 1200"
            value={article.wordGoal ?? ''}
            onChange={(e) => update({ wordGoal: e.target.value ? Math.max(0, parseInt(e.target.value, 10)) : null })}
          />
        </Field>
      </div>

      <Field label="Signature" hint="Laisse vide pour utiliser le nom défini dans les réglages.">
        <input className="input" value={article.author} placeholder="Ton nom" onChange={(e) => update({ author: e.target.value })} />
      </Field>

      <div className="stat-grid">
        <div><b>{article.wordCount.toLocaleString('fr-FR')}</b><span>mots</span></div>
        <div><b>{chars.toLocaleString('fr-FR')}</b><span>signes</span></div>
        <div><b>{readingTime(article.wordCount).replace(' de lecture', '')}</b><span>de lecture</span></div>
      </div>
      <p className="muted small">
        Créé le {formatDateTime(article.createdAt)} · modifié {timeAgo(article.updatedAt)}
        {idea ? <><br />Né de l'idée : « {idea.text.slice(0, 80)}{idea.text.length > 80 ? '…' : ''} »</> : null}
      </p>

      <NewIssueSheet open={newIssue} onClose={() => setNewIssue(false)} onCreated={(id) => update({ issueId: id })} />
    </div>
  );
}

export function NewIssueSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  const [number, setNumber] = useState('');
  const [title, setTitle] = useState('');
  const save = async () => {
    if (!number.trim()) return;
    const id = uid();
    await db.issues.add({ id, number: number.trim(), title: title.trim(), closingDate: null, publishDate: null, notes: '', createdAt: Date.now() });
    onCreated?.(id);
    setNumber('');
    setTitle('');
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Nouveau numéro" footer={<div className="row-end"><button className="btn ghost" onClick={onClose}>Annuler</button><button className="btn primary" disabled={!number.trim()} onClick={save}>Créer</button></div>}>
      <div className="form">
        <Field label="Numéro"><input className="input" autoFocus inputMode="numeric" placeholder="ex. 1" value={number} onChange={(e) => setNumber(e.target.value)} /></Field>
        <Field label="Titre / thème (facultatif)"><input className="input" placeholder="ex. Spécial printemps" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      </div>
    </Sheet>
  );
}

// ---------------- Sources ----------------

export function SourcesPanel({ articleId }: { articleId: string }) {
  const sources = useLiveQuery(() => db.sources.where('articleId').equals(articleId).reverse().sortBy('createdAt'), [articleId]);
  const unattached = useLiveQuery(() => db.sources.filter((s) => !s.articleId).count(), []);
  const [editing, setEditing] = useState<Source | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);

  const blank = (): Source => ({ id: '', articleId, type: 'lien', title: '', content: '', url: '', createdAt: Date.now() });

  return (
    <div className="pad">
      <div className="row">
        <button className="btn primary grow" onClick={() => setEditing(blank())}><Icon name="plus" size={18} /> Ajouter une source</button>
        {!!unattached && <button className="btn ghost" onClick={() => setAttachOpen(true)}>Depuis mes recherches</button>}
      </div>
      {sources && sources.length === 0 && <Empty icon="sources" title="Aucune source" text="Liens, citations, contacts, notes d'interview : tout ce qui nourrit cet article." />}
      <div className="list tight">
        {sources?.map((s) => <SourceItem key={s.id} s={s} onClick={() => setEditing(s)} />)}
      </div>
      <SourceSheet source={editing} onClose={() => setEditing(null)} />
      <AttachSourcesSheet open={attachOpen} onClose={() => setAttachOpen(false)} articleId={articleId} />
    </div>
  );
}

export function SourceItem({ s, onClick, articleTitle }: { s: Source; onClick: () => void; articleTitle?: string }) {
  const t = sourceInfo(s.type);
  return (
    <button className="card source-card" onClick={onClick}>
      <span className="source-icon">{t.icon}</span>
      <span className="source-body">
        <span className="source-type">{t.label}{articleTitle !== undefined ? <> · <span className="muted">{articleTitle || 'Non rattachée'}</span></> : null}</span>
        <b>{s.title || (s.type === 'citation' ? 'Citation' : s.url || 'Sans titre')}</b>
        {s.content && <span className={`source-content ${s.type === 'citation' ? 'serif-italic' : ''}`}>{s.content}</span>}
        {s.url && <span className="source-url">{s.url.replace(/^https?:\/\/(www\.)?/, '')}</span>}
      </span>
    </button>
  );
}

export function SourceSheet({ source, onClose, allowArticlePick }: { source: Source | null; onClose: () => void; allowArticlePick?: boolean }) {
  const [draft, setDraft] = useState<Source | null>(null);
  const [forKey, setForKey] = useState<string | null>(null);
  const articles = useLiveQuery(() => (allowArticlePick ? db.articles.orderBy('updatedAt').reverse().toArray() : []), [allowArticlePick]);
  const key = source ? `${source.id}:${source.createdAt}` : null;
  if (key !== forKey) {
    setForKey(key);
    setDraft(source);
  }
  const d = draft;
  const set = (p: Partial<Source>) => setDraft({ ...(d as Source), ...p });

  const save = async () => {
    if (!d) return;
    if (!d.title.trim() && !d.content.trim() && !d.url.trim()) {
      onClose();
      return;
    }
    let url = d.url.trim();
    if (url && !/^[a-z]+:/i.test(url) && /\./.test(url)) url = 'https://' + url;
    await db.sources.put({ ...d, url, id: d.id || uid() });
    setDraft(null);
    onClose();
  };
  const remove = async () => {
    if (!d?.id) return onClose();
    if (!(await confirmDialog('Supprimer cette source ?', { ok: 'Supprimer', danger: true }))) return;
    await db.sources.delete(d.id);
    setDraft(null);
    onClose();
  };

  return (
    <Sheet
      open={!!d}
      onClose={() => {
        setDraft(null);
        onClose();
      }}
      title={d?.id ? 'Modifier la source' : 'Nouvelle source'}
      footer={
        <div className="row-end">
          {d?.id && <button className="btn ghost danger-text" onClick={remove}><Icon name="trash" size={18} /></button>}
          <span className="spacer" />
          <button className="btn primary" onClick={save}>Enregistrer</button>
        </div>
      }
    >
      {d && (
        <div className="form">
          <div className="chips wrap">
            {SOURCE_TYPES.map((t) => (
              <button key={t.id} className={`chip ${d.type === t.id ? 'on' : ''}`} onClick={() => set({ type: t.id })}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <Field label={d.type === 'contact' ? 'Nom' : d.type === 'citation' ? 'Auteur de la citation' : 'Titre'}>
            <input className="input" value={d.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          {(d.type === 'lien' || d.type === 'interview') && (
            <Field label={d.type === 'lien' ? 'Adresse (URL)' : 'Lien vers l\'enregistrement (facultatif)'}>
              <div className="row">
                <input className="input" type="url" inputMode="url" placeholder="https://…" value={d.url} onChange={(e) => set({ url: e.target.value })} />
                {d.url && (
                  <a className="btn ghost" href={/^[a-z]+:/i.test(d.url) ? d.url : 'https://' + d.url} target="_blank" rel="noreferrer"><Icon name="external" size={18} /></a>
                )}
              </div>
            </Field>
          )}
          <Field label={d.type === 'contact' ? 'Coordonnées, fonction, notes' : d.type === 'citation' ? 'Citation' : d.type === 'interview' ? 'Notes / transcription' : 'Notes'}>
            <AutoTextarea className="input textarea" rows={4} value={d.content} onChange={(e) => set({ content: e.target.value })} spellCheck lang="fr" />
          </Field>
          {d.type === 'contact' && (
            <Field label="Téléphone ou e-mail (facultatif)">
              <input className="input" value={d.url} onChange={(e) => set({ url: e.target.value })} />
            </Field>
          )}
          {allowArticlePick && (
            <Field label="Rattachée à l'article">
              <select className="input" value={d.articleId ?? ''} onChange={(e) => set({ articleId: e.target.value || null })}>
                <option value="">Aucun (recherche libre)</option>
                {articles?.map((a) => <option key={a.id} value={a.id}>{a.title || 'Sans titre'}</option>)}
              </select>
            </Field>
          )}
          {d.type === 'citation' && d.content && (
            <button
              className="btn ghost"
              onClick={() => {
                void navigator.clipboard?.writeText(`« ${d.content} »${d.title ? ` (${d.title})` : ''}`).then(() => toast('Citation copiée'));
              }}
            >
              <Icon name="copy" size={18} /> Copier la citation
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}

function AttachSourcesSheet({ open, onClose, articleId }: { open: boolean; onClose: () => void; articleId: string }) {
  const free = useLiveQuery(() => db.sources.filter((s) => !s.articleId).toArray(), []);
  return (
    <Sheet open={open} onClose={onClose} title="Rattacher une recherche">
      <div className="list tight">
        {free?.map((s) => (
          <SourceItem
            key={s.id}
            s={s}
            onClick={async () => {
              await db.sources.update(s.id, { articleId });
              toast('Source rattachée');
            }}
          />
        ))}
        {free?.length === 0 && <p className="muted">Plus rien à rattacher.</p>}
      </div>
    </Sheet>
  );
}

// ---------------- Médias ----------------

export function MediaPanel({ articleId, onInsert }: { articleId: string; onInsert: (src: string, caption: string) => void }) {
  const media = useLiveQuery(() => db.media.where('articleId').equals(articleId).sortBy('createdAt'), [articleId]);
  const [open, setOpen] = useState<Media | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    setBusy(true);
    try {
      const img = await loadAndResize(file);
      await db.media.add({ id: uid(), articleId, ...img, caption: '', credit: '', createdAt: Date.now() });
    } catch {
      toast('Impossible de lire cette image');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pad">
      <button className="btn primary full" onClick={add} disabled={busy}><Icon name="image" size={18} /> {busy ? 'Import…' : 'Ajouter une photo'}</button>
      {media && media.length === 0 && <Empty icon="image" title="Aucune photo" text="Ajoute les photos de l'article : tu pourras les légender, créditer et les insérer dans le texte." />}
      <div className="media-grid">
        {media?.map((m) => (
          <button key={m.id} className="media-thumb" onClick={() => setOpen(m)}>
            <img src={m.dataUrl} alt={m.caption} loading="lazy" />
            {m.caption && <span>{m.caption}</span>}
          </button>
        ))}
      </div>
      <MediaSheet media={open} onClose={() => setOpen(null)} onInsert={onInsert} />
    </div>
  );
}

function MediaSheet({ media, onClose, onInsert }: { media: Media | null; onClose: () => void; onInsert: (src: string, caption: string) => void }) {
  const [caption, setCaption] = useState('');
  const [credit, setCredit] = useState('');
  const [forId, setForId] = useState<string | null>(null);
  if (media && forId !== media.id) {
    setForId(media.id);
    setCaption(media.caption);
    setCredit(media.credit);
  }
  const persist = async () => {
    if (media) await db.media.update(media.id, { caption, credit });
  };
  const full = [caption, credit && `© ${credit}`].filter(Boolean).join(' – ');
  return (
    <Sheet
      open={!!media}
      onClose={() => {
        void persist();
        onClose();
      }}
      footer={
        <div className="row-end">
          <button
            className="btn ghost danger-text"
            onClick={async () => {
              if (!media || !(await confirmDialog('Supprimer cette photo de la galerie ? (Si elle est déjà dans le texte, elle y reste.)', { ok: 'Supprimer', danger: true }))) return;
              await db.media.delete(media.id);
              onClose();
            }}
          >
            <Icon name="trash" size={18} />
          </button>
          <span className="spacer" />
          <button
            className="btn primary"
            onClick={async () => {
              await persist();
              onInsert(media!.dataUrl, full);
              onClose();
            }}
          >
            Insérer dans le texte
          </button>
        </div>
      }
    >
      {media && (
        <div className="form">
          <img className="media-preview" src={media.dataUrl} alt="" />
          <Field label="Légende"><input className="input" value={caption} onChange={(e) => setCaption(e.target.value)} /></Field>
          <Field label="Crédit photo"><input className="input" value={credit} placeholder="ex. Jean Dupont" onChange={(e) => setCredit(e.target.value)} /></Field>
        </div>
      )}
    </Sheet>
  );
}

// ---------------- Versions ----------------

export function VersionsPanel({ article, onSave, onRestore }: { article: Article; onSave: () => void; onRestore: (v: Version) => void }) {
  const versions = useLiveQuery(() => db.versions.where('articleId').equals(article.id).reverse().sortBy('createdAt'), [article.id]);
  const [open, setOpen] = useState<Version | null>(null);
  return (
    <div className="pad">
      <button className="btn primary full" onClick={onSave}><Icon name="history" size={18} /> Enregistrer la version actuelle</button>
      <p className="muted small">Une version est aussi gardée automatiquement quand tu quittes l'article, et toutes les 10 minutes pendant l'écriture.</p>
      {versions && versions.length === 0 && <Empty icon="history" title="Pas encore de version" />}
      <div className="list tight">
        {versions?.map((v, i) => {
          const prev = versions[i + 1];
          const diff = prev ? v.wordCount - prev.wordCount : v.wordCount;
          return (
            <button key={v.id} className="card version-card" onClick={() => setOpen(v)}>
              <span className="version-dot" data-manual={!!v.label} />
              <span className="grow">
                <b>{formatDateTime(v.createdAt)}</b>
                <span className="muted small">{v.label || 'Automatique'} · {v.wordCount.toLocaleString('fr-FR')} mots{diff ? ` (${diff > 0 ? '+' : ''}${diff})` : ''}</span>
              </span>
              <Icon name="arrowRight" size={18} />
            </button>
          );
        })}
      </div>
      <VersionSheet version={open} onClose={() => setOpen(null)} onRestore={onRestore} />
    </div>
  );
}

function VersionSheet({ version, onClose, onRestore }: { version: Version | null; onClose: () => void; onRestore: (v: Version) => void }) {
  const html = useMemo(() => {
    if (!version?.content) return '';
    try {
      return generateHTML(version.content, editorExtensions);
    } catch {
      return '';
    }
  }, [version]);
  return (
    <Sheet
      open={!!version}
      onClose={onClose}
      title={version ? formatDateTime(version.createdAt) : ''}
      footer={
        <div className="row-end">
          <button className="btn ghost" onClick={onClose}>Fermer</button>
          <button
            className="btn primary"
            onClick={async () => {
              if (!version) return;
              if (!(await confirmDialog("Remplacer le texte actuel par cette version ? L'actuel sera gardé dans l'historique.", { ok: 'Restaurer' }))) return;
              onRestore(version);
              onClose();
            }}
          >
            Restaurer
          </button>
        </div>
      }
    >
      {version && (
        <div className="version-preview">
          <h2>{version.title || 'Sans titre'}</h2>
          {version.chapo && <p className="chapo">{version.chapo}</p>}
          <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
    </Sheet>
  );
}

// ---------------- Petit lien vers un article ----------------

export function ArticleLink({ id }: { id: string }) {
  const nav = useNav();
  const a = useLiveQuery(() => db.articles.get(id), [id]);
  if (!a) return null;
  return (
    <button className="link-btn" onClick={() => nav.push({ name: 'article', id })}>
      → {a.title || 'Sans titre'} {a.deadline ? <span className="muted">· {formatDate(a.deadline)}</span> : null}
    </button>
  );
}
