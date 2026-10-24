import type { Ingredient, MotivoMovimento, PantryMovement } from '../../db/types';
import { formatEstoque } from '../../lib/units';

export const MOTIVO: Record<MotivoMovimento, string> = {
  compra: 'Compra da lista',
  avulsa: 'Compra avulsa',
  ajuste: 'Ajuste',
  cozinhou: 'Cozinhou',
};

/** referência das entradas "Já tinha em casa" (inventário), para o histórico mostrar assim */
export const JA_TINHA = 'ja-tinha';

export const rotuloMotivo = (m: PantryMovement) => (m.referencia === JA_TINHA ? 'Já tinha em casa' : MOTIVO[m.motivo]);

const NIVEL_TEXTO = { tem: 'tem', pouco: 'pouco', acabou: 'acabou' } as const;

export function textoMovimento(m: PantryMovement, ing?: Ingredient): string {
  if (m.novoNivel) return `→ ${NIVEL_TEXTO[m.novoNivel]}`;
  if (m.delta == null) return '';
  const sinal = m.delta > 0 ? '+' : '−';
  return `${sinal}${formatEstoque(Math.abs(m.delta), ing?.unidadeBase ?? 'g')}`;
}

export function MovimentoLinha({ m, ing, mostrarData, mostrarNome }: { m: PantryMovement; ing?: Ingredient; mostrarData?: boolean; mostrarNome?: boolean }) {
  const quando = new Date(m.data);
  const hora = quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const data = quando.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
  const positivo = (m.delta ?? 0) > 0 || m.novoNivel === 'tem';
  return (
    <div className="li mov">
      <div className="grow">
        {mostrarNome && <div className="name">{ing?.nome ?? m.ingredientId}</div>}
        <div className={mostrarNome ? 'sub' : 'name'}>
          {rotuloMotivo(m)}
          {mostrarNome ? ` · ${hora}` : ''}
        </div>
        {mostrarData && <div className="sub">{`${data}, ${hora}`}</div>}
      </div>
      <div className={`qty ${positivo ? 'pos' : 'neg'}`}>{textoMovimento(m, ing)}</div>
    </div>
  );
}
