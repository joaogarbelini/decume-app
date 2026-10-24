import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../db/db';
import type { Ingredient } from '../db/types';

/** Catálogo inteiro como Map (id → ingrediente), sempre atualizado. undefined enquanto carrega. */
export function useCatalogo(): Map<string, Ingredient> | undefined {
  const lista = useLiveQuery(() => db.ingredients.toArray(), []);
  return useMemo(() => (lista ? new Map(lista.map((i) => [i.id, i])) : undefined), [lista]);
}

/** URL temporária para exibir um Blob (foto); liberada quando o Blob muda ou o componente sai. */
export function useBlobUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

/** URL da foto pelo id, lida do banco. */
export function useFotoUrl(fotoId: string | null | undefined): string | null {
  const foto = useLiveQuery(() => (fotoId ? db.photos.get(fotoId) : undefined), [fotoId]);
  return useBlobUrl(foto?.blob);
}
