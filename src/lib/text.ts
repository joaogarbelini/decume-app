/** Minúsculas e sem acento, para busca: "Maçã" → "maca". */
export const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** true se todas as palavras da busca aparecem no texto (sem acento, sem diferença de caixa). */
export function casaBusca(busca: string, ...textos: string[]): boolean {
  const palavras = semAcento(busca).split(/\s+/).filter(Boolean);
  if (!palavras.length) return true;
  const alvo = semAcento(textos.join(' '));
  return palavras.every((p) => alvo.includes(p));
}

export function plural(n: number, um: string, varios: string): string {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;
}
