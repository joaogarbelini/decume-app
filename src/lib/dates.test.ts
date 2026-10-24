import { describe, expect, it } from 'vitest';
import { chaveSemana, proximaSemana, rotuloSemana } from './dates';

describe('semanas', () => {
  it('a semana começa na segunda', () => {
    expect(chaveSemana(new Date(2026, 9, 24))).toBe('2026-10-19'); // sábado
    expect(chaveSemana(new Date(2026, 9, 25))).toBe('2026-10-19'); // domingo
    expect(chaveSemana(new Date(2026, 9, 26))).toBe('2026-10-26'); // segunda
  });

  it('rótulos dentro e entre meses', () => {
    expect(rotuloSemana(new Date(2026, 9, 24))).toBe('19 – 25 out');
    expect(rotuloSemana(proximaSemana(new Date(2026, 9, 24)))).toBe('26 out – 1 nov');
  });
});
