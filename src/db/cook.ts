import { db as defaultDb, type DecumeDB } from './db';
import { darBaixa, definirNivel } from './pantry';
import type { Baixa, CookSession, Ingredient, Leftover, Nivel, Rating } from './types';
import { calcularBaixaPrevista } from './week';

/** A casa come 2 porções por refeição; o que passar disso vira marmita. */
export const PORCOES_REFEICAO = 2;

export class CookError extends Error {}

const novoId = (p: string) => `${p}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`}`;

/** Começa (ou retoma) o modo cozinhar de uma receita. */
export async function iniciarSessao(recipeId: string, weekRecipeId: string | null, d: DecumeDB = defaultDb): Promise<CookSession> {
  const abertas = await d.cookSessions.where('recipeId').equals(recipeId).toArray();
  const aberta = abertas.find((s) => !s.fim && s.weekRecipeId === weekRecipeId);
  if (aberta) return aberta;
  const s: CookSession = { id: novoId('c'), weekRecipeId, recipeId, inicio: new Date().toISOString(), fim: null, passosMarcados: [], baixas: [] };
  await d.cookSessions.add(s);
  return s;
}

export async function marcarPassos(sessionId: string, passos: number[], d: DecumeDB = defaultDb): Promise<void> {
  await d.cookSessions.update(sessionId, { passosMarcados: [...new Set(passos)].sort((a, b) => a - b) });
}

export interface PreparoFinalizacao {
  porcoes: number;
  /** itens exatos: quanto deve sair (unidade base) e quanto tem */
  baixas: { ingredientId: string; quantidade: number; tem: number }[];
  /** básicos usados na receita, com o nível atual */
  basicos: { ingredientId: string; nivel: Nivel | null }[];
  marmitasSugeridas: number;
}

/** O que a tela de finalizar mostra: baixa prevista, básicos usados e sobra sugerida. */
export async function prepararFinalizacao(recipeId: string, porcoes: number, d: DecumeDB = defaultDb): Promise<PreparoFinalizacao> {
  const r = await d.recipes.get(recipeId);
  if (!r) throw new CookError('Receita não encontrada.');
  const linhas = await d.recipeIngredients.where('recipeId').equals(recipeId).toArray();
  const catalogo = new Map((await d.ingredients.toArray()).map((i) => [i.id, i] as [string, Ingredient]));
  const despensa = new Map((await d.pantry.toArray()).map((p) => [p.ingredientId, p]));
  const baixas = calcularBaixaPrevista(linhas, r.porcoes, porcoes, catalogo).map((b) => ({ ...b, tem: despensa.get(b.ingredientId)?.quantidade ?? 0 }));
  const basicosIds = [
    ...new Set(
      linhas
        .filter((l) => !l.opcional && l.ingredientId)
        .map((l) => catalogo.get(l.ingredientId!))
        .filter((i): i is Ingredient => !!i && i.modo === 'nivel' && !i.sempreTenho)
        .map((i) => i.id),
    ),
  ];
  return {
    porcoes,
    baixas,
    basicos: basicosIds.map((id) => ({ ingredientId: id, nivel: despensa.get(id)?.nivel ?? null })),
    marmitasSugeridas: Math.max(0, porcoes - PORCOES_REFEICAO),
  };
}

export interface Avaliacao {
  sabor: number;
  facilidade: number;
  custo: number;
  apresentacao: number;
  fariaDeNovo: boolean;
  comentario: string;
}

export interface Finalizacao {
  recipeId: string;
  weekRecipeId: string | null;
  sessionId: string | null;
  porcoes: number;
  baixas: { ingredientId: string; quantidade: number }[];
  /** básicos que mudaram de nível ao cozinhar */
  niveis: { ingredientId: string; nivel: Nivel }[];
  marmitas: number;
  avaliacao: Avaliacao | null;
  /** fotos já comprimidas */
  fotos: Blob[];
}

const notaValida = (n: number) => Number.isInteger(n) && n >= 1 && n <= 5;

/**
 * Fecha o cozinhar numa transação só: baixa na despensa (que para em zero), níveis dos
 * básicos, receita da semana como feita, marmitas, avaliação e fotos.
 * Devolve o que faltou em estoque.
 */
export async function finalizar(f: Finalizacao, d: DecumeDB = defaultDb): Promise<{ sessionId: string; faltas: { ingredientId: string; faltou: number }[] }> {
  if (f.avaliacao) {
    const a = f.avaliacao;
    if (![a.sabor, a.facilidade, a.custo, a.apresentacao].every(notaValida)) throw new CookError('As notas vão de 1 a 5.');
  }
  if (f.marmitas < 0) throw new CookError('Marmitas não podem ser negativas.');
  const faltas: { ingredientId: string; faltou: number }[] = [];
  const sessionId = f.sessionId ?? novoId('c');
  const agora = new Date().toISOString();

  await d.transaction('rw', [d.cookSessions, d.weekRecipes, d.ingredients, d.pantry, d.movements, d.leftovers, d.ratings, d.photos, d.recipes], async () => {
    if (f.weekRecipeId) {
      const w = await d.weekRecipes.get(f.weekRecipeId);
      if (w?.status === 'feita') throw new CookError('Essa receita da semana já foi marcada como feita.');
    }
    const registradas: Baixa[] = [];
    for (const b of f.baixas) {
      if (!(b.quantidade > 0)) continue;
      const { baixado, faltou } = await darBaixa(b.ingredientId, b.quantidade, sessionId, d);
      registradas.push({ ingredientId: b.ingredientId, quantidade: baixado, nivel: null });
      if (faltou > 0) faltas.push({ ingredientId: b.ingredientId, faltou });
    }
    for (const n of f.niveis) {
      await definirNivel(n.ingredientId, n.nivel, 'cozinhou', sessionId, d);
      registradas.push({ ingredientId: n.ingredientId, quantidade: null, nivel: n.nivel });
    }
    const existente = await d.cookSessions.get(sessionId);
    await d.cookSessions.put({
      id: sessionId,
      weekRecipeId: f.weekRecipeId,
      recipeId: f.recipeId,
      inicio: existente?.inicio ?? agora,
      fim: agora,
      passosMarcados: existente?.passosMarcados ?? [],
      baixas: registradas,
    });
    if (f.weekRecipeId) await d.weekRecipes.update(f.weekRecipeId, { status: 'feita', porcoes: f.porcoes });
    if (f.marmitas > 0) {
      await d.leftovers.add({ id: novoId('m'), cookSessionId: sessionId, recipeId: f.recipeId, porcoesRestantes: Math.round(f.marmitas), feitaEm: agora });
    }
    if (f.avaliacao) {
      await d.ratings.add({ id: novoId('a'), cookSessionId: sessionId, recipeId: f.recipeId, ...f.avaliacao, comentario: f.avaliacao.comentario.trim() });
    }
    const r = await d.recipes.get(f.recipeId);
    let capa = r?.capaFotoId ?? null;
    for (const blob of f.fotos) {
      const id = novoId('f');
      await d.photos.add({ id, recipeId: f.recipeId, cookSessionId: sessionId, blob, criadoEm: new Date().toISOString() });
      if (!capa) capa = id;
    }
    if (r && capa !== r.capaFotoId) await d.recipes.update(f.recipeId, { capaFotoId: capa });
  });
  return { sessionId, faltas };
}

// ---------- Marmitas ----------

/** "Comi uma": desconta uma porção; a marmita some quando acaba. A despensa não muda. */
export async function comerMarmita(id: string, d: DecumeDB = defaultDb): Promise<void> {
  await d.transaction('rw', d.leftovers, async () => {
    const m = await d.leftovers.get(id);
    if (!m) return;
    if (m.porcoesRestantes <= 1) await d.leftovers.delete(id);
    else await d.leftovers.update(id, { porcoesRestantes: m.porcoesRestantes - 1 });
  });
}

/** Jogou fora ou acabou de outro jeito. */
export async function descartarMarmita(id: string, d: DecumeDB = defaultDb): Promise<void> {
  await d.leftovers.delete(id);
}

export async function marmitas(d: DecumeDB = defaultDb): Promise<Leftover[]> {
  return (await d.leftovers.toArray()).sort((a, b) => a.feitaEm.localeCompare(b.feitaEm));
}

// ---------- Avaliações ----------

export interface ResumoAvaliacoes {
  vezes: number;
  /** média dos 4 critérios em todas as vezes (1 a 5) */
  nota: number;
  criterios: { sabor: number; facilidade: number; custo: number; apresentacao: number };
  /** resposta mais recente de "Faria de novo?" */
  fariaDeNovo: boolean;
  ultimas: Rating[];
}

export function resumir(avaliacoes: Rating[], datas: Map<string, string> = new Map()): ResumoAvaliacoes | null {
  if (!avaliacoes.length) return null;
  const ordenadas = [...avaliacoes].sort((a, b) => (datas.get(b.cookSessionId) ?? '').localeCompare(datas.get(a.cookSessionId) ?? ''));
  const media = (k: 'sabor' | 'facilidade' | 'custo' | 'apresentacao') => ordenadas.reduce((s, r) => s + r[k], 0) / ordenadas.length;
  const criterios = { sabor: media('sabor'), facilidade: media('facilidade'), custo: media('custo'), apresentacao: media('apresentacao') };
  return {
    vezes: ordenadas.length,
    nota: (criterios.sabor + criterios.facilidade + criterios.custo + criterios.apresentacao) / 4,
    criterios,
    fariaDeNovo: ordenadas[0].fariaDeNovo,
    ultimas: ordenadas,
  };
}

/** Resumo das avaliações de todas as receitas (id → resumo). */
export async function resumosPorReceita(d: DecumeDB = defaultDb): Promise<Map<string, ResumoAvaliacoes>> {
  const [avaliacoes, sessoes] = await Promise.all([d.ratings.toArray(), d.cookSessions.toArray()]);
  const datas = new Map(sessoes.map((s) => [s.id, s.fim ?? s.inicio]));
  const porReceita = new Map<string, Rating[]>();
  for (const a of avaliacoes) porReceita.set(a.recipeId, [...(porReceita.get(a.recipeId) ?? []), a]);
  const out = new Map<string, ResumoAvaliacoes>();
  for (const [id, lista] of porReceita) out.set(id, resumir(lista, datas)!);
  return out;
}

/** Datas (fim) das sessões, para mostrar quando cada avaliação foi feita. */
export async function datasDasSessoes(recipeId: string, d: DecumeDB = defaultDb): Promise<Map<string, string>> {
  const s = await d.cookSessions.where('recipeId').equals(recipeId).toArray();
  return new Map(s.map((x) => [x.id, x.fim ?? x.inicio]));
}
