import type { Ingredient } from '../db/types';
import { formatQuantidade } from './quantity';

/** Unidades aceitas numa linha de ingrediente. As caseiras dependem do ingrediente. */
export type UnidadeReceita = 'g' | 'kg' | 'ml' | 'l' | 'un' | 'xicara' | 'colher_sopa' | 'colher_cha' | 'pitada';

export const CASEIRAS: UnidadeReceita[] = ['xicara', 'colher_sopa', 'colher_cha', 'pitada'];

const ROTULO: Record<UnidadeReceita, [string, string]> = {
  g: ['g', 'g'],
  kg: ['kg', 'kg'],
  ml: ['ml', 'ml'],
  l: ['litro', 'litros'],
  un: ['unidade', 'unidades'],
  xicara: ['xícara', 'xícaras'],
  colher_sopa: ['colher de sopa', 'colheres de sopa'],
  colher_cha: ['colher de chá', 'colheres de chá'],
  pitada: ['pitada', 'pitadas'],
};

const CURTO: Record<UnidadeReceita, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
  un: '',
  xicara: 'xíc.',
  colher_sopa: 'c. sopa',
  colher_cha: 'c. chá',
  pitada: 'pitada',
};

export function rotuloUnidade(u: string, quantidade = 1): string {
  const r = ROTULO[u as UnidadeReceita];
  if (!r) return u;
  return quantidade > 1 ? r[1] : r[0];
}

/**
 * Ao mudar as porções, as medidas viram números quebrados (3,375 cenouras).
 * Unidades arredondam para meia; xícaras e colheres para ¼. Valores pequenos ficam como estão.
 */
function arredondarCaseira(q: number, u: UnidadeReceita): number {
  const passo = u === 'un' && q >= 1 ? 0.5 : u === 'kg' || u === 'l' ? 0.05 : 0.25;
  if (q < passo) return q;
  return Math.round(q / passo) * passo;
}

/** "250 g", "1 ½ xíc.", "2" (unidades) */
export function formatMedida(quantidade: number | null, unidade: string | null): string {
  if (quantidade == null) return '';
  const u = (unidade ?? 'un') as UnidadeReceita;
  const exata = u === 'g' || u === 'ml';
  const q = formatQuantidade(exata ? quantidade : arredondarCaseira(quantidade, u), !exata);
  const curto = CURTO[u] ?? u;
  return curto ? `${q} ${curto}` : q;
}

/**
 * Medidas caseiras de referência, em gramas por medida, para os ingredientes
 * pesados em g. Valores médios; o usuário pode corrigir e a correção
 * (guardada em ingredient.conversoes) passa a valer no lugar destes.
 */
export const CONVERSOES_PADRAO: Record<string, Partial<Record<UnidadeReceita, number>>> = {
  'farinha-trigo': { xicara: 120, colher_sopa: 7.5, colher_cha: 2.5 },
  'farinha-mandioca': { xicara: 150, colher_sopa: 10 },
  fuba: { xicara: 120, colher_sopa: 7 },
  'amido-milho': { xicara: 150, colher_sopa: 9, colher_cha: 3 },
  acucar: { xicara: 180, colher_sopa: 12, colher_cha: 4 },
  'acucar-mascavo': { xicara: 150, colher_sopa: 10, colher_cha: 3.5 },
  arroz: { xicara: 185, colher_sopa: 12 },
  'arroz-integral': { xicara: 190, colher_sopa: 12 },
  aveia: { xicara: 80, colher_sopa: 6 },
  cacau: { xicara: 90, colher_sopa: 6, colher_cha: 2 },
  'coco-ralado': { xicara: 80, colher_sopa: 5 },
  chocolate: { xicara: 150 },
  amendoim: { xicara: 140, colher_sopa: 9 },
  'fermento-quimico': { colher_sopa: 10, colher_cha: 4 },
  'fermento-biologico': { colher_sopa: 10, colher_cha: 3 },
  manteiga: { xicara: 200, colher_sopa: 15, colher_cha: 5 },
  'queijo-parmesao': { xicara: 80, colher_sopa: 5 },
  'queijo-mucarela': { xicara: 100 },
  'creme-de-leite': { xicara: 240, colher_sopa: 15 },
  requeijao: { xicara: 240, colher_sopa: 15 },
  iogurte: { xicara: 240, colher_sopa: 15 },
  'leite-condensado': { xicara: 300, colher_sopa: 20 },
  mel: { xicara: 340, colher_sopa: 21, colher_cha: 7 },
  maionese: { xicara: 220, colher_sopa: 13 },
  mostarda: { colher_sopa: 15, colher_cha: 5 },
  ketchup: { colher_sopa: 15 },
  'extrato-tomate': { colher_sopa: 15 },
  'molho-tomate': { xicara: 240, colher_sopa: 15 },
  'feijao-carioca': { xicara: 180 },
  'feijao-preto': { xicara: 180 },
  lentilha: { xicara: 190 },
  'grao-de-bico': { xicara: 200 },
  'milho-verde': { xicara: 165, colher_sopa: 10 },
  ervilha: { xicara: 160, colher_sopa: 10 },
  azeitona: { xicara: 130 },
  sal: { colher_sopa: 18, colher_cha: 6 },
  'pimenta-do-reino': { colher_cha: 2 },
  canela: { colher_sopa: 7, colher_cha: 2.5 },
  oregano: { colher_sopa: 2, colher_cha: 0.7 },
  paprica: { colher_sopa: 7, colher_cha: 2.3 },
  cominho: { colher_cha: 2 },
  'noz-moscada': { colher_cha: 2 },
  salsinha: { xicara: 60, colher_sopa: 4 },
  cebolinha: { xicara: 50, colher_sopa: 4 },
  coentro: { xicara: 30, colher_sopa: 3 },
  manjericao: { xicara: 25, colher_sopa: 2 },
  gengibre: { colher_sopa: 6, colher_cha: 2 },
};

