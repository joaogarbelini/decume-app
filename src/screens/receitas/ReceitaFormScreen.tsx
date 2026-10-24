import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCatalogo } from '../../components/hooks';
import { Icon } from '../../components/Icon';
import { IngredientPicker } from '../../components/IngredientPicker';
import { SubHeader } from '../../components/Layout';
import { db } from '../../db/db';
import { carregarReceita, draftVazio, excluirReceita, paraDraft, RecipeError, salvarConversao, salvarReceita, type RecipeDraft } from '../../db/recipes';
import type { Ingredient } from '../../db/types';
import { formatQuantidade, parseQuantidade } from '../../lib/quantity';
import { faltaConversao, rotuloUnidade, unidadesPara } from '../../lib/units';

const TAGS_SUGERIDAS = ['almoço', 'jantar', 'café da manhã', 'lanche', 'doce', 'rápido', 'marmita'];

interface LinhaForm {
  key: string;
  ingredientId: string | null;
  textoOriginal: string | null;
  qtd: string;
  unidade: string | null;
  observacao: string;
  opcional: boolean;
  aGosto: boolean;
  /** valor em g/ml de 1 medida caseira, quando o ingrediente ainda não tem essa conversão */
  conv: string;
}

interface PassoForm {
  key: string;
  texto: string;
}

interface Estado {
  titulo: string;
  porcoes: number;
  tempo: string;
  tags: string[];
  fonteUrl: string;
  notas: string;
  linhas: LinhaForm[];
  passos: PassoForm[];
}

/** Quantidade no campo de edição: frações em medidas caseiras ("1 1/2"), número nas demais ("12,5"). */
function qtdParaEditar(q: number, unidade: string | null): string {
  if (unidade !== 'g' && unidade !== 'ml') {
    const f = formatQuantidade(q);
    if (/[¼⅓½⅔¾]/.test(f)) return f;
  }
  return q.toLocaleString('pt-BR', { maximumFractionDigits: 3, useGrouping: false });
}

let seq = 0;
const k = () => `k${++seq}`;

function deDraft(d: RecipeDraft): Estado {
  return {
    titulo: d.titulo,
    porcoes: d.porcoes,
    tempo: d.tempoMin ? String(d.tempoMin) : '',
    tags: d.tags,
    fonteUrl: d.fonteUrl ?? '',
    notas: d.notas,
    linhas: d.ingredientes.map((i) => ({
      key: k(),
      ingredientId: i.ingredientId,
      textoOriginal: i.textoOriginal,
      qtd: i.quantidade != null ? qtdParaEditar(i.quantidade, i.unidade) : '',
      unidade: i.unidade,
      observacao: i.observacao,
      opcional: i.opcional,
      aGosto: i.aGosto,
      conv: '',
    })),
    passos: (d.passos.length ? d.passos : ['']).map((texto) => ({ key: k(), texto })),
  };
}

/** Compara só o conteúdo (sem as chaves internas), para saber se há mudança não salva. */
const assinatura = (e: Estado) =>
  JSON.stringify({ ...e, linhas: e.linhas.map(({ key: _k, ...r }) => r), passos: e.passos.map((p) => p.texto.trim()).filter(Boolean) });

function mover<T>(lista: T[], i: number, delta: number): T[] {
  const j = i + delta;
  if (j < 0 || j >= lista.length) return lista;
  const nova = [...lista];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  return nova;
}

/** Tira numeração colada junto ("1.", "2)", "Passo 3:") de cada linha. */
const limparPasso = (s: string) => s.replace(/^\s*(passo\s*)?\d+\s*[.)\-:–]\s*/i, '').trim();

