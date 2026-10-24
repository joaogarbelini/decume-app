import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useBlobUrl, useCatalogo } from '../../components/hooks';
import { Icon } from '../../components/Icon';
import { SubHeader } from '../../components/Layout';
import { Stars } from '../../components/Stars';
import { CookError, finalizar, prepararFinalizacao, type Avaliacao, type PreparoFinalizacao } from '../../db/cook';
import { db } from '../../db/db';
import type { Nivel } from '../../db/types';
import { comprimirFoto } from '../../lib/photos';
import { parseQuantidade } from '../../lib/quantity';
import { plural } from '../../lib/text';
import { formatEstoque, rotuloUnidade } from '../../lib/units';
import { NiveisBotoes } from '../despensa/NiveisBotoes';

const CRITERIOS: { k: keyof Pick<Avaliacao, 'sabor' | 'facilidade' | 'custo' | 'apresentacao'>; nome: string; dica: string }[] = [
  { k: 'sabor', nome: 'Sabor', dica: 'O quanto gostou' },
  { k: 'facilidade', nome: 'Facilidade', dica: 'Esforço e tempo de verdade' },
  { k: 'custo', nome: 'Custo-benefício', dica: 'Valeu o que gastou' },
  { k: 'apresentacao', nome: 'Apresentação', dica: 'Como ficou no prato' },
];

const qtdTexto = (q: number) => q.toLocaleString('pt-BR', { maximumFractionDigits: 2, useGrouping: false });

/**
 * Finalizar (depois de cozinhar ou ao marcar como feita): baixa ajustável na despensa,
 * toque rápido nos básicos usados, marmitas e avaliação com fotos.
 */
