import { afterEach, describe, expect, it } from 'vitest';
import { DecumeDB } from './db';
import { ajustarQuantidade, darBaixa, definirNivel, historico, PantryError, quantidadeEmEstoque, registrarEntrada } from './pantry';
import { seedIfNeeded } from './seed';

let n = 0;
const opened: DecumeDB[] = [];
const fresh = async () => {
  const d = new DecumeDB(`pantry-test-${n++}`);
  opened.push(d);
  await seedIfNeeded(d);
  return d;
};
afterEach(async () => {
  for (const d of opened.splice(0)) await d.delete();
});

describe('despensa', () => {
  it('entrada soma no estoque e registra o movimento', async () => {
    const d = await fresh();
    await registrarEntrada('ovo', 12, 'avulsa', null, d);
    await registrarEntrada('ovo', 6, 'compra', 'lista', d);
    expect(await quantidadeEmEstoque('ovo', d)).toBe(18);
    const mov = await historico({ ingredientId: 'ovo' }, d);
    expect(mov.map((m) => [m.motivo, m.delta])).toEqual([
      ['compra', 6],
      ['avulsa', 12],
    ]);
  });

  it('entrada de básico volta o nível para "tem"', async () => {
    const d = await fresh();
    await definirNivel('farinha-trigo', 'acabou', 'ajuste', null, d);
    await registrarEntrada('farinha-trigo', null, 'avulsa', null, d);
    expect((await d.pantry.get('farinha-trigo'))?.nivel).toBe('tem');
  });

  it('recusa entrada sem quantidade em item exato', async () => {
    const d = await fresh();
    await expect(registrarEntrada('ovo', 0, 'avulsa', null, d)).rejects.toThrow(PantryError);
  });

  it('ajuste grava a nova quantidade e a diferença no histórico', async () => {
    const d = await fresh();
    await registrarEntrada('peito-frango', 1000, 'avulsa', null, d);
    await ajustarQuantidade('peito-frango', 650, d);
    expect(await quantidadeEmEstoque('peito-frango', d)).toBe(650);
    expect((await historico({ ingredientId: 'peito-frango' }, d))[0]).toMatchObject({ motivo: 'ajuste', delta: -350 });
    await ajustarQuantidade('peito-frango', 650, d);
    expect(await historico({ ingredientId: 'peito-frango' }, d)).toHaveLength(2);
  });

  it('baixa nunca deixa o estoque negativo e devolve o que faltou', async () => {
    const d = await fresh();
    await registrarEntrada('leite', 500, 'avulsa', null, d);
    expect(await darBaixa('leite', 200, 'sessao-1', d)).toEqual({ baixado: 200, faltou: 0 });
    expect(await darBaixa('leite', 450, 'sessao-2', d)).toEqual({ baixado: 300, faltou: 150 });
    expect(await quantidadeEmEstoque('leite', d)).toBe(0);
    expect(await darBaixa('leite', 100, 'sessao-3', d)).toEqual({ baixado: 0, faltou: 100 });
    expect((await historico({ ingredientId: 'leite' }, d)).map((m) => m.delta)).toEqual([-300, -200, 500]);
  });

  it('não acumula erro de arredondamento', async () => {
    const d = await fresh();
    await registrarEntrada('manteiga', 0.1, 'avulsa', null, d);
    await registrarEntrada('manteiga', 0.2, 'avulsa', null, d);
    expect(await quantidadeEmEstoque('manteiga', d)).toBe(0.3);
  });

  it('nível só muda em básicos e só registra quando muda', async () => {
    const d = await fresh();
    await definirNivel('acucar', 'pouco', 'ajuste', null, d);
    await definirNivel('acucar', 'pouco', 'ajuste', null, d);
    expect(await historico({ ingredientId: 'acucar' }, d)).toHaveLength(1);
    await expect(definirNivel('ovo', 'pouco', 'ajuste', null, d)).rejects.toThrow(/quantidade/);
    await expect(ajustarQuantidade('acucar', 100, d)).rejects.toThrow(/nível/);
  });
});