export function ReceitaFormScreen() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const catalogo = useCatalogo();
  const todasTags = useLiveQuery(async () => [...new Set((await db.recipes.toArray()).flatMap((r) => r.tags))], []);

  const [estado, setEstado] = useState<Estado | null>(editando ? null : deDraft(draftVazio()));
  const inicial = useRef<string>(editando ? '' : assinatura(deDraft(draftVazio())));
  const [picker, setPicker] = useState<{ trocar?: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [novaTag, setNovaTag] = useState('');
  /** linha recém-adicionada: rola até ela e põe o cursor na quantidade */
  const [focar, setFocar] = useState<string | null>(null);

  useEffect(() => {
    if (!focar) return;
    const card = document.querySelector<HTMLElement>(`[data-linha="${focar}"]`);
    card?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    card?.querySelector<HTMLInputElement>('input[inputmode="decimal"]')?.focus({ preventScroll: true });
    setFocar(null);
  }, [focar]);

  useEffect(() => {
    if (!id) return;
    let vivo = true;
    carregarReceita(id).then((r) => {
      if (!vivo) return;
      if (!r) return navigate('/receitas', { replace: true });
      const e = deDraft(paraDraft(r));
      inicial.current = assinatura(e);
      setEstado(e);
    });
    return () => {
      vivo = false;
    };
  }, [id, navigate]);

  const sugestoes = useMemo(() => {
    const ja = new Set(estado?.tags ?? []);
    return [...new Set([...(todasTags ?? []), ...TAGS_SUGERIDAS])].filter((t) => !ja.has(t)).slice(0, 10);
  }, [todasTags, estado?.tags]);

  if (!estado || !catalogo) return <SubHeader title={editando ? 'Editar receita' : 'Nova receita'} />;

  const set = (patch: Partial<Estado>) => setEstado((e) => (e ? { ...e, ...patch } : e));
  const setLinha = (key: string, patch: Partial<LinhaForm>) =>
    setEstado((e) => (e ? { ...e, linhas: e.linhas.map((l) => (l.key === key ? { ...l, ...patch } : l)) } : e));
  const setPasso = (key: string, texto: string) =>
    setEstado((e) => (e ? { ...e, passos: e.passos.map((p) => (p.key === key ? { ...p, texto } : p)) } : e));

  function sair() {
    const mudou = estado && assinatura(estado) !== inicial.current;
    if (mudou && !window.confirm('Sair sem salvar? As mudanças serão perdidas.')) return;
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate(id ? `/receitas/${id}` : '/receitas');
  }

  function escolher(ing: Ingredient) {
    const alvo = picker?.trocar;
    setPicker(null);
    if (alvo) {
      setLinha(alvo, { ingredientId: ing.id, textoOriginal: null, unidade: ing.unidadeBase, conv: '' });
      return;
    }
    const nova = k();
    setFocar(nova);
    set({
      linhas: [
        ...estado!.linhas,
        { key: nova, ingredientId: ing.id, textoOriginal: null, qtd: '', unidade: ing.unidadeBase, observacao: '', opcional: false, aGosto: ing.sempreTenho, conv: '' },
      ],
    });
  }

  function addTag(t: string) {
    const tag = t.trim().toLowerCase().replace(/,$/, '');
    if (tag && !estado!.tags.includes(tag)) set({ tags: [...estado!.tags, tag] });
    setNovaTag('');
  }

  function onTagKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(novaTag);
    }
  }

  function onPastePasso(e: ClipboardEvent<HTMLTextAreaElement>, key: string) {
    const texto = e.clipboardData.getData('text');
    const partes = texto.split(/\r?\n/).map(limparPasso).filter(Boolean);
    if (partes.length < 2) return;
    e.preventDefault();
    setEstado((s) => {
      if (!s) return s;
      const i = s.passos.findIndex((p) => p.key === key);
      const atual = s.passos[i].texto.trim();
      const novos = partes.map((t) => ({ key: k(), texto: t }));
      if (atual) novos[0].texto = `${atual} ${novos[0].texto}`;
      return { ...s, passos: [...s.passos.slice(0, i), ...novos, ...s.passos.slice(i + 1)] };
    });
  }

  async function salvar() {
    if (!estado || !catalogo) return;
    setErro(null);
    const ingredientes: RecipeDraft['ingredientes'] = [];
    const conversoes: [string, string, number][] = [];
    for (const l of estado.linhas) {
      const ing = l.ingredientId ? catalogo.get(l.ingredientId) : undefined;
      const nome = ing?.nome ?? l.textoOriginal ?? 'ingrediente';
      let quantidade: number | null = null;
      if (!l.aGosto) {
        quantidade = parseQuantidade(l.qtd);
        if (quantidade == null) {
          setErro(l.qtd.trim() ? `Não entendi a quantidade de ${nome}: "${l.qtd}". Use números como 200, 1/2 ou 1,5.` : `Falta a quantidade de ${nome}. Se for a gosto, marque "a gosto".`);
          return;
        }
        if (ing && faltaConversao(ing, l.unidade) && l.conv.trim()) {
          const v = parseQuantidade(l.conv);
          if (v == null) {
            setErro(`Não entendi quanto pesa 1 ${rotuloUnidade(l.unidade ?? '')} de ${nome}.`);
            return;
          }
          conversoes.push([ing.id, l.unidade!, v]);
        }
      }
      ingredientes.push({
        ingredientId: l.ingredientId,
        textoOriginal: l.textoOriginal,
        quantidade,
        unidade: l.aGosto ? null : l.unidade,
        observacao: l.observacao,
        opcional: l.opcional,
        aGosto: l.aGosto,
      });
    }
    const tempo = parseQuantidade(estado.tempo);
    if (estado.tempo.trim() && tempo == null) {
      setErro('O tempo de preparo precisa ser um número de minutos.');
      return;
    }
    const pendente = novaTag.trim() ? [novaTag.trim().toLowerCase()] : [];
    setSalvando(true);
    try {
      for (const [ingId, u, v] of conversoes) await salvarConversao(ingId, u, v);
      const novoId = await salvarReceita(
        {
          titulo: estado.titulo,
          porcoes: estado.porcoes,
          tempoMin: tempo,
          tags: [...estado.tags, ...pendente],
          fonteUrl: estado.fonteUrl,
          notas: estado.notas,
          ingredientes,
          passos: estado.passos.map((p) => p.texto),
        },
        id,
      );
      inicial.current = assinatura(estado);
      navigate(`/receitas/${novoId}`, { replace: true });
    } catch (e) {
      setErro(e instanceof RecipeError ? e.message : 'Não deu para salvar. Tente de novo.');
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!id) return;
    await excluirReceita(id);
    navigate('/receitas', { replace: true });
  }

  return (
    <>
      <SubHeader title={editando ? 'Editar receita' : 'Nova receita'} onBack={sair} />
      <main className="view form-view">
        <section className="sec form">
          <label className="field">
            <span className="label">Nome da receita</span>
            <input
              className="input lg"
              value={estado.titulo}
              onChange={(e) => set({ titulo: e.target.value })}
              placeholder="Ex.: Frango xadrez"
              autoFocus={!editando}
              enterKeyHint="next"
            />
          </label>
          <div className="field-row">
            <div className="field">
              <span className="label" id="lbl-porcoes">
                Rende
              </span>
              <div className="stepper lg" role="group" aria-labelledby="lbl-porcoes">
                <button type="button" onClick={() => set({ porcoes: Math.max(1, estado.porcoes - 1) })} disabled={estado.porcoes <= 1} aria-label="Menos uma porção">
                  <Icon name="minus" />
                </button>
                <span>
                  {estado.porcoes} {estado.porcoes === 1 ? 'porção' : 'porções'}
                </span>
                <button type="button" onClick={() => set({ porcoes: estado.porcoes + 1 })} aria-label="Mais uma porção">
                  <Icon name="plus" />
                </button>
              </div>
            </div>
            <label className="field">
              <span className="label">Tempo (min)</span>
              <input className="input" inputMode="numeric" value={estado.tempo} onChange={(e) => set({ tempo: e.target.value })} placeholder="30" />
            </label>
          </div>

          <div className="field">
            <span className="label">Tags</span>
            <div className="tag-box">
              {estado.tags.map((t) => (
                <button type="button" className="chip neu tag-x" key={t} onClick={() => set({ tags: estado.tags.filter((x) => x !== t) })} aria-label={`Remover tag ${t}`}>
                  {t}
                  <Icon name="close" />
                </button>
              ))}
              <input
                className="tag-input"
                value={novaTag}
                onChange={(e) => (e.target.value.endsWith(',') ? addTag(e.target.value) : setNovaTag(e.target.value))}
                onKeyDown={onTagKey}
                onBlur={() => novaTag.trim() && addTag(novaTag)}
                placeholder={estado.tags.length ? 'Outra tag' : 'Ex.: almoço, rápido'}
                aria-label="Nova tag"
              />
            </div>
            {sugestoes.length > 0 && (
              <div className="chip-row wrap">
                {sugestoes.map((t) => (
                  <button type="button" className="fchip sm" key={t} onClick={() => addTag(t)}>
                    <Icon name="plus" />
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="sec">
          <div className="sec-h">
            <h2>Ingredientes</h2>
            <span className="meta">{estado.linhas.length || ''}</span>
          </div>
          {estado.linhas.map((l, i) => {
            const ing = l.ingredientId ? catalogo.get(l.ingredientId) : undefined;
            const unidades = ing ? unidadesPara(ing) : [];
            const semConv = ing && !l.aGosto && faltaConversao(ing, l.unidade);
            return (
              <div className="card ing-edit" key={l.key} data-linha={l.key}>
                <div className="ie-top">
                  <button type="button" className="ie-name" onClick={() => setPicker({ trocar: l.key })}>
                    <span>{ing?.nome ?? l.textoOriginal ?? 'Escolher ingrediente'}</span>
                    <Icon name="chevron" />
                  </button>
                  <div className="ie-tools">
                    <button type="button" className="tool" onClick={() => set({ linhas: mover(estado.linhas, i, -1) })} disabled={i === 0} aria-label="Subir">
                      <Icon name="up" />
                    </button>
                    <button type="button" className="tool" onClick={() => set({ linhas: mover(estado.linhas, i, 1) })} disabled={i === estado.linhas.length - 1} aria-label="Descer">
                      <Icon name="down" />
                    </button>
                    <button type="button" className="tool" onClick={() => set({ linhas: estado.linhas.filter((x) => x.key !== l.key) })} aria-label={`Remover ${ing?.nome ?? 'ingrediente'}`}>
                      <Icon name="trash" />
                    </button>
                  </div>
                </div>
                {!l.aGosto && (
                  <div className="ie-qty">
                    <input
                      className="input"
                      inputMode="decimal"
                      value={l.qtd}
                      onChange={(e) => setLinha(l.key, { qtd: e.target.value })}
                      placeholder="Qtd."
                      aria-label={`Quantidade de ${ing?.nome ?? 'ingrediente'}`}
                    />
                    <select
                      className="input"
                      value={l.unidade ?? ''}
                      onChange={(e) => setLinha(l.key, { unidade: e.target.value, conv: '' })}
                      aria-label={`Unidade de ${ing?.nome ?? 'ingrediente'}`}
                    >
                      {unidades.map((u) => (
                        <option value={u} key={u}>
                          {rotuloUnidade(u, 2)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {semConv && ing && (
                  <div className="conv">
                    <label>
                      1 {rotuloUnidade(l.unidade ?? '')} de {ing.nome.toLowerCase()} ={' '}
                      <input className="input xs" inputMode="decimal" value={l.conv} onChange={(e) => setLinha(l.key, { conv: e.target.value })} placeholder="?" /> {ing.unidadeBase}
                    </label>
                    <span className="hint">Fica guardado para as próximas receitas. Sem isso, a nutrição sai parcial.</span>
                  </div>
                )}
                <input
                  className="input sm"
                  value={l.observacao}
                  onChange={(e) => setLinha(l.key, { observacao: e.target.value })}
                  placeholder="Observação (ex.: picada em cubos)"
                  aria-label="Observação"
                />
                <div className="ie-flags">
                  <label className="check">
                    <input type="checkbox" checked={l.opcional} onChange={(e) => setLinha(l.key, { opcional: e.target.checked })} />
                    <span>opcional</span>
                  </label>
                  <label className="check">
                    <input type="checkbox" checked={l.aGosto} onChange={(e) => setLinha(l.key, { aGosto: e.target.checked })} />
                    <span>a gosto</span>
                  </label>
                </div>
              </div>
            );
          })}
          <button type="button" className="btn ghost block" onClick={() => setPicker({})}>
            <Icon name="plus" />
            Adicionar ingrediente
          </button>
        </section>

        <section className="sec">
          <div className="sec-h">
            <h2>Modo de preparo</h2>
          </div>
          <p className="note">
            <Icon name="info" />
            <span>Um passo por caixa. Colou o texto todo? Ele é separado em passos por linha.</span>
          </p>
          {estado.passos.map((p, i) => (
            <div className="step-edit" key={p.key}>
              <span className="sn">{i + 1}</span>
              <textarea
                className="input"
                rows={2}
                value={p.texto}
                onChange={(e) => setPasso(p.key, e.target.value)}
                onPaste={(e) => onPastePasso(e, p.key)}
                placeholder={i === 0 ? 'Ex.: Pique a cebola e o alho.' : 'Próximo passo'}
                aria-label={`Passo ${i + 1}`}
              />
              <div className="se-tools">
                <button type="button" className="tool" onClick={() => set({ passos: mover(estado.passos, i, -1) })} disabled={i === 0} aria-label="Subir passo">
                  <Icon name="up" />
                </button>
                <button type="button" className="tool" onClick={() => set({ passos: mover(estado.passos, i, 1) })} disabled={i === estado.passos.length - 1} aria-label="Descer passo">
                  <Icon name="down" />
                </button>
                <button
                  type="button"
                  className="tool"
                  onClick={() => set({ passos: estado.passos.length > 1 ? estado.passos.filter((x) => x.key !== p.key) : [{ key: k(), texto: '' }] })}
                  aria-label="Remover passo"
                >
                  <Icon name="trash" />
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="btn ghost block" onClick={() => set({ passos: [...estado.passos, { key: k(), texto: '' }] })}>
            <Icon name="plus" />
            Adicionar passo
          </button>
        </section>

        <section className="sec form">
          <div className="sec-h">
            <h2>Notas e origem</h2>
          </div>
          <label className="field">
            <span className="label">Notas</span>
            <textarea className="input" rows={3} value={estado.notas} onChange={(e) => set({ notas: e.target.value })} placeholder="Ex.: fica melhor no dia seguinte" />
          </label>
          <label className="field">
            <span className="label">Link de origem</span>
            <input className="input" type="url" inputMode="url" value={estado.fonteUrl} onChange={(e) => set({ fonteUrl: e.target.value })} placeholder="https://" />
          </label>
        </section>

        {editando && (
          <section className="sec">
            {confirmarExclusao ? (
              <div className="confirm" role="alertdialog" aria-label="Confirmar exclusão">
                <strong>Excluir "{estado.titulo}"?</strong>
                <span className="small">A receita e as fotos dela somem deste celular. Não dá para desfazer.</span>
                <div className="row-btns">
                  <button type="button" className="btn ghost sm" onClick={() => setConfirmarExclusao(false)}>
                    Cancelar
                  </button>
                  <button type="button" className="btn danger sm" onClick={excluir}>
                    Excluir receita
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn danger block" onClick={() => setConfirmarExclusao(true)}>
                <Icon name="trash" />
                Excluir receita
              </button>
            )}
          </section>
        )}
      </main>

      <div className="savebar">
        {erro && (
          <div className="alert err" role="alert">
            {erro}
          </div>
        )}
        <button type="button" className="btn block" onClick={salvar} disabled={salvando || !estado.titulo.trim()}>
          <Icon name="check" />
          {salvando ? 'Salvando…' : 'Salvar receita'}
        </button>
      </div>

      {picker && <IngredientPicker catalogo={catalogo} onPick={escolher} onClose={() => setPicker(null)} />}
    </>
  );
}
