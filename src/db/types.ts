// Modelo de dados do deCumê. Espelha a seção "Modelo de dados" do guideline.

export type Unidade = 'g' | 'ml' | 'un';
/** exato = controle por quantidade; nivel = básicos controlados por tem/pouco/acabou */
export type ModoControle = 'exato' | 'nivel';
export type Nivel = 'tem' | 'pouco' | 'acabou';

export const SECOES = [
  'Hortifrúti',
  'Carnes e peixes',
  'Laticínios e ovos',
  'Mercearia',
  'Temperos e condimentos',
] as const;
export type Secao = (typeof SECOES)[number];

/** Valores por 100 g (ou 100 ml), vindos da TACO ou do rótulo. */
export interface Nutri100g {
  kcal: number;
  proteina: number;
  carboidrato: number;
  gordura: number;
  fibra: number;
  /** mg */
  sodio: number;
}

export interface Ingredient {
  id: string;
  nome: string;
  apelidos: string[];
  unidadeBase: Unidade;
  modo: ModoControle;
  secao: Secao;
  /** id do alimento na TACO; null quando não há equivalente */
  tacoId: number | null;
  nutri100g: Nutri100g | null;
  /** peso médio de uma unidade, para itens contáveis (ovo, cebola) */
  pesoUnidadeG: number | null;
  /** medidas caseiras → unidade base, ex.: { 'xícara': 120 } */
  conversoes: Record<string, number>;
  /** sal, pimenta: nunca entram na lista nem na baixa */
  sempreTenho: boolean;
  /** carne, frango ou peixe: tira a marca de vegetariana da receita */
  carneOuPeixe: boolean;
  criadoEm: string;
}

export interface PantryItem {
  ingredientId: string;
  /** usado no modo exato */
  quantidade: number | null;
  /** usado no modo nível */
  nivel: Nivel | null;
  atualizadoEm: string;
}

export type MotivoMovimento = 'compra' | 'cozinhou' | 'ajuste' | 'avulsa';

export interface PantryMovement {
  id?: number;
  ingredientId: string;
  delta: number | null;
  novoNivel: Nivel | null;
  motivo: MotivoMovimento;
  referencia: string | null;
  data: string;
}

export interface Recipe {
  id: string;
  titulo: string;
  status: 'rascunho' | 'minha';
  porcoes: number;
  tempoMin: number | null;
  tags: string[];
  fonteUrl: string | null;
  capaFotoId: string | null;
  notas: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface RecipeIngredient {
  id?: number;
  recipeId: string;
  ordem: number;
  ingredientId: string | null;
  quantidade: number | null;
  unidade: string | null;
  observacao: string;
  textoOriginal: string | null;
  opcional: boolean;
  aGosto: boolean;
}

export interface RecipeStep {
  id?: number;
  recipeId: string;
  ordem: number;
  texto: string;
}

export interface WeekRecipe {
  id: string;
  /** data ISO da segunda-feira da semana */
  semana: string;
  recipeId: string;
  porcoes: number;
  status: 'a_fazer' | 'feita' | 'removida';
  veioDeSemana: string | null;
}

export interface Baixa {
  ingredientId: string;
  quantidade: number | null;
  nivel: Nivel | null;
}

export interface CookSession {
  id: string;
  weekRecipeId: string | null;
  recipeId: string;
  inicio: string;
  fim: string | null;
  passosMarcados: number[];
  baixas: Baixa[];
}

export interface Leftover {
  id: string;
  cookSessionId: string;
  recipeId: string;
  porcoesRestantes: number;
  feitaEm: string;
}

export interface Rating {
  id: string;
  cookSessionId: string;
  recipeId: string;
  sabor: number;
  facilidade: number;
  custo: number;
  apresentacao: number;
  fariaDeNovo: boolean;
  comentario: string;
}

export interface Photo {
  id: string;
  recipeId: string;
  cookSessionId: string | null;
  blob: Blob;
  criadoEm: string;
}

export interface ShoppingItem {
  id: string;
  ingredientId: string | null;
  textoLivre: string | null;
  quantidadeFaltante: number | null;
  unidade: string | null;
  origem: 'cardapio' | 'nivel' | 'avulso';
  comprado: boolean;
  quantidadeComprada: number | null;
}

export interface Meta {
  key: string;
  value: unknown;
}
