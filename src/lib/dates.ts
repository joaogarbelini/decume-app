const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Segunda-feira (meia-noite local) da semana de `d`. */
export function inicioDaSemana(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dia = x.getDay(); // 0 = domingo
  x.setDate(x.getDate() - (dia === 0 ? 6 : dia - 1));
  return x;
}

/** Chave da semana: data ISO local (AAAA-MM-DD) da segunda-feira. */
export function chaveSemana(d: Date): string {
  const s = inicioDaSemana(d);
  const mm = String(s.getMonth() + 1).padStart(2, '0');
  const dd = String(s.getDate()).padStart(2, '0');
  return `${s.getFullYear()}-${mm}-${dd}`;
}

/** "19 – 25 out" ou "26 out – 1 nov" */
export function rotuloSemana(d: Date): string {
  const ini = inicioDaSemana(d);
  const fim = new Date(ini);
  fim.setDate(ini.getDate() + 6);
  const mesmoMes = ini.getMonth() === fim.getMonth();
  return mesmoMes
    ? `${ini.getDate()} – ${fim.getDate()} ${MESES[fim.getMonth()]}`
    : `${ini.getDate()} ${MESES[ini.getMonth()]} – ${fim.getDate()} ${MESES[fim.getMonth()]}`;
}

export function proximaSemana(d: Date): Date {
  const x = inicioDaSemana(d);
  x.setDate(x.getDate() + 7);
  return x;
}
