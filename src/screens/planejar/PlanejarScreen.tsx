import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCatalogo } from '../../components/hooks';
import { Icon } from '../../components/Icon';
import { IngredientPicker } from '../../components/IngredientPicker';
import { TabHeader } from '../../components/Layout';
import { RecipeThumb } from '../../components/RecipeThumb';
import { db } from '../../db/db';
import { SECOES, type Recipe, type WeekRecipe } from '../../db/types';
import {
  adicionarAvulso,
  alterarPorcoes,
  avulsosComprados,
  carregarLista,
  comprarAvulso,
  comprasDaLista,
  desfazerAvulso,
  desfazerCompra,
  limparAvulsosComprados,
  passarParaSemana,
  pendentesAnteriores,
  removerDaSemana,
  tirarDoCardapio,
} from '../../db/week';
import { chaveSemana, proximaSemana, rotuloSemana } from '../../lib/dates';
import type { LinhaLista } from '../../lib/shopping';
import { plural } from '../../lib/text';
import { formatEstoque } from '../../lib/units';
import { textoMovimento } from '../despensa/MovimentoLinha';
import { AdicionarReceitaSheet } from './AdicionarReceitaSheet';
import { CompraSheet } from './CompraSheet';

export function PlanejarScreen() {
  const [params, setParams] = useSearchParams();
  const qual = params.get('s') === 'atual' ? 'atual' : 'proxima';
  const hoje = new Date();
  const semanaAtual = chaveSemana(hoje);
  const semana = qual === 'atual' ? semanaAtual : chaveSemana(proximaSemana(hoje));
  const rotulo = qual === 'atual' ? `esta semana` : `a próxima semana`;
  const rotuloDatas = rotuloSemana(qual === 'atual' ? hoje : proximaSemana(hoje));

  const catalogo = useCatalogo();
  const receitas = useLiveQuery(async () => new Map((await db.recipes.toArray()).map((r) => [r.id, r])), []);
  const cardapio = useLiveQuery(() => db.weekRecipes.where('semana').equals(semana).toArray(), [semana]);
  const pendentes = useLiveQuery(() => pendentesAnteriores(semanaAtual), [semanaAtual]);
  const lista = useLiveQuery(() => carregarLista(semana), [semana]);
  const compras = useLiveQuery(() => comprasDaLista(semana), [semana]);
  const textosComprados = useLiveQuery(() => avulsosComprados(), []);

  const [adicionandoReceita, setAdicionandoReceita] = useState(false);
  const [adicionandoAvulso, setAdicionandoAvulso] = useState(false);
  const [comprando, setComprando] = useState<LinhaLista | null>(null);
  const [verComprados, setVerComprados] = useState(false);

  const grupos = useMemo(() => {
    const linhas = lista?.linhas ?? [];
    return [...SECOES, 'Outros' as const].map((s) => [s, linhas.filter((l) => l.secao === s)] as const).filter(([, l]) => l.length);
  }, [lista]);

  if (!catalogo || !receitas || !cardapio || !lista) return <TabHeader title="Planejar" eyebrow={rotuloDatas} />;

  const ativos = cardapio.filter((w) => w.status !== 'removida').sort((a, b) => (receitas.get(a.recipeId)?.titulo ?? '').localeCompare(receitas.get(b.recipeId)?.titulo ?? '', 'pt-BR'));
  const deOutrasSemanas = lista.receitasConsideradas.filter((w) => w.semana !== semana).length;
  const totalComprados = (compras?.length ?? 0) + (textosComprados?.length ?? 0);

  return (
    <>
      <TabHeader title="Planejar" eyebrow={rotuloDatas} />
      <main className="view">
        <div className="seg" role="radiogroup" aria-label="Semana">
          <button type="button" role="radio" aria-checked={qual === 'atual'} className={qual === 'atual' ? 'on' : ''} onClick={() => setParams({ s: 'atual' }, { replace: true })}>
            Esta semana
          </button>
          <button type="button" role="radio" aria-checked={qual === 'proxima'} className={qual === 'proxima' ? 'on' : ''} onClick={() => setParams({}, { replace: true })}>
            Próxima semana
          </button>
        </div>

        {pendentes && pendentes.length > 0 && (
          <section className="card pad review" aria-label="Receitas que ficaram a fazer">
            <h2>{plural(pendentes.length, 'receita ficou', 'receitas ficaram')} a fazer</h2>
            <p className="muted small">
              De semanas que já passaram. <strong>Fiz</strong> dá baixa na despensa; <strong>Adiar</strong> passa para {rotulo} ({rotuloDatas});{' '}
              <strong>Tirar</strong> libera os ingredientes.
            </p>
            {pendentes.map((w) => {
              const r = receitas.get(w.recipeId);
              return (
                <div className="review-item" key={w.id}>
                  <div className="name">{r?.titulo ?? 'Receita apagada'}</div>
                  <div className="row-btns">
                    <Link className={`btn ghost sm ${r ? '' : 'disabled'}`} to={r ? `/cozinhar/${r.id}/finalizar?w=${w.id}` : '#'}>
                      Fiz
                    </Link>
                    <button type="button" className="btn ghost sm" onClick={() => void passarParaSemana(w.id, semana)}>
                      Adiar
                    </button>
                    <button type="button" className="btn ghost sm" onClick={() => void tirarDoCardapio(w.id)}>
                      Tirar
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        <section className="sec">
          <div className="sec-h">
            <h2>Cardápio</h2>
            <span className="meta">{ativos.length ? plural(ativos.length, 'receita', 'receitas') : ''}</span>
          </div>
          {ativos.length ? (
            <div className="card">
              <div className="list">
                {ativos.map((w) => (
                  <CardapioLinha key={w.id} w={w} r={receitas.get(w.recipeId)} />
                ))}
              </div>
            </div>
          ) : (
            <p className="muted small">Nenhuma receita para {rotulo} ainda.</p>
          )}
          <button type="button" className="btn block" onClick={() => setAdicionandoReceita(true)}>
            <Icon name="plus" />
            Adicionar receita
          </button>
        </section>

        <section className="sec">
          <div className="sec-h">
            <h2>Lista de compras</h2>
            <span className="meta">{lista.linhas.length ? plural(lista.linhas.length, 'item', 'itens') : ''}</span>
          </div>
          {deOutrasSemanas > 0 && (
            <p className="note">
              <Icon name="info" />
              <span>Também conta {plural(deOutrasSemanas, 'receita ainda a fazer', 'receitas ainda a fazer')} de semanas anteriores, que vão usar a despensa.</span>
            </p>
          )}
          {lista.lembretes.length > 0 && (
            <p className="note">
              <Icon name="info" />
              <span>Confira se tem: {lista.lembretes.join(', ').toLowerCase()}.</span>
            </p>
          )}
          {!lista.linhas.length && (
            <div className="card empty-state">
              <span className="badge-ic ok">
                <Icon name="check" />
              </span>
              <h2>Nada para comprar</h2>
              <p>{ativos.length ? 'A despensa cobre o cardápio e nenhum básico está acabando.' : 'Adicione receitas ao cardápio e a lista aparece aqui, já descontando a despensa.'}</p>
            </div>
          )}
          {grupos.map(([secao, linhas]) => (
            <div className="shop-group" key={secao}>
              <h3 className="shop-h">{secao}</h3>
              <div className="card">
                <div className="list">
                  {linhas.map((l) => (
                    <ItemLista key={l.chave} l={l} onComprar={() => (l.origem === 'avulso' && !l.ingredientId ? void comprarAvulso(l.avulsoId!, null, semana) : setComprando(l))} />
                  ))}
                </div>
              </div>
            </div>
          ))}
          <button type="button" className="btn ghost block" onClick={() => setAdicionandoAvulso(true)}>
            <Icon name="plus" />
            Item avulso
          </button>
        </section>

        {totalComprados > 0 && (
          <section className="sec">
            <button type="button" className="sec-h toggle-h" onClick={() => setVerComprados(!verComprados)} aria-expanded={verComprados}>
              <h2>Comprados</h2>
              <span className="meta">
                {totalComprados} <Icon name={verComprados ? 'up' : 'down'} />
              </span>
            </button>
            {verComprados && (
              <div className="card">
                <div className="list">
                  {compras?.map((m) => {
                    const ing = catalogo.get(m.ingredientId);
                    return (
                      <div className="li bought" key={m.id}>
                        <Icon name="check" />
                        <div className="grow">
                          <div className="name">{ing?.nome ?? m.ingredientId}</div>
                          <div className="sub">{textoMovimento(m, ing)} na despensa</div>
                        </div>
                        <button type="button" className="btn ghost sm" onClick={() => void desfazerCompra(m.id!)}>
                          Desfazer
                        </button>
                      </div>
                    );
                  })}
                  {textosComprados?.map((a) => (
                    <div className="li bought" key={a.id}>
                      <Icon name="check" />
                      <div className="grow">
                        <div className="name">{a.textoLivre}</div>
                      </div>
                      <button type="button" className="btn ghost sm" onClick={() => void desfazerAvulso(a.id)}>
                        Desfazer
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {verComprados && (textosComprados?.length ?? 0) > 0 && (
              <button type="button" className="btn ghost sm" onClick={() => void limparAvulsosComprados()}>
                Limpar avulsos comprados
              </button>
            )}
          </section>
        )}
      </main>

      {adicionandoReceita && <AdicionarReceitaSheet semana={semana} rotulo={rotulo} onClose={() => setAdicionandoReceita(false)} />}
      {adicionandoAvulso && (
        <IngredientPicker
          catalogo={catalogo}
          titulo="Item avulso"
          incluir={(i) => !i.sempreTenho}
          onPick={async (i) => {
            await adicionarAvulso({ ingredientId: i.id, textoLivre: null, quantidade: null });
            setAdicionandoAvulso(false);
          }}
          onTextoLivre={async (t) => {
            await adicionarAvulso({ ingredientId: null, textoLivre: t, quantidade: null });
            setAdicionandoAvulso(false);
          }}
          onClose={() => setAdicionandoAvulso(false)}
        />
      )}
      {comprando && <CompraSheet linha={comprando} ing={comprando.ingredientId ? catalogo.get(comprando.ingredientId) : undefined} semana={semana} onClose={() => setComprando(null)} />}
    </>
  );
}

function CardapioLinha({ w, r }: { w: WeekRecipe; r: Recipe | undefined }) {
  const feita = w.status === 'feita';
  return (
    <div className="li week-li">
      <RecipeThumb capaId={r?.capaFotoId ?? null} size={52} />
      <div className="grow">
        <Link className="name plain" to={r ? `/receitas/${r.id}` : '#'}>
          {r?.titulo ?? 'Receita apagada'}
        </Link>
        <div className="metas">
          {feita ? (
            <span className="chip ok">
              <Icon name="check" />
              feita
            </span>
          ) : (
            <div className="stepper sm" aria-label="Porções">
              <button type="button" onClick={() => void alterarPorcoes(w.id, w.porcoes - 1)} disabled={w.porcoes <= 1} aria-label={`Menos uma porção de ${r?.titulo}`}>
                <Icon name="minus" />
              </button>
              <span>{plural(w.porcoes, 'porção', 'porções')}</span>
              <button type="button" onClick={() => void alterarPorcoes(w.id, w.porcoes + 1)} aria-label={`Mais uma porção de ${r?.titulo}`}>
                <Icon name="plus" />
              </button>
            </div>
          )}
          {w.veioDeSemana && !feita && <span className="chip neu">da semana passada</span>}
        </div>
      </div>
      {!feita && (
        <button type="button" className="tool" onClick={() => void removerDaSemana(w.id)} aria-label={`Tirar ${r?.titulo} do cardápio`}>
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}

function ItemLista({ l, onComprar }: { l: LinhaLista; onComprar: () => void }) {
  let detalhe: string;
  if (l.origem === 'nivel') detalhe = l.nivel === 'acabou' ? 'acabou' : 'está no fim';
  else if (l.origem === 'avulso') detalhe = l.quantidadeAvulso && l.unidadeBase ? formatEstoque(l.quantidadeAvulso, l.unidadeBase) : 'avulso';
  else if (l.falta != null && l.falta > 0 && l.unidadeBase) detalhe = `falta ${formatEstoque(l.falta, l.unidadeBase)}`;
  else detalhe = 'quantidade sem conversão';
  const para = l.receitas.length ? ` · ${l.receitas.join(', ')}` : '';
  return (
    <button type="button" className="li shop-li" onClick={onComprar} aria-label={`Comprei ${l.nome}`}>
      <span className="checkcircle" aria-hidden="true" />
      <div className="grow">
        <div className="name">{l.nome}</div>
        <div className="sub">
          <span className={l.origem === 'nivel' && l.nivel === 'acabou' ? 'miss-text' : ''}>{detalhe}</span>
          {para}
        </div>
      </div>
    </button>
  );
}
