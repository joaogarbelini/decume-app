/** Lado maior das fotos guardadas, em px (guideline: ~1200 px para não encher o celular). */
export const FOTO_MAX_PX = 1200;

/** Tamanho final mantendo a proporção, sem nunca aumentar a imagem. */
export function encaixar(largura: number, altura: number, max = FOTO_MAX_PX): { largura: number; altura: number } {
  const maior = Math.max(largura, altura);
  if (maior <= max) return { largura, altura };
  const f = max / maior;
  return { largura: Math.round(largura * f), altura: Math.round(altura * f) };
}

/**
 * Reduz e recomprime a foto no próprio celular (JPEG, ~1200 px no lado maior).
 * Respeita a orientação da câmera (EXIF).
 */
export async function comprimirFoto(arquivo: Blob, max = FOTO_MAX_PX, qualidade = 0.82): Promise<Blob> {
  const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  try {
    const { largura, altura } = encaixar(bmp.width, bmp.height, max);
    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível');
    ctx.drawImage(bmp, 0, 0, largura, altura);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', qualidade));
    if (!blob) throw new Error('Não deu para comprimir a foto');
    return blob;
  } finally {
    bmp.close();
  }
}
