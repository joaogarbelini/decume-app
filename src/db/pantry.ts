import { db as defaultDb, type DecumeDB } from './db';
import type { Ingredient, MotivoMovimento, Nivel, PantryItem, PantryMovement } from './types';

/**
 * Despensa: a fonte da verdade do que tem em casa.
 * Itens exatos guardam a quantidade na unidade base do ingrediente (g, ml ou un);
 * básicos guardam o nível (tem, pouco, acabou). Todo movimento vai para o histórico.
 */

export class PantryError extends Error {}

const agora = () => new Date().toISOString();
/** Evita sobras como 0,30000000004 g depois de somas e subtrações. */
const limpa = (q: number) => Math.round(q * 1000) / 1000;

async function pegarIngrediente(d: DecumeDB, id: string): Promise<Ingredient> {
  const ing = await d.ingredients.get(id);
  if (!ing) throw new PantryError('Ingrediente não encontrado no catálogo.');
  return ing;
}

async function registrar(d: DecumeDB, m: Omit<PantryMovement, 'id' | 'data'>, data = agora()) {
  await d.movements.add({ ...m, data });
}

/** Quantidade em estoque (unidade base) de um item exato; 0 se não houver. */
export async function quantidadeEmEstoque(ingredientId: string, d: DecumeDB = defaultDb): Promise<number> {
  return (await d.pantry.get(ingredientId))?.quantidade ?? 0;
}

/**
 * Entrada na despensa (compra pela lista, compra avulsa ou "já tinha em casa").
 * Item exato: soma a quantidade. Básico: volta para "tem" (a quantidade é ignorada).
 */
export async function registrarEntrada(
  ingredientId: string,
  quantidade: number | null,
  motivo: Extract<MotivoMovimento, 'compra' | 'avulsa' | 'ajuste'>,
  referencia: string | null = null,
  d: DecumeDB = defaultDb,
): Promise<void> {
  await d.transaction('rw', d.ingredients, d.pantry, d.movements, async () => {
    const ing = await pegarIngrediente(d, ingredientId);
    const atual = await d.pantry.get(ingredientId);
    if (ing.modo === 'nivel') {
      await d.pantry.put({ ingredientId, quantidade: null, nivel: 'tem', atualizadoEm: agora() });
      await registrar(d, { ingredientId, delta: null, novoNivel: 'tem', motivo, referencia });
      return;
    }
    if (quantidade == null || !(quantidade > 0)) throw new PantryError('Informe uma quantidade maior que zero.');
    const nova = limpa((atual?.quantidade ?? 0) + quantidade);
    await d.pantry.put({ ingredientId, quantidade: nova, nivel: null, atualizadoEm: agora() });
    await registrar(d, { ingredientId, delta: limpa(quantidade), novoNivel: null, motivo, referencia });
  });
}

/** Ajuste manual de um item exato: grava a nova quantidade e o histórico guarda a diferença. */
export async function ajustarQuantidade(ingredientId: string, novaQuantidade: number, d: DecumeDB = defaultDb): Promise<void> {
  if (!(novaQuantidade >= 0)) throw new PantryError('A quantidade não pode ser negativa.');
  await d.transaction('rw', d.ingredients, d.pantry, d.movements, async () => {
    const ing = await pegarIngrediente(d, ingredientId);
    if (ing.modo !== 'exato') throw new PantryError(`${ing.nome} é controlado por nível.`);
    const anterior = (await d.pantry.get(ingredientId))?.quantidade ?? 0;
    const nova = limpa(novaQuantidade);
    const delta = limpa(nova - anterior);
    if (delta === 0) return;
    await d.pantry.put({ ingredientId, quantidade: nova, nivel: null, atualizadoEm: agora() });
    await registrar(d, { ingredientId, delta, novoNivel: null, motivo: 'ajuste', referencia: null });
  });
}

/** Muda o nível de um básico (tem, pouco, acabou). */
export async function definirNivel(
  ingredientId: string,
  nivel: Nivel,
  motivo: Extract<MotivoMovimento, 'ajuste' | 'cozinhou' | 'compra'> = 'ajuste',
  referencia: string | null = null,
  d: DecumeDB = defaultDb,
): Promise<void> {
  await d.transaction('rw', d.ingredients, d.pantry, d.movements, async () => {
    const ing = await pegarIngrediente(d, ingredientId);
    if (ing.modo !== 'nivel') throw new PantryError(`${ing.nome} é controlado por quantidade.`);
    const atual = await d.pantry.get(ingredientId);
    if (atual?.nivel === nivel) return;
    await d.pantry.put({ ingredientId, quantidade: null, nivel, atualizadoEm: agora() });
    await registrar(d, { ingredientId, delta: null, novoNivel: nivel, motivo, referencia });
  });
}

/**
 * Baixa de um item exato (ao cozinhar). O estoque nunca fica negativo: a baixa para
 * em zero e a função devolve quanto faltou, para o app avisar a diferença.
 */
export async function darBaixa(
  ingredientId: string,
  quantidade: number,
  referencia: string | null = null,
  d: DecumeDB = defaultDb,
): Promise<{ baixado: number; faltou: number }> {
  if (!(quantidade > 0)) return { baixado: 0, faltou: 0 };
  let resultado = { baixado: 0, faltou: 0 };
  await d.transaction('rw', d.ingredients, d.pantry, d.movements, async () => {
    const ing = await pegarIngrediente(d, ingredientId);
    if (ing.modo !== 'exato') throw new PantryError(`${ing.nome} é controlado por nível.`);
    const anterior = (await d.pantry.get(ingredientId))?.quantidade ?? 0;
    const baixado = limpa(Math.min(anterior, quantidade));
    resultado = { baixado, faltou: limpa(quantidade - baixado) };
    if (baixado === 0) return;
    await d.pantry.put({ ingredientId, quantidade: limpa(anterior - baixado), nivel: null, atualizadoEm: agora() });
    await registrar(d, { ingredientId, delta: -baixado, novoNivel: null, motivo: 'cozinhou', referencia });
  });
  return resultado;
}

/** Histórico, mais recente primeiro. Com ingredientId, só daquele item. */
export async function historico(opts: { ingredientId?: string; limite?: number } = {}, d: DecumeDB = defaultDb): Promise<PantryMovement[]> {
  const limite = opts.limite ?? 200;
  if (opts.ingredientId) {
    const lista = await d.movements.where('ingredientId').equals(opts.ingredientId).toArray();
    return lista.sort((a, b) => b.data.localeCompare(a.data) || (b.id ?? 0) - (a.id ?? 0)).slice(0, limite);
  }
  return d.movements.orderBy('data').reverse().limit(limite).toArray();
}

/** Itens que aparecem na despensa: exatos com estoque e básicos (menos os "sempre tenho"). */
export function itemVisivel(ing: Ingredient, item: PantryItem | undefined): boolean {
  if (ing.modo === 'nivel') return !ing.sempreTenho;
  return (item?.quantidade ?? 0) > 0;
}
