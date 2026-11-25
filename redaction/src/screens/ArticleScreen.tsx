import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { JSONContent } from '@tiptap/react';
import { db, deleteArticle, snapshotVersion, uid, type Article } from '../db';
import { useNav } from '../nav';
import { confirmDialog, Header, Icon, Menu, Sheet, toast } from '../ui';
import { countWords, readingTime } from '../util';
import { EditorContent, EditorToolbar, useArticleEditor } from './Editor';
import { InfoPanel, MediaPanel, SourcesPanel, VersionsPanel } from './ArticlePanels';
import { pickFile, rescheduleRemindersSoon } from '../native';
import { loadAndResize } from '../images';
import { exportArticle, type ExportKind } from '../export';

type PanelTab = 'texte' | 'sources' | 'medias' | 'infos' | 'versions';

const AUTO_VERSION_MS = 10 * 60 * 1000;

export function ArticleScreen({ id }: { id: string }) {
  const [initial, setInitial] = useState<Article | null | undefined>(undefined);
  useEffect(() => {
    void db.articles.get(id).then((a) => setInitial(a ?? null));
  }, [id]);
  if (initial === undefined) return null;
  if (initial === null) return <MissingArticle />;
  return <ArticleEditorScreen initial={initial} />;
}

function MissingArticle() {
  return (
    <div className="screen">
      <Header back title="Article introuvable" />
    </div>
  );
}

