import type { Ingredient, Nutri100g, RecipeIngredient } from '../db/types';
import { emGramas } from './units';

export const NUTRI_ZERO: Nutri100g = { kcal: 0, proteina: 0, carboidrato: 0, gordura: 0, fibra: 0, sodio: 0 };
const CAMPOS = Object.keys(NUTRI_ZERO) as (keyof Nutri100g)[];

export interface Faltante {
  nome: string;
  motivo: 'sem dados nutricionais' | 'sem peso em gramas' | 'sem quantidade';
}

export interface NutricaoReceita {
  total: Nutri100g;
  porPorcao: Nutri100g;
  /** true quando algum ingrediente ficou fora da conta */
  parcial: boolean;
  faltantes: Faltante[];
}

type Linha = Pick<RecipeIngredient, 'ingredientId' | 'quantidade' | 'unidade' | 'opcional' | 'aGosto' | 'textoOriginal'>;

/**
 * Soma (gramas × valor por 100 g ÷ 100) de cada ingrediente e divide pelas porções.
 * Ficam fora da conta, sem tornar o resultado parcial: itens a gosto, opcionais e
 * temperos "sempre tenho" sem dados (sal, pimenta), que quase não pesam nas calorias.
 */
export function calcularNutricao(linhas: Linha[], catalogo: Map<string, Ingredient>, porcoes: number): NutricaoReceita {
  const total = { ...NUTRI_ZERO };
  const faltantes: Faltante[] = [];

  for (const l of linhas) {
    if (l.aGosto || l.opcional) continue;
    const ing = l.ingredientId ? catalogo.get(l.ingredientId) : undefined;
    const nome = ing?.nome ?? l.textoOriginal ?? 'Ingrediente';
    if (!ing || !ing.nutri100g) {
      if (!ing?.sempreTenho) faltantes.push({ nome, motivo: 'sem dados nutricionais' });
      continue;
    }
    if (l.quantidade == null) {
      faltantes.push({ nome, motivo: 'sem quantidade' });
      continue;
    }
    const g = emGramas(ing, l.quantidade, l.unidade);
    if (g == null) {
      faltantes.push({ nome, motivo: 'sem peso em gramas' });
      continue;
    }
    for (const c of CAMPOS) total[c] += (g * ing.nutri100g[c]) / 100;
  }

  const p = porcoes > 0 ? porcoes : 1;
  const porPorcao = { ...NUTRI_ZERO };
  for (const c of CAMPOS) porPorcao[c] = total[c] / p;
  return { total, porPorcao, parcial: faltantes.length > 0, faltantes };
}

/** Vegetariana = nenhum ingrediente marcado como carne, frango ou peixe. Ovos e laticínios não contam. */
export function ehVegetariana(linhas: Pick<RecipeIngredient, 'ingredientId'>[], catalogo: Map<string, Ingredient>): boolean {
  return !linhas.some((l) => l.ingredientId && catalogo.get(l.ingredientId)?.carneOuPeixe);
}
