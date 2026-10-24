import { sugerir, type Sugestao } from '../lib/sugestoes';
import { resumosPorReceita } from './cook';
import { db as defaultDb, type DecumeDB } from './db';
import type { RecipeIngredient } from './types';
import { adicionarAvulso, carregarLista } from './week';
import { chaveSemana, proximaSemana } from '../lib/dates';

/** Lê tudo o que as sugestões precisam e devolve a lista ordenada. */
export async function carregarSugestoes(d: DecumeDB = defaultDb): Promise<Sugestao[]> {
  const [receitas, linhas, catalogo, despensa, movimentos, resumos] = await Promise.all([
    d.recipes.toArray(),
    d.recipeIngredients.toArray(),
    d.ingredients.toArray(),
    d.pantry.toArray(),
    d.movements.toArray(),
    resumosPorReceita(d),
  ]);
  const porReceita = new Map<string, RecipeIngredient[]>();
  for (const l of linhas) porReceita.set(l.recipeId, [...(porReceita.get(l.recipeId) ?? []), l]);
  const ultimaEntrada = new Map<string, string>();
  for (const m of movimentos) {
    const entrou = (m.delta ?? 0) > 0 || m.novoNivel === 'tem';
    if (!entrou) continue;
    const atual = ultimaEntrada.get(m.ingredientId);
    if (!atual || m.data > atual) ultimaEntrada.set(m.ingredientId, m.data);
  }
  return sugerir({
    receitas,
    ingredientesPorReceita: porReceita,
    catalogo: new Map(catalogo.map((i) => [i.id, i])),
    despensa: new Map(despensa.map((p) => [p.ingredientId, p])),
    avaliacoes: new Map([...resumos].map(([id, r]) => [id, { nota: r.nota, fariaDeNovo: r.fariaDeNovo }])),
    ultimaEntrada,
  });
}

/** "Falta pouco" → joga os itens que faltam na lista de compras (sem duplicar avulsos já na lista). */
export async function faltantesParaLista(s: Sugestao, d: DecumeDB = defaultDb): Promise<number> {
  // o que já está na lista (avulso ou vindo do cardápio até a próxima semana) não entra de novo
  const { linhas } = await carregarLista(chaveSemana(proximaSemana(new Date())), d);
  const jaNaLista = new Set(linhas.map((l) => l.ingredientId));
  let n = 0;
  for (const f of s.cobertura.faltantes) {
    if (jaNaLista.has(f.ingredientId)) continue;
    await adicionarAvulso({ ingredientId: f.ingredientId, textoLivre: null, quantidade: f.falta != null ? Math.ceil(f.falta * 100) / 100 : null }, d);
    n++;
  }
  return n;
}
