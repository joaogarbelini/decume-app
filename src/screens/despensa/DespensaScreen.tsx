import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalogo } from '../../components/hooks';
import { Icon } from '../../components/Icon';
import { IngredientPicker } from '../../components/IngredientPicker';
import { TabHeader } from '../../components/Layout';
import { db } from '../../db/db';
import { definirNivel, itemVisivel } from '../../db/pantry';
import { SECOES, type Ingredient, type PantryItem } from '../../db/types';
import { casaBusca, plural } from '../../lib/text';
import { formatEstoque } from '../../lib/units';
import { ItemSheet } from './ItemSheet';
import { NiveisBotoes } from './NiveisBotoes';

type Aberto = { ing: Ingredient; modo: 'entrada' | 'ajuste' } | null;

export function DespensaScreen() {
  const catalogo = useCatalogo();
  const itens = useLiveQuery(() => db.pantry.toArray(), []);
  const [busca, setBusca] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Aberto>(null);

  const porId = useMemo(() => new Map((itens ?? []).map((i) => [i.ingredientId, i])), [itens]);

  const { grupos, outros, totalExatos, acabando, semMarcar } = useMemo(() => {
    const vazio = { grupos: [] as [string, Ingredient[]][], outros: [] as Ingredient[], totalExatos: 0, acabando: 0, semMarcar: 0 };
    if (!catalogo) return vazio;
    const todos = [...catalogo.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const visiveis = todos.filter((i) => itemVisivel(i, porId.get(i.id)));
    const filtrados = visiveis.filter((i) => casaBusca(busca, i.nome, ...i.apelidos));
    const grupos = SECOES.map((s) => {
      const doGrupo = filtrados.filter((i) => i.secao === s);
      // quantidades primeiro, básicos depois
      return [s, [...doGrupo.filter((i) => i.modo === 'exato'), ...doGrupo.filter((i) => i.modo === 'nivel')]] as [string, Ingredient[]];
    }).filter(([, l]) => l.length);
    const outros = busca.trim()
      ? todos.filter((i) => !itemVisivel(i, porId.get(i.id)) && !i.sempreTenho && casaBusca(busca, i.nome, ...i.apelidos)).slice(0, 12)
      : [];
    const basicos = visiveis.filter((i) => i.modo === 'nivel');
    return {
      grupos,
      outros,
      totalExatos: visiveis.length - basicos.length,
      acabando: basicos.filter((i) => ['pouco', 'acabou'].includes(porId.get(i.id)?.nivel ?? '')).length,
      semMarcar: basicos.filter((i) => !porId.get(i.id)?.nivel).length,
    };
  }, [catalogo, porId, busca]);

  const fecharItem = useCallback(() => setAberto(null), []);
  const escolher = useCallback((ing: Ingredient) => setAberto({ ing, modo: 'entrada' }), []);
  const incluir = useCallback((i: Ingredient) => !i.sempreTenho, []);
  const descrever = useCallback(
    (i: Ingredient) => {
      const it = porId.get(i.id);
      if (i.modo === 'nivel') return it?.nivel ? `básico · ${it.nivel}` : 'básico';
      return it?.quantidade ? `em casa: ${formatEstoque(it.quantidade, i.unidadeBase)}` : i.secao;
    },
    [porId],
  );

  if (!catalogo || !itens) return <TabHeader title="Despensa" eyebrow="O que tem em casa" />;

  const resumo = [totalExatos ? plural(totalExatos, 'item com quantidade', 'itens com quantidade') : null, acabando ? `${acabando} acabando` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <TabHeader title="Despensa" eyebrow={resumo || 'O que tem em casa'} />
      <main className="view">
        <button type="button" className="btn block" onClick={() => { setAviso(null); setAdicionando(true); }}>
          <Icon name="plus" />
          Adicionar à despensa
        </button>

        <label className="search">
          <Icon name="search" />
          <input type="search" placeholder="Buscar na despensa" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar na despensa" />
        </label>

        {!busca && totalExatos === 0 && (
          <div className="card pad intro">
            <strong>Comece pelo que já tem em casa.</strong>
            <span className="muted small">
              Toque em "Adicionar à despensa" e escolha "Já tinha em casa" para carnes, laticínios, massas e hortifrúti. Os básicos já estão listados abaixo: é só marcar o nível.
            </span>
          </div>
        )}
        {!busca && semMarcar > 0 && totalExatos > 0 && (
          <p className="note">
            <Icon name="info" />
            <span>{plural(semMarcar, 'básico ainda sem nível marcado', 'básicos ainda sem nível marcado')}.</span>
          </p>
        )}

        {grupos.map(([secao, lista]) => (
          <section className="sec" key={secao}>
            <div className="sec-h">
              <h2>{secao}</h2>
              <span className="meta">{lista.length}</span>
            </div>
            <div className="card">
              <div className="list">
                {lista.map((ing) => (
                  <Linha key={ing.id} ing={ing} item={porId.get(ing.id)} onAbrir={() => setAberto({ ing, modo: 'ajuste' })} />
                ))}
              </div>
            </div>
          </section>
        ))}

        {busca.trim() && !grupos.length && !outros.length && (
          <div className="card empty-state">
            <p>Nada encontrado para "{busca}".</p>
          </div>
        )}

        {outros.length > 0 && (
          <section className="sec">
            <div className="sec-h">
              <h2>Não tem em casa</h2>
            </div>
            <div className="card">
              <div className="list">
                {outros.map((ing) => (
                  <button type="button" className="li pick" key={ing.id} onClick={() => setAberto({ ing, modo: 'entrada' })}>
                    <div className="grow">
                      <div className="name">{ing.nome}</div>
                      <div className="sub">{ing.secao}</div>
                    </div>
                    <Icon name="plus" />
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        <div className="card">
          <div className="list">
            <Link className="li" to="/despensa/historico">
              <div className="grow">
                <div className="name">Histórico de movimentos</div>
                <div className="sub">Compras, ajustes e o que foi usado ao cozinhar</div>
              </div>
              <Icon name="chevron" />
            </Link>
          </div>
        </div>
      </main>

      {adicionando && !aberto && (
        <IngredientPicker
          catalogo={catalogo}
          titulo="Adicionar à despensa"
          aviso={aviso}
          incluir={incluir}
          descrever={descrever}
          onPick={escolher}
          onClose={() => setAdicionando(false)}
        />
      )}
      {aberto && <ItemSheet key={aberto.ing.id + aberto.modo} ing={aberto.ing} modoInicial={aberto.modo} onClose={fecharItem} onAdicionado={setAviso} />}
    </>
  );
}

function Linha({ ing, item, onAbrir }: { ing: Ingredient; item: PantryItem | undefined; onAbrir: () => void }) {
  if (ing.modo === 'nivel') {
    return (
      <div className="li nivel-li">
        <button type="button" className="grow name-btn" onClick={onAbrir}>
          <div className="name">{ing.nome}</div>
        </button>
        <NiveisBotoes nivel={item?.nivel ?? null} nome={ing.nome} onChange={(n) => void definirNivel(ing.id, n)} />
      </div>
    );
  }
  return (
    <button type="button" className="li pick" onClick={onAbrir}>
      <div className="grow">
        <div className="name">{ing.nome}</div>
      </div>
      <div className="qty">{formatEstoque(item?.quantidade ?? 0, ing.unidadeBase)}</div>
    </button>
  );
}
