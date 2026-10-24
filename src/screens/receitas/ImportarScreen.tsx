import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCatalogo } from '../../components/hooks';
import { Icon } from '../../components/Icon';
import { SubHeader } from '../../components/Layout';
import { adicionarFoto, salvarRascunho } from '../../db/recipes';
import { ImportError, montarRascunho, receitaDoHtml, receitaDoTexto, type ReceitaImportada } from '../../lib/importar';
import { baixarImagem, buscarPagina, ImportadorError, obterImportadorUrl } from '../../lib/importador';
import { comprimirFoto } from '../../lib/photos';

/** Importar por link (pelo importador) ou colando o texto da receita. Vira rascunho para revisar. */
export function ImportarScreen() {
  const navigate = useNavigate();
  const catalogo = useCatalogo();
  const importador = useLiveQuery(async () => (await obterImportadorUrl()) ?? '', []);
  const [link, setLink] = useState('');
  const [texto, setTexto] = useState('');
  const [modo, setModo] = useState<'link' | 'texto'>('link');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function criar(r: ReceitaImportada) {
    if (!catalogo) return;
    const id = await salvarRascunho(montarRascunho(r, catalogo));
    if (r.imagem && importador) {
      setOcupado('Baixando a foto…');
      try {
        await adicionarFoto(id, await comprimirFoto(await baixarImagem(r.imagem)));
      } catch {
        // sem foto, tudo bem: dá para adicionar depois
      }
    }
    navigate(`/receitas/${id}/editar`, { replace: true });
  }

  async function porLink() {
    setErro(null);
    const url = link.trim();
    if (!/^https?:\/\//i.test(url)) return setErro('Cole o link completo, começando com https://');
    setOcupado('Buscando a receita…');
    try {
      const pagina = await buscarPagina(url);
      await criar(receitaDoHtml(pagina.html, pagina.url));
    } catch (e) {
      setErro(e instanceof ImportError || e instanceof ImportadorError ? e.message : 'Não deu para ler essa página.');
      setOcupado(null);
    }
  }

  async function porTexto() {
    setErro(null);
    setOcupado('Lendo o texto…');
    try {
      const r = receitaDoTexto(texto);
      await criar({ ...r, fonteUrl: link.trim() || null });
    } catch (e) {
      setErro(e instanceof ImportError ? e.message : 'Não deu para ler esse texto.');
      setOcupado(null);
    }
  }

  return (
    <>
      <SubHeader title="Importar receita" />
      <main className="view form-view">
        <div className="seg" role="radiogroup" aria-label="Como importar">
          <button type="button" role="radio" aria-checked={modo === 'link'} className={modo === 'link' ? 'on' : ''} onClick={() => { setModo('link'); setErro(null); }}>
            Pelo link
          </button>
          <button type="button" role="radio" aria-checked={modo === 'texto'} className={modo === 'texto' ? 'on' : ''} onClick={() => { setModo('texto'); setErro(null); }}>
            Colando o texto
          </button>
        </div>

        {modo === 'link' ? (
          <section className="sec form">
            {importador === '' && (
              <div className="alert warn" role="note">
                Para buscar pelo link, o app precisa do importador (um serviço pequeno na internet). Configure em{' '}
                <Link to="/ajustes">Ajustes</Link>. Enquanto isso, use "Colando o texto".
              </div>
            )}
            <label className="field">
              <span className="label">Link da receita</span>
              <input
                className="input"
                type="url"
                inputMode="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://www.tudogostoso.com.br/receita/…"
                aria-label="Link da receita"
              />
              <span className="hint">Funciona melhor com o TudoGostoso. Outros sites funcionam quando a página traz os dados de receita no padrão schema.org.</span>
            </label>
            <button type="button" className="btn block" onClick={porLink} disabled={!!ocupado || !importador || !link.trim()}>
              <Icon name="download" />
              {ocupado ?? 'Buscar receita'}
            </button>
          </section>
        ) : (
          <section className="sec form">
            <p className="muted small">
              No site, selecione a receita do título até o fim do modo de preparo, copie e cole aqui. Precisa ter as linhas "Ingredientes" e "Modo de preparo".
            </p>
            <label className="field">
              <span className="label">Texto da receita</span>
              <textarea
                className="input"
                rows={12}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={'Bolo de cenoura\nIngredientes (8 porções)\n1/2 xícara (chá) de óleo\n3 cenouras médias raladas\n…\nModo de preparo\nBata no liquidificador…'}
                aria-label="Texto da receita"
              />
            </label>
            <label className="field">
              <span className="label">Link de origem (opcional)</span>
              <input className="input" type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
            </label>
            <button type="button" className="btn block" onClick={porTexto} disabled={!!ocupado || !texto.trim()}>
              <Icon name="check" />
              {ocupado ?? 'Ler receita'}
            </button>
          </section>
        )}

        {erro && (
          <div className="alert err" role="alert">
            {erro}
          </div>
        )}
        <p className="note">
          <Icon name="info" />
          <span>A receita entra como rascunho. Na revisão você confere os ingredientes e salva como sua; só depois ela aparece no cardápio e nas sugestões.</span>
        </p>
      </main>
    </>
  );
}
