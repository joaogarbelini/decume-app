import { DATA_TABLES, db as defaultDb, type DecumeDB } from '../db/db';

export const BACKUP_APP = 'decume';
export const BACKUP_VERSION = 1;

export interface BackupPhoto {
  id: string;
  recipeId: string;
  cookSessionId: string | null;
  criadoEm: string;
  dataUrl: string;
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  versao: number;
  exportadoEm: string;
  tabelas: Record<string, unknown[]>;
  fotos: BackupPhoto[];
}

export class BackupError extends Error {}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || comma < 0) throw new BackupError('Foto com formato inválido no backup.');
  const type = dataUrl.slice(5, comma).split(';')[0] || 'application/octet-stream';
  const bin = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Lê todo o banco e devolve um objeto pronto para virar JSON. */
export async function exportBackup(d: DecumeDB = defaultDb): Promise<BackupFile> {
  const tabelas: Record<string, unknown[]> = {};
  for (const name of DATA_TABLES) tabelas[name] = await d.table(name).toArray();
  const fotos: BackupPhoto[] = [];
  for (const p of await d.photos.toArray()) {
    fotos.push({ id: p.id, recipeId: p.recipeId, cookSessionId: p.cookSessionId, criadoEm: p.criadoEm, dataUrl: await blobToDataUrl(p.blob) });
  }
  return { app: BACKUP_APP, versao: BACKUP_VERSION, exportadoEm: new Date().toISOString(), tabelas, fotos };
}

/** Confere se um objeto lido de arquivo é um backup do deCumê que esta versão entende. */
export function parseBackup(texto: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(texto);
  } catch {
    throw new BackupError('O arquivo não é um backup válido: não deu para ler o conteúdo.');
  }
  const b = data as Partial<BackupFile>;
  if (!b || b.app !== BACKUP_APP || typeof b.tabelas !== 'object' || b.tabelas === null) {
    throw new BackupError('Este arquivo não é um backup do deCumê.');
  }
  if (typeof b.versao !== 'number' || b.versao > BACKUP_VERSION) {
    throw new BackupError('Este backup foi feito por uma versão mais nova do app. Atualize o app e tente de novo.');
  }
  return { ...b, fotos: Array.isArray(b.fotos) ? b.fotos : [] } as BackupFile;
}

/**
 * Substitui todos os dados do aparelho pelos do backup, numa transação só:
 * se algo falhar no meio, nada muda.
 */
export async function restoreBackup(backup: BackupFile, d: DecumeDB = defaultDb): Promise<number> {
  const fotos = backup.fotos.map((f) => ({
    id: f.id,
    recipeId: f.recipeId,
    cookSessionId: f.cookSessionId,
    criadoEm: f.criadoEm,
    blob: dataUrlToBlob(f.dataUrl),
  }));
  let total = 0;
  const tables = [...DATA_TABLES.map((n) => d.table(n)), d.photos];
  await d.transaction('rw', tables, async () => {
    for (const name of DATA_TABLES) {
      const t = d.table(name);
      await t.clear();
      const rows = backup.tabelas[name];
      if (Array.isArray(rows) && rows.length) {
        await t.bulkAdd(rows);
        total += rows.length;
      }
    }
    await d.photos.clear();
    if (fotos.length) await d.photos.bulkAdd(fotos);
    total += fotos.length;
  });
  return total;
}

export function backupFileName(date = new Date()): string {
  const iso = date.toISOString().slice(0, 10);
  return `decume-backup-${iso}.json`;
}

/** No navegador: gera o arquivo e dispara o download. */
export async function downloadBackup(d: DecumeDB = defaultDb): Promise<void> {
  const backup = await exportBackup(d);
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
