import { afterEach, describe, expect, it } from 'vitest';
import { DecumeDB } from './db';
import { adicionarFoto, carregarReceita, criarIngrediente, definirCapa, draftVazio, excluirFoto, excluirReceita, paraDraft, RecipeError, salvarConversao, salvarReceita, type RecipeDraft } from './recipes';
import { seedIfNeeded } from './seed';

let n = 0;
const opened: DecumeDB[] = [];
const fresh = async () => {
  const d = new DecumeDB(`recipes-test-${n++}`);
  opened.push(d);
  await seedIfNeeded(d);
  return d;
};
afterEach(async () => {
  for (const d of opened.splice(0)) await d.delete();
});

const omelete = (): RecipeDraft => ({
  ...draftVazio(),
  titulo: '  Omelete de queijo ',
  tempoMin: 10,
  tags: ['Rápido', 'café da manhã', 'rápido', ' '],
  ingredientes: [
    { ingredientId: 'ovo', quantidade: 3, unidade: 'un', observacao: '', textoOriginal: null, opcional: false, aGosto: false },
    { ingredientId: 'queijo-mucarela', quantidade: 50, unidade: 'g', observacao: 'ralado ', textoOriginal: null, opcional: false, aGosto: false },
    { ingredientId: 'sal', quantidade: 1, unidade: 'pitada', observacao: '', textoOriginal: null, opcional: false, aGosto: true },
    { ingredientId: null, quantidade: null, unidade: null, observacao: '', textoOriginal: '', opcional: false, aGosto: false },
  ],
  passos: ['Bata os ovos.', '  ', 'Junte o queijo e leve à frigideira.'],
});

describe('receitas', () => {
  it('salva e carrega com ingredientes e passos em ordem, limpando campos vazios', async () => {
    const d = await fresh();
    const id = await salvarReceita(omelete(), undefined, d);
    const r = await carregarReceita(id, d);
    expect(r?.recipe.titulo).toBe('Omelete de queijo');
    expect(r?.recipe.status).toBe('minha');
    expect(r?.recipe.porcoes).toBe(2);
    expect(r?.recipe.tags).toEqual(['rápido', 'café da manhã']);
    expect(r?.ingredientes.map((i) => i.ingredientId)).toEqual(['ovo', 'queijo-mucarela', 'sal']);
    expect(r?.ingredientes[1].observacao).toBe('ralado');
    expect(r?.ingredientes[2].quantidade).toBeNull();
    expect(r?.passos).toEqual(['Bata os ovos.', 'Junte o queijo e leve à frigideira.']);
  });

  it('edição sobrescreve a versão anterior sem duplicar ingredientes', async () => {
    const d = await fresh();
    const id = await salvarReceita(omelete(), undefined, d);
    const antes = (await carregarReceita(id, d))!;
    const draft = paraDraft(antes);
    draft.porcoes = 1;
    draft.ingredientes = draft.ingredientes.slice(0, 1);
    draft.passos = ['Tudo junto.'];
    await salvarReceita(draft, id, d);
    const depois = (await carregarReceita(id, d))!;
    expect(depois.recipe.porcoes).toBe(1);
    expect(depois.recipe.criadoEm).toBe(antes.recipe.criadoEm);
    expect(depois.ingredientes).toHaveLength(1);
    expect(depois.passos).toEqual(['Tudo junto.']);
    expect(await d.recipeIngredients.count()).toBe(1);
    expect(await d.recipes.count()).toBe(1);
  });

  it('recusa receita sem nome', async () => {
    const d = await fresh();
    await expect(salvarReceita({ ...omelete(), titulo: '  ' }, undefined, d)).rejects.toThrow(RecipeError);
  });

  it('primeira foto vira capa; excluir a capa passa para outra foto', async () => {
    const d = await fresh();
    const id = await salvarReceita(omelete(), undefined, d);
    const f1 = await adicionarFoto(id, new Blob(['a'], { type: 'image/jpeg' }), d);
    await new Promise((r) => setTimeout(r, 5));
    const f2 = await adicionarFoto(id, new Blob(['b'], { type: 'image/jpeg' }), d);
    expect((await d.recipes.get(id))?.capaFotoId).toBe(f1);
    await definirCapa(id, f2, d);
    await excluirFoto(f2, d);
    expect((await d.recipes.get(id))?.capaFotoId).toBe(f1);
    await excluirFoto(f1, d);
    expect((await d.recipes.get(id))?.capaFotoId).toBeNull();
  });

  it('salvar edição mantém a capa', async () => {
    const d = await fresh();
    const id = await salvarReceita(omelete(), undefined, d);
    const f1 = await adicionarFoto(id, new Blob(['a']), d);
    await salvarReceita(paraDraft((await carregarReceita(id, d))!), id, d);
    expect((await d.recipes.get(id))?.capaFotoId).toBe(f1);
  });

  it('excluir receita apaga ingredientes, passos e fotos', async () => {
    const d = await fresh();
    const id = await salvarReceita(omelete(), undefined, d);
    await adicionarFoto(id, new Blob(['a']), d);
    await excluirReceita(id, d);
    expect(await d.recipes.count()).toBe(0);
    expect(await d.recipeIngredients.count()).toBe(0);
    expect(await d.recipeSteps.count()).toBe(0);
    expect(await d.photos.count()).toBe(0);
  });
});

describe('catálogo pelo formulário', () => {
  it('cria ingrediente novo com dados da TACO e id único', async () => {
    const d = await fresh();
    const ing = await criarIngrediente(
      { nome: 'Grão de soja', unidadeBase: 'g', secao: 'Mercearia', modo: 'exato', carneOuPeixe: false, pesoUnidadeG: 50, tacoId: 1 },
      d,
    );
    expect(ing.id).toBe('grao-de-soja');
    expect(ing.nutri100g?.kcal).toBeGreaterThan(0);
    expect(ing.pesoUnidadeG).toBeNull();
    await expect(
      criarIngrediente({ nome: 'grão de SOJA', unidadeBase: 'g', secao: 'Mercearia', modo: 'exato', carneOuPeixe: false, pesoUnidadeG: null, tacoId: null }, d),
    ).rejects.toThrow(/Já existe/);
  });

  it('guarda a conversão de medida caseira informada', async () => {
    const d = await fresh();
    await salvarConversao('brocolis', 'xicara', 90, d);
    expect((await d.ingredients.get('brocolis'))?.conversoes).toEqual({ xicara: 90 });
  });
});
