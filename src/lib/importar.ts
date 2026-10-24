import type { Ingredient } from '../db/types';
import type { DraftIngrediente, RecipeDraft } from '../db/recipes';
import { parseQuantidade } from './quantity';
import { semAcento } from './text';
import { formatMedida, unidadesPara, type UnidadeReceita } from './units';

/**
 * Importação de receitas: lê a página (dados estruturados schema.org/Recipe; se não
 * houver, o texto da página, no formato do TudoGostoso) ou um texto colado, quebra cada
 * linha de ingrediente em quantidade + unidade + nome e casa com o catálogo.
 */

export interface ReceitaImportada {
  titulo: string;
  porcoes: number | null;
  tempoMin: number | null;
  ingredientes: string[];
  passos: string[];
  imagem: string | null;
  fonteUrl: string | null;
}

export class ImportError extends Error {}

// ---------------- HTML ----------------

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ordm: 'º', ordf: 'ª', frac12: '½', frac14: '¼', frac34: '¾', deg: '°' };

export function decodificarEntidades(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const cod = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cod) ? String.fromCodePoint(cod) : m;
    }
    return ENTIDADES[e.toLowerCase()] ?? m;
  });
}

/** Texto da página, uma linha por bloco (títulos, parágrafos, itens de lista). */
export function htmlParaTexto(html: string): string {
  return decodificarEntidades(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(p|div|li|ul|ol|h[1-6]|tr|section|article|header|footer|figure|figcaption|label|button|span class="[^"]*title[^"]*")\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .split('\n')
    .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').replace(/\s+([.,;:!?)])/g, '$1').replace(/\(\s+/g, '(').trim())
    .filter(Boolean)
    .join('\n');
}

function metaConteudo(html: string, prop: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  const c = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return c ? decodificarEntidades(c).trim() : null;
}

/** "PT1H20M" → 80 */
export function duracaoMinutos(iso: unknown): number | null {
  if (typeof iso !== 'string') return null;
  const m = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?)?$/i);
  if (!m) return null;
  const total = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return total > 0 ? total : null;
}

function numeroDe(v: unknown): number | null {
  const s = Array.isArray(v) ? v.map(String).join(' ') : v == null ? '' : String(v);
  const n = s.match(/\d+/)?.[0];
  return n ? Number(n) : null;
}

function textoLimpo(v: unknown): string {
  return typeof v === 'string' ? htmlParaTexto(v).replace(/\n+/g, ' ').trim() : '';
}

function ehReceita(o: unknown): o is Record<string, unknown> {
  if (!o || typeof o !== 'object') return false;
  const t = (o as Record<string, unknown>)['@type'];
  return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
}

function acharReceita(dado: unknown): Record<string, unknown> | null {
  if (ehReceita(dado)) return dado;
  if (Array.isArray(dado)) {
    for (const x of dado) {
      const r = acharReceita(x);
      if (r) return r;
    }
  } else if (dado && typeof dado === 'object') {
    const o = dado as Record<string, unknown>;
    for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage']) {
      const r = acharReceita(o[k]);
      if (r) return r;
    }
  }
  return null;
}

function passosDe(instr: unknown): string[] {
  if (!instr) return [];
  if (typeof instr === 'string') {
    const t = htmlParaTexto(instr);
    return t.split('\n').map(limparNumeracao).filter(Boolean);
  }
  if (Array.isArray(instr)) return instr.flatMap(passosDe);
  if (typeof instr === 'object') {
    const o = instr as Record<string, unknown>;
    if (o.itemListElement) return passosDe(o.itemListElement);
    const t = textoLimpo(o.text) || textoLimpo(o.name);
    return t ? [limparNumeracao(t)] : [];
  }
  return [];
}

function imagemDe(img: unknown): string | null {
  if (!img) return null;
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) return imagemDe(img[0]);
  if (typeof img === 'object') return imagemDe((img as Record<string, unknown>).url);
  return null;
}

/** Lê os blocos <script type="application/ld+json"> e devolve a receita, se houver. */
export function receitaDoJsonLd(html: string, url: string | null): ReceitaImportada | null {
  const blocos = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocos) {
    let dado: unknown;
    try {
      dado = JSON.parse(b[1].trim());
    } catch {
      continue;
    }
    const r = acharReceita(dado);
    if (!r) continue;
    const ingredientes = (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : Array.isArray(r.ingredients) ? r.ingredients : [])
      .map(textoLimpo)
      .filter(Boolean);
    if (!ingredientes.length) continue;
    const tempo = duracaoMinutos(r.totalTime) ?? ((duracaoMinutos(r.prepTime) ?? 0) + (duracaoMinutos(r.cookTime) ?? 0) || null);
    return {
      titulo: textoLimpo(r.name),
      porcoes: numeroDe(r.recipeYield),
      tempoMin: tempo,
      ingredientes,
      passos: passosDe(r.recipeInstructions),
      imagem: imagemDe(r.image),
      fonteUrl: url,
    };
  }
  return null;
}

