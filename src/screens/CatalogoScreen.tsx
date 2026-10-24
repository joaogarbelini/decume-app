import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { SubHeader } from '../components/Layout';
import { db } from '../db/db';
import { SECOES, type Ingredient } from '../db/types';

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function unidadeTexto(i: Ingredient) {
  if (i.unidadeBase === 'un') return i.pesoUnidadeG ? `unidade (~${i.pesoUnidadeG} g)` : 'unidade';
  return i.unidadeBase;
}

export function CatalogoScreen() {
  const ingredientes = useLiveQuery(() => db.ingredients.orderBy('nome').toArray(), []);
  const [busca, setBusca] = useState('');

  const grupos = useMemo(() => {
    const q = semAcento(busca.trim());
    const lista = (ingredientes ?? []).filter(
      (i) => !q || semAcento(i.nome).includes(q) || i.apelidos.some((a) => semAcento(a).includes(q)),
    );
    return SECOES.map((s) => [s, lista.filter((i) => i.secao === s)] as const).filter(([, l]) => l.length);
  }, [ingredientes, busca]);

  return (
    <>
      <SubHeader title="Catálogo de ingredientes" />
      <main className="view">
        <label className="search">
          <Icon name="search" />
          <input
            id="busca-catalogo"
            type="search"
            placeholder="Buscar ingrediente ou apelido"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar ingrediente"
          />
        </label>
        {ingredientes && !grupos.length && <div className="card empty-state"><p>Nada encontrado para "{busca}".</p></div>}
        {grupos.map(([secao, lista]) => (
          <section className="sec" key={secao}>
            <div className="sec-h">
              <h2>{secao}</h2>
              <span className="meta">
                {lista.length} {lista.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
            <div className="card">
              <div className="list">
                {lista.map((i) => (
                  <div className="li" key={i.id}>
                    <div className="grow">
                      <div className="name">{i.nome}</div>
                      <div className="sub">
                        {i.modo === 'nivel' ? 'básico, por nível' : unidadeTexto(i)}
                        {' · '}
                        {i.nutri100g ? `${Math.round(i.nutri100g.kcal)} kcal por 100 ${i.unidadeBase === 'ml' ? 'ml' : 'g'}` : 'sem dados da TACO'}
                      </div>
                    </div>
                    <div className="metas">
                      {i.sempreTenho && <span className="chip neu">sempre tenho</span>}
                      {i.carneOuPeixe && <span className="chip miss">carne/peixe</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
