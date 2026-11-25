import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newArticle, uid, type Idea, type Source, type SourceType } from '../db';
import { SOURCE_TYPES } from '../constants';
import { useNav } from '../nav';
import { AutoTextarea, confirmDialog, Dot, Empty, Fab, Header, Icon, Menu, Segmented, Sheet } from '../ui';
import { normalize, timeAgo } from '../util';
import { ArticleLink, SourceItem, SourceSheet } from './ArticlePanels';

export function IdeasScreen() {
  const [mode, setMode] = useState<'idees' | 'recherches'>('idees');
  return (
    <div className="screen">
      <Header large title={mode === 'idees' ? 'Idées' : 'Recherches'} />
      <div className="pad-x">
        <Segmented value={mode} onChange={setMode} options={[{ id: 'idees', label: "Banque d'idées" }, { id: 'recherches', label: 'Recherches & sources' }]} />
      </div>
      {mode === 'idees' ? <IdeasList /> : <ResearchList />}
    </div>
  );
}

function IdeasList() {
  const nav = useNav();
  const ideas = useLiveQuery(() => db.ideas.orderBy('createdAt').reverse().toArray(), []);
  const rubriques = useLiveQuery(() => db.rubriques.orderBy('order').toArray(), []);
  const [text, setText] = useState('');
  const [rub, setRub] = useState<string | null>(null);
  const [menu, setMenu] = useState<Idea | null>(null);
  const [edit, setEdit] = useState<Idea | null>(null);
  const [showDone, setShowDone] = useState(false);

  const add = async () => {
    if (!text.trim()) return;
    await db.ideas.add({ id: uid(), text: text.trim(), rubriqueId: rub, pinned: false, articleId: null, createdAt: Date.now() });
    setText('');
  };

  const toArticle = async (i: Idea) => {
    const [first, ...rest] = i.text.split('\n');
    const short = first.length <= 90;
    const a = newArticle({
      title: short ? first : '',
      chapo: short ? rest.join('\n').trim() : i.text,
      status: 'idee',
      rubriqueId: i.rubriqueId,
    });
    await db.articles.add(a);
    await db.ideas.update(i.id, { articleId: a.id });
    nav.push({ name: 'article', id: a.id });
  };

  if (!ideas || !rubriques) return null;
  const open = ideas.filter((i) => !i.articleId).sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const done = ideas.filter((i) => i.articleId);

  return (
    <>
      <div className="pad">
        <div className="quick-add">
          <AutoTextarea className="input textarea" rows={2} placeholder="Une idée d'article, un angle, une piste…" value={text} onChange={(e) => setText(e.target.value)} spellCheck lang="fr" />
          <div className="row">
            <select className="select-inline" value={rub ?? ''} onChange={(e) => setRub(e.target.value || null)}>
              <option value="">Sans rubrique</option>
              {rubriques.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <span className="spacer" />
            <button className="btn primary" disabled={!text.trim()} onClick={add}>Noter</button>
          </div>
        </div>
      </div>

      {open.length === 0 && <Empty icon="idea" title="Ta banque d'idées est vide" text="Note ici tout ce qui te passe par la tête. Tu pourras transformer une idée en article en un geste." />}
      <div className="list">
        {open.map((i) => {
          const r = rubriques.find((x) => x.id === i.rubriqueId);
          return (
            <div key={i.id} className={`card idea-card ${i.pinned ? 'pinned' : ''}`}>
              <button className="idea-main" onClick={() => setMenu(i)}>
                <span className="idea-text">{i.text}</span>
                <span className="card-meta">
                  {i.pinned && <span className="pin"><Icon name="pin" size={13} /> Épinglée</span>}
                  {r && <span><Dot color={r.color} /> {r.name}</span>}
                  <span className="spacer" />
                  <span className="muted">{timeAgo(i.createdAt)}</span>
                </span>
              </button>
              <button className="idea-go" onClick={() => toArticle(i)} aria-label="Transformer en article">
                <Icon name="arrowRight" size={20} />
              </button>
            </div>
          );
        })}
      </div>

      {done.length > 0 && (
        <div className="pad">
          <button className="link-btn" onClick={() => setShowDone((v) => !v)}>
            {showDone ? 'Masquer' : 'Voir'} les {done.length} idée{done.length > 1 ? 's' : ''} devenue{done.length > 1 ? 's' : ''} article{done.length > 1 ? 's' : ''}
          </button>
          {showDone && (
            <div className="list tight">
              {done.map((i) => (
                <div key={i.id} className="card idea-card done">
                  <div className="idea-main">
                    <span className="idea-text">{i.text}</span>
                    <ArticleLink id={i.articleId!} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Menu
        open={!!menu}
        onClose={() => setMenu(null)}
        items={
          menu
            ? [
                { label: 'Transformer en article', icon: 'doc', onClick: () => toArticle(menu) },
                { label: 'Modifier', icon: 'edit', onClick: () => setEdit(menu) },
                { label: menu.pinned ? 'Désépingler' : 'Épingler en haut', icon: 'pin', onClick: () => db.ideas.update(menu.id, { pinned: !menu.pinned }) },
                {
                  label: 'Supprimer',
                  icon: 'trash',
                  danger: true,
                  onClick: async () => {
                    if (await confirmDialog('Supprimer cette idée ?', { ok: 'Supprimer', danger: true })) await db.ideas.delete(menu.id);
                  },
                },
              ]
            : []
        }
      />
      <EditIdeaSheet idea={edit} onClose={() => setEdit(null)} />
    </>
  );
}

function EditIdeaSheet({ idea, onClose }: { idea: Idea | null; onClose: () => void }) {
  const rubriques = useLiveQuery(() => db.rubriques.orderBy('order').toArray(), []);
  const [text, setText] = useState('');
  const [rub, setRub] = useState<string | null>(null);
  const [forId, setForId] = useState<string | null>(null);
  if ((idea?.id ?? null) !== forId) {
    setForId(idea?.id ?? null);
    setText(idea?.text ?? '');
    setRub(idea?.rubriqueId ?? null);
  }
  return (
    <Sheet
      open={!!idea}
      onClose={onClose}
      title="Modifier l'idée"
      footer={
        <div className="row-end">
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button
            className="btn primary"
            onClick={async () => {
              if (idea) await db.ideas.update(idea.id, { text: text.trim() || idea.text, rubriqueId: rub });
              onClose();
            }}
          >
            Enregistrer
          </button>
        </div>
      }
    >
      <div className="form">
        <AutoTextarea className="input textarea" rows={4} value={text} onChange={(e) => setText(e.target.value)} spellCheck lang="fr" />
        <select className="input" value={rub ?? ''} onChange={(e) => setRub(e.target.value || null)}>
          <option value="">Sans rubrique</option>
          {rubriques?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>
    </Sheet>
  );
}

function ResearchList() {
  const sources = useLiveQuery(() => db.sources.orderBy('createdAt').reverse().toArray(), []);
  const articles = useLiveQuery(() => db.articles.toArray(), []);
  const [type, setType] = useState<SourceType | 'all'>('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Source | null>(null);

  if (!sources || !articles) return null;
  const nq = normalize(q.trim());
  const list = sources
    .filter((s) => type === 'all' || s.type === type)
    .filter((s) => !nq || normalize(`${s.title} ${s.content} ${s.url}`).includes(nq));
  const titleOf = (id: string | null) => (id ? articles.find((a) => a.id === id)?.title ?? '' : '');

  return (
    <>
      <div className="pad">
        <input className="input search" placeholder="Chercher dans les sources…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="chips scroll-x">
        <button className={`chip ${type === 'all' ? 'on' : ''}`} onClick={() => setType('all')}>Tout</button>
        {SOURCE_TYPES.map((t) => (
          <button key={t.id} className={`chip ${type === t.id ? 'on' : ''}`} onClick={() => setType(t.id)}>{t.icon} {t.label}</button>
        ))}
      </div>
      {list.length === 0 && <Empty icon="sources" title={sources.length ? 'Rien ne correspond' : 'Aucune recherche'} text={sources.length ? undefined : 'Garde ici tes liens, citations, contacts et notes, rattachés ou non à un article.'} />}
      <div className="list tight">
        {list.map((s) => <SourceItem key={s.id} s={s} articleTitle={titleOf(s.articleId)} onClick={() => setEditing(s)} />)}
      </div>
      <Fab label="Nouvelle source" onClick={() => setEditing({ id: '', articleId: null, type: 'lien', title: '', content: '', url: '', createdAt: Date.now() })} />
      <SourceSheet source={editing} onClose={() => { setEditing(null); }} allowArticlePick />
    </>
  );
}

