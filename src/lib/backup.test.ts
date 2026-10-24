import { afterEach, describe, expect, it } from 'vitest';
import { DecumeDB } from '../db/db';
import { seedIfNeeded } from '../db/seed';
import { BackupError, exportBackup, parseBackup, restoreBackup } from './backup';

let n = 0;
const opened: DecumeDB[] = [];
const fresh = () => {
  const d = new DecumeDB(`backup-test-${n++}`);
  opened.push(d);
  return d;
};
afterEach(async () => {
  for (const d of opened.splice(0)) await d.delete();
});

describe('backup', () => {
  it('exporta e restaura tudo, inclusive fotos', async () => {
    const origem = fresh();
    await seedIfNeeded(origem);
    await origem.pantry.put({ ingredientId: 'ovo', quantidade: 6, nivel: null, atualizadoEm: '2026-10-24T12:00:00Z' });
    await origem.pantry.put({ ingredientId: 'farinha-trigo', quantidade: null, nivel: 'pouco', atualizadoEm: '2026-10-24T12:00:00Z' });
    await origem.photos.add({
      id: 'f1',
      recipeId: 'r1',
      cookSessionId: null,
      blob: new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/jpeg' }),
      criadoEm: '2026-10-24T12:00:00Z',
    });

    const json = JSON.stringify(await exportBackup(origem));
    const destino = fresh();
    await destino.pantry.put({ ingredientId: 'lixo', quantidade: 1, nivel: null, atualizadoEm: 'x' });
    await restoreBackup(parseBackup(json), destino);

    expect(await destino.ingredients.count()).toBe(await origem.ingredients.count());
    expect(await destino.pantry.get('lixo')).toBeUndefined();
    expect((await destino.pantry.get('farinha-trigo'))?.nivel).toBe('pouco');
    const foto = await destino.photos.get('f1');
    expect(foto?.blob.type).toBe('image/jpeg');
    expect([...new Uint8Array(await foto!.blob.arrayBuffer())]).toEqual([1, 2, 3, 250]);
  });

  it('recusa arquivos que não são backup do deCumê', () => {
    expect(() => parseBackup('não é json')).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ app: 'outro', tabelas: {} }))).toThrow(/não é um backup do deCumê/);
    expect(() => parseBackup(JSON.stringify({ app: 'decume', versao: 99, tabelas: {} }))).toThrow(/versão mais nova/);
  });
});
