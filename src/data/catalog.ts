import type { Ingredient, ModoControle, Nutri100g, Secao, Unidade } from '../db/types';
import tacoRaw from './taco.json';

/** Linha da TACO já reduzida (src/data/taco.json). Valores por 100 g. */
export interface TacoFood {
  id: number;
  /** descrição oficial */
  d: string;
  /** categoria TACO */
  c: string;
  kcal: number;
  prot: number;
  carb: number;
  gord: number;
  fibra: number;
  sodio: number;
}

export const TACO: TacoFood[] = tacoRaw as TacoFood[];
const tacoById = new Map(TACO.map((f) => [f.id, f]));

export function nutriFromTaco(tacoId: number | null): Nutri100g | null {
  if (tacoId == null) return null;
  const f = tacoById.get(tacoId);
  if (!f) return null;
  return { kcal: f.kcal, proteina: f.prot, carboidrato: f.carb, gordura: f.gord, fibra: f.fibra, sodio: f.sodio };
}

export function tacoDescricao(tacoId: number | null): string | null {
  return tacoId == null ? null : (tacoById.get(tacoId)?.d ?? null);
}

/*
 * Catálogo inicial. Cada linha:
 * [id, nome, unidade base, modo, seção, id TACO, peso por unidade (g), marcas, apelidos]
 * marcas: 'c' = carne/frango/peixe, 's' = sempre tenho
 * Básicos por nível (decisão de 24/10): farinha, açúcar, arroz, óleo, temperos e condimentos.
 * Pesos por unidade são médias de referência e podem ser editados no app.
 */
type Row = [string, string, Unidade, ModoControle, Secao, number | null, number | null, string, string[]];

const H: Secao = 'Hortifrúti';
const C: Secao = 'Carnes e peixes';
const L: Secao = 'Laticínios e ovos';
const M: Secao = 'Mercearia';
const T: Secao = 'Temperos e condimentos';

