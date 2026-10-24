import { calcularLista, type ResultadoLista } from '../lib/shopping';
import { paraUnidadeBase } from '../lib/units';
import { db as defaultDb, type DecumeDB } from './db';
import { darBaixa, registrarEntrada } from './pantry';
import type { Nivel, PantryMovement, RecipeIngredient, ShoppingItem, WeekRecipe } from './types';

/**
 * Cardápio da semana (lista de receitas, sem dia fixo) e lista de compras.
 * A lista que vem do cardápio não é gravada: é recalculada do cardápio e da despensa.
 * Só os itens avulsos ficam guardados.
 */

export class WeekError extends Error {}

const novoId = (p: string) => `${p}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`}`;

/** Põe uma receita na semana; as porções vêm da receita. */
export async function adicionarNaSemana(semana: string, recipeId: string, d: DecumeDB = defaultDb): Promise<string> {
  const r = await d.recipes.get(recipeId);
  if (!r) throw new WeekError('Receita não encontrada.');
  const id = novoId('w');
  await d.weekRecipes.add({ id, semana, recipeId, porcoes: r.porcoes, status: 'a_fazer', veioDeSemana: null });
  return id;
}

export async function alterarPorcoes(id: string, porcoes: number, d: DecumeDB = defaultDb): Promise<void> {
  if (!(porcoes >= 1)) throw new WeekError('Pelo menos 1 porção.');
  await d.weekRecipes.update(id, { porcoes: Math.round(porcoes) });
}

/** Tira a receita do cardápio durante o planejamento (apaga a linha). */
export async function removerDaSemana(id: string, d: DecumeDB = defaultDb): Promise<void> {
  await d.weekRecipes.delete(id);
}

/** Receitas que ficaram "a fazer" em semanas que já passaram. */
export async function pendentesAnteriores(semanaAtual: string, d: DecumeDB = defaultDb): Promise<WeekRecipe[]> {
  const lista = await d.weekRecipes.where('semana').below(semanaAtual).toArray();
  return lista.filter((w) => w.status === 'a_fazer');
}

/** "Passa para esta semana": move a receita não feita para outra semana. */
export async function passarParaSemana(id: string, semana: string, d: DecumeDB = defaultDb): Promise<void> {
  const w = await d.weekRecipes.get(id);
  if (!w) return;
  await d.weekRecipes.update(id, { semana, veioDeSemana: w.veioDeSemana ?? w.semana });
}

/** "Tirar do cardápio": a receita não feita sai; os ingredientes ficam livres na despensa. */
export async function tirarDoCardapio(id: string, d: DecumeDB = defaultDb): Promise<void> {
  await d.weekRecipes.update(id, { status: 'removida' });
}

export interface BaixaPrevista {
  ingredientId: string;
  /** na unidade base */
  quantidade: number;
}

/**
 * Baixa prevista ao fazer uma receita da semana: quantidades × fator de porções, só nos
 * itens exatos. A gosto, opcionais, "sempre tenho" e básicos por nível ficam de fora.
 */
export function calcularBaixaPrevista(
  linhas: RecipeIngredient[],
  porcoesReceita: number,
  porcoesSemana: number,
  catalogo: Map<string, import('./types').Ingredient>,
): BaixaPrevista[] {
  const fator = porcoesReceita > 0 ? porcoesSemana / porcoesReceita : 1;
  const soma = new Map<string, number>();
  for (const l of linhas) {
    if (l.aGosto || l.opcional || !l.ingredientId || l.quantidade == null) continue;
    const ing = catalogo.get(l.ingredientId);
    if (!ing || ing.sempreTenho || ing.modo !== 'exato') continue;
    const base = paraUnidadeBase(ing, l.quantidade * fator, l.unidade);
    if (base == null) continue;
    soma.set(ing.id, (soma.get(ing.id) ?? 0) + base);
  }
  return [...soma].map(([ingredientId, quantidade]) => ({ ingredientId, quantidade }));
}

/**
 * Marca a receita da semana como feita e dá baixa prevista na despensa.
 * (O modo cozinhar, na etapa 5, vai permitir ajustar a baixa antes de confirmar.)
 * Devolve o que faltou em estoque, por ingrediente.
 */
export async function marcarFeita(id: string, d: DecumeDB = defaultDb): Promise<{ ingredientId: string; faltou: number }[]> {
  const w = await d.weekRecipes.get(id);
  if (!w) throw new WeekError('Receita da semana não encontrada.');
  if (w.status === 'feita') return [];
  const r = await d.recipes.get(w.recipeId);
  if (!r) throw new WeekError('Receita não encontrada.');
  const linhas = await d.recipeIngredients.where('recipeId').equals(r.id).toArray();
  const catalogo = new Map((await d.ingredients.toArray()).map((i) => [i.id, i]));
  const faltas: { ingredientId: string; faltou: number }[] = [];
  await d.transaction('rw', [d.weekRecipes, d.ingredients, d.pantry, d.movements], async () => {
    for (const b of calcularBaixaPrevista(linhas, r.porcoes, w.porcoes, catalogo)) {
      const { faltou } = await darBaixa(b.ingredientId, b.quantidade, w.id, d);
      if (faltou > 0) faltas.push({ ingredientId: b.ingredientId, faltou });
    }
    await d.weekRecipes.update(id, { status: 'feita' });
  });
  return faltas;
}

// ---------- Lista de compras ----------

/**
 * Lista para a semana escolhida: considera as receitas a fazer dessa semana e das
 * anteriores (ainda vão consumir a despensa), mais básicos acabando e avulsos.
 */
export async function carregarLista(semana: string, d: DecumeDB = defaultDb): Promise<ResultadoLista & { receitasConsideradas: WeekRecipe[] }> {
  const [semanas, receitas, linhas, catalogo, despensa, avulsos] = await Promise.all([
    d.weekRecipes.where('semana').belowOrEqual(semana).toArray(),
    d.recipes.toArray(),
    d.recipeIngredients.toArray(),
    d.ingredients.toArray(),
    d.pantry.toArray(),
    d.shopping.where('origem').equals('avulso').toArray(),
  ]);
  const receitasConsideradas = semanas.filter((w) => w.status === 'a_fazer');
  const porReceita = new Map<string, RecipeIngredient[]>();
  for (const l of linhas) porReceita.set(l.recipeId, [...(porReceita.get(l.recipeId) ?? []), l]);
  const res = calcularLista({
    receitasDaSemana: receitasConsideradas,
    receitas: new Map(receitas.map((r) => [r.id, r])),
    ingredientesPorReceita: porReceita,
    catalogo: new Map(catalogo.map((i) => [i.id, i])),
    despensa: new Map(despensa.map((p) => [p.ingredientId, p])),
    avulsos,
  });
  return { ...res, receitasConsideradas };
}

/** Referência gravada no histórico das compras feitas pela lista. */
export const refLista = (semana: string, nivelAnterior?: Nivel | null) => `lista:${semana}${nivelAnterior ? `:${nivelAnterior}` : ''}`;

/**
 * Comprei (item do cardápio ou básico): soma na despensa e registra no histórico.
 * Básicos voltam para "tem".
 */
export async function comprarItem(ingredientId: string, quantidadeBase: number | null, semana: string, d: DecumeDB = defaultDb): Promise<void> {
  const ing = await d.ingredients.get(ingredientId);
  if (!ing) throw new WeekError('Ingrediente não encontrado.');
  const anterior = ing.modo === 'nivel' ? ((await d.pantry.get(ingredientId))?.nivel ?? null) : null;
  await registrarEntrada(ingredientId, ing.modo === 'nivel' ? null : quantidadeBase, 'compra', refLista(semana, anterior), d);
}

/** Compras feitas pela lista desta semana, mais recentes primeiro. */
export async function comprasDaLista(semana: string, d: DecumeDB = defaultDb): Promise<PantryMovement[]> {
  const prefixo = refLista(semana);
  const lista = await d.movements.where('data').above(new Date(Date.now() - 1000 * 60 * 60 * 24 * 21).toISOString()).toArray();
  return lista
    .filter((m) => m.motivo === 'compra' && (m.referencia === prefixo || m.referencia?.startsWith(`${prefixo}:`)))
    .sort((a, b) => b.data.localeCompare(a.data));
}

/** Desfaz uma compra marcada por engano: devolve a despensa ao estado anterior. */
export async function desfazerCompra(movimentoId: number, d: DecumeDB = defaultDb): Promise<void> {
  await d.transaction('rw', d.movements, d.pantry, d.ingredients, async () => {
    const m = await d.movements.get(movimentoId);
    if (!m || m.motivo !== 'compra') return;
    const item = await d.pantry.get(m.ingredientId);
    const agora = new Date().toISOString();
    if (m.novoNivel) {
      const anterior = (m.referencia?.split(':')[2] as Nivel | undefined) ?? 'acabou';
      await d.pantry.put({ ingredientId: m.ingredientId, quantidade: null, nivel: anterior, atualizadoEm: agora });
    } else if (m.delta != null) {
      const nova = Math.max(0, Math.round(((item?.quantidade ?? 0) - m.delta) * 1000) / 1000);
      await d.pantry.put({ ingredientId: m.ingredientId, quantidade: nova, nivel: null, atualizadoEm: agora });
    }
    // a compra desfeita sai do histórico: ela não aconteceu
    await d.movements.delete(movimentoId);
  });
}

// ---------- Avulsos ----------

export async function adicionarAvulso(
  item: { ingredientId: string | null; textoLivre: string | null; quantidade: number | null },
  d: DecumeDB = defaultDb,
): Promise<string> {
  const texto = item.textoLivre?.trim() || null;
  if (!item.ingredientId && !texto) throw new WeekError('Escreva o item.');
  const id = novoId('s');
  const ing = item.ingredientId ? await d.ingredients.get(item.ingredientId) : undefined;
  const row: ShoppingItem = {
    id,
    ingredientId: item.ingredientId,
    textoLivre: item.ingredientId ? null : texto,
    quantidadeFaltante: item.quantidade,
    unidade: ing?.unidadeBase ?? null,
    origem: 'avulso',
    comprado: false,
    quantidadeComprada: null,
  };
  await d.shopping.add(row);
  return id;
}

/** Comprei um avulso: se for ingrediente do catálogo, entra na despensa. */
export async function comprarAvulso(id: string, quantidadeBase: number | null, semana: string, d: DecumeDB = defaultDb): Promise<void> {
  const a = await d.shopping.get(id);
  if (!a) return;
  if (a.ingredientId) {
    // do catálogo: vai para a despensa e passa a aparecer nos comprados pelo histórico
    await comprarItem(a.ingredientId, quantidadeBase, semana, d);
    await d.shopping.delete(id);
    return;
  }
  await d.shopping.update(id, { comprado: true, quantidadeComprada: quantidadeBase });
}

/** Volta um avulso de texto livre para a lista. */
export async function desfazerAvulso(id: string, d: DecumeDB = defaultDb): Promise<void> {
  await d.shopping.update(id, { comprado: false, quantidadeComprada: null });
}

export async function removerAvulso(id: string, d: DecumeDB = defaultDb): Promise<void> {
  await d.shopping.delete(id);
}

/** Avulsos já comprados (só texto livre; os do catálogo aparecem pelo histórico). */
export async function avulsosComprados(d: DecumeDB = defaultDb): Promise<ShoppingItem[]> {
  return (await d.shopping.where('origem').equals('avulso').toArray()).filter((a) => a.comprado && !a.ingredientId);
}

/** Limpa da lista os avulsos já comprados. */
export async function limparAvulsosComprados(d: DecumeDB = defaultDb): Promise<void> {
  const ids = (await d.shopping.where('origem').equals('avulso').toArray()).filter((a) => a.comprado).map((a) => a.id);
  await d.shopping.bulkDelete(ids);
}
