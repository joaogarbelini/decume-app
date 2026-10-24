import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { SubHeader } from '../components/Layout';
import { db } from '../db/db';
import { BackupError, downloadBackup, parseBackup, restoreBackup, type BackupFile } from '../lib/backup';
import { APP_VERSION } from '../lib/version';
import { definirImportadorUrl, ImportadorError, obterImportadorUrl, testarImportador } from '../lib/importador';

type Aviso = { tipo: 'ok' | 'err'; texto: string } | null;

export function AjustesScreen() {
  const total = useLiveQuery(() => db.ingredients.count(), []);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, setPendente] = useState<{ nome: string; backup: BackupFile } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function exportar() {
    setAviso(null);
    setOcupado(true);
    try {
      await downloadBackup();
      setAviso({ tipo: 'ok', texto: 'Backup gerado. Guarde o arquivo num lugar seguro, como o Drive.' });
    } catch {
      setAviso({ tipo: 'err', texto: 'Não deu para gerar o backup. Tente de novo.' });
    } finally {
      setOcupado(false);
    }
  }

  async function escolherArquivo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAviso(null);
    try {
      setPendente({ nome: file.name, backup: parseBackup(await file.text()) });
    } catch (err) {
      setAviso({ tipo: 'err', texto: err instanceof BackupError ? err.message : 'Não deu para ler o arquivo.' });
    }
  }

  async function restaurar() {
    if (!pendente) return;
    setOcupado(true);
    try {
      const n = await restoreBackup(pendente.backup);
      setAviso({ tipo: 'ok', texto: `Backup restaurado: ${n} registros.` });
    } catch (err) {
      setAviso({ tipo: 'err', texto: err instanceof BackupError ? err.message : 'Não deu para restaurar. Seus dados não foram alterados.' });
    } finally {
      setPendente(null);
      setOcupado(false);
    }
  }

  return (
    <>
      <SubHeader title="Ajustes" />
      <main className="view">
        <section className="sec">
          <div className="sec-h">
            <h2>Ingredientes</h2>
          </div>
          <div className="card">
            <div className="list">
              <Link className="li" to="/ajustes/catalogo">
                <div className="grow">
                  <div className="name">Catálogo de ingredientes</div>
                  <div className="sub">{total ?? '…'} ingredientes com dados da tabela TACO</div>
                </div>
                <Icon name="chevron" />
              </Link>
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="sec-h">
            <h2>Backup</h2>
          </div>
          <p className="note">
            <Icon name="info" />
            <span>Seus dados ficam só neste celular. Faça um backup de vez em quando para não perder nada se trocar de aparelho.</span>
          </p>
          <div className="row-btns">
            <button className="btn" onClick={exportar} disabled={ocupado}>
              <Icon name="download" />
              Exportar backup
            </button>
            <button className="btn ghost" onClick={() => fileRef.current?.click()} disabled={ocupado}>
              <Icon name="upload" />
              Restaurar
            </button>
          </div>
          <input
            ref={fileRef}
            id="backup-file"
            className="file-input"
            type="file"
            accept="application/json,.json"
            onChange={escolherArquivo}
            aria-label="Escolher arquivo de backup"
          />
          {pendente && (
            <div className="confirm" role="alertdialog" aria-label="Confirmar restauração">
              <strong>Restaurar {pendente.nome}?</strong>
              <span className="small">
                Tudo o que está no app agora será trocado pelo conteúdo do backup, feito em{' '}
                {new Date(pendente.backup.exportadoEm).toLocaleString('pt-BR')}.
              </span>
              <div className="row-btns">
                <button className="btn ghost sm" onClick={() => setPendente(null)} disabled={ocupado}>
                  Cancelar
                </button>
                <button className="btn sm" onClick={restaurar} disabled={ocupado}>
                  Restaurar backup
                </button>
              </div>
            </div>
          )}
          {aviso && (
            <div className={`alert ${aviso.tipo}`} role="status">
              {aviso.texto}
            </div>
          )}
        </section>

        <ImportadorAjuste />

        <section className="sec">
          <div className="sec-h">
            <h2>Sobre</h2>
          </div>
          <p className="note">
            <span>
              deCumê versão {APP_VERSION}. Dados nutricionais da TACO (Tabela Brasileira de Composição de Alimentos, NEPA/Unicamp).
            </span>
          </p>
        </section>
      </main>
    </>
  );
}

/** Endereço do importador de receitas (Cloudflare Worker em worker/ no repositório). */
function ImportadorAjuste() {
  const salvo = useLiveQuery(async () => (await obterImportadorUrl()) ?? '', []);
  const [valor, setValor] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [ocupado, setOcupado] = useState(false);
  const atual = valor ?? salvo ?? '';

  async function salvar() {
    setAviso(null);
    setOcupado(true);
    try {
      if (atual.trim()) await testarImportador(atual.trim());
      await definirImportadorUrl(atual);
      setValor(null);
      setAviso({ tipo: 'ok', texto: atual.trim() ? 'Importador funcionando. Já dá para importar pelo link.' : 'Importador removido.' });
    } catch (e) {
      setAviso({ tipo: 'err', texto: e instanceof ImportadorError ? e.message : 'Não deu para salvar.' });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="sec">
      <div className="sec-h">
        <h2>Importação por link</h2>
      </div>
      <div className="ajuste-imp">
        <p className="note">
          <Icon name="info" />
          <span>Endereço do importador, o serviço que busca a página da receita (ex.: https://decume-importador.seu-usuario.workers.dev). Sem ele, dá para importar colando o texto.</span>
        </p>
        <input
          className="input"
          type="url"
          inputMode="url"
          value={atual}
          onChange={(e) => setValor(e.target.value)}
          placeholder="https://…workers.dev"
          aria-label="Endereço do importador"
        />
        <button className="btn ghost" onClick={salvar} disabled={ocupado || atual === (salvo ?? '')}>
          {ocupado ? 'Testando…' : 'Testar e salvar'}
        </button>
        {aviso && (
          <div className={`alert ${aviso.tipo}`} role="status">
            {aviso.texto}
          </div>
        )}
      </div>
    </section>
  );
}
