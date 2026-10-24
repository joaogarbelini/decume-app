# deCumê

App pessoal para organizar a despensa, montar o cardápio da semana, guardar receitas e gerar a lista de compras. Feito para o celular, funciona offline e instala na tela inicial como um app.

## O que já tem

### Etapa 1: fundação

- App React instalável no celular (PWA), com visual creme, azul-marinho e laranja.
- Quatro abas: Semana, Planejar, Despensa e Receitas, mais a tela de Ajustes.
- Banco de dados local no aparelho (IndexedDB), com todas as tabelas do modelo de dados.
- Catálogo inicial com 107 ingredientes ligados à tabela TACO, separados por seção do mercado. Básicos (farinha, açúcar, arroz, óleo, temperos e condimentos) são controlados por nível: tem, pouco ou acabou.
- Backup: exportar e restaurar todos os dados num arquivo JSON.

### Etapa 2: receitas

- Livro de receitas com busca e filtros por tag e "Vegetarianas".
- Formulário para criar e editar: nome, porções, tempo, tags, ingredientes do catálogo (quantidade, unidade, observação, opcional, a gosto), passos ordenáveis, notas e link de origem. Colar um modo de preparo inteiro separa os passos por linha.
- Ingrediente que não está no catálogo pode ser criado na hora, com seção do mercado e dados da TACO.
- Medidas caseiras (xícara, colher de sopa, colher de chá, pitada) convertidas por ingrediente. Quando o app não sabe a conversão, pergunta e guarda para as próximas receitas.
- Detalhe com ingredientes ajustáveis ao número de porções, calorias e macros por porção ou da receita toda, aviso de "nutrição parcial" dizendo o que ficou de fora, passos e notas.
- Fotos: capa e galeria, reduzidas para 1200 px no próprio celular.
- Folha de vegetariana nas receitas sem carne, frango ou peixe, detectada pelos ingredientes.

### Etapa 3: despensa

- Estoque por seção do mercado: quantidade nos itens principais (g, ml ou unidades, mostrados em kg e litros a partir de mil) e nível tem, pouco ou acabou nos básicos, marcado com um toque.
- Adicionar à despensa: "Comprei agora" (compra avulsa) ou "Já tinha em casa", vários itens seguidos no mesmo painel.
- Corrigir a quantidade de um item ou marcar que acabou.
- Busca, inclusive do que não tem em casa, para lançar direto.
- Histórico de movimentos por dia, e os últimos de cada item no painel dele.
- O estoque nunca fica negativo: a baixa ao cozinhar (etapa 5) para em zero e informa a diferença.

## Próximas etapas

1. ~~Fundação~~
2. ~~Receitas: formulário, detalhe, edição, fotos, cálculo nutricional, marca de vegetariana~~
3. ~~Despensa: estoque exato e por nível, compra avulsa, ajuste, histórico~~
4. Cardápio da semana e lista de compras por seção
5. Cozinhar: modo checklist, baixa, marmitas, avaliação
6. Importação de receitas por link (TudoGostoso)
7. Sugestões com base na despensa

O planejamento completo está no documento "deCumê — Guideline do App".

## Rodar no computador

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm test         # testes
npm run build    # gera a versão final em dist/
```

## Publicar e instalar no celular

Cada push na branch `main` roda os testes e publica o app no GitHub Pages (arquivo `.github/workflows/deploy.yml`).

O app fica em **https://joaogarbelini.github.io/decume-app/** (Pages ativado em Settings → Pages → Source: GitHub Actions).

Para instalar: abra o endereço no celular e use "Adicionar à tela inicial" (Safari no iPhone) ou "Instalar app" (Chrome no Android).

## Onde ficam os dados

Tudo fica no próprio celular, no navegador. Para não perder nada ao trocar de aparelho ou limpar o navegador, use **Ajustes → Exportar backup** de vez em quando.

## Créditos

Dados nutricionais da TACO (Tabela Brasileira de Composição de Alimentos, NEPA/Unicamp), na versão em JSON de [marcelosanto/tabela_taco](https://github.com/marcelosanto/tabela_taco) (licença MIT).