/** Página inteira: primeiro schema.org; se não houver, o texto da página. */
export function receitaDoHtml(html: string, url: string | null): ReceitaImportada {
  const ld = receitaDoJsonLd(html, url);
  if (ld) return ld;
  const texto = htmlParaTexto(html);
  const titulo = (metaConteudo(html, 'og:title') ?? html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s*[|–-]\s*(receitas?\s+)?tudo\s*gostoso.*$/i, '')
    .trim();
  const r = receitaDoTexto(texto, { titulo: decodificarEntidades(titulo) });
  return { ...r, imagem: metaConteudo(html, 'og:image'), fonteUrl: url };
}

// ---------------- Texto ----------------

const RE_INGREDIENTES = /^ingredientes\b/i;
const RE_PREPARO = /^(modo de preparo|modo de fazer|preparo|como fazer|instru[cç][oõ]es)\b/i;
const RE_FIM_INGREDIENTES = /^(utens[ií]lios|equipamentos?)\b/i;
const RE_FIM_PASSOS = /^(veja tamb[eé]m|informa[cç][oõ]es adicionais|dicas?\b|avalia[cç]|coment[aá]rios?|receitas relacionadas|voc[eê] tamb[eé]m|leia tamb[eé]m|compartilhe|publicidade)/i;
const RE_SUBTITULO = /^(massa|cobertura|recheio|calda|molho|montagem|base|creme|farofa|decora[cç][aã]o|finaliza[cç][aã]o|para (a|o)\s+\w+|marinada|tempero|acompanhamento)\b/i;

export function limparNumeracao(s: string): string {
  return s.replace(/^\s*(?:passo\s*)?\d+\s*[.)\-:–]\s*/i, '').replace(/^[•·*\-–]\s*/, '').trim();
}

const temDigito = (s: string) => /\d|[½¼¾⅓⅔]/.test(s);

function ehSubtitulo(l: string): boolean {
  if (temDigito(l) || /gosto|opcional/i.test(l)) return false;
  if (/:\s*$/.test(l)) return true;
  return l.split(/\s+/).length <= 4 && RE_SUBTITULO.test(l);
}

function porcoesDe(s: string): number | null {
  const m = s.match(/(\d+)\s*(por[cç][oõ]es|pessoas|fatias|unidades|peda[cç]os)/i) ?? s.match(/rend(e|imento)\D{0,12}(\d+)/i);
  if (!m) return null;
  return Number(m[2] && /\d/.test(m[2]) ? m[2] : m[1]);
}

function minutosDe(s: string): number | null {
  const h = s.match(/(\d+)\s*h/i);
  const min = s.match(/(\d+)\s*min/i);
  const t = (h ? Number(h[1]) * 60 : 0) + (min ? Number(min[1]) : 0);
  return t > 0 ? t : null;
}