/** Medidas de volume, em ml. Valem para qualquer ingrediente medido em ml. */
const VOLUME_ML: Partial<Record<UnidadeReceita, number>> = { xicara: 240, colher_sopa: 15, colher_cha: 5 };

/** Densidade (g por ml) dos líquidos que fogem de 1. */
const DENSIDADE: Record<string, number> = { oleo: 0.92, azeite: 0.91 };

const PITADA_G = 0.5;

/** Quanto vale 1 medida caseira na unidade base do ingrediente, ou null se não se sabe. */
export function valorMedida(ing: Ingredient, u: UnidadeReceita): number | null {
  const propria = ing.conversoes?.[u];
  if (typeof propria === 'number' && propria > 0) return propria;
  if (ing.unidadeBase === 'ml') return VOLUME_ML[u] ?? null;
  if (ing.unidadeBase === 'g') return CONVERSOES_PADRAO[ing.id]?.[u] ?? (u === 'pitada' ? PITADA_G : null);
  return null;
}

/** Unidades que fazem sentido para o ingrediente, a base primeiro. */
export function unidadesPara(ing: Ingredient): UnidadeReceita[] {
  if (ing.unidadeBase === 'un') return ing.pesoUnidadeG ? ['un', 'g', 'kg'] : ['un'];
  if (ing.unidadeBase === 'ml') return ['ml', 'l', 'xicara', 'colher_sopa', 'colher_cha'];
  const lista: UnidadeReceita[] = ['g', 'kg', 'xicara', 'colher_sopa', 'colher_cha', 'pitada'];
  if (ing.pesoUnidadeG) lista.splice(2, 0, 'un');
  return lista;
}

/** Converte para a unidade base do ingrediente (g, ml ou un). null = conversão desconhecida. */
export function paraUnidadeBase(ing: Ingredient, quantidade: number, unidade: string | null): number | null {
  const u = (unidade || ing.unidadeBase) as UnidadeReceita;
  if (u === ing.unidadeBase) return quantidade;
  const peso = ing.pesoUnidadeG;
  switch (ing.unidadeBase) {
    case 'g':
      if (u === 'kg') return quantidade * 1000;
      if (u === 'un') return peso ? quantidade * peso : null;
      break;
    case 'ml':
      if (u === 'l') return quantidade * 1000;
      break;
    case 'un':
      if (u === 'g') return peso ? quantidade / peso : null;
      if (u === 'kg') return peso ? (quantidade * 1000) / peso : null;
      return null;
  }
  const v = valorMedida(ing, u);
  return v == null ? null : quantidade * v;
}

/** Peso em gramas, para o cálculo nutricional. null = não dá para saber. */
export function emGramas(ing: Ingredient, quantidade: number, unidade: string | null): number | null {
  const base = paraUnidadeBase(ing, quantidade, unidade);
  if (base == null) return null;
  if (ing.unidadeBase === 'g') return base;
  if (ing.unidadeBase === 'ml') return base * (DENSIDADE[ing.id] ?? 1);
  return ing.pesoUnidadeG ? base * ing.pesoUnidadeG : null;
}

/** Estoque na unidade base, para exibir: "750 g", "1,2 kg", "1,5 l", "6 un". */
export function formatEstoque(quantidade: number, unidadeBase: Ingredient['unidadeBase']): string {
  const num = (q: number, casas: number) => q.toLocaleString('pt-BR', { maximumFractionDigits: casas });
  if (unidadeBase === 'un') return `${num(quantidade, 1)} un`;
  const grande = unidadeBase === 'g' ? 'kg' : 'l';
  if (quantidade >= 1000) return `${num(quantidade / 1000, 2)} ${grande}`;
  return `${num(quantidade, quantidade < 10 ? 1 : 0)} ${unidadeBase}`;
}

/** Unidades para lançar estoque: sem medidas caseiras, que não fazem sentido na despensa. */
export function unidadesEstoque(ing: Ingredient): UnidadeReceita[] {
  return unidadesPara(ing).filter((u) => !CASEIRAS.includes(u));
}

/** true quando a unidade é caseira e o ingrediente ainda não tem conversão para ela. */
export function faltaConversao(ing: Ingredient, unidade: string | null): boolean {
  if (!unidade) return false;
  return paraUnidadeBase(ing, 1, unidade) == null && CASEIRAS.includes(unidade as UnidadeReceita);
}
