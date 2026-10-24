import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalogo } from '../../components/hooks';
import { Icon } from '../../components/Icon';
import { RecipeThumb } from '../../components/RecipeThumb';
import { Sheet } from '../../components/Sheet';
import { db } from '../../db/db';
import type { RecipeIngredient } from '../../db/types';
import { adicionarNaSemana } from '../../db/week';
import { ehVegetariana } from '../../lib/nutrition';
import { casaBusca, plural } from '../../lib/text';

/** Escolher receitas do livro para a semana. Fica aberto para adicionar várias. */
export function AdicionarReceitaSheet({ semana, rotulo, onClose }: { semana: string; rotulo: string; onClose: () => void }) {
  const receitas = useLiveQuery(() => db.recipes.where('status').equals('minha').sortBy('titulo'), []);
  const naSemana = useLiveQuery(() => db.weekRecipes.where('semana').equals(semana).toArray(), [semana]);
  const linhas = useLiveQuery(() => db.recipeIngredients.toArray(), []);
  const catalogo = useCatalogo();
  const [busca, setBusca] = useState('');

  const veg = useMemo(() => {
    const porReceita = new Map<string, RecipeIngredient[]>();
    for (const l of linhas ?? []) porReceita.set(l.recipeId, [...(porReceita.get(l.recipeId) ?? []), l]);
    return (id: string) => (catalogo ? ehVegetariana(porReceita.get(id) ?? [], catalogo) : false);
  }, [linhas, catalogo]);

  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of naSemana ?? []) if (w.status !== 'removida') m.set(w.recipeId, (m.get(w.recipeId) ?? 0) + 1);
    return m;
  }, [naSemana]);

  const visiveis = (receitas ?? []).filter((r) => casaBusca(busca, r.titulo, ...r.tags));

  return (
    <Sheet title={`Receitas para ${rotulo}`} onClose={onClose} footer={<button type="button" className="btn ghost block" onClick={onClose}>Pronto</button>}>
      {receitas && !receitas.length ? (
        <div className="card empty-state">
          <p>Seu livro ainda não tem receitas.</p>
          <Link className="btn" to="/receitas/nova">
            <Icon name="plus" />
            Nova receita
          </Link>
        </div>
      ) : (
        <>
          <label className="search">
            <Icon name="search" />
            <input type="search" placeholder="Buscar receita ou tag" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar receita" />
          </label>
          <div className="list pick-list">
            {visiveis.map((r) => {
              const n = contagem.get(r.id) ?? 0;
              return (
                <button type="button" className="li pick add-rec" key={r.id} onClick={() => void adicionarNaSemana(semana, r.id)} aria-label={`Adicionar ${r.titulo}`}>
                  <RecipeThumb capaId={r.capaFotoId} size={48} />
                  <div className="grow">
                    <div className="name">
                      {r.titulo} {veg(r.id) && <Icon name="leaf" title="Vegetariana" />}
                    </div>
                    <div className="sub">
                      {plural(r.porcoes, 'porção', 'porções')}
                      {r.tempoMin ? ` · ${r.tempoMin} min` : ''}
                    </div>
                  </div>
                  {n > 0 ? (
                    <span className="chip ok">
                      <Icon name="check" />
                      {n > 1 ? `${n}×` : 'na semana'}
                    </span>
                  ) : (
                    <Icon name="plus" />
                  )}
                </button>
              );
            })}
            {!visiveis.length && <p className="muted small pick-empty">Nenhuma receita com "{busca}".</p>}
          </div>
        </>
      )}
    </Sheet>
  );
}
