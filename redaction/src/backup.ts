import { db, TABLES } from './db';
import { saveAndShare } from './native';
import { todayISO } from './util';

const FORMAT = 'redaction-backup';

export async function exportBackup() {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  const payload = { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), data };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  await saveAndShare(`redaction-sauvegarde-${todayISO()}.json`, blob, 'Sauvegarder mes articles');
  await db.settings.put({ key: 'lastBackup', value: Date.now() });
}

export interface BackupSummary {
  articles: number;
  ideas: number;
  issues: number;
  exportedAt: string;
}

export async function readBackup(file: File): Promise<{ summary: BackupSummary; data: Record<string, unknown[]> }> {
  const text = await file.text();
  let parsed: { format?: string; exportedAt?: string; data?: Record<string, unknown[]> };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n'est pas une sauvegarde valide.");
  }
  if (parsed.format !== FORMAT || !parsed.data) throw new Error("Ce fichier n'est pas une sauvegarde de Rédaction.");
  return {
    data: parsed.data,
    summary: {
      articles: parsed.data.articles?.length ?? 0,
      ideas: parsed.data.ideas?.length ?? 0,
      issues: parsed.data.issues?.length ?? 0,
      exportedAt: parsed.exportedAt ?? '',
    },
  };
}

/** Remplace tout le contenu de l'appli par celui de la sauvegarde. */
export async function restoreBackup(data: Record<string, unknown[]>) {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      const rows = data[t];
      if (Array.isArray(rows) && rows.length) await db.table(t).bulkAdd(rows);
    }
  });
}
