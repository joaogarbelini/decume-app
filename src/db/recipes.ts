import { db as defaultDb, type DecumeDB } from './db';
import { SECOES, type Ingredient, type ModoControle, type Photo, type Recipe, type RecipeIngredient, type Secao, type Unidade } from './types';
import { nutriFromTaco } from '../data/catalog';

/** O que o formulário edita. Vira recipe + recipeIngredients + recipeSteps ao salvar. */
export interface RecipeDraft {
  titulo: string;
  porcoes: number;
  tempoMin: number | null;
  tags: string[];
  fonteUrl: string | null;
  notas: string;
  ingredientes: DraftIngrediente[];
  passos: string[];
}

export type DraftIngrediente = Omit<RecipeIngredient, 'id' | 'recipeId' | 'ordem'>;

export interface ReceitaCompleta {
  recipe: Recipe;
  ingredientes: RecipeIngredient[];
  passos: string[];
}

export const PORCOES_PADRAO = 2;

export function draftVazio(): RecipeDraft {
  return { titulo: '', porcoes: PORCOES_PADRAO, tempoMin: null, tags: [], fonteUrl: null, notas: '', ingredientes: [], passos: [] };
}

export class RecipeError extends Error {}

function novoId(prefixo: string): string {
  const rnd = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefixo}-${rnd}`;
}

const limparTags = (tags: string[]) => [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];

/**
 * Salva a receita (nova ou editada) numa transação só. A edição sobrescreve a versão
 * anterior (decisão do MVP). Receita salva pelo formulário já é "minha receita".
 * Devolve o id.
 */
export async function salvarReceita(draft: RecipeDraft, id?: string, d: DecumeDB = defaultDb, status: Recipe['status'] = 'minha'): Promise<string> {
  const titulo = draft.titulo.trim();
  if (!titulo) throw new RecipeError('Dê um nome para a receita.');
  if (!(draft.porcoes >= 1)) throw new RecipeError('A receita precisa render pelo menos 1 porção.');

  const ingredientes = draft.ingredientes.filter((i) => i.ingredientId || i.textoOriginal?.trim());
  const passos = draft.passos.map((p) => p.trim()).filter(Boolean);
  const agora = new Date().toISOString();
  const recipeId = id ?? novoId('r');

  await d.transaction('rw', d.recipes, d.recipeIngredients, d.recipeSteps, async () => {
    const anterior = id ? await d.recipes.get(id) : undefined;
    if (id && !anterior) throw new RecipeError('Essa receita não existe mais.');
    const recipe: Recipe = {
      id: recipeId,
      titulo,
      status,
      porcoes: Math.round(draft.porcoes),
      tempoMin: draft.tempoMin && draft.tempoMin > 0 ? Math.round(draft.tempoMin) : null,
      tags: limparTags(draft.tags),
      fonteUrl: draft.fonteUrl?.trim() || null,
      capaFotoId: anterior?.capaFotoId ?? null,
      notas: draft.notas.trim(),
      criadoEm: anterior?.criadoEm ?? agora,
      atualizadoEm: agora,
    };
    await d.recipes.put(recipe);
    await d.recipeIngredients.where('recipeId').equals(recipeId).delete();
    await d.recipeSteps.where('recipeId').equals(recipeId).delete();
    if (ingredientes.length) {
      await d.recipeIngredients.bulkAdd(
        ingredientes.map((i, ordem) => ({
          recipeId,
          ordem,
          ingredientId: i.ingredientId,
          quantidade: i.aGosto ? null : i.quantidade,
          unidade: i.unidade,
          observacao: i.observacao.trim(),
          textoOriginal: i.textoOriginal,
          opcional: i.opcional,
          aGosto: i.aGosto,
        })),
      );
    }
    if (passos.length) await d.recipeSteps.bulkAdd(passos.map((texto, ordem) => ({ recipeId, ordem, texto })));
  });
  return recipeId;
}

/** Receita importada: entra como rascunho e só vira "minha receita" depois de revisada. */
export async function salvarRascunho(draft: RecipeDraft, d: DecumeDB = defaultDb): Promise<string> {
  return salvarReceita({ ...draft, titulo: draft.titulo.trim() || 'Receita importada' }, undefined, d, 'rascunho');
}

export async function carregarReceita(id: string, d: DecumeDB = defaultDb): Promise<ReceitaCompleta | null> {
  const recipe = await d.recipes.get(id);
  if (!recipe) return null;
  const ingredientes = (await d.recipeIngredients.where('recipeId').equals(id).toArray()).sort((a, b) => a.ordem - b.ordem);
  const passos = (await d.recipeSteps.where('recipeId').equals(id).toArray()).sort((a, b) => a.ordem - b.ordem).map((s) => s.texto);
  return { recipe, ingredientes, passos };
}

export function paraDraft(r: ReceitaCompleta): RecipeDraft {
  return {
    titulo: r.recipe.titulo,
    porcoes: r.recipe.porcoes,
    tempoMin: r.recipe.tempoMin,
    tags: r.recipe.tags,
    fonteUrl: r.recipe.fonteUrl,
    notas: r.recipe.notas,
    ingredientes: r.ingredientes.map(({ ingredientId, quantidade, unidade, observacao, textoOriginal, opcional, aGosto }) => ({
      ingredientId,
      quantidade,
      unidade,
      observacao,
      textoOriginal,
      opcional,
      aGosto,
    })),
    passos: r.passos,
  };
}

/** Apaga a receita com ingredientes, passos e fotos. */
export async function excluirReceita(id: string, d: DecumeDB = defaultDb): Promise<void> {
  await d.transaction('rw', [d.recipes, d.recipeIngredients, d.recipeSteps, d.photos], async () => {
    await d.recipeIngredients.where('recipeId').equals(id).delete();
    await d.recipeSteps.where('recipeId').equals(id).delete();
    await d.photos.where('recipeId').equals(id).delete();
    await d.recipes.delete(id);
  });
}

// ---------- Fotos ----------

/** Guarda uma foto (já comprimida). A primeira foto da receita vira capa. */
export async function adicionarFoto(recipeId: string, blob: Blob, d: DecumeDB = defaultDb): Promise<string> {
  const id = novoId('f');
  await d.transaction('rw', d.photos, d.recipes, async () => {
    const photo: Photo = { id, recipeId, cookSessionId: null, blob, criadoEm: new Date().toISOString() };
    await d.photos.add(photo);
    const r = await d.recipes.get(recipeId);
    if (r && !r.capaFotoId) await d.recipes.update(recipeId, { capaFotoId: id });
  });
  return id;
}

export async function definirCapa(recipeId: string, fotoId: string, d: DecumeDB = defaultDb): Promise<void> {
  await d.recipes.update(recipeId, { capaFotoId: fotoId });
}

/** Remove a foto; se era a capa, a foto mais recente que sobrar assume. */
export async function excluirFoto(fotoId: string, d: DecumeDB = defaultDb): Promise<void> {
  await d.transaction('rw', d.photos, d.recipes, async () => {
    const foto = await d.photos.get(fotoId);
    if (!foto) return;
    await d.photos.delete(fotoId);
    const r = await d.recipes.get(foto.recipeId);
    if (r?.capaFotoId === fotoId) {
      const resto = (await d.photos.where('recipeId').equals(foto.recipeId).toArray()).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
      await d.recipes.update(foto.recipeId, { capaFotoId: resto[0]?.id ?? null });
    }
  });
}

// ---------- Catálogo ----------

export interface NovoIngrediente {
  nome: string;
  unidadeBase: Unidade;
  secao: Secao;
  modo: ModoControle;
  carneOuPeixe: boolean;
  pesoUnidadeG: number | null;
  tacoId: number | null;
}

export function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Cria um ingrediente no catálogo (na hora, pelo formulário). Devolve o ingrediente criado. */
export async function criarIngrediente(n: NovoIngrediente, d: DecumeDB = defaultDb): Promise<Ingredient> {
  const nome = n.nome.trim();
  if (!nome) throw new RecipeError('Dê um nome para o ingrediente.');
  if (!SECOES.includes(n.secao)) throw new RecipeError('Seção do mercado inválida.');
  const base = slug(nome) || 'ingrediente';
  return d.transaction('rw', d.ingredients, async () => {
    const mesmoNome = await d.ingredients.filter((i) => slug(i.nome) === base).first();
    if (mesmoNome) throw new RecipeError(`Já existe "${mesmoNome.nome}" no catálogo.`);
    let id = base;
    for (let k = 2; await d.ingredients.get(id); k++) id = `${base}-${k}`;
    const ing: Ingredient = {
      id,
      nome,
      apelidos: [],
      unidadeBase: n.unidadeBase,
      modo: n.modo,
      secao: n.secao,
      tacoId: n.tacoId,
      nutri100g: nutriFromTaco(n.tacoId),
      pesoUnidadeG: n.unidadeBase === 'un' && n.pesoUnidadeG && n.pesoUnidadeG > 0 ? n.pesoUnidadeG : null,
      conversoes: {},
      sempreTenho: false,
      carneOuPeixe: n.carneOuPeixe,
      criadoEm: new Date().toISOString(),
    };
    await d.ingredients.add(ing);
    return ing;
  });
}

/** Guarda quanto vale uma medida caseira para o ingrediente ("1 xícara de farinha = 120 g"). */
export async function salvarConversao(ingredientId: string, unidade: string, valor: number, d: DecumeDB = defaultDb): Promise<void> {
  if (!(valor > 0)) throw new RecipeError('O valor da medida precisa ser maior que zero.');
  await d.transaction('rw', d.ingredients, async () => {
    const ing = await d.ingredients.get(ingredientId);
    if (!ing) throw new RecipeError('Ingrediente não encontrado.');
    await d.ingredients.update(ingredientId, { conversoes: { ...ing.conversoes, [unidade]: valor } });
  });
}