const ROWS: Row[] = [
  // Hortifrúti
  ['cebola', 'Cebola', 'un', 'exato', H, 107, 150, '', []],
  ['alho', 'Alho (dente)', 'un', 'exato', H, 82, 5, '', ['alho', 'dente de alho']],
  ['tomate', 'Tomate', 'un', 'exato', H, 157, 120, '', []],
  ['batata', 'Batata', 'un', 'exato', H, 92, 150, '', ['batata inglesa']],
  ['batata-doce', 'Batata-doce', 'un', 'exato', H, 89, 200, '', []],
  ['cenoura', 'Cenoura', 'un', 'exato', H, 110, 120, '', []],
  ['abobrinha', 'Abobrinha', 'un', 'exato', H, 71, 250, '', ['abobrinha italiana']],
  ['berinjela', 'Berinjela', 'un', 'exato', H, 96, 250, '', []],
  ['beterraba', 'Beterraba', 'un', 'exato', H, 98, 150, '', []],
  ['chuchu', 'Chuchu', 'un', 'exato', H, 113, 300, '', []],
  ['pepino', 'Pepino', 'un', 'exato', H, 142, 200, '', []],
  ['pimentao-verde', 'Pimentão verde', 'un', 'exato', H, 144, 150, '', ['pimentão']],
  ['pimentao-vermelho', 'Pimentão vermelho', 'un', 'exato', H, 145, 150, '', []],
  ['pimentao-amarelo', 'Pimentão amarelo', 'un', 'exato', H, 143, 150, '', []],
  ['brocolis', 'Brócolis', 'g', 'exato', H, 101, null, '', []],
  ['couve-flor', 'Couve-flor', 'g', 'exato', H, 117, null, '', []],
  ['couve', 'Couve', 'g', 'exato', H, 115, null, '', ['couve manteiga']],
  ['espinafre', 'Espinafre', 'g', 'exato', H, 119, null, '', []],
  ['alface', 'Alface', 'un', 'exato', H, 78, 250, '', []],
  ['rucula', 'Rúcula', 'g', 'exato', H, 152, null, '', []],
  ['repolho', 'Repolho', 'g', 'exato', H, 149, null, '', []],
  ['vagem', 'Vagem', 'g', 'exato', H, 162, null, '', []],
  ['quiabo', 'Quiabo', 'g', 'exato', H, 147, null, '', []],
  ['mandioca', 'Mandioca', 'g', 'exato', H, 130, null, '', ['aipim', 'macaxeira']],
  ['abobora-cabotia', 'Abóbora cabotiá', 'g', 'exato', H, 65, null, '', ['abóbora japonesa', 'cabotian']],
  ['cogumelo', 'Cogumelo', 'g', 'exato', H, null, null, '', ['champignon', 'cogumelo em conserva']],
  ['gengibre', 'Gengibre', 'g', 'exato', H, null, null, '', []],
  ['salsinha', 'Salsinha', 'g', 'exato', H, 153, null, '', ['salsa', 'cheiro-verde']],
  ['cebolinha', 'Cebolinha', 'g', 'exato', H, 108, null, '', []],
  ['coentro', 'Coentro', 'g', 'exato', H, null, null, '', []],
  ['manjericao', 'Manjericão', 'g', 'exato', H, 133, null, '', []],
  ['limao', 'Limão', 'un', 'exato', H, 220, 70, '', ['limão tahiti']],
  ['banana', 'Banana', 'un', 'exato', H, 182, 100, '', ['banana prata']],
  ['maca', 'Maçã', 'un', 'exato', H, 222, 150, '', []],
  ['laranja', 'Laranja', 'un', 'exato', H, 214, 180, '', []],
  ['mamao', 'Mamão', 'un', 'exato', H, 226, 300, '', ['papaia']],
  ['abacate', 'Abacate', 'un', 'exato', H, 163, 600, '', []],
  ['morango', 'Morango', 'g', 'exato', H, 239, null, '', []],
  ['uva', 'Uva', 'g', 'exato', H, 256, null, '', []],

  // Carnes e peixes
  ['peito-frango', 'Peito de frango', 'g', 'exato', C, 409, null, 'c', ['frango', 'filé de frango']],
  ['coxa-frango', 'Coxa e sobrecoxa de frango', 'g', 'exato', C, 414, null, 'c', ['coxa de frango', 'sobrecoxa']],
  ['patinho', 'Patinho', 'g', 'exato', C, 376, null, 'c', ['carne bovina']],
  ['acem', 'Acém', 'g', 'exato', C, 329, null, 'c', []],
  ['carne-moida', 'Carne moída', 'g', 'exato', C, 327, null, 'c', ['acém moído']],
  ['lombo-porco', 'Lombo de porco', 'g', 'exato', C, 433, null, 'c', []],
  ['linguica', 'Linguiça de porco', 'g', 'exato', C, 421, null, 'c', ['linguiça']],
  ['bacon', 'Bacon', 'g', 'exato', C, null, null, 'c', []],
  ['presunto', 'Presunto', 'g', 'exato', C, 439, null, 'c', []],
  ['peixe-branco', 'Filé de peixe branco', 'g', 'exato', C, 307, null, 'c', ['pescada', 'tilápia', 'merluza']],
  ['salmao', 'Salmão', 'g', 'exato', C, 316, null, 'c', []],
  ['camarao', 'Camarão', 'g', 'exato', C, 285, null, 'c', []],
  ['atum-lata', 'Atum em lata', 'g', 'exato', C, 277, null, 'c', ['atum']],
  ['sardinha-lata', 'Sardinha em lata', 'g', 'exato', C, 319, null, 'c', ['sardinha']],

  // Laticínios e ovos
  ['ovo', 'Ovo', 'un', 'exato', L, 489, 50, '', []],
  ['leite', 'Leite integral', 'ml', 'exato', L, 458, null, '', ['leite']],
  ['creme-de-leite', 'Creme de leite', 'g', 'exato', L, 447, null, '', []],
  ['manteiga', 'Manteiga', 'g', 'exato', L, 262, null, '', []],
  ['queijo-mucarela', 'Queijo muçarela', 'g', 'exato', L, 463, null, '', ['mussarela', 'mozarela']],
  ['queijo-parmesao', 'Queijo parmesão', 'g', 'exato', L, 464, null, '', ['parmesão']],
  ['queijo-minas', 'Queijo minas frescal', 'g', 'exato', L, 461, null, '', []],
  ['requeijao', 'Requeijão', 'g', 'exato', L, null, null, '', []],
  ['iogurte', 'Iogurte natural', 'g', 'exato', L, 448, null, '', []],
  ['leite-condensado', 'Leite condensado', 'g', 'exato', L, 453, null, '', []],

  // Mercearia
  ['arroz', 'Arroz branco', 'g', 'nivel', M, 4, null, '', ['arroz']],
  ['arroz-integral', 'Arroz integral', 'g', 'nivel', M, 2, null, '', []],
  ['farinha-trigo', 'Farinha de trigo', 'g', 'nivel', M, 35, null, '', ['farinha']],
  ['farinha-mandioca', 'Farinha de mandioca', 'g', 'nivel', M, 121, null, '', []],
  ['fuba', 'Fubá', 'g', 'nivel', M, 43, null, '', []],
  ['amido-milho', 'Amido de milho', 'g', 'nivel', M, 42, null, '', ['maisena']],
  ['acucar', 'Açúcar', 'g', 'nivel', M, 494, null, '', ['açúcar refinado']],
  ['acucar-mascavo', 'Açúcar mascavo', 'g', 'nivel', M, 493, null, '', []],
  ['oleo', 'Óleo de soja', 'ml', 'nivel', M, 272, null, '', ['óleo']],
  ['azeite', 'Azeite', 'ml', 'nivel', M, 260, null, '', ['azeite de oliva']],
  ['fermento-quimico', 'Fermento químico', 'g', 'nivel', M, 513, null, '', ['fermento em pó']],
  ['feijao-carioca', 'Feijão carioca', 'g', 'exato', M, 562, null, '', ['feijão']],
  ['feijao-preto', 'Feijão preto', 'g', 'exato', M, 568, null, '', []],
  ['lentilha', 'Lentilha', 'g', 'exato', M, 578, null, '', []],
  ['grao-de-bico', 'Grão-de-bico', 'g', 'exato', M, 575, null, '', []],
  ['macarrao', 'Macarrão', 'g', 'exato', M, 40, null, '', ['espaguete', 'massa', 'penne']],
  ['aveia', 'Aveia em flocos', 'g', 'exato', M, 7, null, '', ['aveia']],
  ['pao-frances', 'Pão francês', 'un', 'exato', M, 53, 50, '', ['pão']],
  ['milho-verde', 'Milho verde em lata', 'g', 'exato', M, 45, null, '', ['milho']],
  ['ervilha', 'Ervilha em lata', 'g', 'exato', M, 560, null, '', ['ervilha']],
  ['molho-tomate', 'Molho de tomate', 'g', 'exato', M, 159, null, '', []],
  ['extrato-tomate', 'Extrato de tomate', 'g', 'exato', M, 158, null, '', []],
  ['leite-de-coco', 'Leite de coco', 'ml', 'exato', M, 523, null, '', []],
  ['coco-ralado', 'Coco ralado', 'g', 'exato', M, null, null, '', []],
  ['chocolate', 'Chocolate meio amargo', 'g', 'exato', M, 498, null, '', ['chocolate']],
  ['cacau', 'Cacau em pó', 'g', 'exato', M, null, null, '', []],
  ['mel', 'Mel', 'g', 'exato', M, 507, null, '', []],
  ['fermento-biologico', 'Fermento biológico', 'g', 'exato', M, 514, null, '', []],
  ['amendoim', 'Amendoim torrado', 'g', 'exato', M, 558, null, '', ['amendoim']],
  ['azeitona', 'Azeitona', 'g', 'exato', M, 521, null, '', []],
  ['palmito', 'Palmito', 'g', 'exato', M, 139, null, '', []],

  // Temperos e condimentos
  ['sal', 'Sal', 'g', 'nivel', T, null, null, 's', []],
  ['pimenta-do-reino', 'Pimenta-do-reino', 'g', 'nivel', T, null, null, 's', ['pimenta']],
  ['shoyu', 'Molho shoyu', 'ml', 'nivel', T, 518, null, '', ['shoyu', 'molho de soja']],
  ['vinagre', 'Vinagre', 'ml', 'nivel', T, null, null, '', []],
  ['mostarda', 'Mostarda', 'g', 'nivel', T, null, null, '', []],
  ['ketchup', 'Ketchup', 'g', 'nivel', T, null, null, '', ['catchup']],
  ['maionese', 'Maionese', 'g', 'nivel', T, 524, null, '', []],
  ['canela', 'Canela em pó', 'g', 'nivel', T, null, null, '', ['canela']],
  ['oregano', 'Orégano', 'g', 'nivel', T, null, null, '', []],
  ['paprica', 'Páprica', 'g', 'nivel', T, null, null, '', []],
  ['cominho', 'Cominho', 'g', 'nivel', T, null, null, '', []],
  ['noz-moscada', 'Noz-moscada', 'g', 'nivel', T, null, null, '', []],
  ['louro', 'Folha de louro', 'un', 'nivel', T, null, null, '', ['louro']],

  // Versão 2 do catálogo
  ['agua', 'Água', 'ml', 'nivel', M, null, null, 's', ['água filtrada', 'água quente', 'água fervente', 'água gelada']],
];

export function buildCatalog(now: string): Ingredient[] {
  return ROWS.map(([id, nome, unidadeBase, modo, secao, tacoId, pesoUnidadeG, marcas, apelidos]) => ({
    id,
    nome,
    apelidos,
    unidadeBase,
    modo,
    secao,
    tacoId,
    nutri100g: nutriFromTaco(tacoId),
    pesoUnidadeG,
    conversoes: {},
    sempreTenho: marcas.includes('s'),
    carneOuPeixe: marcas.includes('c'),
    criadoEm: now,
  }));
}

export const CATALOG_SIZE = ROWS.length;
