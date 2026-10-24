import type { Ingredient, Nivel, PantryItem, Recipe, RecipeIngredient, Secao, ShoppingItem, Unidade, WeekRecipe } from '../db/types';
import { formatMedida, paraUnidadeBase } from './units';

/**
 * Lista de compras = cardápio − despensa, mais básicos em "pouco"/"acabou", mais itens avulsos.
 * Função pura: não lê nem grava nada; quem chama passa os dados.
 */

export interface LinhaLista {
  /** chave estável para a tela */
  chave: string;
  origem: 'cardapio' | 'nivel' | 'avulso';
  ingredientId: string | null;
  nome: string;
  secao: Secao | 'Outros';
  unidadeBase: Unidade | null;
  /** quanto falta comprar, na unidade base (null = não dá para calcular) */
  falta: number | null;
  precisa: number;
  tem: number;
  nivel: Nivel | null;
  /** receitas da semana que usam o item */
  receitas: string[];
  /** medidas que o app não conseguiu converter (ex.: "1 xíc. (Sopa)") */
  semConversao: string[];
  /** id do item avulso, quando origem = avulso */
  avulsoId?: string;
  /** texto livre do avulso ("papel toalha") */
  textoLivre?: string;
  quantidadeAvulso?: number | null;
}

export interface EntradaLista {
  receitasDaSemana: WeekRecipe[];
  receitas: Map<string, Recipe>;
  ingredientesPorReceita: Map<string, RecipeIngredient[]>;
  catalogo: Map<string, Ingredient>;
  despensa: Map<string, PantryItem>;
  avulsos: ShoppingItem[];
}

export interface ResultadoLista {
  linhas: LinhaLista[];
  /** itens "sempre tenho" usados no cardápio (sal, pimenta): só lembrete, não entram na lista */
  lembretes: string[];
}

const EPS = 1e-6;

export function calcularLista(e: EntradaLista): ResultadoLista {
  const necessidade = new Map<string, { precisa: number; receitas: Set<string>; semConversao: string[] }>();
  const usadosNivel = new Map<string, Set<string>>();
  const lembretes = new Set<string>();

  for (const wr of e.receitasDaSemana) {
    if (wr.status !== 'a_fazer') continue;
    const r = e.receitas.get(wr.recipeId);
    if (!r) continue;
    const fator = r.porcoes > 0 ? wr.porcoes / r.porcoes : 1;
    for (const l of e.ingredientesPorReceita.get(r.id) ?? []) {
      if (!l.ingredientId) continue;
      const ing = e.catalogo.get(l.ingredientId);
      if (!ing) continue;
      // sal, pimenta: nunca entram na lista, só lembrete (mesmo "a gosto")
      if (ing.sempreTenho) {
        if (!l.opcional) lembretes.add(ing.nome);
        continue;
      }
      if (l.aGosto || l.opcional) continue;
      if (ing.modo === 'nivel') {
        usadosNivel.set(ing.id, (usadosNivel.get(ing.id) ?? new Set()).add(r.titulo));
        continue;
      }
      if (l.quantidade == null) continue;
      const n = necessidade.get(ing.id) ?? { precisa: 0, receitas: new Set<string>(), semConversao: [] };
      n.receitas.add(r.titulo);
      const qtd = l.quantidade * fator;
      const base = paraUnidadeBase(ing, qtd, l.unidade);
      if (base == null) n.semConversao.push(`${formatMedida(qtd, l.unidade)} (${r.titulo})`);
      else n.precisa += base;
      necessidade.set(ing.id, n);
    }
  }

  const linhas: LinhaLista[] = [];

  for (const [id, n] of necessidade) {
    const ing = e.catalogo.get(id)!;
    const tem = e.despensa.get(id)?.quantidade ?? 0;
    const falta = n.precisa - tem;
    if (falta <= EPS && !n.semConversao.length) continue;
    linhas.push({
      chave: `c:${id}`,
      origem: 'cardapio',
      ingredientId: id,
      nome: ing.nome,
      secao: ing.secao,
      unidadeBase: ing.unidadeBase,
      falta: falta > EPS ? falta : n.semConversao.length ? null : 0,
      precisa: n.precisa,
      tem,
      nivel: null,
      receitas: [...n.receitas],
      semConversao: n.semConversao,
    });
  }

  for (const ing of e.catalogo.values()) {
    if (ing.modo !== 'nivel' || ing.sempreTenho) continue;
    const nivel = e.despensa.get(ing.id)?.nivel;
    if (nivel !== 'pouco' && nivel !== 'acabou') continue;
    linhas.push({
      chave: `n:${ing.id}`,
      origem: 'nivel',
      ingredientId: ing.id,
      nome: ing.nome,
      secao: ing.secao,
      unidadeBase: ing.unidadeBase,
      falta: null,
      precisa: 0,
      tem: 0,
      nivel,
      receitas: [...(usadosNivel.get(ing.id) ?? [])],
      semConversao: [],
    });
  }

  for (const a of e.avulsos) {
    if (a.comprado) continue;
    const ing = a.ingredientId ? e.catalogo.get(a.ingredientId) : undefined;
    linhas.push({
      chave: `a:${a.id}`,
      origem: 'avulso',
      ingredientId: ing?.id ?? null,
      nome: ing?.nome ?? a.textoLivre ?? 'Item',
      secao: ing?.secao ?? 'Outros',
      unidadeBase: ing?.unidadeBase ?? null,
      falta: null,
      precisa: 0,
      tem: 0,
      nivel: null,
      receitas: [],
      semConversao: [],
      avulsoId: a.id,
      textoLivre: a.textoLivre ?? undefined,
      quantidadeAvulso: a.quantidadeFaltante,
    });
  }

  linhas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return { linhas, lembretes: [...lembretes].sort((a, b) => a.localeCompare(b, 'pt-BR')) };
}

/**
 * Quanto comprar, arredondado para o mercado: unidades para cima (2,4 ovos → 3);
 * gramas e ml para cima de 10 em 10 acima de 10 (347 g → 350 g).
 */
export function arredondarCompra(falta: number, unidadeBase: Unidade): number {
  if (falta <= 0) return 0;
  if (unidadeBase === 'un') return Math.ceil(falta - EPS);
  if (falta <= 10) return Math.ceil(falta - EPS);
  return Math.ceil(falta / 10 - EPS) * 10;
}
