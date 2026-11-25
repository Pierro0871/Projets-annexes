import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newArticle, type Issue } from '../db';
import { STATUSES } from '../constants';
import { useNav } from '../nav';
import { AutoTextarea, confirmDialog, Empty, Fab, Field, Header, Icon, Menu, Sheet, toast } from '../ui';
import { formatDate, relativeDeadline } from '../util';
import { ArticleCard } from './Articles';
import { NewIssueSheet } from './ArticlePanels';
import { rescheduleRemindersSoon } from '../native';

export function IssuesScreen() {
  const nav = useNav();
  const issues = useLiveQuery(() => db.issues.orderBy('createdAt').reverse().toArray(), []);
  const articles = useLiveQuery(() => db.articles.toArray(), []);
  const [creating, setCreating] = useState(false);
  if (!issues || !articles) return null;

  return (
    <div className="screen">
      <Header large title="Numéros" subtitle="Le sommaire et l'avancement de chaque numéro" />
      {issues.length === 0 && (
        <Empty icon="book" title="Aucun numéro" text="Crée ton premier numéro pour y ranger tes articles et suivre le bouclage." action={<button className="btn primary" onClick={() => setCreating(true)}>Créer un numéro</button>} />
      )}
      <div className="list">
        {issues.map((i) => {
          const arts = articles.filter((a) => a.issueId === i.id);
          const ready = arts.filter((a) => a.status === 'pret' || a.status === 'publie').length;
          const words = arts.reduce((s, a) => s + a.wordCount, 0);
          const dl = relativeDeadline(i.closingDate);
          return (
            <button key={i.id} className="card issue-card" onClick={() => nav.push({ name: 'issue', id: i.id })}>
              <div className="issue-num">N°{i.number}</div>
              <div className="grow">
                <div className="card-title">{i.title || `Numéro ${i.number}`}</div>
                <div className="card-meta">
                  <span>{arts.length} article{arts.length > 1 ? 's' : ''}</span>
                  <span>{words.toLocaleString('fr-FR')} mots</span>
                  {i.publishDate && <span>Parution {formatDate(i.publishDate)}</span>}
                </div>
                {i.closingDate && dl && <div className={`deadline ${dl.tone}`}><Icon name="clock" size={13} /> Bouclage {dl.tone === 'ok' ? 'le ' : ''}{dl.text}</div>}
                <StackBar arts={arts.map((a) => a.status)} />
                {arts.length > 0 && <div className="muted small">{ready}/{arts.length} prêts</div>}
              </div>
            </button>
          );
        })}
      </div>
      <Fab label="Nouveau numéro" onClick={() => setCreating(true)} />
      <NewIssueSheet open={creating} onClose={() => setCreating(false)} onCreated={(id) => nav.push({ name: 'issue', id })} />
    </div>
  );
}

function StackBar({ arts }: { arts: string[] }) {
  if (!arts.length) return null;
  return (
    <div className="stack-bar">
      {STATUSES.map((s) => {
        const n = arts.filter((x) => x === s.id).length;
        return n ? <div key={s.id} style={{ flex: n, background: s.color }} title={`${s.label} : ${n}`} /> : null;
      })}
    </div>
  );
}

