import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { LocalNotifications } from '@capacitor/local-notifications';
import { db } from './db';
import { daysUntil, parseISO, formatDate } from './util';

export const isNative = Capacitor.isNativePlatform();

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Enregistre un fichier puis ouvre le menu de partage Android (Drive, mail, Fichiers…). */
export async function saveAndShare(filename: string, blob: Blob, dialogTitle = 'Enregistrer ou partager') {
  if (isNative) {
    const data = await blobToBase64(blob);
    const res = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
    await Share.share({ title: filename, files: [res.uri], dialogTitle });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Ouvre le sélecteur de fichiers et renvoie le fichier choisi. */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

// ---------- Rappels ----------

function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

export interface ReminderSettings {
  enabled: boolean;
  daysBefore: number;
  hour: number;
}

export const DEFAULT_REMINDERS: ReminderSettings = { enabled: true, daysBefore: 2, hour: 9 };

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNative) return false;
  const p = await LocalNotifications.checkPermissions();
  if (p.display === 'granted') return true;
  const r = await LocalNotifications.requestPermissions();
  return r.display === 'granted';
}

/** Recalcule tous les rappels à partir des échéances d'articles et des bouclages. */
export async function rescheduleReminders() {
  if (!isNative) return;
  try {
    const settings = ((await db.settings.get('reminders'))?.value as ReminderSettings) ?? DEFAULT_REMINDERS;
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
    if (!settings.enabled) return;
    if (!(await ensureNotificationPermission())) return;

    const items: Array<{ key: string; date: string; title: string; body: string }> = [];
    const articles = await db.articles.toArray();
    for (const a of articles) {
      if (!a.deadline || a.status === 'publie' || a.status === 'pret') continue;
      const name = a.title || 'Article sans titre';
      items.push({ key: `a-before-${a.id}`, date: shift(a.deadline, -settings.daysBefore), title: `Échéance dans ${settings.daysBefore} j`, body: `« ${name} » est à rendre le ${formatDate(a.deadline)}.` });
      items.push({ key: `a-day-${a.id}`, date: a.deadline, title: "Échéance aujourd'hui", body: `« ${name} » est à rendre aujourd'hui.` });
    }
    const issues = await db.issues.toArray();
    for (const i of issues) {
      const name = `n°${i.number}${i.title ? ' – ' + i.title : ''}`;
      if (i.closingDate) {
        items.push({ key: `i-before-${i.id}`, date: shift(i.closingDate, -settings.daysBefore), title: `Bouclage dans ${settings.daysBefore} j`, body: `Bouclage du ${name} le ${formatDate(i.closingDate)}.` });
        items.push({ key: `i-day-${i.id}`, date: i.closingDate, title: "Bouclage aujourd'hui", body: `C'est le jour du bouclage du ${name}.` });
      }
      if (i.publishDate) {
        items.push({ key: `i-pub-${i.id}`, date: i.publishDate, title: 'Jour de parution 🎉', body: `Le ${name} paraît aujourd'hui.` });
      }
    }

    const now = Date.now();
    const notifications = items
      .map((it) => {
        const at = parseISO(it.date);
        at.setHours(settings.hour, 0, 0, 0);
        return { ...it, at };
      })
      .filter((it) => it.at.getTime() > now && daysUntil(it.date) < 365)
      .map((it) => ({
        id: hashId(it.key),
        title: it.title,
        body: it.body,
        schedule: { at: it.at, allowWhileIdle: true },
      }));
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  } catch (e) {
    console.warn('Rappels non programmés', e);
  }
}

function shift(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** Version différée, pour éviter de reprogrammer à chaque frappe. */
export function rescheduleRemindersSoon() {
  clearTimeout(timer);
  timer = setTimeout(() => void rescheduleReminders(), 1500);
}
