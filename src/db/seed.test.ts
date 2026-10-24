import { afterEach, describe, expect, it } from 'vitest';
import { CATALOG_SIZE } from '../data/catalog';
import { DecumeDB } from './db';
import { seedIfNeeded } from './seed';

let n = 0;
const fresh = () => new DecumeDB(`seed-test-${n++}`);
const opened: DecumeDB[] = [];
afterEach(async () => {
  for (const d of opened.splice(0)) await d.delete();
});

describe('seedIfNeeded', () => {
  it('semeia o catálogo inteiro na primeira abertura', async () => {
    const d = fresh();
    opened.push(d);
    expect(await seedIfNeeded(d)).toBe(CATALOG_SIZE);
    expect(await d.ingredients.count()).toBe(CATALOG_SIZE);
  });

  it('não semeia de novo na segunda abertura', async () => {
    const d = fresh();
    opened.push(d);
    await seedIfNeeded(d);
    expect(await seedIfNeeded(d)).toBe(0);
  });

  it('não sobrescreve um ingrediente editado pelo usuário', async () => {
    const d = fresh();
    opened.push(d);
    await seedIfNeeded(d);
    await d.ingredients.update('ovo', { pesoUnidadeG: 60 });
    await d.meta.delete('catalogVersion');
    await seedIfNeeded(d);
    expect((await d.ingredients.get('ovo'))?.pesoUnidadeG).toBe(60);
  });

  it('liga ingredientes à TACO e marca carne e básicos por nível', async () => {
    const d = fresh();
    opened.push(d);
    await seedIfNeeded(d);
    const frango = await d.ingredients.get('peito-frango');
    expect(frango?.carneOuPeixe).toBe(true);
    expect(frango?.nutri100g?.proteina).toBeGreaterThan(15);
    const farinha = await d.ingredients.get('farinha-trigo');
    expect(farinha?.modo).toBe('nivel');
    const sal = await d.ingredients.get('sal');
    expect(sal?.sempreTenho).toBe(true);
    const ovo = await d.ingredients.get('ovo');
    expect(ovo?.carneOuPeixe).toBe(false);
  });
});