/** Texto colado ou extraído da página: precisa ter uma linha "Ingredientes". */
export function receitaDoTexto(texto: string, extra: { titulo?: string } = {}): ReceitaImportada {
  const linhas = texto.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  // "Ingredientes" de verdade é o seguido de linhas com quantidade (o do menu do site não é).
  const iIng = linhas.findIndex((l, i) => RE_INGREDIENTES.test(l) && l.length < 60 && linhas.slice(i + 1, i + 6).some((x) => /^[\s•·*\-–]*([\d½¼¾⅓⅔]|meia|uma|um\b)/i.test(x) && x.length < 120));
  if (iIng < 0) throw new ImportError('Não encontrei a lista de ingredientes. O texto precisa ter uma linha "Ingredientes" seguida dos itens.');
  const iPrep = linhas.findIndex((l, i) => i > iIng && RE_PREPARO.test(l) && l.length < 60);

  let porcoes = porcoesDe(linhas[iIng]);
  const ingredientes: string[] = [];
  for (let i = iIng + 1; i < (iPrep < 0 ? linhas.length : iPrep); i++) {
    const l = linhas[i];
    if (RE_FIM_INGREDIENTES.test(l)) break;
    if (/^rend(e|imento)/i.test(l)) {
      porcoes ??= porcoesDe(l);
      continue;
    }
    if (ehSubtitulo(l)) continue;
    ingredientes.push(limparNumeracao(l));
  }

  let tempoMin: number | null = null;
  const passos: string[] = [];
  if (iPrep >= 0) {
    tempoMin = minutosDe(linhas[iPrep]);
    for (let i = iPrep + 1; i < linhas.length; i++) {
      const l = linhas[i];
      if (RE_FIM_PASSOS.test(l)) break;
      if (RE_PREPARO.test(l) && l.length < 40) {
        tempoMin ??= minutosDe(l);
        continue;
      }
      if (ehSubtitulo(l)) continue;
      const p = limparNumeracao(l);
      if (p) passos.push(p);
    }
  }
  for (const l of linhas.slice(0, iIng)) {
    if (/^(tempo|preparo)\b/i.test(l)) tempoMin ??= minutosDe(l);
    if (/^rend/i.test(l)) porcoes ??= porcoesDe(l);
  }

  const primeira = linhas[0];
  const titulo = extra.titulo?.trim() || (iIng > 0 && primeira.length <= 80 && !temDigito(primeira) ? primeira : '');
  return { titulo, porcoes, tempoMin, ingredientes, passos, imagem: null, fonteUrl: null };
}

// ---------------- Linha de ingrediente ----------------

export interface IngredienteLido {
  quantidade: number | null;
  unidade: UnidadeReceita | null;
  nome: string;
  observacao: string;
  aGosto: boolean;
  opcional: boolean;
}

const NUMEROS: Record<string, number> = { meia: 0.5, meio: 0.5, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, doze: 12 };

