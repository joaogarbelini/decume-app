import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { EmptyState, TabHeader } from '../components/Layout';
import { RecipeThumb } from '../components/RecipeThumb';
import { comerMarmita, descartarMarmita, marmitas } from '../db/cook';
import { db } from '../db/db';
import type { WeekRecipe } from '../db/types';
import { chaveSemana, rotuloSemana } from '../lib/dates';
import { plural } from '../lib/text';
import { carregarSugestoes } from '../db/sugestoes';
import { calcularCobertura, type Cobertura } from '../lib/sugestoes';
import { CoberturaChip, SugestaoCard } from './sugestoes/SugestaoCard';
import type { RecipeIngredient } from '../db/types';

export function SemanaScreen() {
  const semana = chaveSemana(new Date());
  const cardapio = useLiveQuery(() => db.weekRecipes.where('semana').equals(semana).toArray(), [semana]);
  const receitas = useLiveQuery(async () => new Map((await db.recipes.toArray()).map((r) => [r.id, r])), []);
  const sobras = useLiveQuery(() => marmitas(), []);
  const sugestoes = useLiveQuery(() => carregarSugestoes(), []);
  // cobertura da despensa para cada receita da semana, nas porções planejadas
  const coberturas = useLiveQuery(async () => {
    const [ws, linhas, catalogo, despensa, recs] = await Promise.all([
      db.weekRecipes.where('semana').equals(semana).toArray(),
      db.recipeIngredients.toArray(),
      db.ingredients.toArray(),
      db.pantry.toArray(),
      db.recipes.toArray(),
    ]);
    const porReceita = new Map<string, RecipeIngredient[]>();
    for (const l of linhas) porReceita.set(l.recipeId, [...(porReceita.get(l.recipeId) ?? []), l]);
    const cat = new Map(catalogo.map((i) => [i.id, i]));
    const desp = new Map(despensa.map((p) => [p.ingredientId, p]));
    const porcoesDe = new Map(recs.map((r) => [r.id, r.porcoes]));
    const m = new Map<string, Cobertura>();
    for (const w of ws) m.set(w.id, calcularCobertura(porReceita.get(w.recipeId) ?? [], porcoesDe.get(w.recipeId) ?? w.porcoes, w.porcoes, cat, desp));
    return m;
  }, [semana]);

  if (!cardapio || !receitas || !sobras) return <TabHeader title="Esta semana" eyebrow={rotuloSemana(new Date())} />;

  const ativos = cardapio.filter((w) => w.status !== 'removida');
  const aFazer = ativos.filter((w) => w.status === 'a_fazer');
  const feitas = ativos.filter((w) => w.status === 'feita');
  const titulo = (id: string) => receitas.get(id)?.titulo ?? 'Receita apagada';
  const ordenar = (a: WeekRecipe, b: WeekRecipe) => titulo(a.recipeId).localeCompare(titulo(b.recipeId), 'pt-BR');
  const totalMarmitas = sobras.reduce((s, m) => s + m.porcoesRestantes, 0);

  return (
    <>
      <TabHeader title="Esta semana" eyebrow={rotuloSemana(new Date())} />
      <main className="view">
        {sobras.length > 0 && (
          <section className="sec">
            <div className="sec-h">
              <h2>Marmitas na geladeira</h2>
              <span className="meta">{plural(totalMarmitas, 'porção', 'porções')}</span>
            </div>
            <div className="card">
              <div className="list">
                {sobras.map((m) => (
                  <div className="li" key={m.id}>
                    <Icon name="bowl" />
                    <div className="grow">
                      <div className="name">
                        {plural(m.porcoesRestantes, 'porção', 'porções')} de {titulo(m.recipeId).toLowerCase()}
                      </div>
                      <div className="sub">feita {new Date(m.feitaEm).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
                    </div>
                    <button type="button" className="tool" onClick={() => window.confirm('Jogar fora o resto dessa marmita?') && void descartarMarmita(m.id)} aria-label={`Descartar marmita de ${titulo(m.recipeId)}`}>
                      <Icon name="trash" />
                    </button>
                    <button type="button" className="btn ghost sm" onClick={() => void comerMarmita(m.id)}>
                      Comi uma
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {!ativos.length ? (
          <EmptyState
            icon="week"
            title="Nenhuma receita nesta semana"
            action={
              <Link className="btn" to="/planejar?s=atual">
                <Icon name="plus" />
                Montar o cardápio
              </Link>
            }
          >
            Escolha as receitas da semana e o app monta a lista de compras descontando o que já tem na despensa.
          </EmptyState>
        ) : (
          <>
            <section className="sec">
              <div className="sec-h">
                <h2>A fazer</h2>
                <span className="meta">{aFazer.length ? `${aFazer.length} de ${ativos.length}` : ''}</span>
              </div>
              {aFazer.length ? (
                <div className="recipe-list">
                  {aFazer.sort(ordenar).map((w) => {
                    const r = receitas.get(w.recipeId);
                    return (
                      <div className="card rcard week-card" key={w.id}>
                        <RecipeThumb capaId={r?.capaFotoId ?? null} />
                        <div className="grow">
                          <Link className="rtitle plain" to={r ? `/receitas/${r.id}` : '#'}>
                            {titulo(w.recipeId)}
                          </Link>
                          <div className="rmeta">
                            <span>
                              <Icon name="people" />
                              {plural(w.porcoes, 'porção', 'porções')}
                            </span>
                            {r?.tempoMin != null && (
                              <span>
                                <Icon name="clock" />
                                {r.tempoMin} min
                              </span>
                            )}
                          </div>
                          {coberturas?.get(w.id) && (
                            <div className="metas">
                              <CoberturaChip s={{ cobertura: coberturas.get(w.id)! }} />
                              {coberturas.get(w.id)!.faltantes.length > 0 && (
                                <span className="sub">{coberturas.get(w.id)!.faltantes.map((f) => f.nome.toLowerCase()).join(', ')}</span>
                              )}
                            </div>
                          )}
                          {r && (
                            <div className="row-btns week-actions">
                              <Link className="btn sm" to={`/cozinhar/${r.id}?w=${w.id}`}>
                                <Icon name="pot" />
                                Cozinhar
                              </Link>
                              <Link className="btn ghost sm" to={`/cozinhar/${r.id}/finalizar?w=${w.id}`}>
                                Já fiz
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="card empty-state">
                  <span className="badge-ic ok">
                    <Icon name="check" />
                  </span>
                  <h2>Tudo feito</h2>
                  <p>Todas as receitas desta semana já foram feitas.</p>
                </div>
              )}
            </section>

            {feitas.length > 0 && (
              <section className="sec">
                <div className="sec-h">
                  <h2>Feitas</h2>
                  <span className="meta">{feitas.length}</span>
                </div>
                <div className="card">
                  <div className="list">
                    {feitas.sort(ordenar).map((w) => (
                      <div className="li" key={w.id}>
                        <span className="chip ok">
                          <Icon name="check" />
                          feita
                        </span>
                        <div className="grow">
                          <div className="name">{titulo(w.recipeId)}</div>
                          <div className="sub">{plural(w.porcoes, 'porção', 'porções')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            <Link className="btn ghost block" to="/planejar?s=atual">
              Editar cardápio e lista desta semana
            </Link>
          </>
        )}
        {sugestoes && sugestoes.length > 0 && <DaPraFazer sugestoes={sugestoes} naSemana={new Set(aFazer.map((w) => w.recipeId))} />}
      </main>
    </>
  );
}

function DaPraFazer({ sugestoes, naSemana }: { sugestoes: Awaited<ReturnType<typeof carregarSugestoes>>; naSemana: Set<string> }) {
  const livres = sugestoes.filter((s) => !s.naoFariaDeNovo && !naSemana.has(s.recipe.id));
  const prontas = livres.filter((s) => s.faixa === 'pronta');
  const quase = livres.filter((s) => s.faixa === 'quase');
  const mostrar = (prontas.length ? prontas : quase).slice(0, 3);
  return (
    <section className="sec">
      <div className="sec-h">
        <h2>Dá pra fazer agora</h2>
        <Link className="meta" to="/sugestoes">
          ver todas
        </Link>
      </div>
      {!prontas.length && (
        <p className="muted small">
          {quase.length ? 'Nenhuma receita com tudo em casa. Estas estão a 1 ou 2 itens:' : 'Nenhuma receita do livro dá para fazer com a despensa de agora.'}
        </p>
      )}
      {mostrar.length > 0 && (
        <div className="recipe-list">
          {mostrar.map((s) => (
            <SugestaoCard key={s.recipe.id} s={s} compacto />
          ))}
        </div>
      )}
    </section>
  );
}
