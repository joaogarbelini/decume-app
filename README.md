# deCumê

App pessoal para organizar a despensa, montar o cardápio da semana, guardar receitas e gerar a lista de compras. Feito para o celular, funciona offline e instala na tela inicial como um app.

## O que já tem (etapa 1)

- App React instalável no celular (PWA), com visual creme, azul-marinho e laranja.
- Quatro abas: Semana, Planejar, Despensa e Receitas, mais a tela de Ajustes.
- Banco de dados local no aparelho (IndexedDB), com todas as tabelas do modelo de dados.
- Catálogo inicial com 107 ingredientes ligados à tabela TACO, separados por seção do mercado. Básicos (farinha, açúcar, arroz, óleo, temperos e condimentos) são controlados por nível: tem, pouco ou acabou.
- Backup: exportar e restaurar todos os dados num arquivo JSON.

## Próximas etapas

1. ~~Fundação~~
2. Receitas: formulário, detalhe, edição, fotos, cálculo nutricional, marca de vegetariana
3. Despensa: estoque exato e por nível, compra avulsa, ajuste, histórico
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

Na primeira vez, ative o Pages no repositório: **Settings → Pages → Source: GitHub Actions**. O endereço fica `https://<seu-usuário>.github.io/decume-app/`. Em repositório privado, o GitHub Pages exige um plano pago do GitHub.

Para instalar: abra o endereço no celular e use "Adicionar à tela inicial" (Safari no iPhone) ou "Instalar app" (Chrome no Android).

## Onde ficam os dados

Tudo fica no próprio celular, no navegador. Para não perder nada ao trocar de aparelho ou limpar o navegador, use **Ajustes → Exportar backup** de vez em quando.

## Créditos

Dados nutricionais da TACO (Tabela Brasileira de Composição de Alimentos, NEPA/Unicamp), na versão em JSON de [marcelosanto/tabela_taco](https://github.com/marcelosanto/tabela_taco) (licença MIT).
