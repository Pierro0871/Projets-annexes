import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setSetting, uid, type Rubrique } from '../db';
import { RUBRIQUE_COLORS } from '../constants';
import { confirmDialog, Field, Header, Icon, Segmented, Sheet, toast } from '../ui';
import { exportBackup, readBackup, restoreBackup, type BackupSummary } from '../backup';
import { DEFAULT_REMINDERS, ensureNotificationPermission, isNative, pickFile, rescheduleReminders, type ReminderSettings } from '../native';
import { formatDateTime, timeAgo } from '../util';

export const APP_VERSION = '1.0.0';

function useSetting<T>(key: string, fallback: T): T {
  const v = useLiveQuery(() => db.settings.get(key), [key]);
  return (v?.value as T) ?? fallback;
}

export function SettingsScreen() {
  const author = useSetting('authorName', '');
  const magazine = useSetting('magazineName', '');
  const theme = useSetting<'auto' | 'light' | 'dark'>('theme', 'auto');
  const accent = useSetting('accent', '#e4572e');
  const reminders = useSetting<ReminderSettings>('reminders', DEFAULT_REMINDERS);
  const lastBackup = useSetting<number | null>('lastBackup', null);
  const counts = useLiveQuery(async () => ({ articles: await db.articles.count(), ideas: await db.ideas.count(), media: await db.media.count() }), []);
  const [restore, setRestore] = useState<{ summary: BackupSummary; data: Record<string, unknown[]> } | null>(null);
  const [busy, setBusy] = useState(false);

  const setReminders = async (p: Partial<ReminderSettings>) => {
    const next = { ...reminders, ...p };
    if (p.enabled && isNative && !(await ensureNotificationPermission())) {
      toast("Autorise les notifications dans les réglages Android pour recevoir les rappels");
    }
    await setSetting('reminders', next);
    await rescheduleReminders();
  };

  const backupAge = lastBackup ? Date.now() - lastBackup : Infinity;

  return (
    <div className="screen">
      <Header large title="Réglages" />

      <section className="settings-section">
        <h2 className="section-title">Sauvegarde</h2>
        <div className={`card backup-card ${backupAge > 7 * 86400000 && counts?.articles ? 'warn' : ''}`}>
          <p>
            Tout est stocké sur ce téléphone. Fais une sauvegarde régulière et range le fichier sur Google Drive ou envoie-le par mail : si le téléphone est perdu, tu ne perds rien.
          </p>
          <p className="muted small">
            {lastBackup ? `Dernière sauvegarde : ${formatDateTime(lastBackup)} (${timeAgo(lastBackup)})` : 'Aucune sauvegarde pour le moment.'}
            {counts ? ` · ${counts.articles} articles, ${counts.ideas} idées, ${counts.media} photos` : ''}
          </p>
          <div className="row">
            <button
              className="btn primary grow"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await exportBackup();
                } catch (e) {
                  console.error(e);
                  toast('La sauvegarde a échoué');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Icon name="download" size={18} /> Tout sauvegarder
            </button>
            <button
              className="btn ghost"
              onClick={async () => {
                const f = await pickFile('application/json,.json');
                if (!f) return;
                try {
                  setRestore(await readBackup(f));
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              <Icon name="upload" size={18} /> Restaurer
            </button>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-title">Le magazine</h2>
        <div className="card form">
          <Field label="Nom du magazine" hint="Apparaît en pied de page des PDF magazine.">
            <input className="input" defaultValue={magazine} key={'m' + magazine} placeholder="Mon magazine" onBlur={(e) => setSetting('magazineName', e.target.value.trim())} />
          </Field>
          <Field label="Ta signature" hint="Utilisée par défaut dans les exports.">
            <input className="input" defaultValue={author} key={'a' + author} placeholder="Prénom Nom" onBlur={(e) => setSetting('authorName', e.target.value.trim())} />
          </Field>
        </div>
      </section>

      <RubriquesSection />

      <section className="settings-section">
        <h2 className="section-title">Apparence</h2>
        <div className="card form">
          <Field label="Thème">
            <Segmented value={theme} onChange={(v) => setSetting('theme', v)} options={[{ id: 'auto', label: 'Auto' }, { id: 'light', label: 'Clair' }, { id: 'dark', label: 'Sombre' }]} />
          </Field>
          <Field label="Couleur principale">
            <div className="swatches">
              {RUBRIQUE_COLORS.slice(0, 9).map((c) => (
                <button key={c} className={`swatch ${c === accent ? 'on' : ''}`} style={{ background: c }} onClick={() => setSetting('accent', c)} aria-label={c} />
              ))}
            </div>
          </Field>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-title">Rappels</h2>
        <div className="card form">
          <label className="switch-row">
            <span>
              <b>Notifications d'échéance</b>
              <span className="muted small">Articles à rendre, bouclages et parutions.</span>
            </span>
            <input type="checkbox" className="switch" checked={reminders.enabled} onChange={(e) => setReminders({ enabled: e.target.checked })} />
          </label>
          {reminders.enabled && (
            <div className="grid2">
              <Field label="Prévenir">
                <select className="input" value={reminders.daysBefore} onChange={(e) => setReminders({ daysBefore: Number(e.target.value) })}>
                  {[1, 2, 3, 5, 7].map((n) => <option key={n} value={n}>{n} jour{n > 1 ? 's' : ''} avant</option>)}
                </select>
              </Field>
              <Field label="À">
                <select className="input" value={reminders.hour} onChange={(e) => setReminders({ hour: Number(e.target.value) })}>
                  {[7, 8, 9, 10, 12, 14, 18, 20].map((h) => <option key={h} value={h}>{h} h</option>)}
                </select>
              </Field>
            </div>
          )}
          {!isNative && <p className="muted small">Les rappels fonctionnent dans l'appli installée sur le téléphone.</p>}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-title">Astuces</h2>
        <div className="card tips">
          <p><b>🎙 Dictée vocale</b> : dans l'éditeur, appuie sur le micro de ton clavier (Gboard) pour écrire en parlant. Dis « virgule », « point » ou « à la ligne » pour la ponctuation.</p>
          <p><b>✓ Correcteur</b> : les fautes sont soulignées en rouge par le clavier. Appuie sur un mot souligné pour voir les suggestions. Vérifie que le français est activé dans Gboard → Correcteur orthographique.</p>
          <p><b>⛶ Mode concentration</b> : l'icône en haut d'un article masque tout sauf ton texte.</p>
          <p><b>↺ Versions</b> : chaque article garde son historique. Tu peux revenir en arrière à tout moment depuis l'onglet Versions.</p>
        </div>
      </section>

      <p className="pad muted small center">Rédaction · version {APP_VERSION}</p>

      <Sheet
        open={!!restore}
        onClose={() => setRestore(null)}
        title="Restaurer une sauvegarde"
        footer={
          <div className="row-end">
            <button className="btn ghost" onClick={() => setRestore(null)}>Annuler</button>
            <button
              className="btn danger"
              onClick={async () => {
                if (!restore) return;
                await restoreBackup(restore.data);
                await rescheduleReminders();
                setRestore(null);
                toast('Sauvegarde restaurée');
              }}
            >
              Tout remplacer
            </button>
          </div>
        }
      >
        {restore && (
          <p className="confirm-msg">
            Cette sauvegarde{restore.summary.exportedAt ? ` du ${formatDateTime(new Date(restore.summary.exportedAt).getTime())}` : ''} contient {restore.summary.articles} articles, {restore.summary.ideas} idées et {restore.summary.issues} numéros.
            <br />
            <br />
            <b>Tout le contenu actuel de l'appli sera remplacé.</b>
          </p>
        )}
      </Sheet>
    </div>
  );
}

function RubriquesSection() {
  const rubriques = useLiveQuery(() => db.rubriques.orderBy('order').toArray(), []);
  const [edit, setEdit] = useState<Rubrique | null>(null);
  if (!rubriques) return null;

  const move = async (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= rubriques.length) return;
    const a = rubriques[i];
    const b = rubriques[j];
    await db.transaction('rw', db.rubriques, async () => {
      await db.rubriques.update(a.id, { order: b.order });
      await db.rubriques.update(b.id, { order: a.order });
    });
  };

  return (
    <section className="settings-section">
      <h2 className="section-title">Rubriques</h2>
      <div className="card rub-list">
        {rubriques.map((r, i) => (
          <div key={r.id} className="rub-row">
            <button className="rub-name" onClick={() => setEdit(r)}>
              <span className="dot lg" style={{ background: r.color }} /> {r.name}
            </button>
            <button className="icon-btn sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter"><span className="rot90"><Icon name="back" size={18} /></span></button>
            <button className="icon-btn sm" disabled={i === rubriques.length - 1} onClick={() => move(i, 1)} aria-label="Descendre"><span className="rot-90"><Icon name="back" size={18} /></span></button>
          </div>
        ))}
        <button
          className="btn ghost full"
          onClick={() =>
            setEdit({ id: '', name: '', color: RUBRIQUE_COLORS[rubriques.length % RUBRIQUE_COLORS.length], order: (rubriques[rubriques.length - 1]?.order ?? 0) + 1 })
          }
        >
          <Icon name="plus" size={18} /> Ajouter une rubrique
        </button>
      </div>
      <RubriqueSheet rubrique={edit} onClose={() => setEdit(null)} />
    </section>
  );
}

function RubriqueSheet({ rubrique, onClose }: { rubrique: Rubrique | null; onClose: () => void }) {
  const [d, setD] = useState<Rubrique | null>(null);
  const [forKey, setForKey] = useState<string | null>(null);
  const key = rubrique ? rubrique.id + ':' + rubrique.order : null;
  if (key !== forKey) {
    setForKey(key);
    setD(rubrique);
  }
  return (
    <Sheet
      open={!!rubrique}
      onClose={onClose}
      title={rubrique?.id ? 'Modifier la rubrique' : 'Nouvelle rubrique'}
      footer={
        <div className="row-end">
          {rubrique?.id && (
            <button
              className="btn ghost danger-text"
              onClick={async () => {
                if (!(await confirmDialog(`Supprimer la rubrique « ${rubrique.name} » ? Les articles concernés passeront « sans rubrique ».`, { ok: 'Supprimer', danger: true }))) return;
                await db.transaction('rw', db.rubriques, db.articles, db.ideas, async () => {
                  await db.articles.where('rubriqueId').equals(rubrique.id).modify({ rubriqueId: null });
                  await db.ideas.where('rubriqueId').equals(rubrique.id).modify({ rubriqueId: null });
                  await db.rubriques.delete(rubrique.id);
                });
                onClose();
              }}
            >
              <Icon name="trash" size={18} />
            </button>
          )}
          <span className="spacer" />
          <button
            className="btn primary"
            disabled={!d?.name.trim()}
            onClick={async () => {
              if (!d) return;
              await db.rubriques.put({ ...d, name: d.name.trim(), id: d.id || uid() });
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
          <Field label="Nom"><input className="input" autoFocus value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
          <Field label="Couleur">
            <div className="swatches">
              {RUBRIQUE_COLORS.map((c) => (
                <button key={c} className={`swatch ${c === d.color ? 'on' : ''}`} style={{ background: c }} onClick={() => setD({ ...d, color: c })} aria-label={c} />
              ))}
            </div>
          </Field>
        </div>
      )}
    </Sheet>
  );
}
