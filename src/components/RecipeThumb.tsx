import { useFotoUrl } from './hooks';
import { Icon } from './Icon';

/** Miniatura da capa da receita; sem foto, mostra um prato desenhado. */
export function RecipeThumb({ capaId, size = 84 }: { capaId: string | null; size?: number }) {
  const url = useFotoUrl(capaId);
  return (
    <div className="thumb" style={{ width: size, height: size }}>
      {url ? <img src={url} alt="" /> : <Icon name="bowl" />}
    </div>
  );
}
