import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { db } from '../../db/db';
import { ajustarQuantidade, definirNivel, historico, PantryError, registrarEntrada } from '../../db/pantry';
import type { Ingredient, Nivel } from '../../db/types';
import { parseQuantidade } from '../../lib/quantity';
import { formatEstoque, paraUnidadeBase, rotuloUnidade, unidadesEstoque } from '../../lib/units';
import { NiveisBotoes } from './NiveisBotoes';
import { JA_TINHA, MovimentoLinha } from './MovimentoLinha';

type Modo = 'entrada' | 'ajuste';

/**
 * Painel de um ingrediente da despensa.
 * entrada = "Comprei" ou "Já tinha em casa" (soma no estoque).
 * ajuste = corrigir a quantidade que está em casa, marcar que acabou, ver o histórico.
 */
export function ItemSheet({ ing, modoInicial, onClose, onAdicionado }: { ing: Ingredient; modoInicial: Modo; onClose: () => void; onAdicionado?: (texto: string) => void }) {
  const item = useLiveQuery(() => db.pantry.get(ing.id), [ing.id]);
  const movimentos = useLiveQuery(() => historico({ ingredientId: ing.id, limite: 5 }), [ing.id]);
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [origem, setOrigem] = useState<'avulsa' | 'ajuste'>('avulsa');
  const unidades = unidadesEstoque(ing);
  const [unidade, setUnidade] = useState<string>(ing.unidadeBase);
  const [qtd, setQtd] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const atual = item?.quantidade ?? 0;
  const digitada = parseQuantidade(qtd);
  const emBase = digitada != null ? paraUnidadeBase(ing, digitada, unidade) : null;

  async function executar(acao: () => Promise<void>, fechar = true) {
    setErro(null);
    try {
      await acao();
      if (fechar) onClose();
    } catch (e) {
      setErro(e instanceof PantryError ? e.message : 'Não deu para salvar. Tente de novo.');
    }
  }

  if (ing.modo === 'nivel') {
    return (
      <Sheet
        title={ing.nome}
        onClose={onClose}
        footer={
          modo === 'entrada' ? (
            <button
              type="button"
              className="btn block"
              onClick={() =>
                executar(async () => {
                  await registrarEntrada(ing.id, null, 'avulsa');
                  onAdicionado?.(`${ing.nome}: comprado, fica como "tem".`);
                })
              }
            >
              <Icon name="check" />
              Comprei
            </button>
          ) : undefined
        }
      >
        <p className="muted small">Básico controlado por nível. Em "pouco" ou "acabou", entra na lista de compras.</p>
        <NiveisBotoes grande nivel={item?.nivel ?? null} nome={ing.nome} onChange={(n: Nivel) => executar(() => definirNivel(ing.id, n), modo === 'ajuste')} />
        <Historico movimentos={movimentos} ing={ing} />
        {erro && <div className="alert err" role="alert">{erro}</div>}
      </Sheet>
    );
  }

  const depois = modo === 'entrada' ? atual + (emBase ?? 0) : (emBase ?? atual);

  return (
    <Sheet
      title={modo === 'entrada' ? `Adicionar ${ing.nome.toLowerCase()}` : ing.nome}
      onClose={onClose}
      footer={
        modo === 'entrada' ? (
          <button
            type="button"
            className="btn block"
            disabled={emBase == null}
            onClick={() =>
              executar(async () => {
                await registrarEntrada(ing.id, emBase, origem, origem === 'ajuste' ? JA_TINHA : null);
                onAdicionado?.(`${ing.nome}: +${formatEstoque(emBase!, ing.unidadeBase)}. Em casa: ${formatEstoque(atual + emBase!, ing.unidadeBase)}.`);
              })
            }
          >
            <Icon name="plus" />
            Adicionar
          </button>
        ) : (
          <div className="row-btns">
            <button type="button" className="btn danger" disabled={atual === 0} onClick={() => executar(() => ajustarQuantidade(ing.id, 0))}>
              Acabou
            </button>
            <button type="button" className="btn" disabled={emBase == null} onClick={() => executar(() => ajustarQuantidade(ing.id, emBase!))}>
              <Icon name="check" />
              Salvar
            </button>
          </div>
        )
      }
    >
      <div className="stock-now">
        <span className="muted">Em casa agora</span>
        <strong>{formatEstoque(atual, ing.unidadeBase)}</strong>
      </div>

      <div className="seg" role="radiogroup" aria-label="O que fazer">
        <button type="button" role="radio" aria-checked={modo === 'entrada'} className={modo === 'entrada' ? 'on' : ''} onClick={() => { setModo('entrada'); setQtd(''); }}>
          Adicionar
        </button>
        <button type="button" role="radio" aria-checked={modo === 'ajuste'} className={modo === 'ajuste' ? 'on' : ''} onClick={() => { setModo('ajuste'); setQtd(''); }}>
          Corrigir quantidade
        </button>
      </div>

      {modo === 'entrada' && (
        <div className="seg sm" role="radiogroup" aria-label="De onde veio">
          <button type="button" role="radio" aria-checked={origem === 'avulsa'} className={origem === 'avulsa' ? 'on' : ''} onClick={() => setOrigem('avulsa')}>
            Comprei agora
          </button>
          <button type="button" role="radio" aria-checked={origem === 'ajuste'} className={origem === 'ajuste' ? 'on' : ''} onClick={() => setOrigem('ajuste')}>
            Já tinha em casa
          </button>
        </div>
      )}

      <div className="field">
        <span className="label">{modo === 'entrada' ? 'Quanto entrou' : 'Quanto tem em casa'}</span>
        <div className="ie-qty">
          <input
            className="input lg"
            autoFocus
            inputMode="decimal"
            value={qtd}
            onChange={(e) => setQtd(e.target.value)}
            placeholder={modo === 'ajuste' ? String(atual).replace('.', ',') : 'Qtd.'}
            aria-label={modo === 'entrada' ? `Quanto entrou de ${ing.nome}` : `Quanto tem de ${ing.nome}`}
          />
          <select className="input" value={unidade} onChange={(e) => setUnidade(e.target.value)} aria-label="Unidade">
            {unidades.map((u) => (
              <option key={u} value={u}>
                {rotuloUnidade(u, 2)}
              </option>
            ))}
          </select>
        </div>
        {qtd.trim() && digitada == null && <span className="hint err-text">Use números como 500, 1,5 ou 1/2.</span>}
        {emBase != null && (
          <span className="hint">
            Fica em casa: <strong>{formatEstoque(depois, ing.unidadeBase)}</strong>
          </span>
        )}
      </div>

      <Historico movimentos={movimentos} ing={ing} />
      {erro && <div className="alert err" role="alert">{erro}</div>}
    </Sheet>
  );
}

function Historico({ movimentos, ing }: { movimentos: Awaited<ReturnType<typeof historico>> | undefined; ing: Ingredient }) {
  if (!movimentos?.length) return null;
  return (
    <div className="field">
      <span className="label">Últimos movimentos</span>
      <div className="list mini-hist">
        {movimentos.map((m) => (
          <MovimentoLinha key={m.id} m={m} ing={ing} mostrarData />
        ))}
      </div>
    </div>
  );
}
