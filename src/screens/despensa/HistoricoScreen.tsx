import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useCatalogo } from '../../components/hooks';
import { EmptyState, SubHeader } from '../../components/Layout';
import { historico } from '../../db/pantry';
import type { PantryMovement } from '../../db/types';
import { MovimentoLinha } from './MovimentoLinha';

const PAGINA = 100;

function rotuloDia(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  const mesmo = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mesmo(d, hoje)) return 'Hoje';
  if (mesmo(d, ontem)) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function HistoricoScreen() {
  const catalogo = useCatalogo();
  const [limite, setLimite] = useState(PAGINA);
  const movimentos = useLiveQuery(() => historico({ limite: limite + 1 }), [limite]);

  const dias = useMemo(() => {
    const m = new Map<string, PantryMovement[]>();
    for (const mov of (movimentos ?? []).slice(0, limite)) {
      const k = rotuloDia(mov.data);
      m.set(k, [...(m.get(k) ?? []), mov]);
    }
    return [...m];
  }, [movimentos, limite]);

  return (
    <>
      <SubHeader title="Histórico da despensa" />
      <main className="view">
        {movimentos && !movimentos.length && (
          <EmptyState icon="list" title="Nenhum movimento ainda">
            Compras, ajustes e o que for usado ao cozinhar aparecem aqui.
          </EmptyState>
        )}
        {dias.map(([dia, lista]) => (
          <section className="sec" key={dia}>
            <div className="sec-h">
              <h2 className="cap">{dia}</h2>
            </div>
            <div className="card">
              <div className="list">
                {lista.map((m) => (
                  <MovimentoLinha key={m.id} m={m} ing={catalogo?.get(m.ingredientId)} mostrarNome />
                ))}
              </div>
            </div>
          </section>
        ))}
        {movimentos && movimentos.length > limite && (
          <button type="button" className="btn ghost block" onClick={() => setLimite(limite + PAGINA)}>
            Ver mais antigos
          </button>
        )}
      </main>
    </>
  );
}
