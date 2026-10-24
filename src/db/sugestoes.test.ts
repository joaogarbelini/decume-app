import { afterEach, describe, expect, it } from 'vitest';
import { finalizar } from './cook';
import { DecumeDB } from './db';
import { definirNivel, registrarEntrada } from './pantry';
import { draftVazio, salvarRascunho, salvarReceita, type DraftIngrediente } from './recipes';
import { seedIfNeeded } from './seed';
import { carregarSugestoes, faltantesParaLista } from './sugestoes';
import { carregarLista } from './week';

let n = 0;
const opened: DecumeDB[] = [];
const fresh = async () => {
  const d = new DecumeDB(`sug-test-${n++}`);
  opened.push(d);
  await seedIfNeeded(d);
  return d;
};
afterEach(async () => {
  for (const d of opened.splice(0)) await d.delete();
});

const ing = (ingredientId: string, quantidade: number | null, unidade: string | null, extra: Partial<DraftIngrediente> = {}): DraftIngrediente => ({
  ingredientId,
  quantidade,
  unidade,
  observacao: '',
  textoOriginal: null,
  opcional: false,
  aGosto: false,
  ...extra,
});
const receita = (d: DecumeDB, titulo: string, ingredientes: DraftIngrediente[]) => salvarReceita({ ...draftVazio(), titulo, ingredientes }, undefined, d);
const avaliar = (d: DecumeDB, recipeId: string, x: number, fariaDeNovo = true) =>
  finalizar({ recipeId, weekRecipeId: null, sessionId: null, porcoes: 2, baixas: [], niveis: [], marmitas: 0, fotos: [], avaliacao: { sabor: x, facilidade: x, custo: x, apresentacao: x, fariaDeNovo, comentario: '' } }, d);

describe('sugestões', () => {
  it('exemplo do frango alfredo: macarrão + molho branco + frango salvos viram "dá pra fazer"', async () => {
    const d = await fresh();
    const alfredo = await receita(d, 'Frango alfredo', [
      ing('macarrao', 250, 'g'),
      ing('peito-frango', 300, 'g'),
      ing('creme-de-leite', 200, 'g'),
      ing('manteiga', 1, 'colher_sopa'),
      ing('sal', null, null, { aGosto: true }),
      ing('queijo-parmesao', 30, 'g', { opcional: true }),
    ]);
    await registrarEntrada('macarrao', 500, 'avulsa', null, d);
    await registrarEntrada('peito-frango', 600, 'avulsa', null, d);
    await registrarEntrada('creme-de-leite', 200, 'avulsa', null, d);
    await registrarEntrada('manteiga', 200, 'avulsa', null, d);
    const [s] = await carregarSugestoes(d);
    expect(s.recipe.id).toBe(alfredo);
    expect(s.faixa).toBe('pronta');
    expect(s.cobertura).toMatchObject({ necessarios: 4, disponiveis: 4, fracao: 1 });
  });

  it('separa em faixas e mostra o que falta', async () => {
    const d = await fresh();
    await receita(d, 'Omelete', [ing('ovo', 3, 'un')]);
    await receita(d, 'Bolo', [ing('ovo', 3, 'un'), ing('farinha-trigo', 2, 'xicara'), ing('leite', 200, 'ml'), ing('acucar', 1, 'xicara')]);
    await receita(d, 'Moqueca', [ing('peixe-branco', 500, 'g'), ing('leite-de-coco', 200, 'ml'), ing('tomate', 2, 'un'), ing('pimentao-verde', 1, 'un')]);
    await registrarEntrada('ovo', 4, 'avulsa', null, d);
    await definirNivel('acucar', 'acabou', 'ajuste', null, d);
    const s = await carregarSugestoes(d);
    expect(s.map((x) => [x.recipe.titulo, x.faixa])).toEqual([
      ['Omelete', 'pronta'],
      ['Bolo', 'quase'],
      ['Moqueca', 'comprar'],
    ]);
    const bolo = s[1];
    expect(bolo.cobertura.faltantes.map((f) => [f.nome, f.falta])).toEqual([
      ['Leite integral', 200],
      ['Açúcar', null],
    ]);
    // farinha sem nível marcado conta como "tem"
    expect(bolo.cobertura.disponiveis).toBe(2);
  });

  it('desempata pela nota e depois pelo item que está há mais tempo na despensa', async () => {
    const d = await fresh();
    const a = await receita(d, 'A com ovo', [ing('ovo', 2, 'un')]);
    const b = await receita(d, 'B com leite', [ing('leite', 100, 'ml')]);
    const c = await receita(d, 'C com queijo', [ing('queijo-minas', 100, 'g')]);
    await registrarEntrada('leite', 1000, 'avulsa', null, d);
    await new Promise((ok) => setTimeout(ok, 5));
    await registrarEntrada('ovo', 12, 'avulsa', null, d);
    await new Promise((ok) => setTimeout(ok, 5));
    await registrarEntrada('queijo-minas', 300, 'avulsa', null, d);
    let s = await carregarSugestoes(d);
    expect(s.map((x) => x.recipe.id)).toEqual([b, a, c]); // sem nota: o leite está há mais tempo
    await avaliar(d, c, 5);
    s = await carregarSugestoes(d);
    expect(s[0].recipe.id).toBe(c);
  });

  it('marca "não faria de novo" e ignora rascunhos', async () => {
    const d = await fresh();
    const r = await receita(d, 'Ruim', [ing('ovo', 1, 'un')]);
    await salvarRascunho({ ...draftVazio(), titulo: 'Importada', ingredientes: [ing('ovo', 1, 'un')] }, d);
    await avaliar(d, r, 2, false);
    const s = await carregarSugestoes(d);
    expect(s).toHaveLength(1);
    expect(s[0].naoFariaDeNovo).toBe(true);
  });

  it('"falta pouco" joga os itens na lista sem duplicar', async () => {
    const d = await fresh();
    await receita(d, 'Bolo', [ing('ovo', 3, 'un'), ing('leite', 200, 'ml')]);
    await registrarEntrada('ovo', 1, 'avulsa', null, d);
    const [s] = await carregarSugestoes(d);
    expect(await faltantesParaLista(s, d)).toBe(2);
    expect(await faltantesParaLista(s, d)).toBe(0);
    const { linhas } = await carregarLista('2026-10-26', d);
    expect(linhas.map((l) => [l.nome, l.quantidadeAvulso])).toEqual([
      ['Leite integral', 200],
      ['Ovo', 2],
    ]);
  });
});
