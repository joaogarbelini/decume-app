import { Icon } from './Icon';

/** Nota de 1 a 5 em estrelas. Tocar na mesma estrela de novo limpa. */
export function Stars({ valor, onChange, rotulo }: { valor: number; onChange: (v: number) => void; rotulo: string }) {
  return (
    <div className="stars" role="radiogroup" aria-label={rotulo}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          role="radio"
          aria-checked={valor === n}
          aria-label={`${rotulo}: ${n} de 5`}
          className={`star ${n <= valor ? 'on' : ''}`}
          onClick={() => onChange(valor === n ? 0 : n)}
        >
          <Icon name="star" />
        </button>
      ))}
    </div>
  );
}

/** Nota só para ler: "★ 4,3". */
export function Nota({ valor, vezes }: { valor: number; vezes?: number }) {
  return (
    <span className="nota" aria-label={`Nota ${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} de 5`}>
      <Icon name="star" />
      {valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
      {vezes ? <small> ({vezes})</small> : null}
    </span>
  );
}
