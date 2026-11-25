const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function todayISO(): string {
  return toISO(new Date());
}

export function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(s: string | null): string {
  if (!s) return '';
  const d = parseISO(s);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? '' : ' ' + d.getFullYear()}`;
}

export function daysUntil(s: string): number {
  const a = parseISO(s).getTime();
  const b = parseISO(todayISO()).getTime();
  return Math.round((a - b) / 86400000);
}

export function relativeDeadline(s: string | null): { text: string; tone: 'late' | 'soon' | 'ok' } | null {
  if (!s) return null;
  const n = daysUntil(s);
  if (n < 0) return { text: `en retard de ${-n} j`, tone: 'late' };
  if (n === 0) return { text: "aujourd'hui", tone: 'soon' };
  if (n === 1) return { text: 'demain', tone: 'soon' };
  if (n <= 3) return { text: `dans ${n} j`, tone: 'soon' };
  return { text: formatDate(s), tone: 'ok' };
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(toISO(d))} à ${hh}:${mm}`;
}

export function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return formatDate(toISO(new Date(ts)));
}

export function countWords(text: string): number {
  const m = text.trim().match(/[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu);
  return m ? m.length : 0;
}

export function readingTime(words: number): string {
  const min = Math.max(1, Math.round(words / 230));
  return `${min} min de lecture`;
}

export function slugify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036F]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 60) || 'article'
  );
}

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase();
}
