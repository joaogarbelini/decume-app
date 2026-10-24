import { db as defaultDb, type DecumeDB } from '../db/db';

/** Endereço do serviço que busca as páginas (Cloudflare Worker em worker/). Guardado no aparelho. */
const CHAVE = 'importadorUrl';

export class ImportadorError extends Error {}

export async function obterImportadorUrl(d: DecumeDB = defaultDb): Promise<string | null> {
  const v = (await d.meta.get(CHAVE))?.value;
  return typeof v === 'string' && v ? v : null;
}

export async function definirImportadorUrl(url: string | null, d: DecumeDB = defaultDb): Promise<void> {
  const limpo = url?.trim().replace(/\/+$/, '') ?? '';
  if (!limpo) {
    await d.meta.delete(CHAVE);
    return;
  }
  let u: URL;
  try {
    u = new URL(limpo);
  } catch {
    throw new ImportadorError('Endereço inválido. Ele começa com https://');
  }
  if (u.protocol !== 'https:' && u.hostname !== 'localhost') throw new ImportadorError('O endereço precisa começar com https://');
  await d.meta.put({ key: CHAVE, value: limpo });
}

async function chamar(base: string, alvo: string): Promise<Response> {
  let r: Response;
  try {
    r = await fetch(`${base}/?url=${encodeURIComponent(alvo)}`, { signal: AbortSignal.timeout(20000) });
  } catch {
    throw new ImportadorError('Sem conexão com o importador. Confira a internet e o endereço em Ajustes.');
  }
  if (!r.ok) {
    let msg = `O importador respondeu com erro ${r.status}.`;
    try {
      const j = await r.json();
      if (j?.erro) msg = j.erro;
    } catch {
      /* resposta sem JSON */
    }
    throw new ImportadorError(msg);
  }
  return r;
}

/** Baixa o HTML da página da receita pelo importador. */
export async function buscarPagina(url: string, d: DecumeDB = defaultDb): Promise<{ url: string; html: string }> {
  const base = await obterImportadorUrl(d);
  if (!base) throw new ImportadorError('O importador ainda não foi configurado em Ajustes.');
  const j = await (await chamar(base, url)).json();
  if (typeof j?.html !== 'string') throw new ImportadorError('Resposta inesperada do importador.');
  return { url: j.url ?? url, html: j.html };
}

/** Baixa a foto da receita pelo importador (para virar a capa). */
export async function baixarImagem(url: string, d: DecumeDB = defaultDb): Promise<Blob> {
  const base = await obterImportadorUrl(d);
  if (!base) throw new ImportadorError('Importador não configurado.');
  const r = await chamar(base, url);
  if (!(r.headers.get('Content-Type') ?? '').startsWith('image/')) throw new ImportadorError('O link da foto não é uma imagem.');
  return r.blob();
}

/** Teste rápido do endereço configurado. */
export async function testarImportador(base: string): Promise<void> {
  let r: Response;
  try {
    r = await fetch(`${base.replace(/\/+$/, '')}/`, { signal: AbortSignal.timeout(10000) });
  } catch {
    throw new ImportadorError('Não respondeu. Confira o endereço.');
  }
  const j = await r.json().catch(() => null);
  if (!r.ok || j?.servico !== 'importador do deCumê') throw new ImportadorError(j?.erro ?? 'Esse endereço não é o importador do deCumê.');
}
