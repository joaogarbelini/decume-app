import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { RecipeThumb } from '../../components/RecipeThumb';
import { Nota } from '../../components/Stars';
import { faltantesParaLista } from '../../db/sugestoes';
import type { Sugestao } from '../../lib/sugestoes';
import { formatEstoque } from '../../lib/units';

/** Chip de cobertura: texto sempre junto da cor. */
export function CoberturaChip({ s }: { s: Pick<Sugestao, 'cobertura'> }) {
  const f = s.cobertura.faltantes.length;
  if (!s.cobertura.necessarios) return null;
  if (!f)
    return (
      <span className="chip ok">
        <Icon name="check" />
        tem tudo
      </span>
    );
  return <span className="chip miss">{f === 1 ? 'falta 1 item' : `falta ${f} itens`}</span>;
}

export function SugestaoCard({ s, compacto }: { s: Sugestao; compacto?: boolean }) {
  const [aviso, setAviso] = useState<string | null>(null);
  const r = s.recipe;
  return (
    <div className="card rcard sug-card">
      <RecipeThumb capaId={r.capaFotoId} size={compacto ? 64 : 84} />
      <div className="grow">
        <Link className="rtitle plain" to={`/receitas/${r.id}`}>
          {r.titulo}
        </Link>
        <div className="metas">
          <CoberturaChip s={s} />
          {s.nota != null && <Nota valor={s.nota} />}
          {s.naoFariaDeNovo && <span className="chip neu">não faria de novo</span>}
        </div>
        {s.faixa !== 'pronta' && !compacto && (
          <div className="sub falta-lista">
            Falta: {s.cobertura.faltantes.map((f) => (f.falta != null ? `${f.nome.toLowerCase()} (${formatEstoque(f.falta, f.unidadeBase)})` : f.nome.toLowerCase())).join(', ')}
          </div>
        )}
        {!compacto && (
          <div className="row-btns week-actions">
            {s.faixa === 'pronta' ? (
              <Link className="btn sm" to={`/cozinhar/${r.id}`}>
                <Icon name="pot" />
                Cozinhar
              </Link>
            ) : (
              <button
                type="button"
                className="btn ghost sm"
                onClick={async () => {
                  const n = await faltantesParaLista(s);
                  setAviso(n ? 'Na lista de compras.' : 'Já estava na lista.');
                }}
              >
                <Icon name="plan" />
                Pôr o que falta na lista
              </button>
            )}
          </div>
        )}
        {aviso && <div className="sub ok-text">{aviso}</div>}
      </div>
    </div>
  );
}
