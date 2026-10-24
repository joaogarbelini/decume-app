import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../data/catalog';
import type { Ingredient } from '../db/types';
import { calcularNutricao, ehVegetariana } from './nutrition';
import { encaixar } from './photos';
import { formatQuantidade, parseQuantidade } from './quantity';
import { emGramas, faltaConversao, formatMedida, paraUnidadeBase, unidadesPara } from './units';

const catalogo = new Map<string, Ingredient>(buildCatalog('2026-10-24T00:00:00Z').map((i) => [i.id, i]));
const ing = (id: string) => catalogo.get(id)!;

const linha = (ingredientId: string, quantidade: number | null, unidade: string | null, extra: Partial<{ opcional: boolean; aGosto: boolean }> = {}) => ({
  ingredientId,
  quantidade,
  unidade,
  opcional: false,
  aGosto: false,
  textoOriginal: null,
  ...extra,
});

describe('quantidades', () => {
  it('lê frações, decimais com vírgula e números mistos', () => {
    expect(parseQuantidade('1/2')).toBe(0.5);
    expect(parseQuantidade('1 1/2')).toBe(1.5);
    expect(parseQuantidade('1½')).toBe(1.5);
    expect(parseQuantidade('0,25')).toBe(0.25);
    expect(parseQuantidade('200')).toBe(200);
    expect(parseQuantidade('')).toBeNull();
    expect(parseQuantidade('abc')).toBeNull();
    expect(parseQuantidade('1/0')).toBeNull();
  });

  it('mostra frações nas medidas caseiras e números redondos em gramas', () => {
    expect(formatQuantidade(1.5)).toBe('1 ½');
    expect(formatQuantidade(0.25)).toBe('¼');
    expect(formatQuantidade(2)).toBe('2');
    expect(formatQuantidade(1 / 3)).toBe('⅓');
    expect(formatMedida(250, 'g')).toBe('250 g');
    expect(formatMedida(2.5, 'g')).toBe('2,5 g');
    expect(formatMedida(1.5, 'xicara')).toBe('1 ½ xíc.');
    expect(formatMedida(2, 'un')).toBe('2');
    expect(formatMedida(3.375, 'un')).toBe('3 ½');
    expect(formatMedida(1.1, 'xicara')).toBe('1 xíc.');
    expect(formatMedida(0.1, 'colher_cha')).toBe('0,1 c. chá');
  });
});

describe('unidades e conversão', () => {
  it('converte medidas caseiras por ingrediente', () => {
    expect(paraUnidadeBase(ing('farinha-trigo'), 2, 'xicara')).toBe(240);
    expect(paraUnidadeBase(ing('acucar'), 1, 'xicara')).toBe(180);
    expect(paraUnidadeBase(ing('leite'), 1, 'xicara')).toBe(240);
    expect(paraUnidadeBase(ing('peito-frango'), 0.5, 'kg')).toBe(500);
  });

  it('usa a conversão salva pelo usuário no lugar da padrão', () => {
    const farinha = { ...ing('farinha-trigo'), conversoes: { xicara: 140 } };
    expect(paraUnidadeBase(farinha, 1, 'xicara')).toBe(140);
  });

  it('converte unidades contáveis pelo peso médio', () => {
    expect(emGramas(ing('cebola'), 2, 'un')).toBe(300);
    expect(paraUnidadeBase(ing('cebola'), 300, 'g')).toBe(2);
    expect(emGramas(ing('azeite'), 100, 'ml')).toBeCloseTo(91);
  });

  it('avisa quando falta conversão de medida caseira', () => {
    expect(faltaConversao(ing('brocolis'), 'xicara')).toBe(true);
    expect(faltaConversao(ing('farinha-trigo'), 'xicara')).toBe(false);
    expect(faltaConversao(ing('brocolis'), 'g')).toBe(false);
    expect(paraUnidadeBase(ing('brocolis'), 1, 'xicara')).toBeNull();
  });

  it('oferece só unidades que fazem sentido', () => {
    expect(unidadesPara(ing('leite'))).not.toContain('g');
    expect(unidadesPara(ing('ovo'))).toEqual(['un', 'g', 'kg']);
    expect(unidadesPara(ing('louro'))).toEqual(['un']);
    expect(unidadesPara(ing('farinha-trigo'))[0]).toBe('g');
  });
});

describe('nutrição', () => {
  it('soma por receita e divide pelas porções', () => {
    const n = calcularNutricao([linha('peito-frango', 400, 'g'), linha('arroz', 1, 'xicara')], catalogo, 2);
    const frango = ing('peito-frango').nutri100g!;
    const arroz = ing('arroz').nutri100g!;
    const kcal = 4 * frango.kcal + 1.85 * arroz.kcal;
    expect(n.total.kcal).toBeCloseTo(kcal, 5);
    expect(n.porPorcao.kcal).toBeCloseTo(kcal / 2, 5);
    expect(n.parcial).toBe(false);
  });

  it('marca nutrição parcial e diz qual item falta', () => {
    const n = calcularNutricao([linha('ovo', 2, 'un'), linha('cogumelo', 100, 'g'), linha('brocolis', 1, 'xicara')], catalogo, 2);
    expect(n.parcial).toBe(true);
    expect(n.faltantes).toEqual([
      { nome: 'Cogumelo', motivo: 'sem dados nutricionais' },
      { nome: 'Brócolis', motivo: 'sem peso em gramas' },
    ]);
    expect(n.total.kcal).toBeGreaterThan(0);
  });

  it('ignora a gosto, opcionais e sal sem tornar a conta parcial', () => {
    const n = calcularNutricao(
      [linha('ovo', 2, 'un'), linha('sal', 1, 'colher_cha'), linha('pimenta-do-reino', null, null, { aGosto: true }), linha('bacon', 50, 'g', { opcional: true })],
      catalogo,
      1,
    );
    expect(n.parcial).toBe(false);
    expect(n.total.kcal).toBeCloseTo(2 * 50 * ing('ovo').nutri100g!.kcal / 100, 5);
  });

  it('reconhece receita vegetariana pelos ingredientes', () => {
    expect(ehVegetariana([linha('ovo', 2, 'un'), linha('queijo-mucarela', 100, 'g')], catalogo)).toBe(true);
    expect(ehVegetariana([linha('macarrao', 200, 'g'), linha('peito-frango', 300, 'g')], catalogo)).toBe(false);
    expect(ehVegetariana([linha('arroz', 1, 'xicara'), linha('atum-lata', 1, 'un')], catalogo)).toBe(false);
  });
});

describe('fotos', () => {
  it('reduz para 1200 px no lado maior mantendo a proporção', () => {
    expect(encaixar(4032, 3024)).toEqual({ largura: 1200, altura: 900 });
    expect(encaixar(3024, 4032)).toEqual({ largura: 900, altura: 1200 });
    expect(encaixar(800, 600)).toEqual({ largura: 800, altura: 600 });
  });
});
