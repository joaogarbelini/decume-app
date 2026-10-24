import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState, type ChangeEvent } from 'react';
import { useBlobUrl } from '../../components/hooks';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { db } from '../../db/db';
import { adicionarFoto, definirCapa, excluirFoto } from '../../db/recipes';
import type { Photo } from '../../db/types';
import { comprimirFoto } from '../../lib/photos';

/** Input escondido + função para abrir o seletor de fotos e salvar as escolhidas já comprimidas. */
export function useAdicionarFotos(recipeId: string) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onChange(e: ChangeEvent<HTMLInputElement>) {
    const arquivos = [...(e.target.files ?? [])];
    e.target.value = '';
    if (!arquivos.length) return;
    setErro(null);
    setProcessando(true);
    let falhas = 0;
    for (const a of arquivos) {
      try {
        await adicionarFoto(recipeId, await comprimirFoto(a));
      } catch {
        falhas++;
      }
    }
    setProcessando(false);
    if (falhas) setErro(falhas === 1 ? 'Uma foto não pôde ser lida. Tente outra imagem.' : `${falhas} fotos não puderam ser lidas.`);
  }

  const input = (
    <input ref={inputRef} className="file-input" type="file" accept="image/*" multiple onChange={onChange} aria-label="Escolher fotos" tabIndex={-1} />
  );
  return { abrir: () => inputRef.current?.click(), input, processando, erro };
}

export function PhotoGallery({ recipeId, capaId }: { recipeId: string; capaId: string | null }) {
  const fotos = useLiveQuery(() => db.photos.where('recipeId').equals(recipeId).sortBy('criadoEm'), [recipeId]);
  const { abrir, input, processando, erro } = useAdicionarFotos(recipeId);
  const [aberta, setAberta] = useState<Photo | null>(null);

  return (
    <section className="sec">
      <div className="sec-h">
        <h2>Fotos</h2>
        {fotos && fotos.length > 0 && <span className="meta">{fotos.length}</span>}
      </div>
      <div className="gallery">
        {fotos?.map((f) => (
          <Thumb key={f.id} foto={f} capa={f.id === capaId} onOpen={() => setAberta(f)} />
        ))}
        <button type="button" className="gadd" onClick={abrir} disabled={processando}>
          <Icon name="camera" />
          <span>{processando ? 'Salvando…' : 'Adicionar'}</span>
        </button>
      </div>
      {input}
      {erro && (
        <div className="alert err" role="alert">
          {erro}
        </div>
      )}
      {aberta && <FotoSheet foto={aberta} capa={aberta.id === capaId} onClose={() => setAberta(null)} />}
    </section>
  );
}

function Thumb({ foto, capa, onOpen }: { foto: Photo; capa: boolean; onOpen: () => void }) {
  const url = useBlobUrl(foto.blob);
  return (
    <button type="button" className="gthumb" onClick={onOpen} aria-label={capa ? 'Foto de capa' : 'Abrir foto'}>
      {url && <img src={url} alt="" />}
      {capa && (
        <span className="gcapa">
          <Icon name="star" />
          capa
        </span>
      )}
    </button>
  );
}

function FotoSheet({ foto, capa, onClose }: { foto: Photo; capa: boolean; onClose: () => void }) {
  const url = useBlobUrl(foto.blob);
  const [confirmar, setConfirmar] = useState(false);
  return (
    <Sheet
      title="Foto"
      onClose={onClose}
      footer={
        confirmar ? (
          <div className="row-btns">
            <button type="button" className="btn ghost" onClick={() => setConfirmar(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn danger"
              onClick={async () => {
                await excluirFoto(foto.id);
                onClose();
              }}
            >
              Excluir de vez
            </button>
          </div>
        ) : (
          <div className="row-btns">
            <button type="button" className="btn danger" onClick={() => setConfirmar(true)}>
              <Icon name="trash" />
              Excluir
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={capa}
              onClick={async () => {
                await definirCapa(foto.recipeId, foto.id);
                onClose();
              }}
            >
              <Icon name="star" />
              {capa ? 'É a capa' : 'Usar como capa'}
            </button>
          </div>
        )
      }
    >
      {url && <img className="foto-full" src={url} alt="" />}
      <p className="muted small">{new Date(foto.criadoEm).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    </Sheet>
  );
}