export function FinalizarScreen() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const weekRecipeId = params.get('w');
  const sessionId = params.get('s');
  const catalogo = useCatalogo();
  const receita = useLiveQuery(async () => (await db.recipes.get(id)) ?? null, [id]);
  const semana = useLiveQuery(async () => (weekRecipeId ? ((await db.weekRecipes.get(weekRecipeId)) ?? null) : null), [weekRecipeId]);
  const porcoes = semana?.porcoes ?? (Number(params.get('p')) || receita?.porcoes || 2);

  const [prep, setPrep] = useState<PreparoFinalizacao | null>(null);
  const [baixas, setBaixas] = useState<Record<string, string>>({});
  const [niveis, setNiveis] = useState<Record<string, Nivel | null>>({});
  const [marmitas, setMarmitas] = useState(0);
  const [notas, setNotas] = useState({ sabor: 0, facilidade: 0, custo: 0, apresentacao: 0 });
  const [fariaDeNovo, setFariaDeNovo] = useState<boolean | null>(null);
  const [comentario, setComentario] = useState('');
  const [fotos, setFotos] = useState<Blob[]>([]);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState<{ faltas: { ingredientId: string; faltou: number }[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!receita || semana === undefined) return;
    prepararFinalizacao(receita.id, porcoes).then((p) => {
      setPrep(p);
      setBaixas(Object.fromEntries(p.baixas.map((b) => [b.ingredientId, qtdTexto(b.quantidade)])));
      setNiveis(Object.fromEntries(p.basicos.map((b) => [b.ingredientId, b.nivel])));
      setMarmitas(p.marmitasSugeridas);
    });
    // só na primeira carga: as edições do usuário não podem ser sobrescritas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receita?.id, semana === undefined]);

  if (receita === null) return <Navigate to="/receitas" replace />;
  if (!receita || !catalogo || !prep) return <SubHeader title="Finalizar" />;

  if (semana?.status === 'feita' && !resultado) {
    return (
      <>
        <SubHeader title={receita.titulo} />
        <main className="view">
          <div className="card empty-state">
            <h2>Já marcada como feita</h2>
            <p>Essa receita da semana já foi finalizada e teve a baixa feita.</p>
            <Link className="btn ghost" to="/">
              Voltar para a semana
            </Link>
          </div>
        </main>
      </>
    );
  }

  async function addFotos(e: ChangeEvent<HTMLInputElement>) {
    const arquivos = [...(e.target.files ?? [])];
    e.target.value = '';
    setProcessando(true);
    const novas: Blob[] = [];
    for (const a of arquivos) {
      try {
        novas.push(await comprimirFoto(a));
      } catch {
        setErro('Uma foto não pôde ser lida.');
      }
    }
    setFotos((f) => [...f, ...novas]);
    setProcessando(false);
  }

  async function concluir() {
    setErro(null);
    const valores = Object.values(notas);
    const algumaNota = valores.some((v) => v > 0);
    if (algumaNota && valores.some((v) => v === 0)) return setErro('Dê nota nos quatro critérios, ou deixe todos em branco para não avaliar.');
    if (algumaNota && fariaDeNovo == null) return setErro('Responda "Faria de novo?" para salvar a avaliação.');
    const lista: { ingredientId: string; quantidade: number }[] = [];
    for (const b of prep!.baixas) {
      const t = baixas[b.ingredientId]?.trim() ?? '';
      if (!t) continue;
      const q = parseQuantidade(t);
      if (q == null) return setErro(`Não entendi a quantidade de ${catalogo!.get(b.ingredientId)?.nome}.`);
      lista.push({ ingredientId: b.ingredientId, quantidade: q });
    }
    const mudaram = prep!.basicos
      .filter((b) => niveis[b.ingredientId] && niveis[b.ingredientId] !== b.nivel)
      .map((b) => ({ ingredientId: b.ingredientId, nivel: niveis[b.ingredientId]! }));
    setSalvando(true);
    try {
      const res = await finalizar({
        recipeId: receita!.id,
        weekRecipeId,
        sessionId,
        porcoes,
        baixas: lista,
        niveis: mudaram,
        marmitas,
        avaliacao: algumaNota ? { ...notas, fariaDeNovo: fariaDeNovo!, comentario } : null,
        fotos,
      });
      setResultado(res);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErro(e instanceof CookError ? e.message : 'Não deu para finalizar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  if (resultado) {
    return (
      <>
        <SubHeader title={receita.titulo} />
        <main className="view">
          <div className="card empty-state">
            <span className="badge-ic ok">
              <Icon name="check" />
            </span>
            <h2>Pronto!</h2>
            <p>
              Baixa feita na despensa.
              {marmitas > 0 ? ` ${plural(marmitas, 'porção foi', 'porções foram')} para as marmitas.` : ''}
            </p>
          </div>
          {resultado.faltas.length > 0 && (
            <div className="alert warn" role="status">
              A despensa tinha menos do que saiu. Ficou zerado:{' '}
              {resultado.faltas
                .map((f) => {
                  const ing = catalogo.get(f.ingredientId);
                  return `${ing?.nome} (faltaram ${formatEstoque(f.faltou, ing?.unidadeBase ?? 'g')})`;
                })
                .join('; ')}
              .
            </div>
          )}
          <Link className="btn block" to="/">
            Voltar para a semana
          </Link>
          <Link className="btn ghost block" to={`/receitas/${receita.id}`}>
            Ver a receita
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <SubHeader title={`Finalizar ${receita.titulo.toLowerCase()}`} />
      <main className="view form-view">
        <p className="muted small">{plural(porcoes, 'porção', 'porções')}. Confira o que saiu da despensa, conte as sobras e avalie.</p>

        <section className="sec">
          <div className="sec-h">
            <h2>Saiu da despensa</h2>
          </div>
          {prep.baixas.length ? (
            <div className="card">
              <div className="list">
                {prep.baixas.map((b) => {
                  const ing = catalogo.get(b.ingredientId)!;
                  const q = parseQuantidade(baixas[b.ingredientId] ?? '');
                  const falta = q != null && q > b.tem + 1e-6;
                  return (
                    <div className="li baixa-li" key={b.ingredientId}>
                      <div className="grow">
                        <div className="name">{ing.nome}</div>
                        <div className={`sub ${falta ? 'miss-text' : ''}`}>
                          tem {formatEstoque(b.tem, ing.unidadeBase)}
                          {falta ? ' · vai zerar' : ''}
                        </div>
                      </div>
                      <input
                        className="input baixa-in"
                        inputMode="decimal"
                        value={baixas[b.ingredientId] ?? ''}
                        onChange={(e) => setBaixas({ ...baixas, [b.ingredientId]: e.target.value })}
                        aria-label={`Quanto saiu de ${ing.nome} (${rotuloUnidade(ing.unidadeBase, 2)})`}
                      />
                      <span className="unit">{ing.unidadeBase}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="muted small">Nenhum item com quantidade nesta receita.</p>
          )}
        </section>

        {prep.basicos.length > 0 && (
          <section className="sec">
            <div className="sec-h">
              <h2>Básicos usados</h2>
            </div>
            <p className="muted small">Como ficaram depois de cozinhar?</p>
            <div className="card">
              <div className="list">
                {prep.basicos.map((b) => {
                  const ing = catalogo.get(b.ingredientId)!;
                  return (
                    <div className="li nivel-li" key={b.ingredientId}>
                      <div className="grow">
                        <div className="name">{ing.nome}</div>
                      </div>
                      <NiveisBotoes nivel={niveis[b.ingredientId] ?? null} nome={ing.nome} onChange={(n) => setNiveis({ ...niveis, [b.ingredientId]: n })} />
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <section className="sec">
          <div className="sec-h">
            <h2>Marmitas</h2>
          </div>
          <div className="card pad marmita-row">
            <span>Sobrou para marmita</span>
            <div className="stepper" aria-label="Porções de marmita">
              <button type="button" onClick={() => setMarmitas(Math.max(0, marmitas - 1))} disabled={marmitas <= 0} aria-label="Menos uma marmita">
                <Icon name="minus" />
              </button>
              <span>{plural(marmitas, 'porção', 'porções')}</span>
              <button type="button" onClick={() => setMarmitas(marmitas + 1)} aria-label="Mais uma marmita">
                <Icon name="plus" />
              </button>
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="sec-h">
            <h2>Avaliação</h2>
            <span className="meta">opcional</span>
          </div>
          <div className="card pad rating-card">
            {CRITERIOS.map((c) => (
              <div className="rating-row" key={c.k}>
                <div>
                  <div className="name">{c.nome}</div>
                  <div className="sub">{c.dica}</div>
                </div>
                <Stars valor={notas[c.k]} rotulo={c.nome} onChange={(v) => { setErro(null); setNotas({ ...notas, [c.k]: v }); }} />
              </div>
            ))}
            <div className="rating-row">
              <div className="name">Faria de novo?</div>
              <div className="seg sm" role="radiogroup" aria-label="Faria de novo?">
                <button type="button" role="radio" aria-checked={fariaDeNovo === true} className={fariaDeNovo === true ? 'on' : ''} onClick={() => { setErro(null); setFariaDeNovo(true); }}>
                  Sim
                </button>
                <button type="button" role="radio" aria-checked={fariaDeNovo === false} className={fariaDeNovo === false ? 'on' : ''} onClick={() => { setErro(null); setFariaDeNovo(false); }}>
                  Não
                </button>
              </div>
            </div>
            <textarea className="input" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Comentário (ex.: menos sal da próxima vez)" aria-label="Comentário" />
            <div className="gallery">
              {fotos.map((f, i) => (
                <FotoNova key={i} blob={f} onRemover={() => setFotos(fotos.filter((_, j) => j !== i))} />
              ))}
              <button type="button" className="gadd" onClick={() => fileRef.current?.click()} disabled={processando}>
                <Icon name="camera" />
                <span>{processando ? 'Lendo…' : 'Foto do prato'}</span>
              </button>
            </div>
            <input ref={fileRef} className="file-input" type="file" accept="image/*" multiple onChange={addFotos} aria-label="Escolher fotos" tabIndex={-1} />
          </div>
        </section>
      </main>
      <div className="savebar">
        {erro && (
          <div className="alert err" role="alert">
            {erro}
          </div>
        )}
        <button type="button" className="btn block" onClick={concluir} disabled={salvando || processando}>
          <Icon name="check" />
          {salvando ? 'Salvando…' : 'Concluir'}
        </button>
      </div>
    </>
  );
}

function FotoNova({ blob, onRemover }: { blob: Blob; onRemover: () => void }) {
  const url = useBlobUrl(blob);
  return (
    <div className="gthumb">
      {url && <img src={url} alt="" />}
      <button type="button" className="gx" onClick={onRemover} aria-label="Remover foto">
        <Icon name="close" />
      </button>
    </div>
  );
}
