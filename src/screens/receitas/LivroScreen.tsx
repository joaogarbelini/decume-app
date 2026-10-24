import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalogo, useFotoUrl } from '../../components/hooks';
import { Icon } from '../../components/Icon';
import { EmptyState, TabHeader } from '../../components/Layout';
import { db } from '../../db/db';
import type { Recipe, RecipeIngredient } from '../../db/types';
import { calcularNutricao, ehVegetariana } from '../../lib/nutrition';
import { resumosPorReceita } from '../../db/cook';
import { Nota } from '../../components/Stars';
import { casaBusca, plural } from '../../lib/text';

const VEG = '__veg__';
const BOAS = '__boas__';

export function LivroScreen() {
  const receitas = useLiveQuery(() => db.recipes.orderBy('titulo').toArray(), []);
  const linhas = useLiveQuery(() => db.recipeIngredients.toArray(), []);
  const catalogo = useCatalogo();
  const notas = useLiveQuery(() => resumosPorReceita(), []);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<string | null>(null);

  const porReceita = useMemo(() => {
    const m = new Map<string, RecipeIngredient[]>();
    for (const l of linhas ?? []) m.set(l.recipeId, [...(m.get(l.recipeId) ?? []), l]);
    return m;
  }, [linhas]);

  const info = useMemo(() => {
    const m = new Map<string, { veg: boolean; kcal: number | null; parcial: boolean }>();
    if (!receitas || !catalogo) return m;
    for (const r of receitas) {
      const ls = porReceita.get(r.id) ?? [];
      const n = calcularNutricao(ls, catalogo, r.porcoes);
      m.set(r.id, { veg: ehVegetariana(ls, catalogo), kcal: ls.length ? n.porPorcao.kcal : null, parcial: n.parcial });
    }
    return m;
  }, [receitas, catalogo, porReceita]);

  const tags = useMemo(() => [...new Set((receitas ?? []).flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [receitas]);
  const temVeg = useMemo(() => [...info.values()].some((i) => i.veg), [info]);
  const temBoas = useMemo(() => [...(notas?.values() ?? [])].some((n) => n.nota >= 4), [notas]);

  const visiveis = useMemo(
    () =>
      (receitas ?? []).filter((r) => {
        if (filtro === VEG && !info.get(r.id)?.veg) return false;
        if (filtro === BOAS && (notas?.get(r.id)?.nota ?? 0) < 4) return false;
        if (filtro && filtro !== VEG && filtro !== BOAS && !r.tags.includes(filtro)) return false;
        return casaBusca(busca, r.titulo, ...r.tags);
      }),
    [receitas, filtro, busca, info, notas],
  );

  if (!receitas) return <TabHeader title="Receitas" eyebrow="Seu livro" />;

  return (
    <>
      <TabHeader title="Receitas" eyebrow={receitas.length ? `Seu livro · ${plural(receitas.length, 'receita', 'receitas')}` : 'Seu livro'} />
      <main className="view">
        {!receitas.length ? (
          <EmptyState
            icon="book"
            title="Seu livro de receitas está vazio"
            action={
              <div className="row-btns">
                <Link className="btn" to="/receitas/nova">
                  <Icon name="plus" />
                  Nova receita
                </Link>
                <Link className="btn ghost" to="/receitas/importar">
                  <Icon name="link" />
                  Importar
                </Link>
              </div>
            }
          >
            Cadastre suas receitas com ingredientes e passos. O app calcula calorias e macros por porção e marca as vegetarianas.
          </EmptyState>
        ) : (
          <>
            <div className="row-btns">
              <Link className="btn" to="/receitas/nova">
                <Icon name="plus" />
                Nova receita
              </Link>
              <Link className="btn ghost" to="/receitas/importar">
                <Icon name="link" />
                Importar
              </Link>
            </div>
            <div className="filters">
              <label className="search">
                <Icon name="search" />
                <input type="search" placeholder="Buscar receita ou tag" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar receita" />
              </label>
              {(temVeg || temBoas || tags.length > 0) && (
                <div className="chip-row" role="group" aria-label="Filtrar">
                  <button type="button" className={`fchip ${filtro === null ? 'on' : ''}`} aria-pressed={filtro === null} onClick={() => setFiltro(null)}>
                    Todas
                  </button>
                  {temVeg && (
                    <button type="button" className={`fchip ${filtro === VEG ? 'on' : ''}`} aria-pressed={filtro === VEG} onClick={() => setFiltro(filtro === VEG ? null : VEG)}>
                      <Icon name="leaf" />
                      Vegetarianas
                    </button>
                  )}
                  {temBoas && (
                    <button type="button" className={`fchip ${filtro === BOAS ? 'on' : ''}`} aria-pressed={filtro === BOAS} onClick={() => setFiltro(filtro === BOAS ? null : BOAS)}>
                      <Icon name="star" />
                      Nota 4+
                    </button>
                  )}
                  {tags.map((t) => (
                    <button type="button" key={t} className={`fchip ${filtro === t ? 'on' : ''}`} aria-pressed={filtro === t} onClick={() => setFiltro(filtro === t ? null : t)}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="recipe-list">
              {visiveis.map((r) => (
                <RecipeCard key={r.id} r={r} info={info.get(r.id)} nota={notas?.get(r.id)?.nota} />
              ))}
              {!visiveis.length && <div className="card empty-state"><p>Nenhuma receita com esse filtro.</p></div>}
            </div>
          </>
        )}
      </main>
    </>
  );
}

function RecipeCard({ r, info, nota }: { r: Recipe; info?: { veg: boolean; kcal: number | null; parcial: boolean }; nota?: number }) {
  const url = useFotoUrl(r.capaFotoId);
  return (
    <Link className="card rcard" to={`/receitas/${r.id}`}>
      <div className="thumb">{url ? <img src={url} alt="" /> : <Icon name="bowl" />}</div>
      <div className="grow">
        <div className="rtitle">{r.titulo}</div>
        <div className="rmeta">
          {r.tempoMin != null && (
            <span>
              <Icon name="clock" />
              {r.tempoMin} min
            </span>
          )}
          <span>
            <Icon name="people" />
            {plural(r.porcoes, 'porção', 'porções')}
          </span>
          {info?.kcal != null && (
            <span>
              {info.parcial ? '~' : ''}
              {Math.round(info.kcal)} kcal/porção
            </span>
          )}
        </div>
        <div className="metas">
          {nota != null && <Nota valor={nota} />}
          {r.status === 'rascunho' && <span className="chip miss">rascunho</span>}
          {info?.veg && (
            <span className="chip ok">
              <Icon name="leaf" />
              Vegetariana
            </span>
          )}
          {r.tags.slice(0, 3).map((t) => (
            <span className="chip neu" key={t}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
