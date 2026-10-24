import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../data/catalog';
import type { Ingredient } from '../db/types';
import { casarIngrediente, duracaoMinutos, htmlParaTexto, interpretarIngrediente, montarRascunho, receitaDoHtml, receitaDoTexto, separarLinha } from './importar';

const catalogo = new Map<string, Ingredient>(buildCatalog('2026-10-24T00:00:00Z').map((i) => [i.id, i]));
const casa = (nome: string) => casarIngrediente(nome, catalogo.values())?.id ?? null;

// Página no formato do TudoGostoso (sem dados estruturados), com menu e textos em volta.
const PAGINA_TG = `<!doctype html><html><head><title>Bolo de cenoura - Receitas TudoGostoso</title>
<meta property="og:title" content="Bolo de cenoura" /><meta property="og:image" content="https://static.tudogostoso.com.br/bolo.jpg" />
<script>var x = "Ingredientes 1 2 3";</script></head><body>
<nav><ul><li>Ingredientes</li><li>Receitas fáceis</li><li>Bolos</li></ul></nav>
<h1>Bolo de cenoura</h1>
<h2>Ingredientes (8 porções)</h2>
<h3>Massa</h3><ul>
<li>1/2 xícara (chá) de óleo</li><li>3 cenouras médias raladas</li><li>4 ovos</li>
<li>2 xícaras (chá) de açúcar</li><li>2 e 1/2 xícaras (chá) de farinha de trigo</li><li>1 colher (sopa) de fermento em pó</li></ul>
<h3>Cobertura</h3><ul><li>1 colher (sopa) de manteiga</li><li>3 colheres (sopa) de chocolate em pó</li><li>1 xícara (chá) de açúcar</li><li>1 xícara (chá) de leite</li></ul>
<h2>Utensílios</h2><ul><li>Liquidificador</li></ul>
<h2>Modo de preparo</h2><p>Modo de preparo : <b>40min</b></p>
<ol><li>Em um liquidificador, adicione a cenoura, os ovos e o óleo, depois misture.</li>
<li>Acrescente o açúcar e bata novamente por 5 minutos.</li>
<li>Em uma tigela, adicione a farinha de trigo e <a href="#">misture novamente</a>.</li></ol>
<h2>Veja também…</h2><p>Bolo de milho</p><h2>Informações adicionais</h2><p>Uma receita &amp; tanto</p>
</body></html>`;

