import { afterEach, describe, expect, it } from 'vitest';
import { arredondarCompra } from '../lib/shopping';
import { DecumeDB } from './db';
import { definirNivel, quantidadeEmEstoque, registrarEntrada } from './pantry';
import { draftVazio, salvarReceita, type DraftIngrediente } from './recipes';
import { seedIfNeeded } from './seed';
import {
  adicionarAvulso,
  adicionarNaSemana,
  alterarPorcoes,
  avulsosComprados,
  carregarLista,
  comprarAvulso,
  comprarItem,
  comprasDaLista,
  desfazerCompra,
  marcarFeita,
  passarParaSemana,
  pendentesAnteriores,
  tirarDoCardapio,
} from './week';

let n = 0;
const opened: DecumeDB[] = [];
const fresh = async () => {
  const d = new DecumeDB(`week-test-${n++}`);
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

async function receitas(d: DecumeDB) {
  const torta = await salvarReceita({ ...draftVazio(), titulo: 'Torta de maçã', porcoes: 4, ingredientes: [ing('maca', 4, 'un'), ing('farinha-trigo', 2, 'xicara'), ing('manteiga', 100, 'g')] }, undefined, d);
  const omelete = await salvarReceita(
    { ...draftVazio(), titulo: 'Omelete', porcoes: 2, ingredientes: [ing('ovo', 4, 'un'), ing('sal', null, null, { aGosto: true }), ing('bacon', 50, 'g', { opcional: true }), ing('pimenta-do-reino', 1, 'pitada')] },
    undefined,
    d,
  );
  const sopa = await salvarReceita({ ...draftVazio(), titulo: 'Sopa', porcoes: 2, ingredientes: [ing('brocolis', 2, 'xicara'), ing('maca', 1, 'un')] }, undefined, d);
  return { torta, omelete, sopa };
}

const S1 = '2026-10-19';
const S2 = '2026-10-26';

describe('lista de compras', () => {
  it('é a necessidade do cardápio menos a despensa, ajustada pelas porções', async () => {
    const d = await fresh();
    const { torta, omelete } = await receitas(d);
    await adicionarNaSemana(S2, torta, d);
    const w = await adicionarNaSemana(S2, omelete, d);
    await alterarPorcoes(w, 3, d); // 6 ovos
    await registrarEntrada('ovo', 2, 'avulsa', null, d);
    await registrarEntrada('manteiga', 200, 'avulsa', null, d);

    const { linhas, lembretes } = await carregarLista(S2, d);
    const porId = new Map(linhas.map((l) => [l.ingredientId, l]));
    expect(porId.get('ovo')).toMatchObject({ precisa: 6, tem: 2, falta: 4, receitas: ['Omelete'] });
    expect(porId.get('maca')?.falta).toBe(4);
    expect(porId.has('manteiga')).toBe(false); // tem o suficiente
    expect(porId.has('bacon')).toBe(false); // opcional
    expect(porId.has('farinha-trigo')).toBe(false); // básico por nível, sem nível marcado
    expect(lembretes).toEqual(['Pimenta-do-reino', 'Sal']);
  });

  it('exemplo da torta: receita não feita deixa as maçãs no estoque e a nova não gera compra', async () => {
    const d = await fresh();
    const { torta, sopa } = await receitas(d);
    const w = await adicionarNaSemana(S1, torta, d);
    await registrarEntrada('maca', 4, 'compra', null, d);
    await tirarDoCardapio(w, d);
    await adicionarNaSemana(S2, sopa, d);
    const { linhas } = await carregarLista(S2, d);
    expect(linhas.find((l) => l.ingredientId === 'maca')).toBeUndefined();
  });

  it('receita a fazer de semana anterior continua consumindo a despensa', async () => {
    const d = await fresh();
    const { torta, sopa } = await receitas(d);
    await adicionarNaSemana(S1, torta, d);
    await adicionarNaSemana(S2, sopa, d);
    await registrarEntrada('maca', 4, 'compra', null, d);
    const { linhas } = await carregarLista(S2, d);
    expect(linhas.find((l) => l.ingredientId === 'maca')?.falta).toBe(1);
  });

  it('básicos em pouco ou acabou entram mesmo sem receita; sem conversão vira aviso', async () => {
    const d = await fresh();
    const { sopa, torta } = await receitas(d);
    await adicionarNaSemana(S2, sopa, d);
    await adicionarNaSemana(S2, torta, d);
    await definirNivel('acucar', 'acabou', 'ajuste', null, d);
    await definirNivel('farinha-trigo', 'pouco', 'ajuste', null, d);
    await definirNivel('oleo', 'tem', 'ajuste', null, d);
    const { linhas } = await carregarLista(S2, d);
    const porId = new Map(linhas.map((l) => [l.ingredientId, l]));
    expect(porId.get('acucar')).toMatchObject({ origem: 'nivel', nivel: 'acabou', receitas: [] });
    expect(porId.get('farinha-trigo')).toMatchObject({ nivel: 'pouco', receitas: ['Torta de maçã'] });
    expect(porId.has('oleo')).toBe(false);
    expect(porId.get('brocolis')).toMatchObject({ falta: null, semConversao: ['2 xíc. (Sopa)'] });
  });

  it('comprar soma na despensa e o item sai da lista; desfazer volta tudo', async () => {
    const d = await fresh();
    const { omelete } = await receitas(d);
    await adicionarNaSemana(S2, omelete, d);
    await definirNivel('acucar', 'pouco', 'ajuste', null, d);
    await comprarItem('ovo', 12, S2, d);
    await comprarItem('acucar', null, S2, d);
    expect(await quantidadeEmEstoque('ovo', d)).toBe(12);
    expect((await carregarLista(S2, d)).linhas.map((l) => l.ingredientId)).toEqual([]);
    const compras = await comprasDaLista(S2, d);
    expect(compras).toHaveLength(2);
    for (const c of compras) await desfazerCompra(c.id!, d);
    expect(await quantidadeEmEstoque('ovo', d)).toBe(0);
    expect((await d.pantry.get('acucar'))?.nivel).toBe('pouco');
    expect(await comprasDaLista(S2, d)).toHaveLength(0);
  });

  it('avulsos: texto livre fica marcado; do catálogo vai para a despensa', async () => {
    const d = await fresh();
    const papel = await adicionarAvulso({ ingredientId: null, textoLivre: 'Papel toalha', quantidade: null }, d);
    const queijo = await adicionarAvulso({ ingredientId: 'queijo-minas', textoLivre: null, quantidade: 300 }, d);
    let lista = await carregarLista(S2, d);
    expect(lista.linhas.map((l) => [l.nome, l.secao])).toEqual([
      ['Papel toalha', 'Outros'],
      ['Queijo minas frescal', 'Laticínios e ovos'],
    ]);
    await comprarAvulso(papel, null, S2, d);
    await comprarAvulso(queijo, 300, S2, d);
    lista = await carregarLista(S2, d);
    expect(lista.linhas).toHaveLength(0);
    expect(await quantidadeEmEstoque('queijo-minas', d)).toBe(300);
    expect((await avulsosComprados(d)).map((a) => a.textoLivre)).toEqual(['Papel toalha']);
  });

  it('arredonda a compra para o mercado', () => {
    expect(arredondarCompra(2.4, 'un')).toBe(3);
    expect(arredondarCompra(3, 'un')).toBe(3);
    expect(arredondarCompra(347, 'g')).toBe(350);
    expect(arredondarCompra(4.2, 'g')).toBe(5);
  });
});

describe('cardápio', () => {
  it('revisão das não feitas: lista as pendentes de semanas passadas e move para a semana nova', async () => {
    const d = await fresh();
    const { torta, omelete } = await receitas(d);
    const w1 = await adicionarNaSemana(S1, torta, d);
    const w2 = await adicionarNaSemana(S1, omelete, d);
    await registrarEntrada('ovo', 10, 'compra', null, d);
    await marcarFeita(w2, d);
    expect((await pendentesAnteriores(S2, d)).map((w) => w.id)).toEqual([w1]);
    await passarParaSemana(w1, S2, d);
    expect(await pendentesAnteriores(S2, d)).toHaveLength(0);
    expect(await d.weekRecipes.get(w1)).toMatchObject({ semana: S2, veioDeSemana: S1 });
  });

  it('marcar como feita dá baixa prevista e avisa o que faltou', async () => {
    const d = await fresh();
    const { torta } = await receitas(d);
    const w = await adicionarNaSemana(S2, torta, d);
    await alterarPorcoes(w, 2, d); // metade: 2 maçãs, 50 g de manteiga
    await registrarEntrada('maca', 5, 'compra', null, d);
    await registrarEntrada('manteiga', 30, 'compra', null, d);
    const faltas = await marcarFeita(w, d);
    expect(await quantidadeEmEstoque('maca', d)).toBe(3);
    expect(await quantidadeEmEstoque('manteiga', d)).toBe(0);
    expect(faltas).toEqual([{ ingredientId: 'manteiga', faltou: 20 }]);
    expect((await d.weekRecipes.get(w))?.status).toBe('feita');
    expect(await marcarFeita(w, d)).toEqual([]); // não baixa duas vezes
    expect(await quantidadeEmEstoque('maca', d)).toBe(3);
  });
});
