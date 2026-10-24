import type { Ingredient, PantryItem, Recipe, RecipeIngredient } from '../db/types';
import { paraUnidadeBase } from './units';

/**
 * Sugestões a partir da despensa (MVP: só receitas salvas).
 * Cobertura = ingredientes disponíveis em quantidade suficiente ÷ ingredientes necessários,
 * sem contar itens a gosto, opcionais e "sempre tenho".
 */

export interface Faltante {
  ingredientId: string;
  nome: string;
  /** quanto falta, na unidade base (null = básico acabou ou medida sem conversão) */
  falta: number | null;
  unidadeBase: Ingredient['unidadeBase'];
}

export interface Cobertura {
  necessarios: number;
  disponiveis: number;
  faltantes: Faltante[];
  /** 0 a 1 */
  fracao: number;
}

export type Faixa = 'pronta' | 'quase' | 'comprar';

export interface Sugestao {
  recipe: Recipe;
  cobertura: Cobertura;
  faixa: Faixa;
  nota: number | null;
  /** data da entrada mais antiga entre os itens que a receita usaria (para gastar antes o que está parado) */
  maisAntigo: string | null;
  /** a avaliação mais recente disse "não faria de novo" */
  naoFariaDeNovo: boolean;
}

const EPS = 1e-6;

export function calcularCobertura(
  linhas: RecipeIngredient[],
  porcoesReceita: number,
  porcoesAlvo: number,
  catalogo: Map<string, Ingredient>,
  despensa: Map<string, PantryItem>,
): Cobertura {
  const fator = porcoesReceita > 0 ? porcoesAlvo / porcoesReceita : 1;
  const precisa = new Map<string, { qtd: number; semConversao: boolean }>();
  for (const l of linhas) {
    if (l.aGosto || l.opcional || !l.ingredientId) continue;
    const ing = catalogo.get(l.ingredientId);
    if (!ing || ing.sempreTenho) continue;
    const atual = precisa.get(ing.id) ?? { qtd: 0, semConversao: false };
    if (ing.modo === 'exato') {
      const base = l.quantidade != null ? paraUnidadeBase(ing, l.quantidade * fator, l.unidade) : null;
      if (base == null) atual.semConversao = true;
      else atual.qtd += base;
    }
    precisa.set(ing.id, atual);
  }

  const faltantes: Faltante[] = [];
  for (const [id, p] of precisa) {
    const ing = catalogo.get(id)!;
    const item = despensa.get(id);
    if (ing.modo === 'nivel') {
      // básico sem nível marcado conta como "tem"; só "acabou" falta
      if (item?.nivel === 'acabou') faltantes.push({ ingredientId: id, nome: ing.nome, falta: null, unidadeBase: ing.unidadeBase });
      continue;
    }
    const tem = item?.quantidade ?? 0;
    if (p.semConversao && p.qtd === 0) {
      if (tem <= EPS) faltantes.push({ ingredientId: id, nome: ing.nome, falta: null, unidadeBase: ing.unidadeBase });
      continue;
    }
    if (tem + EPS < p.qtd) faltantes.push({ ingredientId: id, nome: ing.nome, falta: p.qtd - tem, unidadeBase: ing.unidadeBase });
  }
  const necessarios = precisa.size;
  const disponiveis = necessarios - faltantes.length;
  return { necessarios, disponiveis, faltantes, fracao: necessarios ? disponiveis / necessarios : 1 };
}

export function faixaDe(c: Cobertura): Faixa {
  if (c.faltantes.length === 0) return 'pronta';
  if (c.faltantes.length <= 2) return 'quase';
  return 'comprar';
}

export interface EntradaSugestoes {
  receitas: Recipe[];
  ingredientesPorReceita: Map<string, RecipeIngredient[]>;
  catalogo: Map<string, Ingredient>;
  despensa: Map<string, PantryItem>;
  /** id da receita → nota média e "faria de novo" mais recente */
  avaliacoes: Map<string, { nota: number; fariaDeNovo: boolean }>;
  /** id do ingrediente → data da última entrada na despensa */
  ultimaEntrada: Map<string, string>;
}

const ORDEM: Record<Faixa, number> = { pronta: 0, quase: 1, comprar: 2 };

/**
 * Receitas salvas ordenadas: primeiro por faixa (dá pra fazer, falta pouco, precisa comprar);
 * dentro da faixa, maior nota primeiro (sem nota conta como 3), depois a que usa itens
 * que entraram na despensa há mais tempo.
 */
export function sugerir(e: EntradaSugestoes): Sugestao[] {
  const lista = e.receitas
    .filter((r) => r.status === 'minha')
    .map((r): Sugestao => {
      const linhas = e.ingredientesPorReceita.get(r.id) ?? [];
      const cobertura = calcularCobertura(linhas, r.porcoes, r.porcoes, e.catalogo, e.despensa);
      const faltando = new Set(cobertura.faltantes.map((f) => f.ingredientId));
      const datas = linhas
        .map((l) => l.ingredientId)
        .filter((id): id is string => !!id && !faltando.has(id) && e.catalogo.get(id)?.modo === 'exato')
        .map((id) => e.ultimaEntrada.get(id))
        .filter((d): d is string => !!d)
        .sort();
      const av = e.avaliacoes.get(r.id);
      return { recipe: r, cobertura, faixa: faixaDe(cobertura), nota: av?.nota ?? null, maisAntigo: datas[0] ?? null, naoFariaDeNovo: av ? !av.fariaDeNovo : false };
    });
  return lista.sort(
    (a, b) =>
      ORDEM[a.faixa] - ORDEM[b.faixa] ||
      (b.nota ?? 3) - (a.nota ?? 3) ||
      (a.maisAntigo ?? '9999').localeCompare(b.maisAntigo ?? '9999') ||
      a.cobertura.faltantes.length - b.cobertura.faltantes.length ||
      a.recipe.titulo.localeCompare(b.recipe.titulo, 'pt-BR'),
  );
}
