import { afterEach, describe, expect, it } from 'vitest';
import { comerMarmita, finalizar, iniciarSessao, marcarPassos, prepararFinalizacao, resumosPorReceita, CookError } from './cook';
import { DecumeDB } from './db';
import { definirNivel, historico, quantidadeEmEstoque, registrarEntrada } from './pantry';
import { draftVazio, salvarReceita, type DraftIngrediente } from './recipes';
import { seedIfNeeded } from './seed';
import { adicionarNaSemana } from './week';

let n = 0;
const opened: DecumeDB[] = [];
const fresh = async () => {
  const d = new DecumeDB(`cook-test-${n++}`);
  opened.push(d);
  await seedIfNeeded(d);
  return d;
};
afterEach(async () => {
  for (const d of opened.splice(0)) await d.delete();
});

const ing = (ingredientId: string, quantidade: number | null, unidade: string | null, extra: Partial<DraftIngrediente> = {}): DraftIngrediente => ({
  ingredientId,
  quantidade,
  unidade,
  observacao: '',
  textoOriginal: null,
  opcional: false,
  aGosto: false,
  ...extra,
});

async function frangoXadrez(d: DecumeDB) {
  return salvarReceita(
    {
      ...draftVazio(),
      titulo: 'Frango xadrez',
      porcoes: 4,
      ingredientes: [ing('peito-frango', 600, 'g'), ing('pimentao-verde', 2, 'un'), ing('shoyu', 3, 'colher_sopa'), ing('oleo', 2, 'colher_sopa'), ing('sal', null, null, { aGosto: true })],
      passos: ['Corte', 'Refogue', 'Sirva'],
    },
    undefined,
    d,
  );
}

const nota = { sabor: 5, facilidade: 4, custo: 4, apresentacao: 3, fariaDeNovo: true, comentario: ' menos sal ' };

