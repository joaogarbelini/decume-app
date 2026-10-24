import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCatalogo } from '../../components/hooks';
import { Icon } from '../../components/Icon';
import { SubHeader } from '../../components/Layout';
import { iniciarSessao, marcarPassos } from '../../db/cook';
import { db } from '../../db/db';
import { carregarReceita } from '../../db/recipes';
import type { CookSession } from '../../db/types';
import { plural } from '../../lib/text';
import { formatMedida } from '../../lib/units';

// Evita criar duas sessões quando o efeito roda duas vezes (modo estrito do React).
const sessoesEmAndamento = new Map<string, Promise<CookSession>>();
function sessaoUnica(recipeId: string, weekRecipeId: string | null): Promise<CookSession> {
  const k = `${recipeId}|${weekRecipeId ?? ''}`;
  let p = sessoesEmAndamento.get(k);
  if (!p) {
    p = iniciarSessao(recipeId, weekRecipeId).finally(() => setTimeout(() => sessoesEmAndamento.delete(k), 1000));
    sessoesEmAndamento.set(k, p);
  }
  return p;
}

/** Mantém a tela acesa enquanto o modo cozinhar está aberto (quando o navegador deixa). */
function useTelaAcesa(): boolean {
  const [ativa, setAtiva] = useState(false);
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let vivo = true;
    async function pedir() {
      try {
        if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
        lock = await navigator.wakeLock.request('screen');
        if (!vivo) return void lock.release();
        setAtiva(true);
        lock.addEventListener('release', () => vivo && setAtiva(false));
      } catch {
        setAtiva(false);
      }
    }
    pedir();
    const onVis = () => document.visibilityState === 'visible' && pedir();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      vivo = false;
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => undefined);
    };
  }, []);
  return ativa;
}

export function CozinharScreen() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const weekRecipeId = params.get('w');
  const navigate = useNavigate();
  const catalogo = useCatalogo();
  const dados = useLiveQuery(async () => (await carregarReceita(id)) ?? null, [id]);
  const semana = useLiveQuery(async () => (weekRecipeId ? ((await db.weekRecipes.get(weekRecipeId)) ?? null) : null), [weekRecipeId]);
  const [sessao, setSessao] = useState<CookSession | null>(null);
  const [porcoesLivre, setPorcoesLivre] = useState<number | null>(null);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [passos, setPassos] = useState<Set<number>>(new Set());
  const telaAcesa = useTelaAcesa();

  useEffect(() => {
    if (!id) return;
    sessaoUnica(id, weekRecipeId).then((s) => {
      setSessao(s);
      setPassos(new Set(s.passosMarcados));
    });
  }, [id, weekRecipeId]);

  const porcoes = semana?.porcoes ?? porcoesLivre ?? dados?.recipe.porcoes ?? 2;
  const fator = dados ? porcoes / dados.recipe.porcoes : 1;
  const proximo = useMemo(() => (dados ? dados.passos.findIndex((_, i) => !passos.has(i)) : -1), [dados, passos]);

  if (dados === null) return <Navigate to="/receitas" replace />;
  if (!dados || !catalogo || semana === undefined) return <SubHeader title="Cozinhar" />;
  const { recipe: r, ingredientes } = dados;

  function alternarPasso(i: number) {
    const novo = new Set(passos);
    if (novo.has(i)) novo.delete(i);
    else novo.add(i);
    setPassos(novo);
    if (sessao) void marcarPassos(sessao.id, [...novo]);
  }

  function alternarIngrediente(i: number) {
    const novo = new Set(marcados);
    if (novo.has(i)) novo.delete(i);
    else novo.add(i);
    setMarcados(novo);
  }

  const finalizarUrl = `/cozinhar/${r.id}/finalizar?${new URLSearchParams({ ...(weekRecipeId ? { w: weekRecipeId } : {}), ...(sessao ? { s: sessao.id } : {}), p: String(porcoes) })}`;

  return (
    <>
      <SubHeader
        title={r.titulo}
        right={
          telaAcesa ? (
            <span className="chip neu" title="A tela não apaga enquanto cozinha">
              <Icon name="sun" />
              tela acesa
            </span>
          ) : undefined
        }
      />
      <main className="view cook">
        <section className="sec">
          <div className="sec-h">
            <h2>Ingredientes</h2>
            {semana ? (
              <span className="meta">{plural(porcoes, 'porção', 'porções')}</span>
            ) : (
              <div className="stepper" aria-label="Porções">
                <button type="button" onClick={() => setPorcoesLivre(Math.max(1, porcoes - 1))} disabled={porcoes <= 1} aria-label="Menos uma porção">
                  <Icon name="minus" />
                </button>
                <span>{plural(porcoes, 'porção', 'porções')}</span>
                <button type="button" onClick={() => setPorcoesLivre(porcoes + 1)} aria-label="Mais uma porção">
                  <Icon name="plus" />
                </button>
              </div>
            )}
          </div>
          <div className="card">
            <div className="list">
              {ingredientes.map((l, i) => {
                const ing = l.ingredientId ? catalogo.get(l.ingredientId) : undefined;
                const ok = marcados.has(i);
                return (
                  <button type="button" key={l.id} className={`li check-li ${ok ? 'done' : ''}`} onClick={() => alternarIngrediente(i)} aria-pressed={ok}>
                    <span className={`checkcircle ${ok ? 'on' : ''}`}>{ok && <Icon name="check" />}</span>
                    <span className="qty">{l.aGosto ? 'a gosto' : formatMedida(l.quantidade != null ? l.quantidade * fator : null, l.unidade)}</span>
                    <span className="grow">
                      <span className="name">{ing?.nome ?? l.textoOriginal}</span>
                      {l.observacao && <span className="sub"> · {l.observacao}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="sec-h">
            <h2>Passo a passo</h2>
            <span className="meta">
              {passos.size} de {dados.passos.length}
            </span>
          </div>
          <ol className="steps cook-steps">
            {dados.passos.map((s, i) => (
              <li key={i}>
                <button type="button" className={`step-btn ${passos.has(i) ? 'done' : ''} ${i === proximo ? 'atual' : ''}`} onClick={() => alternarPasso(i)} aria-pressed={passos.has(i)}>
                  <span className="sn">{passos.has(i) ? <Icon name="check" /> : i + 1}</span>
                  <span>{s}</span>
                </button>
              </li>
            ))}
          </ol>
          {!dados.passos.length && <p className="muted">Essa receita não tem passos cadastrados.</p>}
        </section>
      </main>
      <div className="savebar">
        <button type="button" className="btn block" onClick={() => navigate(finalizarUrl)}>
          <Icon name="check" />
          Terminei: finalizar
        </button>
      </div>
    </>
  );
}
