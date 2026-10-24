import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error módulo JS do Worker, sem tipos
import importador, { enderecoPermitido } from './importador.js';

const ORIGEM = 'https://joaogarbelini.github.io';
const pedir = (url: string, origem: string | null = ORIGEM) =>
  importador.fetch(new Request(`https://imp.example.workers.dev/?url=${encodeURIComponent(url)}`, { headers: origem ? { Origin: origem } : {} }), {});

afterEach(() => vi.unstubAllGlobals());

describe('importador (Worker)', () => {
  it('devolve o HTML da página com CORS liberado para o app', async () => {
    const fetchFalso = vi.fn(async () => new Response('<html><h1>Bolo</h1></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
    vi.stubGlobal('fetch', fetchFalso);
    const r = await pedir('https://www.tudogostoso.com.br/receita/23.html');
    expect(r.status).toBe(200);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ORIGEM);
    expect(await r.json()).toMatchObject({ html: '<html><h1>Bolo</h1></html>' });
  });

  it('decodifica páginas em latin-1', async () => {
    const bytes = new Uint8Array([0x61, 0xe7, 0xfa, 0x63, 0x61, 0x72]); // "açúcar" em latin-1
    vi.stubGlobal('fetch', vi.fn(async () => new Response(bytes, { headers: { 'Content-Type': 'text/html; charset=iso-8859-1' } })));
    expect((await (await pedir('https://site.com/r')).json()).html).toBe('açúcar');
  });

  it('repassa imagens', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } })));
    const r = await pedir('https://site.com/foto.jpg');
    expect(r.headers.get('Content-Type')).toBe('image/jpeg');
    expect([...new Uint8Array(await r.arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it('recusa origem estranha, endereços internos e arquivos que não são página', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
    expect((await pedir('https://site.com/r', 'https://outro.com')).status).toBe(403);
    expect((await pedir('https://site.com/r', null)).status).toBe(403);
    expect((await pedir('http://localhost/admin')).status).toBe(400);
    expect((await pedir('https://site.com/r')).status).toBe(415);
    expect(enderecoPermitido('http://192.168.0.1/')).toBe(false);
    expect(enderecoPermitido('file:///etc/passwd')).toBe(false);
    expect(enderecoPermitido('https://www.tudogostoso.com.br/receita/1')).toBe(true);
  });
});
