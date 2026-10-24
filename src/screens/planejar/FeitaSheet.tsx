import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useCatalogo } from '../../components/hooks';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { db } from '../../db/db';
import type { WeekRecipe } from '../../db/types';
import { calcularBaixaPrevista, marcarFeita } from '../../db/week';
import { formatEstoque } from '../../lib/units';

/** Marcar como feita: mostra o que vai sair da despensa e confirma. */
export function FeitaSheet({ w, onClose }: { w: WeekRecipe; onClose: () => void }) {
  const catalogo = useCatalogo();
  const dados = useLiveQuery(async () => {
    const r = await db.recipes.get(w.recipeId);
    const linhas = r ? await db.recipeIngredients.where('recipeId').equals(r.id).toArray() : [];
    const despensa = new Map((await db.pantry.toArray()).map((p) => [p.ingredientId, p.quantidade ?? 0]));
    return { r, linhas, despensa };
  }, [w.recipeId]);
  const [faltas, setFaltas] = useState<{ ingredientId: string; faltou: number }[] | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (!catalogo || !dados?.r) return null;
  const baixas = calcularBaixaPrevista(dados.linhas, dados.r.porcoes, w.porcoes, catalogo);
  const basicos = [...new Set(dados.linhas.map((l) => (l.ingredientId ? catalogo.get(l.ingredientId) : undefined)).filter((i) => i && i.modo === 'nivel' && !i.sempreTenho).map((i) => i!.nome))];

  if (faltas) {
    return (
      <Sheet title="Feita!" onClose={onClose} footer={<button type="button" className="btn block" onClick={onClose}>Ok</button>}>
        {faltas.length ? (
          <div className="alert warn" role="status">
            A despensa tinha menos do que a receita usa. Ficou zerado:{' '}
            {faltas.map((f) => {
              const ing = catalogo.get(f.ingredientId);
              return `${ing?.nome ?? f.ingredientId} (faltaram ${formatEstoque(f.faltou, ing?.unidadeBase ?? 'g')})`;
            }).join('; ')}
            .
          </div>
        ) : (
          <div className="alert ok" role="status">
            Baixa feita na despensa.
          </div>
        )}
        {basicos.length > 0 && <p className="muted small">Se algum básico ({basicos.join(', ').toLowerCase()}) ficou no fim, marque "pouco" na Despensa.</p>}
      </Sheet>
    );
  }

  return (
    <Sheet
      title={`Fiz ${dados.r.titulo.toLowerCase()}`}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="btn block"
          disabled={salvando}
          onClick={async () => {
            setSalvando(true);
            setFaltas(await marcarFeita(w.id));
          }}
        >
          <Icon name="check" />
          Confirmar e dar baixa
        </button>
      }
    >
      <p className="muted small">
        {w.porcoes} {w.porcoes === 1 ? 'porção' : 'porções'}. Vai sair da despensa:
      </p>
      {baixas.length ? (
        <div className="list mini-hist">
          {baixas.map((b) => {
            const ing = catalogo.get(b.ingredientId)!;
            const tem = dados.despensa.get(b.ingredientId) ?? 0;
            return (
              <div className="li mov" key={b.ingredientId}>
                <div className="grow">
                  <div className="name">{ing.nome}</div>
                  <div className="sub">tem {formatEstoque(tem, ing.unidadeBase)}</div>
                </div>
                <div className={`qty ${tem < b.quantidade - 1e-6 ? 'neg' : ''}`}>−{formatEstoque(b.quantidade, ing.unidadeBase)}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="muted small">Nada com quantidade para baixar.</p>
      )}
    </Sheet>
  );
}