const RE_QTD = /^((?:\d+\s+e\s+)?\d+\s*\/\s*\d+|\d+\s+\d+\s*\/\s*\d+|\d+\s*[½¼¾⅓⅔]|\d+(?:[.,]\d+)?|[½¼¾⅓⅔]|meia|meio|uma|um|duas|dois|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|doze)(?=\s|$|[a-zà-ú(])/i;

const UNIDADES: [RegExp, UnidadeReceita | 'colher_sobremesa' | 'desconhecida'][] = [
  [/^x[ií]caras?\s*(\(\s*(de\s+)?ch[aá]\s*\)|de\s+ch[aá])?/i, 'xicara'],
  [/^colher(es)?\s*(\(\s*(de\s+)?sopa\s*\)|de\s+sopa|sopa)/i, 'colher_sopa'],
  [/^colher(es)?\s*(\(\s*(de\s+)?ch[aá]\s*\)|de\s+ch[aá]|ch[aá])/i, 'colher_cha'],
  [/^colher(es)?\s*(\(\s*(de\s+)?sobremesa\s*\)|de\s+sobremesa|sobremesa)/i, 'colher_sobremesa'],
  [/^pitadas?/i, 'pitada'],
  [/^(kg|quilos?|quilogramas?)\b/i, 'kg'],
  [/^(g|gr|gramas?)\b/i, 'g'],
  [/^(ml|mililitros?)\b/i, 'ml'],
  [/^(l|litros?)\b/i, 'l'],
  [/^(dentes?|unidades?|un)\b/i, 'un'],
  [/^(latas?|caixas?|caixinhas?|pacotes?|sach[eê]s?|vidros?|potes?|ma[cç]os?|ramos?|fatias?|tabletes?|envelopes?|copos?(\s+americanos?)?|x[ií]caras?\s+de\s+caf[eé]|punhados?|talos?|folhas?|peda[cç]os?|postas?|bandejas?|cabe[cç]as?|gomos?|barras?|ta[cç]as?|fios?|gotas?|cubos?|bolinhas?|filetes?)\b/i, 'desconhecida'],
];

/** Descrições que vão para a observação ("cebola picada" → cebola + "picada"). */
const DESCRITORES =
  /\b(picad[oa]s?|ralad[oa]s?|cortad[oa]s?(\s+em\s+\w+)?|em\s+(cubos|rodelas|tiras|fatias|peda[cç]os|temperatura ambiente)|fatiad[oa]s?|cozid[oa]s?|desfiad[oa]s?|amassad[oa]s?|derretid[oa]s?|m[eé]di[oa]s?|grandes?|pequen[oa]s?|maduros?|madura?s?|frescos?|frescas?|sem\s+(pele|osso|sementes|casca)|descascad[oa]s?|lavad[oa]s?|escorrid[oa]s?|peneirad[oa]s?|batid[oa]s?|bem\s+\w+|finamente|grosseiramente|para\s+(untar|polvilhar|decorar|servir|fritar))\b/gi;

function quantidadeDe(t: string): number | null {
  const s = semAcento(t.toLowerCase()).replace(/\s+e\s+/, ' ').replace(/\s*\/\s*/, '/');
  if (s in NUMEROS) return NUMEROS[s];
  return parseQuantidade(s);
}

/** "2 colheres (sopa) de azeite de oliva" → 2, colher_sopa, "azeite de oliva" */
export function interpretarIngrediente(linha: string): IngredienteLido {
  let s = limparNumeracao(linha).replace(/\s+/g, ' ').trim();
  let opcional = false;
  let aGosto = false;
  const obs: string[] = [];

  if (/\(?\bopcional\b\)?/i.test(s)) {
    opcional = true;
    s = s.replace(/\(?\s*\bopcional\b\s*\)?/i, ' ').trim();
  }
  if (/\ba gosto\b/i.test(s)) {
    aGosto = true;
    s = s.replace(/\s*\ba gosto\b/i, ' ').trim();
  }

  let quantidade: number | null = null;
  let unidade: UnidadeReceita | null = null;
  const mq = s.match(RE_QTD);
  if (mq) {
    quantidade = quantidadeDe(mq[1]);
    s = s.slice(mq[0].length).trim();
    // "1 lata (395 g) de leite condensado": usa o peso entre parênteses
    for (const [re, u] of UNIDADES) {
      const mu = s.match(re);
      if (!mu) continue;
      s = s.slice(mu[0].length).trim();
      if (u === 'colher_sobremesa') {
        unidade = 'colher_cha';
        quantidade = quantidade != null ? quantidade * 2 : null;
      } else if (u === 'desconhecida') {
        const peso = s.match(/^\(\s*(\d+(?:[.,]\d+)?)\s*(g|gramas?|ml|kg|l)\s*\)/i);
        if (peso && quantidade != null) {
          const un = peso[2].toLowerCase();
          unidade = un.startsWith('g') ? 'g' : (un as UnidadeReceita);
          quantidade = quantidade * Number(peso[1].replace(',', '.'));
          s = s.slice(peso[0].length).trim();
        } else {
          obs.push(`${mq[1]} ${mu[0]}`.trim());
          quantidade = null;
        }
      } else unidade = u;
      break;
    }
    if (quantidade != null && !unidade) unidade = 'un';
  }

  s = s.replace(/^(de|do|da|dos|das)\s+/i, '');
  // tudo depois de vírgula ou entre parênteses é observação
  const virgula = s.indexOf(',');
  if (virgula > 0) {
    obs.push(s.slice(virgula + 1).trim());
    s = s.slice(0, virgula).trim();
  }
  s = s.replace(/\(([^)]*)\)/g, (_, dentro: string) => {
    if (dentro.trim()) obs.push(dentro.trim());
    return ' ';
  });
  const descritos = s.match(DESCRITORES);
  if (descritos) {
    obs.push(...descritos.map((x) => x.trim()));
    s = s.replace(DESCRITORES, ' ');
  }
  const nome = s.replace(/\s+/g, ' ').replace(/^(e|de)\s+|\s+(e|de)$/gi, '').trim();
  return { quantidade: aGosto ? null : quantidade, unidade: aGosto ? null : unidade, nome, observacao: obs.filter(Boolean).join(', '), aGosto, opcional };
}

/** "Sal e pimenta a gosto" vira duas linhas. */
export function separarLinha(linha: string): string[] {
  if (/\ba gosto\b/i.test(linha) && !temDigito(linha)) {
    const base = linha.replace(/\s*\ba gosto\b.*$/i, '');
    const partes = base.split(/\s*(?:,|\be\b)\s*/i).filter((p) => p.trim());
    if (partes.length > 1) return partes.map((p) => `${p.trim()} a gosto`);
  }
  return [linha];
}

// ---------------- Casamento com o catálogo ----------------

const norm = (s: string) =>
  semAcento(s)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function singular(palavra: string): string {
  if (palavra.length <= 3) return palavra;
  if (/oes$|aes$/.test(palavra)) return palavra.slice(0, -3) + 'ao';
  if (/eis$/.test(palavra)) return palavra.slice(0, -3) + 'el';
  if (/res$|zes$|ses$/.test(palavra)) return palavra.slice(0, -2);
  if (/s$/.test(palavra)) return palavra.slice(0, -1);
  return palavra;
}

