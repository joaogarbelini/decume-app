import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useCatalogo, useFotoUrl } from '../../components/hooks';
import { Icon } from '../../components/Icon';
import { SubHeader } from '../../components/Layout';
import { carregarReceita } from '../../db/recipes';
import type { Nutri100g } from '../../db/types';
import { calcularNutricao, ehVegetariana } from '../../lib/nutrition';
import { plural } from '../../lib/text';
import { formatMedida } from '../../lib/units';
import { PhotoGallery, useAdicionarFotos } from './PhotoGallery';

const NUTRIENTES: { k: keyof Nutri100g; nome: string; un: string; casas: number }[] = [
  { k: 'kcal', nome: 'Calorias', un: 'kcal', casas: 0 },
  { k: 'proteina', nome: 'Proteína', un: 'g', casas: 1 },
  { k: 'carboidrato', nome: 'Carboidrato', un: 'g', casas: 1 },
  { k: 'gordura', nome: 'Gordura', un: 'g', casas: 1 },
  { k: 'fibra', nome: 'Fibra', un: 'g', casas: 1 },
  { k: 'sodio', nome: 'Sódio', un: 'mg', casas: 0 },
];

const fmt = (v: number, casas: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: 0 });

export function ReceitaDetalheScreen() {
  const { id = '' } = useParams();
  // undefined = carregando; null = não existe
  const dados = useLiveQuery(async () => (await carregarReceita(id)) ?? null, [id]);
  const catalogo = useCatalogo();
  const [porcoes, setPorcoes] = useState<number | null>(null);
  const [modoNutri, setModoNutri] = useState<'porcao' | 'total'>('porcao');

  const nutri = useMemo(
    () => (dados && catalogo ? calcularNutricao(dados.ingredientes, catalogo, dados.recipe.porcoes) : null),
    [dados, catalogo],
  );
  const veg = useMemo(() => (dados && catalogo ? ehVegetariana(dados.ingredientes, catalogo) : false), [dados, catalogo]);

  if (dados === null) return <Navigate to="/receitas" replace />;
  if (!dados || !catalogo || !nutri) return <SubHeader title="" />;

  const { recipe: r, ingredientes, passos } = dados;
  const p = porcoes ?? r.porcoes;
  const fator = p / r.porcoes;

  return (
    <>
      <SubHeader
        title={r.titulo}
        right={
          <Link className="iconbtn" to={`/receitas/${r.id}/editar`} aria-label="Editar receita">
            <Icon name="edit" />
          </Link>
        }
      />
      <main className="view">
        <Capa recipeId={r.id} capaId={r.capaFotoId} />

        <section className="sec">
          <h1 className="rhead">{r.titulo}</h1>
          <div className="rmeta big">
            {r.tempoMin != null && (
              <span>
                <Icon name="clock" />
                {r.tempoMin} min
              </span>
            )}
            <span>
              <Icon name="people" />
              rende {plural(r.porcoes, 'porção', 'porções')}
            </span>
          </div>
          {(veg || r.tags.length > 0) && (
            <div className="metas">
              {veg && (
                <span className="chip ok">
                  <Icon name="leaf" />
                  Vegetariana
                </span>
              )}
              {r.tags.map((t) => (
                <span className="chip neu" key={t}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="sec">
          <div className="sec-h">
            <h2>Ingredientes</h2>
            <div className="stepper" aria-label="Porções">
              <button type="button" onClick={() => setPorcoes(Math.max(1, p - 1))} aria-label="Menos uma porção" disabled={p <= 1}>
                <Icon name="minus" />
              </button>
              <span aria-live="polite">{plural(p, 'porção', 'porções')}</span>
              <button type="button" onClick={() => setPorcoes(p + 1)} aria-label="Mais uma porção">
                <Icon name="plus" />
              </button>
            </div>
          </div>
          {ingredientes.length ? (
            <div className="card">
              <div className="list">
                {ingredientes.map((l) => {
                  const ing = l.ingredientId ? catalogo.get(l.ingredientId) : undefined;
                  return (
                    <div className="li ing" key={l.id}>
                      <div className="qty">{l.aGosto ? 'a gosto' : formatMedida(l.quantidade != null ? l.quantidade * fator : null, l.unidade)}</div>
                      <div className="grow">
                        <div className="name">{ing?.nome ?? l.textoOriginal}</div>
                        {(l.observacao || l.opcional) && (
                          <div className="sub">
                            {[l.observacao, l.opcional ? 'opcional' : ''].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="muted small">Nenhum ingrediente cadastrado.</p>
          )}
        </section>

        {ingredientes.length > 0 && (
          <section className="sec">
            <div className="sec-h">
              <h2>Nutrição</h2>
              <div className="seg sm" role="radiogroup" aria-label="Mostrar nutrição">
                <button type="button" role="radio" aria-checked={modoNutri === 'porcao'} className={modoNutri === 'porcao' ? 'on' : ''} onClick={() => setModoNutri('porcao')}>
                  Por porção
                </button>
                <button type="button" role="radio" aria-checked={modoNutri === 'total'} className={modoNutri === 'total' ? 'on' : ''} onClick={() => setModoNutri('total')}>
                  Receita toda
                </button>
              </div>
            </div>
            <div className="card nutri">
              {NUTRIENTES.map((n) => {
                const v = (modoNutri === 'porcao' ? nutri.porPorcao : nutri.total)[n.k];
                return (
                  <div className={`nbox ${n.k === 'kcal' ? 'kcal' : ''}`} key={n.k}>
                    <div className="nval">
                      {nutri.parcial ? '~' : ''}
                      {fmt(v, n.casas)}
                      <small> {n.un}</small>
                    </div>
                    <div className="nname">{n.nome}</div>
                  </div>
                );
              })}
            </div>
            {nutri.parcial && (
              <div className="alert warn" role="note">
                <strong>Nutrição parcial.</strong> Ficaram fora da conta:{' '}
                {nutri.faltantes.map((f) => `${f.nome} (${f.motivo})`).join('; ')}. Edite a receita para completar.
              </div>
            )}
            <p className="note">
              <Icon name="info" />
              <span>Estimativa pela tabela TACO, para acompanhamento pessoal. Não conta itens a gosto e opcionais.</span>
            </p>
          </section>
        )}

        <section className="sec">
          <div className="sec-h">
            <h2>Modo de preparo</h2>
          </div>
          {passos.length ? (
            <ol className="steps">
              {passos.map((s, i) => (
                <li key={i}>
                  <span className="sn">{i + 1}</span>
                  <p>{s}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted small">Nenhum passo cadastrado.</p>
          )}
        </section>

        {(r.notas || r.fonteUrl) && (
          <section className="sec">
            <div className="sec-h">
              <h2>Notas</h2>
            </div>
            {r.notas && <p className="notas">{r.notas}</p>}
            {r.fonteUrl && (
              <a className="fonte" href={r.fonteUrl} target="_blank" rel="noreferrer">
                <Icon name="link" />
                <span>{hostDe(r.fonteUrl)}</span>
              </a>
            )}
          </section>
        )}

        <PhotoGallery recipeId={r.id} capaId={r.capaFotoId} />
      </main>
    </>
  );
}

function hostDe(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function Capa({ recipeId, capaId }: { recipeId: string; capaId: string | null }) {
  const url = useFotoUrl(capaId);
  const { abrir, input, processando } = useAdicionarFotos(recipeId);
  if (capaId && url) return <img className="cover" src={url} alt="" />;
  if (capaId) return <div className="cover" />;
  return (
    <>
      <button type="button" className="cover empty" onClick={abrir} disabled={processando}>
        <Icon name="camera" />
        <span>{processando ? 'Salvando foto…' : 'Adicionar foto do prato'}</span>
      </button>
      {input}
    </>
  );
}
