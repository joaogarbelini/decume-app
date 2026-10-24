import Dexie, { type Table } from 'dexie';
import type {
  CookSession,
  Ingredient,
  Leftover,
  Meta,
  PantryItem,
  PantryMovement,
  Photo,
  Rating,
  Recipe,
  RecipeIngredient,
  RecipeStep,
  ShoppingItem,
  WeekRecipe,
} from './types';

/**
 * Banco local (IndexedDB) do deCumê. Fica só no aparelho no MVP;
 * a camada fica isolada aqui para migrar para a nuvem na fase 2.
 */
export class DecumeDB extends Dexie {
  ingredients!: Table<Ingredient, string>;
  pantry!: Table<PantryItem, string>;
  movements!: Table<PantryMovement, number>;
  recipes!: Table<Recipe, string>;
  recipeIngredients!: Table<RecipeIngredient, number>;
  recipeSteps!: Table<RecipeStep, number>;
  weekRecipes!: Table<WeekRecipe, string>;
  cookSessions!: Table<CookSession, string>;
  leftovers!: Table<Leftover, string>;
  ratings!: Table<Rating, string>;
  photos!: Table<Photo, string>;
  shopping!: Table<ShoppingItem, string>;
  meta!: Table<Meta, string>;

  constructor(name = 'decume') {
    super(name);
    this.version(1).stores({
      ingredients: 'id, nome, secao, modo, *apelidos',
      pantry: 'ingredientId',
      movements: '++id, ingredientId, data',
      recipes: 'id, status, titulo, atualizadoEm',
      recipeIngredients: '++id, recipeId, ingredientId',
      recipeSteps: '++id, recipeId',
      weekRecipes: 'id, semana, recipeId, status',
      cookSessions: 'id, recipeId, weekRecipeId',
      leftovers: 'id, recipeId',
      ratings: 'id, recipeId, cookSessionId',
      photos: 'id, recipeId, cookSessionId',
      shopping: 'id, origem, comprado',
      meta: 'key',
    });
  }
}

export const db = new DecumeDB();

/** Tabelas na ordem usada pelo backup. Fotos têm tratamento próprio (Blob). */
export const DATA_TABLES = [
  'ingredients',
  'pantry',
  'movements',
  'recipes',
  'recipeIngredients',
  'recipeSteps',
  'weekRecipes',
  'cookSessions',
  'leftovers',
  'ratings',
  'shopping',
  'meta',
] as const satisfies readonly (keyof DecumeDB)[];

export type DataTableName = (typeof DATA_TABLES)[number];