describe('cozinhar', () => {
  it('prepara a finalização com baixa prevista, básicos usados e marmitas', async () => {
    const d = await fresh();
    const r = await frangoXadrez(d);
    await registrarEntrada('peito-frango', 1000, 'avulsa', null, d);
    await definirNivel('shoyu', 'tem', 'ajuste', null, d);
    const p = await prepararFinalizacao(r, 4, d);
    expect(p.baixas).toEqual([
      { ingredientId: 'peito-frango', quantidade: 600, tem: 1000 },
      { ingredientId: 'pimentao-verde', quantidade: 2, tem: 0 },
    ]);
    expect(p.basicos).toEqual([
      { ingredientId: 'shoyu', nivel: 'tem' },
      { ingredientId: 'oleo', nivel: null },
    ]);
    expect(p.marmitasSugeridas).toBe(2);
    expect((await prepararFinalizacao(r, 2, d)).marmitasSugeridas).toBe(0);
  });

  it('retoma a sessão aberta e guarda os passos marcados', async () => {
    const d = await fresh();
    const r = await frangoXadrez(d);
    const s1 = await iniciarSessao(r, null, d);
    await marcarPassos(s1.id, [1, 0, 1], d);
    const s2 = await iniciarSessao(r, null, d);
    expect(s2.id).toBe(s1.id);
    expect(s2.passosMarcados).toEqual([0, 1]);
  });

  it('finalizar dá baixa ajustada, muda níveis, marca a semana, cria marmita, avaliação e fotos', async () => {
    const d = await fresh();
    const r = await frangoXadrez(d);
    const w = await adicionarNaSemana('2026-10-26', r, d);
    await registrarEntrada('peito-frango', 1000, 'avulsa', null, d);
    await registrarEntrada('pimentao-verde', 1, 'avulsa', null, d);
    const s = await iniciarSessao(r, w, d);
    const { faltas, sessionId } = await finalizar(
      {
        recipeId: r,
        weekRecipeId: w,
        sessionId: s.id,
        porcoes: 4,
        baixas: [
          { ingredientId: 'peito-frango', quantidade: 700 },
          { ingredientId: 'pimentao-verde', quantidade: 2 },
        ],
        niveis: [{ ingredientId: 'shoyu', nivel: 'pouco' }],
        marmitas: 2,
        avaliacao: nota,
        fotos: [new Blob(['x'], { type: 'image/jpeg' })],
      },
      d,
    );
    expect(sessionId).toBe(s.id);
    expect(await quantidadeEmEstoque('peito-frango', d)).toBe(300);
    expect(faltas).toEqual([{ ingredientId: 'pimentao-verde', faltou: 1 }]);
    expect((await d.pantry.get('shoyu'))?.nivel).toBe('pouco');
    expect((await historico({ ingredientId: 'shoyu' }, d))[0]).toMatchObject({ motivo: 'cozinhou', referencia: s.id });
    expect((await d.weekRecipes.get(w))?.status).toBe('feita');
    expect(await d.leftovers.toArray()).toMatchObject([{ recipeId: r, porcoesRestantes: 2 }]);
    expect((await d.ratings.toArray())[0]).toMatchObject({ sabor: 5, comentario: 'menos sal', cookSessionId: s.id });
    const fotos = await d.photos.toArray();
    expect(fotos[0]).toMatchObject({ recipeId: r, cookSessionId: s.id });
    expect((await d.recipes.get(r))?.capaFotoId).toBe(fotos[0].id);
    expect((await d.cookSessions.get(s.id))?.fim).toBeTruthy();
  });

  it('não finaliza duas vezes a mesma receita da semana nem aceita nota fora de 1 a 5', async () => {
    const d = await fresh();
    const r = await frangoXadrez(d);
    const w = await adicionarNaSemana('2026-10-26', r, d);
    const base = { recipeId: r, weekRecipeId: w, sessionId: null, porcoes: 4, baixas: [], niveis: [], marmitas: 0, avaliacao: null, fotos: [] };
    await expect(finalizar({ ...base, avaliacao: { ...nota, sabor: 6 } }, d)).rejects.toThrow(CookError);
    await finalizar(base, d);
    await expect(finalizar(base, d)).rejects.toThrow(/já foi marcada/);
  });

  it('marmita desconta uma porção por vez e some quando acaba', async () => {
    const d = await fresh();
    const r = await frangoXadrez(d);
    await finalizar({ recipeId: r, weekRecipeId: null, sessionId: null, porcoes: 4, baixas: [], niveis: [], marmitas: 2, avaliacao: null, fotos: [] }, d);
    const [m] = await d.leftovers.toArray();
    await comerMarmita(m.id, d);
    expect((await d.leftovers.get(m.id))?.porcoesRestantes).toBe(1);
    await comerMarmita(m.id, d);
    expect(await d.leftovers.count()).toBe(0);
  });

  it('nota da receita é a média de todas as vezes; "faria de novo" vale a mais recente', async () => {
    const d = await fresh();
    const r = await frangoXadrez(d);
    const fim = { weekRecipeId: null, sessionId: null, porcoes: 2, baixas: [], niveis: [], marmitas: 0, fotos: [], recipeId: r };
    await finalizar({ ...fim, avaliacao: { sabor: 4, facilidade: 4, custo: 4, apresentacao: 4, fariaDeNovo: true, comentario: '' } }, d);
    await new Promise((ok) => setTimeout(ok, 5));
    await finalizar({ ...fim, avaliacao: { sabor: 2, facilidade: 2, custo: 2, apresentacao: 2, fariaDeNovo: false, comentario: 'não gostei' } }, d);
    const res = (await resumosPorReceita(d)).get(r)!;
    expect(res.vezes).toBe(2);
    expect(res.nota).toBe(3);
    expect(res.fariaDeNovo).toBe(false);
    expect(res.ultimas[0].comentario).toBe('não gostei');
  });
});
