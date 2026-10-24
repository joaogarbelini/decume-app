import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { SubHeader } from '../../components/Layout';
import { carregarSugestoes } from '../../db/sugestoes';
import type { Faixa } from '../../lib/sugestoes';
import { plural } from '../../lib/text';
import { SugestaoCard } from './SugestaoCard';

const TITULO: Record<Faixa, string> = { pronta: 'Dá pra fazer', quase: 'Falta pouco', comprar: 'Precisa comprar' };

/** O que dá pra cozinhar com o que tem em casa, entre as receitas salvas. */
export function SugestoesScreen() {
  const todas = useLiveQuery(() => carregarSugestoes(), []);
  const [verComprar, setVerComprar] = useState(false);
  const [verEscondidas, setVerEscondidas] = useState(false);

  if (!todas) return <SubHeader title="O que dá pra fazer" />;
  const escondidas = todas.filter((s) => s.naoFariaDeNovo);
  const lista = verEscondidas ? todas : todas.filter((s) => !s.naoFariaDeNovo);
  const por = (f: Faixa) => lista.filter((s) => s.faixa === f);

  return (
    <>
      <SubHeader title="O que dá pra fazer" />
      <main className="view">
        <p className="note">
          <Icon name="info" />
          <span>Pelas receitas salvas e o que tem na despensa. Básicos sem nível marcado contam como "tem". Na frente, as de nota maior e as que usam o que está parado há mais tempo.</span>
        </p>
        {!todas.length && (
          <div className="card empty-state">
            <p>Salve receitas no livro para ver sugestões.</p>
            <Link className="btn" to="/receitas/nova">
              <Icon name="plus" />
              Nova receita
            </Link>
          </div>
        )}
        {(['pronta', 'quase'] as const).map((f) => (
          <section className="sec" key={f}>
            <div className="sec-h">
              <h2>{TITULO[f]}</h2>
              <span className="meta">{por(f).length || ''}</span>
            </div>
            {por(f).length ? (
              <div className="recipe-list">
                {por(f).map((s) => (
                  <SugestaoCard key={s.recipe.id} s={s} />
                ))}
              </div>
            ) : (
              <p className="muted small">{f === 'pronta' ? 'Nenhuma receita com tudo em casa agora.' : 'Nenhuma receita a 1 ou 2 itens de distância.'}</p>
            )}
          </section>
        ))}
        {por('comprar').length > 0 && (
          <section className="sec">
            <button type="button" className="sec-h toggle-h" onClick={() => setVerComprar(!verComprar)} aria-expanded={verComprar}>
              <h2>{TITULO.comprar}</h2>
              <span className="meta">
                {por('comprar').length} <Icon name={verComprar ? 'up' : 'down'} />
              </span>
            </button>
            {verComprar && (
              <div className="recipe-list">
                {por('comprar').map((s) => (
                  <SugestaoCard key={s.recipe.id} s={s} />
                ))}
              </div>
            )}
          </section>
        )}
        {escondidas.length > 0 && (
          <button type="button" className="btn ghost sm" onClick={() => setVerEscondidas(!verEscondidas)}>
            {verEscondidas ? 'Esconder' : 'Mostrar'} {plural(escondidas.length, 'receita marcada', 'receitas marcadas')} como "não faria de novo"
          </button>
        )}
      </main>
    </>
  );
}
