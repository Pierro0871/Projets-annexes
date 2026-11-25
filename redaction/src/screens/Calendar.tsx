import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { statusInfo } from '../constants';
import { useNav } from '../nav';
import { Empty, Header, Icon, StatusBadge } from '../ui';
import { MONTHS_LONG, daysUntil, formatDate, toISO, todayISO } from '../util';

interface CalItem {
  key: string;
  date: string;
  kind: 'deadline' | 'closing' | 'publish';
  label: string;
  color: string;
  open: () => void;
  status?: Parameters<typeof statusInfo>[0];
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function CalendarScreen() {
  const nav = useNav();
  const today = todayISO();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selected, setSelected] = useState<string>(today);
  const articles = useLiveQuery(() => db.articles.toArray(), []);
  const issues = useLiveQuery(() => db.issues.toArray(), []);
  if (!articles || !issues) return null;

  const items: CalItem[] = [];
  for (const a of articles) {
    if (!a.deadline) continue;
    items.push({ key: 'a' + a.id, date: a.deadline, kind: 'deadline', label: a.title || 'Sans titre', color: 'var(--warn)', status: a.status, open: () => nav.push({ name: 'article', id: a.id }) });
  }
  for (const i of issues) {
    const name = `N°${i.number}${i.title ? ' – ' + i.title : ''}`;
    if (i.closingDate) items.push({ key: 'c' + i.id, date: i.closingDate, kind: 'closing', label: `Bouclage ${name}`, color: 'var(--danger)', open: () => nav.push({ name: 'issue', id: i.id }) });
    if (i.publishDate) items.push({ key: 'p' + i.id, date: i.publishDate, kind: 'publish', label: `Parution ${name}`, color: 'var(--accent)', open: () => nav.push({ name: 'issue', id: i.id }) });
  }
  const byDate = new Map<string, CalItem[]>();
  for (const it of items) byDate.set(it.date, [...(byDate.get(it.date) ?? []), it]);

  // Grille du mois (semaine commençant le lundi)
  const first = new Date(cursor.y, cursor.m, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: Array<string | null> = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(new Date(cursor.y, cursor.m, d)));
  while (cells.length % 7) cells.push(null);

  const move = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  const dayItems = byDate.get(selected) ?? [];
  const upcoming = items
    .filter((it) => it.date >= today && !(it.kind === 'deadline' && (it.status === 'publie' || it.status === 'pret')))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 12);
  const late = articles.filter((a) => a.deadline && a.deadline < today && a.status !== 'publie' && a.status !== 'pret');

  return (
    <div className="screen">
      <Header large title="Calendrier" subtitle="Échéances, bouclages et parutions" />
      <div className="pad">
        <div className="card calendar">
          <div className="cal-head">
            <button className="icon-btn" onClick={() => move(-1)} aria-label="Mois précédent"><Icon name="back" /></button>
            <button
              className="cal-title"
              onClick={() => {
                const d = new Date();
                setCursor({ y: d.getFullYear(), m: d.getMonth() });
                setSelected(today);
              }}
            >
              {MONTHS_LONG[cursor.m]} {cursor.y}
            </button>
            <button className="icon-btn flip" onClick={() => move(1)} aria-label="Mois suivant"><Icon name="back" /></button>
          </div>
          <div className="cal-grid">
            {WEEKDAYS.map((w, i) => <div key={i} className="cal-wd">{w}</div>)}
            {cells.map((iso, i) =>
              iso ? (
                <button key={iso} className={`cal-day ${iso === today ? 'today' : ''} ${iso === selected ? 'sel' : ''}`} onClick={() => setSelected(iso)}>
                  <span>{Number(iso.slice(8))}</span>
                  <span className="cal-dots">
                    {(byDate.get(iso) ?? []).slice(0, 4).map((it) => (
                      <i key={it.key} className={it.kind} style={{ background: it.color }} />
                    ))}
                  </span>
                </button>
              ) : (
                <div key={'e' + i} />
              ),
            )}
          </div>
          <div className="cal-legend">
            <span><i className="deadline" /> Échéance article</span>
            <span><i className="closing" /> Bouclage</span>
            <span><i className="publish" /> Parution</span>
          </div>
        </div>
      </div>

      <h2 className="section-title pad-x">{selected === today ? "Aujourd'hui" : formatDate(selected)}</h2>
      {dayItems.length === 0 ? <p className="pad-x muted">Rien de prévu ce jour-là.</p> : <ItemList items={dayItems} />}

      {late.length > 0 && (
        <>
          <h2 className="section-title pad-x danger-text">En retard</h2>
          <ItemList
            items={late.map((a) => ({ key: 'l' + a.id, date: a.deadline!, kind: 'deadline', label: a.title || 'Sans titre', color: statusInfo(a.status).color, status: a.status, open: () => nav.push({ name: 'article', id: a.id }) }))}
            showDate
          />
        </>
      )}

      <h2 className="section-title pad-x">À venir</h2>
      {upcoming.length === 0 ? (
        <Empty icon="calendar" title="Rien à l'horizon" text="Ajoute une échéance dans l'onglet Infos d'un article, ou des dates de bouclage à tes numéros." />
      ) : (
        <ItemList items={upcoming} showDate />
      )}
    </div>
  );
}

function ItemList({ items, showDate }: { items: CalItem[]; showDate?: boolean }) {
  return (
    <div className="list tight">
      {items.map((it) => {
        const n = daysUntil(it.date);
        return (
          <button key={it.key} className="card cal-item" onClick={it.open}>
            <span className="cal-bar" style={{ background: it.color }} />
            <span className="grow">
              <b>{it.label}</b>
              <span className="muted small">
                {it.kind === 'deadline' ? 'Échéance' : it.kind === 'closing' ? 'Bouclage' : 'Parution'}
                {showDate ? ` · ${formatDate(it.date)}${n === 0 ? " (aujourd'hui)" : n > 0 ? ` (J-${n})` : ''}` : ''}
              </span>
            </span>
            {it.status && <StatusBadge status={it.status} small />}
          </button>
        );
      })}
    </div>
  );
}
