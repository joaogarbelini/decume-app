/**
 * Importador do deCumê (Cloudflare Worker).
 *
 * O navegador do celular não consegue baixar páginas de outros sites (bloqueio de CORS),
 * então este serviço mínimo busca a página da receita e devolve o HTML para o app, que faz
 * a leitura. Também repassa a foto da receita.
 *
 *   GET /?url=https://www.tudogostoso.com.br/receita/...  → { url, html }
 *   GET /?url=https://.../foto.jpg                         → bytes da imagem
 *
 * Só atende pedidos vindos das origens permitidas (ORIGENS, separadas por vírgula).
 */

const ORIGENS_PADRAO = 'https://joaogarbelini.github.io,http://localhost:5173,http://localhost:4173';
const LIMITE_BYTES = 5 * 1024 * 1024;
const TEMPO_LIMITE_MS = 15000;

function cabecalhosCors(origem) {
  return {
    'Access-Control-Allow-Origin': origem,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(corpo, status, origem) {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cabecalhosCors(origem) } });
}

/** Bloqueia endereços internos (localhost, IPs privados) para o serviço não virar porta de entrada. */
export function enderecoPermitido(texto) {
  let u;
  try {
    u = new URL(texto);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return false;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  if (h.startsWith('[') || h.includes(':')) return false; // IPv6 literal
  return true;
}

async function lerComLimite(resp) {
  const leitor = resp.body?.getReader();
  if (!leitor) return new Uint8Array();
  const partes = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > LIMITE_BYTES) {
      await leitor.cancel();
      throw new Error('grande demais');
    }
    partes.push(value);
  }
  const tudo = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    tudo.set(p, pos);
    pos += p.byteLength;
  }
  return tudo;
}

function charsetDe(contentType, bytes) {
  const doCabecalho = /charset=([\w-]+)/i.exec(contentType ?? '')?.[1];
  if (doCabecalho) return doCabecalho;
  const inicio = new TextDecoder('latin1').decode(bytes.slice(0, 2048));
  return /<meta[^>]+charset=["']?([\w-]+)/i.exec(inicio)?.[1] ?? 'utf-8';
}

export default {
  async fetch(req, env) {
    const origens = (env?.ORIGENS ?? ORIGENS_PADRAO).split(',').map((s) => s.trim());
    const origem = req.headers.get('Origin') ?? '';
    const permitida = origens.includes(origem) ? origem : origens[0];

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cabecalhosCors(permitida) });
    if (req.method !== 'GET') return json({ erro: 'Use GET.' }, 405, permitida);
    if (!origens.includes(origem)) return json({ erro: 'Origem não permitida.' }, 403, permitida);

    const alvo = new URL(req.url).searchParams.get('url');
    if (!alvo) return json({ ok: true, servico: 'importador do deCumê' }, 200, permitida);
    if (!enderecoPermitido(alvo)) return json({ erro: 'Endereço inválido.' }, 400, permitida);

    let resp;
    try {
      resp = await fetch(alvo, {
        redirect: 'follow',
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          Accept: 'text/html,application/xhtml+xml,image/*;q=0.9,*/*;q=0.5',
        },
      });
    } catch {
      return json({ erro: 'Não deu para acessar o site.' }, 502, permitida);
    }
    if (!resp.ok) return json({ erro: `O site respondeu com erro ${resp.status}.` }, 502, permitida);
    if (!enderecoPermitido(resp.url || alvo)) return json({ erro: 'Endereço inválido.' }, 400, permitida);

    const tipo = resp.headers.get('Content-Type') ?? '';
    let bytes;
    try {
      bytes = await lerComLimite(resp);
    } catch {
      return json({ erro: 'A página é grande demais.' }, 413, permitida);
    }

    if (tipo.startsWith('image/')) {
      return new Response(bytes, { status: 200, headers: { 'Content-Type': tipo, 'Cache-Control': 'public, max-age=86400', ...cabecalhosCors(permitida) } });
    }
    if (!/text\/html|application\/xhtml/i.test(tipo)) return json({ erro: 'O link não é uma página de receita.' }, 415, permitida);

    let html;
    try {
      html = new TextDecoder(charsetDe(tipo, bytes)).decode(bytes);
    } catch {
      html = new TextDecoder('utf-8').decode(bytes);
    }
    return json({ url: resp.url || alvo, html }, 200, permitida);
  },
};
