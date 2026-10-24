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

### Etapa 4: cardápio e lista de compras

- Planejar esta semana ou a próxima: receitas do livro, sem dia fixo, com porções ajustáveis. Também dá para "Pôr no cardápio" direto do detalhe da receita.
- Lista de compras calculada: cardápio menos despensa, ajustada pelas porções, agrupada por seção do mercado e dizendo para qual receita é cada item. Básicos em "pouco" ou "acabou" entram mesmo sem receita; sal e pimenta aparecem só como lembrete.
- Receitas ainda a fazer de semanas anteriores continuam contando, porque vão usar a despensa.
- No mercado: tocar no item pergunta quanto comprou (já preenchido com o que falta, arredondado) e manda para a despensa. Item avulso do catálogo ou em texto livre ("papel toalha"). Comprados ficam numa lista própria com "Desfazer".
- Revisão das receitas que ficaram a fazer em semanas passadas: Fiz, Adiar ou Tirar.
- Tela Semana com as receitas desta semana e "Marcar como feita", que mostra a baixa prevista e avisa se a despensa tinha menos do que a receita usa.

### Etapa 5: cozinhar

- Modo cozinhar com texto grande, tela sempre acesa (quando o navegador permite), checklist de ingredientes e de passos, com o passo atual em destaque. Os passos marcados ficam salvos se sair e voltar.
- Finalizar (depois de cozinhar, pelo "Já fiz" da semana ou pelo "Fiz" da revisão): baixa prevista com as quantidades editáveis, toque rápido no nível dos básicos usados, marmitas (sugere o que passou de 2 porções) e avaliação opcional por sabor, facilidade, custo-benefício e apresentação, "Faria de novo?", comentário e fotos.
- Marmitas na tela Semana, com "Comi uma" e descartar.
- Nota média no livro de receitas (com filtro "Nota 4+") e avaliações no detalhe da receita, com os comentários.

### Etapa 6: importação de receitas

- Receitas → Importar: pelo link (TudoGostoso e sites com dados no padrão schema.org) ou colando o texto da receita.
- O app separa quantidade, unidade e ingrediente de cada linha ("2 e 1/2 xícaras (chá) de farinha de trigo", "1 lata (395 g) de leite condensado", "sal e pimenta a gosto") e casa com o catálogo.
- A receita entra como rascunho e abre na revisão: ponto verde = reconhecido, laranja = escolha no catálogo, cinza = a gosto, com o texto original embaixo. Só depois de salva ela entra no cardápio e nas sugestões.
- Pelo link, a foto da receita vira a capa.

## Próximas etapas

1. ~~Fundação~~
2. ~~Receitas: formulário, detalhe, edição, fotos, cálculo nutricional, marca de vegetariana~~
3. ~~Despensa: estoque exato e por nível, compra avulsa, ajuste, histórico~~
4. ~~Cardápio da semana e lista de compras por seção~~
5. ~~Cozinhar: modo checklist, baixa, marmitas, avaliação~~
6. ~~Importação de receitas por link (TudoGostoso)~~
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

## Importador de receitas (para importar pelo link)

O navegador do celular não consegue baixar páginas de outros sites, então a importação pelo link usa um serviço pequeno e gratuito na Cloudflare, que está em `worker/`. Ele só busca a página ou a foto e devolve para o app; não guarda nada. Sem ele, a importação colando o texto continua funcionando.

Para criar (uma vez, uns 5 minutos):

1. Crie uma conta gratuita em [dash.cloudflare.com](https://dash.cloudflare.com).
2. Vá em **Workers & Pages → Create → Create Worker**, dê o nome `decume-importador` e clique em **Deploy**.
3. Clique em **Edit code**, apague o código de exemplo, cole o conteúdo de `worker/importador.js` e clique em **Deploy**.
4. Copie o endereço do Worker (algo como `https://decume-importador.seu-usuario.workers.dev`).
5. No app, em **Ajustes → Importação por link**, cole o endereço e toque em **Testar e salvar**.

Pelo terminal, o mesmo: `cd worker && npx wrangler deploy`.

O importador só aceita pedidos vindos do endereço do app (variável `ORIGENS` em `worker/wrangler.toml`) e recusa endereços internos.

## Onde ficam os dados

Tudo fica no próprio celular, no navegador. Para não perder nada ao trocar de aparelho ou limpar o navegador, use **Ajustes → Exportar backup** de vez em quando.

## Créditos

Dados nutricionais da TACO (Tabela Brasileira de Composição de Alimentos, NEPA/Unicamp), na versão em JSON de [marcelosanto/tabela_taco](https://github.com/marcelosanto/tabela_taco) (licença MIT).