describe('ler a página', () => {
  it('lê o formato do TudoGostoso pelo texto da página', () => {
    const r = receitaDoHtml(PAGINA_TG, 'https://www.tudogostoso.com.br/receita/23-bolo-de-cenoura.html');
    expect(r.titulo).toBe('Bolo de cenoura');
    expect(r.porcoes).toBe(8);
    expect(r.tempoMin).toBe(40);
    expect(r.ingredientes).toHaveLength(10);
    expect(r.ingredientes[0]).toBe('1/2 xícara (chá) de óleo');
    expect(r.ingredientes).not.toContain('Massa');
    expect(r.ingredientes).not.toContain('Liquidificador');
    expect(r.passos).toEqual([
      'Em um liquidificador, adicione a cenoura, os ovos e o óleo, depois misture.',
      'Acrescente o açúcar e bata novamente por 5 minutos.',
      'Em uma tigela, adicione a farinha de trigo e misture novamente.',
    ]);
    expect(r.imagem).toBe('https://static.tudogostoso.com.br/bolo.jpg');
    expect(r.fonteUrl).toContain('tudogostoso');
  });

  it('prefere os dados estruturados schema.org/Recipe', () => {
    const ld = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', name: 'x' },
        {
          '@type': ['Recipe'],
          name: 'Feijoada &amp; arroz',
          recipeYield: ['6 porções'],
          totalTime: 'PT2H30M',
          image: [{ url: 'https://x.com/f.jpg' }],
          recipeIngredient: ['500 g de feijão preto', '300 g de linguiça'],
          recipeInstructions: [{ '@type': 'HowToSection', itemListElement: [{ '@type': 'HowToStep', text: '1. Deixe o feijão de molho.' }] }, { '@type': 'HowToStep', text: 'Cozinhe.' }],
        },
      ],
    };
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body></body></html>`;
    const r = receitaDoHtml(html, 'https://x.com/r');
    expect(r).toMatchObject({ titulo: 'Feijoada & arroz', porcoes: 6, tempoMin: 150, imagem: 'https://x.com/f.jpg', passos: ['Deixe o feijão de molho.', 'Cozinhe.'] });
    expect(r.ingredientes).toEqual(['500 g de feijão preto', '300 g de linguiça']);
  });

  it('lê texto colado e recusa texto sem ingredientes', () => {
    const r = receitaDoTexto('Panqueca simples\nRende 4 porções\nIngredientes:\n• 1 xícara de farinha\n• 2 ovos\n- sal a gosto\nModo de preparo\n1. Bata tudo.\n2) Frite.');
    expect(r).toMatchObject({ titulo: 'Panqueca simples', porcoes: 4, ingredientes: ['1 xícara de farinha', '2 ovos', 'sal a gosto'], passos: ['Bata tudo.', 'Frite.'] });
    expect(() => receitaDoTexto('só um texto qualquer')).toThrow(/ingredientes/);
  });

  it('converte duração ISO e limpa HTML', () => {
    expect(duracaoMinutos('PT1H20M')).toBe(80);
    expect(duracaoMinutos('PT45M')).toBe(45);
    expect(duracaoMinutos('bobagem')).toBeNull();
    expect(htmlParaTexto('<p>a&nbsp;b</p><p>c&#233;u</p>')).toBe('a b\ncéu');
  });
});

describe('linha de ingrediente', () => {
  const casos: [string, Partial<ReturnType<typeof interpretarIngrediente>>][] = [
    ['2 colheres (sopa) de azeite de oliva', { quantidade: 2, unidade: 'colher_sopa', nome: 'azeite de oliva' }],
    ['1/2 xícara (chá) de óleo', { quantidade: 0.5, unidade: 'xicara', nome: 'óleo' }],
    ['2 e 1/2 xícaras (chá) de farinha de trigo', { quantidade: 2.5, unidade: 'xicara', nome: 'farinha de trigo' }],
    ['3 cenouras médias raladas', { quantidade: 3, unidade: 'un', nome: 'cenouras', observacao: 'médias, raladas' }],
    ['500 g de peito de frango cortado em cubos', { quantidade: 500, unidade: 'g', nome: 'peito de frango', observacao: 'cortado em cubos' }],
    ['1 kg de batata', { quantidade: 1, unidade: 'kg', nome: 'batata' }],
    ['2 dentes de alho picados', { quantidade: 2, unidade: 'un', nome: 'alho' }],
    ['1 cebola, picada', { quantidade: 1, unidade: 'un', nome: 'cebola', observacao: 'picada' }],
    ['sal a gosto', { quantidade: null, nome: 'sal', aGosto: true }],
    ['1 lata de leite condensado', { quantidade: null, unidade: null, nome: 'leite condensado', observacao: '1 lata' }],
    ['1 lata (395 g) de leite condensado', { quantidade: 395, unidade: 'g', nome: 'leite condensado' }],
    ['meia xícara de leite', { quantidade: 0.5, unidade: 'xicara', nome: 'leite' }],
    ['1 colher (chá) de sal', { quantidade: 1, unidade: 'colher_cha', nome: 'sal' }],
    ['100 g de bacon (opcional)', { quantidade: 100, unidade: 'g', nome: 'bacon', opcional: true }],
    ['1 pitada de noz-moscada', { quantidade: 1, unidade: 'pitada', nome: 'noz-moscada' }],
    ['200ml de creme de leite', { quantidade: 200, unidade: 'ml', nome: 'creme de leite' }],
  ];
  it.each(casos)('%s', (linha, esperado) => {
    expect(interpretarIngrediente(linha)).toMatchObject(esperado);
  });

  it('separa "sal e pimenta a gosto"', () => {
    expect(separarLinha('Sal e pimenta-do-reino a gosto')).toEqual(['Sal a gosto', 'pimenta-do-reino a gosto']);
    expect(separarLinha('2 ovos')).toEqual(['2 ovos']);
  });
});

describe('casar com o catálogo', () => {
  it.each([
    ['ovos', 'ovo'],
    ['azeite de oliva', 'azeite'],
    ['farinha de trigo', 'farinha-trigo'],
    ['queijo muçarela', 'queijo-mucarela'],
    ['leite condensado', 'leite-condensado'],
    ['leite', 'leite'],
    ['cenouras', 'cenoura'],
    ['pimentões vermelhos', 'pimentao-vermelho'],
    ['fermento em pó', 'fermento-quimico'],
    ['peito de frango', 'peito-frango'],
    ['óleo', 'oleo'],
    ['tomates', 'tomate'],
    ['chocolate em pó', 'cacau'],
    ['água', 'agua'],
    ['água morna', 'agua'],
    ['cebolas', 'cebola'],
  ])('%s → %s', (nome, id) => {
    expect(casa(nome)).toBe(id);
  });

  it('não inventa casamento', () => {
    expect(casa('tahine')).toBeNull();
  });

  it('monta o rascunho com casamentos, conversões e itens para revisar', () => {
    const r = receitaDoHtml(PAGINA_TG, 'https://www.tudogostoso.com.br/receita/23.html');
    const d = montarRascunho(r, catalogo);
    expect(d.porcoes).toBe(8);
    const porTexto = new Map(d.ingredientes.map((i) => [i.textoOriginal, i]));
    expect(porTexto.get('4 ovos')).toMatchObject({ ingredientId: 'ovo', quantidade: 4, unidade: 'un', casou: true });
    expect(porTexto.get('3 cenouras médias raladas')).toMatchObject({ ingredientId: 'cenoura', quantidade: 3 });
    expect(porTexto.get('1/2 xícara (chá) de óleo')).toMatchObject({ ingredientId: 'oleo', unidade: 'xicara', quantidade: 0.5 });
    expect(porTexto.get('1 colher (sopa) de fermento em pó')).toMatchObject({ ingredientId: 'fermento-quimico', unidade: 'colher_sopa' });
  });
});
