import { buildCatalog } from '../data/catalog';
import { db as defaultDb, type DecumeDB } from './db';

/** Suba este número quando o catálogo inicial ganhar itens novos. */
export const CATALOG_VERSION = 2;

/**
 * Semeia o catálogo de ingredientes na primeira abertura (e quando a versão sobe).
 * Só adiciona ingredientes que ainda não existem: nunca sobrescreve edições do usuário.
 * Retorna quantos ingredientes foram adicionados.
 */
export async function seedIfNeeded(d: DecumeDB = defaultDb): Promise<number> {
  const current = await d.meta.get('catalogVersion');
  if (typeof current?.value === 'number' && current.value >= CATALOG_VERSION) return 0;

  const novos = buildCatalog(new Date().toISOString());
  let added = 0;
  await d.transaction('rw', d.ingredients, d.meta, async () => {
    const existentes = new Set(await d.ingredients.toCollection().primaryKeys());
    const faltando = novos.filter((i) => !existentes.has(i.id));
    if (faltando.length) await d.ingredients.bulkAdd(faltando);
    added = faltando.length;
    await d.meta.put({ key: 'catalogVersion', value: CATALOG_VERSION });
  });
  return added;
}
