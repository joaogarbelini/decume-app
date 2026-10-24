// Leitura e escrita de quantidades do jeito que se escreve receita: "1/2", "1 1/2", "½", "0,5".

const FRACOES_UNICODE: Record<string, number> = {
  '½': 0.5,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 0.25,
  '¾': 0.75,
  '⅕': 0.2,
  '⅛': 0.125,
};

/** "1 1/2" → 1.5; "½" → 0.5; "0,5" → 0.5; vazio ou inválido → null. */
export function parseQuantidade(texto: string): number | null {
  let s = texto.trim().toLowerCase();
  if (!s) return null;
  // "1½" → "1 ½"
  s = s.replace(/(\d)([½⅓⅔¼¾⅕⅛])/g, '$1 $2');
  let total = 0;
  const partes = s.split(/\s+/);
  if (partes.length > 2) return null;
  for (const p of partes) {
    let v: number | null = null;
    if (p in FRACOES_UNICODE) v = FRACOES_UNICODE[p];
    else if (/^\d+\/\d+$/.test(p)) {
      const [a, b] = p.split('/').map(Number);
      v = b ? a / b : null;
    } else if (/^\d+([.,]\d+)?$/.test(p)) v = Number(p.replace(',', '.'));
    if (v == null || !Number.isFinite(v)) return null;
    total += v;
  }
  return total > 0 ? total : null;
}

const FRACOES_EXIBIR: [number, string][] = [
  [0.25, '¼'],
  [1 / 3, '⅓'],
  [0.5, '½'],
  [2 / 3, '⅔'],
  [0.75, '¾'],
];

/**
 * Quantidade para exibir. Medidas caseiras e unidades viram frações ("1 ½");
 * gramas e ml viram números inteiros ou com uma casa ("250", "2,5").
 */
export function formatQuantidade(q: number, comFracao = true): string {
  if (!Number.isFinite(q)) return '';
  if (comFracao) {
    const inteiro = Math.floor(q + 1e-9);
    const resto = q - inteiro;
    if (resto < 0.05) return String(inteiro || q.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
    if (resto > 0.95) return String(inteiro + 1);
    for (const [v, s] of FRACOES_EXIBIR) {
      if (Math.abs(resto - v) < 0.04) return inteiro ? `${inteiro} ${s}` : s;
    }
  }
  if (q >= 10) return String(Math.round(q));
  return q.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}