export function IssueScreen({ id }: { id: string }) {
  const nav = useNav();
  const issue = useLiveQuery(() => db.issues.get(id), [id]);
  const articles = useLiveQuery(() => db.articles.where('issueId').equals(id).toArray(), [id]);
  const rubriques = useLiveQuery(() => db.rubriques.orderBy('order').toArray(), []);
  const issues = useLiveQuery(() => db.issues.toArray(), []);
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [group, setGroup] = useState<'statut' | 'rubrique'>('rubrique');

  if (issue === undefined || !articles || !rubriques || !issues) return null;
  if (!issue) return <div className="screen"><Header back title="Numéro introuvable" /></div>;

  const words = articles.reduce((s, a) => s + a.wordCount, 0);
  const goal = articles.reduce((s, a) => s + (a.wordGoal ?? 0), 0);
  const ready = articles.filter((a) => a.status === 'pret' || a.status === 'publie').length;
  const dl = relativeDeadline(issue.closingDate);

  const groups =
    group === 'statut'
      ? STATUSES.map((s) => ({ key: s.id, label: s.label, color: s.color, items: articles.filter((a) => a.status === s.id) }))
      : [
          ...rubriques.map((r) => ({ key: r.id, label: r.name, color: r.color, items: articles.filter((a) => a.rubriqueId === r.id) })),
          { key: 'none', label: 'Sans rubrique', color: 'var(--muted)', items: articles.filter((a) => !a.rubriqueId || !rubriques.some((r) => r.id === a.rubriqueId)) },
        ];

  const newInIssue = async () => {
    const a = newArticle({ issueId: id });
    await db.articles.add(a);
    nav.push({ name: 'article', id: a.id });
  };

  return (
    <div className="screen">
      <Header
        back
        title={`N°${issue.number}${issue.title ? ' – ' + issue.title : ''}`}
        actions={<button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Plus"><Icon name="more" /></button>}
      />
      <div className="pad">
        <div className="issue-summary card">
          <div className="stat-grid">
            <div><b>{articles.length}</b><span>articles</span></div>
            <div><b>{ready}</b><span>prêts</span></div>
            <div><b>{words.toLocaleString('fr-FR')}</b><span>mots{goal ? ` / ${goal.toLocaleString('fr-FR')}` : ''}</span></div>
          </div>
          <StackBar arts={articles.map((a) => a.status)} />
          <div className="issue-dates">
            <div>
              <span className="muted small">Bouclage</span>
              <b>{issue.closingDate ? formatDate(issue.closingDate) : '—'}</b>
              {dl && <span className={`deadline ${dl.tone}`}>{dl.text}</span>}
            </div>
            <div>
              <span className="muted small">Parution</span>
              <b>{issue.publishDate ? formatDate(issue.publishDate) : '—'}</b>
            </div>
            <button className="btn ghost small" onClick={() => setEditOpen(true)}><Icon name="edit" size={16} /> Modifier</button>
          </div>
          {issue.notes && <p className="issue-notes">{issue.notes}</p>}
        </div>
      </div>

      <div className="pad-x row">
        <h2 className="section-title grow">Sommaire</h2>
        <select className="select-inline" value={group} onChange={(e) => setGroup(e.target.value as 'statut' | 'rubrique')}>
          <option value="rubrique">Par rubrique</option>
          <option value="statut">Par statut</option>
        </select>
      </div>

      {articles.length === 0 && <Empty icon="doc" title="Aucun article dans ce numéro" />}
      {groups.filter((g) => g.items.length).map((g) => (
        <section key={g.key}>
          <div className="group-title"><span className="dot" style={{ background: g.color }} /> {g.label} <span className="muted">· {g.items.length}</span></div>
          <div className="list tight">
            {g.items.map((a) => <ArticleCard key={a.id} a={a} rubriques={rubriques} issues={issues} hideIssue onOpen={() => nav.push({ name: 'article', id: a.id })} />)}
          </div>
        </section>
      ))}

      <div className="pad row">
        <button className="btn primary grow" onClick={newInIssue}><Icon name="plus" size={18} /> Nouvel article</button>
        <button className="btn ghost grow" onClick={() => setAddOpen(true)}>Ajouter un existant</button>
      </div>

      <EditIssueSheet issue={editOpen ? issue : null} onClose={() => setEditOpen(false)} />
      <AddExistingSheet open={addOpen} onClose={() => setAddOpen(false)} issueId={id} />
      <Menu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          { label: 'Modifier le numéro', icon: 'edit', onClick: () => setEditOpen(true) },
          {
            label: 'Supprimer le numéro',
            icon: 'trash',
            danger: true,
            onClick: async () => {
              if (!(await confirmDialog('Supprimer ce numéro ? Les articles ne sont pas supprimés, ils redeviennent « non attribués ».', { ok: 'Supprimer', danger: true }))) return;
              await db.transaction('rw', db.issues, db.articles, async () => {
                await db.articles.where('issueId').equals(id).modify({ issueId: null });
                await db.issues.delete(id);
              });
              rescheduleRemindersSoon();
              nav.back();
            },
          },
        ]}
      />
    </div>
  );
}

function EditIssueSheet({ issue, onClose }: { issue: Issue | null; onClose: () => void }) {
  const [d, setD] = useState<Issue | null>(null);
  const [forId, setForId] = useState<string | null>(null);
  if ((issue?.id ?? null) !== forId) {
    setForId(issue?.id ?? null);
    setD(issue);
  }
  const set = (p: Partial<Issue>) => setD((x) => (x ? { ...x, ...p } : x));
  return (
    <Sheet
      open={!!issue}
      onClose={onClose}
      title="Modifier le numéro"
      footer={
        <div className="row-end">
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button
            className="btn primary"
            onClick={async () => {
              if (d) {
                await db.issues.put({ ...d, number: d.number.trim() || issue!.number });
                rescheduleRemindersSoon();
              }
              onClose();
            }}
          >
            Enregistrer
          </button>
        </div>
      }
    >
      {d && (
        <div className="form">
          <div className="grid2">
            <Field label="Numéro"><input className="input" value={d.number} onChange={(e) => set({ number: e.target.value })} /></Field>
            <Field label="Titre / thème"><input className="input" value={d.title} onChange={(e) => set({ title: e.target.value })} /></Field>
          </div>
          <div className="grid2">
            <Field label="Bouclage"><input className="input" type="date" value={d.closingDate ?? ''} onChange={(e) => set({ closingDate: e.target.value || null })} /></Field>
            <Field label="Parution"><input className="input" type="date" value={d.publishDate ?? ''} onChange={(e) => set({ publishDate: e.target.value || null })} /></Field>
          </div>
          <Field label="Notes (ligne éditoriale, partenaires, pagination…)">
            <AutoTextarea className="input textarea" rows={3} value={d.notes} onChange={(e) => set({ notes: e.target.value })} spellCheck lang="fr" />
          </Field>
        </div>
      )}
    </Sheet>
  );
}

function AddExistingSheet({ open, onClose, issueId }: { open: boolean; onClose: () => void; issueId: string }) {
  const candidates = useLiveQuery(() => db.articles.filter((a) => a.issueId !== issueId).toArray(), [issueId]);
  const issues = useLiveQuery(() => db.issues.toArray(), []);
  return (
    <Sheet open={open} onClose={onClose} title="Ajouter au numéro">
      <div className="list tight">
        {candidates?.length === 0 && <p className="muted">Tous tes articles sont déjà dans ce numéro.</p>}
        {candidates?.map((a) => {
          const other = issues?.find((i) => i.id === a.issueId);
          return (
            <button
              key={a.id}
              className="card pick-card"
              onClick={async () => {
                await db.articles.update(a.id, { issueId });
                toast('Article ajouté au numéro');
              }}
            >
              <b>{a.title || 'Sans titre'}</b>
              <span className="muted small">{a.wordCount} mots{other ? ` · actuellement dans le N°${other.number}` : ''}</span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