function ArticleEditorScreen({ initial }: { initial: Article }) {
  const nav = useNav();
  const [article, setArticle] = useState<Article>(initial);
  const [tab, setTab] = useState<PanelTab>('texte');
  const [focus, setFocus] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [chars, setChars] = useState(0);

  const latest = useRef(article);
  latest.current = article;
  const dirty = useRef(false);
  const changedSinceSnapshot = useRef(false);
  const lastSnapshot = useRef<number>(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    void db.versions.where('articleId').equals(initial.id).last().then((v) => {
      lastSnapshot.current = v?.createdAt ?? initial.createdAt;
    });
  }, [initial.id, initial.createdAt]);

  const flush = useCallback(async () => {
    clearTimeout(saveTimer.current);
    if (!dirty.current) return;
    dirty.current = false;
    const a = { ...latest.current, updatedAt: Date.now() };
    await db.articles.put(a);
    if (changedSinceSnapshot.current && Date.now() - lastSnapshot.current > AUTO_VERSION_MS) {
      await snapshotVersion(a);
      lastSnapshot.current = Date.now();
      changedSinceSnapshot.current = false;
    }
  }, []);

  const update = useCallback(
    (patch: Partial<Article>, opts: { content?: boolean } = {}) => {
      setArticle((prev) => ({ ...prev, ...patch }));
      latest.current = { ...latest.current, ...patch };
      dirty.current = true;
      if (opts.content || 'title' in patch || 'chapo' in patch) changedSinceSnapshot.current = true;
      if ('deadline' in patch || 'status' in patch || 'title' in patch) rescheduleRemindersSoon();
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void flush(), 600);
    },
    [flush],
  );

  // Sauvegarde finale + version automatique en quittant l'article
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      void (async () => {
        await flush();
        if (changedSinceSnapshot.current) {
          await snapshotVersion(latest.current);
          changedSinceSnapshot.current = false;
        }
      })();
    };
  }, [flush]);

  const editor = useArticleEditor(initial.content, (json: JSONContent, text: string) => {
    setChars(text.replace(/\n/g, '').length);
    update({ content: json, wordCount: countWords(text) }, { content: true });
  });

  useEffect(() => {
    if (editor) setChars(editor.getText({ blockSeparator: '\n' }).replace(/\n/g, '').length);
  }, [editor]);

  const media = useLiveQuery(() => db.media.where('articleId').equals(article.id).count(), [article.id]);
  const sources = useLiveQuery(() => db.sources.where('articleId').equals(article.id).count(), [article.id]);
  const versions = useLiveQuery(() => db.versions.where('articleId').equals(article.id).count(), [article.id]);

  const insertImage = async () => {
    const file = await pickFile('image/*');
    if (!file || !editor) return;
    try {
      const img = await loadAndResize(file);
      editor.chain().focus().setImage({ src: img.dataUrl, alt: '' }).run();
      await db.media.add({ id: uid(), articleId: article.id, dataUrl: img.dataUrl, width: img.width, height: img.height, caption: '', credit: '', createdAt: Date.now() });
    } catch {
      toast("Impossible de lire cette image");
    }
  };

  const doExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      await flush();
      await exportArticle(latest.current, kind);
    } catch (e) {
      console.error(e);
      toast("L'export a échoué");
    } finally {
      setExporting(null);
      setExportOpen(false);
    }
  };

  const remove = async () => {
    if (!(await confirmDialog(`Supprimer définitivement « ${article.title || 'Sans titre'} » ? Ses sources, médias et versions seront aussi supprimés.`, { ok: 'Supprimer', danger: true }))) return;
    dirty.current = false;
    changedSinceSnapshot.current = false;
    await deleteArticle(article.id);
    rescheduleRemindersSoon();
    nav.back();
  };

  const saveVersion = async () => {
    await flush();
    await snapshotVersion(latest.current, 'Version enregistrée');
    lastSnapshot.current = Date.now();
    changedSinceSnapshot.current = false;
    toast('Version enregistrée');
  };

  const goal = article.wordGoal;
  const pct = goal ? Math.min(100, Math.round((article.wordCount / goal) * 100)) : null;

  const stats = (
    <div className="stats-line">
      <span><b>{article.wordCount.toLocaleString('fr-FR')}</b> mots</span>
      <span>{chars.toLocaleString('fr-FR')} signes</span>
      <span>{readingTime(article.wordCount)}</span>
      {goal ? <span className={pct! >= 100 ? 'ok' : ''}>{pct}% de {goal.toLocaleString('fr-FR')}</span> : null}
    </div>
  );

  return (
    <div className={`screen article-screen ${focus ? 'focus-mode' : ''}`}>
      {!focus && (
        <>
          <Header
            back
            title={article.title || 'Sans titre'}
            actions={
              <>
                <button className="icon-btn" onClick={() => setFocus(true)} aria-label="Mode concentration"><Icon name="focus" /></button>
                <button className="icon-btn" onClick={() => setExportOpen(true)} aria-label="Exporter"><Icon name="share" /></button>
                <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Plus"><Icon name="more" /></button>
              </>
            }
          />
          <nav className="panel-tabs scroll-x">
            {(
              [
                ['texte', 'Texte', null],
                ['sources', 'Sources', sources],
                ['medias', 'Médias', media],
                ['infos', 'Infos', null],
                ['versions', 'Versions', versions],
              ] as const
            ).map(([t, label, n]) => (
              <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
                {label}
                {n ? <span className="tab-count">{n}</span> : null}
              </button>
            ))}
          </nav>
        </>
      )}

      {focus && (
        <div className="focus-bar">
          {stats}
          <button className="icon-btn" onClick={() => setFocus(false)} aria-label="Quitter le mode concentration"><Icon name="unfocus" /></button>
        </div>
      )}

      <div className="panel" hidden={tab !== 'texte'}>
        <div className="writing">
          <textarea
            className="title-input"
            placeholder="Titre"
            rows={1}
            value={article.title}
            ref={(el) => {
              if (el) {
                el.style.height = 'auto';
                el.style.height = el.scrollHeight + 'px';
              }
            }}
            onChange={(e) => update({ title: e.target.value.replace(/\n/g, ' ') })}
            spellCheck
            lang="fr"
          />
          <textarea
            className="chapo-input"
            placeholder="Chapô : l'accroche qui donne envie de lire…"
            rows={1}
            value={article.chapo}
            ref={(el) => {
              if (el) {
                el.style.height = 'auto';
                el.style.height = el.scrollHeight + 'px';
              }
            }}
            onChange={(e) => update({ chapo: e.target.value })}
            spellCheck
            lang="fr"
          />
          {!focus && stats}
          {pct !== null && !focus && (
            <div className="progress goal"><div style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--ok)' : 'var(--accent)' }} /></div>
          )}
          <EditorContent editor={editor} className="editor" />
        </div>
        {editor && !focus && <EditorToolbar editor={editor} onImage={insertImage} />}
      </div>

      {tab === 'sources' && <div className="panel"><SourcesPanel articleId={article.id} /></div>}
      {tab === 'medias' && (
        <div className="panel">
          <MediaPanel
            articleId={article.id}
            onInsert={(src, caption) => {
              setTab('texte');
              setTimeout(() => editor?.chain().focus('end').setImage({ src, alt: caption }).run(), 50);
            }}
          />
        </div>
      )}
      {tab === 'infos' && <div className="panel"><InfoPanel article={article} chars={chars} update={update} /></div>}
      {tab === 'versions' && (
        <div className="panel">
          <VersionsPanel
            article={article}
            onSave={saveVersion}
            onRestore={async (v) => {
              await flush();
              await snapshotVersion(latest.current, 'Avant restauration');
              editor?.commands.setContent(v.content ?? '');
              update({ title: v.title, chapo: v.chapo, content: v.content, wordCount: v.wordCount }, { content: true });
              await flush();
              lastSnapshot.current = Date.now();
              changedSinceSnapshot.current = false;
              setTab('texte');
              toast('Version restaurée');
            }}
          />
        </div>
      )}

      <Menu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          { label: 'Enregistrer une version', icon: 'history', onClick: saveVersion },
          { label: 'Mode concentration', icon: 'focus', onClick: () => setFocus(true) },
          { label: 'Exporter…', icon: 'share', onClick: () => setExportOpen(true) },
          { label: "Supprimer l'article", icon: 'trash', danger: true, onClick: remove },
        ]}
      />

      <ExportSheet open={exportOpen} onClose={() => setExportOpen(false)} busy={exporting} onPick={doExport} />
    </div>
  );
}

function ExportSheet({ open, onClose, busy, onPick }: { open: boolean; onClose: () => void; busy: ExportKind | null; onPick: (k: ExportKind) => void }) {
  const opts: Array<{ id: ExportKind; title: string; text: string; icon: string }> = [
    { id: 'pdf', title: 'PDF manuscrit', text: 'Une colonne, sobre : pour relire ou envoyer.', icon: 'doc' },
    { id: 'magazine', title: 'PDF magazine', text: 'Deux colonnes, lettrine, intertitres en couleur.', icon: 'book' },
    { id: 'docx', title: 'Word (.docx)', text: 'Pour un maquettiste ou un logiciel de mise en page.', icon: 'edit' },
  ];
  return (
    <Sheet open={open} onClose={onClose} title="Exporter l'article">
      <div className="export-list">
        {opts.map((o) => (
          <button key={o.id} className="export-opt" disabled={!!busy} onClick={() => onPick(o.id)}>
            <span className="export-icon"><Icon name={o.icon} /></span>
            <span className="export-txt">
              <b>{o.title}</b>
              <span>{busy === o.id ? 'Préparation…' : o.text}</span>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
