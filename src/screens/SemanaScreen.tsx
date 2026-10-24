import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { EmptyState, TabHeader } from '../components/Layout';
import { RecipeThumb } from '../components/RecipeThumb';
import { db } from '../db/db';
import type { WeekRecipe } from '../db/types';
import { chaveSemana, rotuloSemana } from '../lib/dates';
import { plural } from '../lib/text';
import { FeitaSheet } from './planejar/FeitaSheet';

export function SemanaScreen() {
  const semana = chaveSemana(new Date());
  const cardapio = useLiveQuery(() => db.weekRecipes.where('semana').equals(semana).toArray(), [semana]);
  const receitas = useLiveQuery(async () => new Map((await db.recipes.toArray()).map((r) => [r.id, r])), []);
  const [fazendo, setFazendo] = useState<WeekRecipe | null>(null);

  if (!cardapio || !receitas) return <TabHeader title="Esta semana" eyebrow={rotuloSemana(new Date())} />;

  const ativos = cardapio.filter((w) => w.status !== 'removida');
  const aFazer = ativos.filter((w) => w.status === 'a_fazer');
  const feitas = ativos.filter((w) => w.status === 'feita');
  const titulo = (w: WeekRecipe) => receitas.get(w.recipeId)?.titulo ?? 'Receita apagada';
  const ordenar = (a: WeekRecipe, b: WeekRecipe) => titulo(a).localeCompare(titulo(b), 'pt-BR');

  return (
    <>
      <TabHeader title="Esta semana" eyebrow={rotuloSemana(new Date())} />
      <main className="view">
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
                            {titulo(w)}
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
                          <button type="button" className="btn ghost sm" onClick={() => setFazendo(w)} disabled={!r}>
                            <Icon name="check" />
                            Marcar como feita
                          </button>
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
                          <div className="name">{titulo(w)}</div>
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
      </main>
      {fazendo && <FeitaSheet w={fazendo} onClose={() => setFazendo(null)} />}
    </>
  );
}