const variantes = (t: string) => {
  const n = norm(t);
  return [...new Set([n, n.split(' ').map(singular).join(' ')])];
};

const contemPalavras = (texto: string, termo: string) => ` ${texto} `.includes(` ${termo} `);

/** Nomes comuns em receitas que o catálogo chama de outro jeito. */
const SINONIMOS: Record<string, string> = {
  'chocolate em po': 'cacau',
  'achocolatado em po': 'cacau',
  'achocolatado': 'cacau',
  'oleo vegetal': 'oleo',
  'oleo de girassol': 'oleo',
  'oleo de canola': 'oleo',
  'oleo de milho': 'oleo',
  'cheiro verde': 'salsinha',
  'margarina': 'manteiga',
  'creme de leite fresco': 'creme-de-leite',
  'creme de leite de caixinha': 'creme-de-leite',
  'molho de soja': 'shoyu',
  'acucar refinado': 'acucar',
  'acucar cristal': 'acucar',
  'farinha de trigo com fermento': 'farinha-trigo',
  'file de frango': 'peito-frango',
  'peito de frango sem osso': 'peito-frango',
  'carne bovina moida': 'carne-moida',
  'macarrao tipo espaguete': 'macarrao',
  'espaguete': 'macarrao',
  'queijo ralado': 'queijo-parmesao',
  'queijo parmesao ralado': 'queijo-parmesao',
  'mussarela': 'queijo-mucarela',
  'muçarela': 'queijo-mucarela',
  'queijo mussarela': 'queijo-mucarela',
  'agua': 'agua',
};

/** Acha o ingrediente do catálogo para um nome lido ("ovos" → Ovo; "queijo muçarela ralado" → Queijo muçarela). */
export function casarIngrediente(nome: string, catalogo: Iterable<Ingredient>): Ingredient | null {
  const vs = variantes(nome);
  if (!vs[0]) return null;
  const lista = [...catalogo];
  for (const v of vs) {
    const id = SINONIMOS[v];
    const achado = id ? lista.find((i) => i.id === id) : undefined;
    if (achado) return achado;
  }
  catalogo = lista;
  let melhor: Ingredient | null = null;
  let pontos = 0;
  for (const ing of catalogo) {
    for (const termo of [ing.nome, ...ing.apelidos].flatMap(variantes)) {
      if (!termo) continue;
      let p = 0;
      if (vs.includes(termo)) p = 1000 + termo.length;
      else if (vs.some((v) => contemPalavras(v, termo))) p = 100 + termo.length;
      else if (vs[0].length >= 4 && vs.some((v) => contemPalavras(termo, v))) p = 10 + vs[0].length;
      if (p > pontos) {
        pontos = p;
        melhor = ing;
      }
    }
  }
  return melhor;
}

// ---------------- Rascunho ----------------

export interface LinhaImportada extends DraftIngrediente {
  /** true quando o app reconheceu o ingrediente sozinho */
  casou: boolean;
}

/** Monta o rascunho da receita (para o formulário de revisão). */
export function montarRascunho(r: ReceitaImportada, catalogo: Map<string, Ingredient>): RecipeDraft & { ingredientes: LinhaImportada[] } {
  const ingredientes: LinhaImportada[] = r.ingredientes.flatMap(separarLinha).map((original) => {
    const lido = interpretarIngrediente(original);
    const ing = casarIngrediente(lido.nome, catalogo.values());
    let { quantidade, unidade } = lido;
    const obs = [lido.observacao];
    if (ing && unidade && !unidadesPara(ing).includes(unidade)) {
      // medida que não serve para esse ingrediente: o usuário completa na revisão
      obs.unshift(formatMedida(lido.quantidade, unidade));
      quantidade = null;
      unidade = ing.unidadeBase;
    }
    return {
      ingredientId: ing?.id ?? null,
      textoOriginal: original,
      quantidade,
      unidade: unidade ?? ing?.unidadeBase ?? null,
      observacao: obs.filter(Boolean).join(', '),
      opcional: lido.opcional,
      aGosto: lido.aGosto || Boolean(ing?.sempreTenho && lido.quantidade == null),
      casou: Boolean(ing),
    };
  });
  return {
    titulo: r.titulo,
    porcoes: r.porcoes && r.porcoes > 0 && r.porcoes < 100 ? r.porcoes : 2,
    tempoMin: r.tempoMin,
    tags: [],
    fonteUrl: r.fonteUrl,
    notas: '',
    ingredientes,
    passos: r.passos,
  };
}
