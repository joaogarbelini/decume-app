import type { Nivel } from '../../db/types';

const NIVEIS: { v: Nivel; texto: string }[] = [
  { v: 'tem', texto: 'Tem' },
  { v: 'pouco', texto: 'Pouco' },
  { v: 'acabou', texto: 'Acabou' },
];

/** Três botões tem / pouco / acabou. O nível aparece em texto e cor, nunca só cor. */
export function NiveisBotoes({ nivel, onChange, nome, grande }: { nivel: Nivel | null; onChange: (n: Nivel) => void; nome: string; grande?: boolean }) {
  return (
    <div className={`niveis ${grande ? 'lg' : ''}`} role="radiogroup" aria-label={`Nível de ${nome}`}>
      {NIVEIS.map((n) => (
        <button
          type="button"
          key={n.v}
          role="radio"
          aria-checked={nivel === n.v}
          className={`nv ${n.v} ${nivel === n.v ? 'on' : ''}`}
          onClick={() => onChange(n.v)}
        >
          {n.texto}
        </button>
      ))}
    </div>
  );
}
