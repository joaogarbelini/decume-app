import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import type { Ingredient } from '../../db/types';
import { comprarAvulso, comprarItem, removerAvulso } from '../../db/week';
import { parseQuantidade } from '../../lib/quantity';
import { arredondarCompra, type LinhaLista } from '../../lib/shopping';
import { formatEstoque, paraUnidadeBase, rotuloUnidade, unidadesEstoque } from '../../lib/units';

/** "Comprei": pergunta quanto comprou (padrão = o que faltava) e manda para a despensa. */
export function CompraSheet({ linha, ing, semana, onClose }: { linha: LinhaLista; ing: Ingredient | undefined; semana: string; onClose: () => void }) {
  const padrao =
    linha.origem === 'avulso'
      ? (linha.quantidadeAvulso ?? null)
      : linha.falta != null && linha.unidadeBase
        ? arredondarCompra(linha.falta, linha.unidadeBase)
        : null;
  const [qtd, setQtd] = useState(padrao != null ? String(padrao).replace('.', ',') : '');
  const [unidade, setUnidade] = useState<string>(ing?.unidadeBase ?? 'un');
  const [erro, setErro] = useState<string | null>(null);

  const exato = ing?.modo === 'exato';
  const digitada = parseQuantidade(qtd);
  const base = ing && digitada != null ? paraUnidadeBase(ing, digitada, unidade) : null;

  async function comprar() {
    setErro(null);
    try {
      if (linha.origem === 'avulso') await comprarAvulso(linha.avulsoId!, exato ? base : null, semana);
      else await comprarItem(linha.ingredientId!, exato ? base : null, semana);
      onClose();
    } catch {
      setErro('Não deu para registrar a compra. Tente de novo.');
    }
  }

  return (
    <Sheet
      title={`Comprei ${linha.nome.toLowerCase()}`}
      onClose={onClose}
      footer={
        <div className="row-btns">
          {linha.origem === 'avulso' && (
            <button
              type="button"
              className="btn danger"
              onClick={async () => {
                await removerAvulso(linha.avulsoId!);
                onClose();
              }}
            >
              <Icon name="trash" />
              Tirar da lista
            </button>
          )}
          <button type="button" className="btn" onClick={comprar} disabled={exato && base == null}>
            <Icon name="check" />
            Comprei
          </button>
        </div>
      }
    >
      {linha.origem === 'cardapio' && ing && (
        <div className="buy-info">
          {linha.falta != null && linha.falta > 0 && (
            <div>
              Falta <strong>{formatEstoque(linha.falta, ing.unidadeBase)}</strong>: precisa de {formatEstoque(linha.precisa, ing.unidadeBase)}, tem{' '}
              {formatEstoque(linha.tem, ing.unidadeBase)}.
            </div>
          )}
          {linha.semConversao.length > 0 && <div>Sem conversão para calcular: {linha.semConversao.join('; ')}.</div>}
          {linha.receitas.length > 0 && <div className="muted">Para: {linha.receitas.join(', ')}</div>}
        </div>
      )}
      {linha.origem === 'nivel' && (
        <p className="muted small">Básico em "{linha.nivel}". Ao comprar, volta para "tem" na despensa.</p>
      )}
      {exato && ing && (
        <div className="field">
          <span className="label">Quanto comprou</span>
          <div className="ie-qty">
            <input className="input lg" inputMode="decimal" autoFocus value={qtd} onChange={(e) => setQtd(e.target.value)} aria-label={`Quanto comprou de ${ing.nome}`} />
            <select className="input" value={unidade} onChange={(e) => setUnidade(e.target.value)} aria-label="Unidade">
              {unidadesEstoque(ing).map((u) => (
                <option key={u} value={u}>
                  {rotuloUnidade(u, 2)}
                </option>
              ))}
            </select>
          </div>
          <span className="hint">Comprou embalagem maior? Coloque o que entrou de verdade: o resto fica na despensa.</span>
        </div>
      )}
      {!ing && <p className="muted small">Item fora do catálogo: só sai da lista, não entra na despensa.</p>}
      {erro && <div className="alert err" role="alert">{erro}</div>}
    </Sheet>
  );
}
