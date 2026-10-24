import { EmptyState, TabHeader } from '../components/Layout';
import { proximaSemana, rotuloSemana } from '../lib/dates';

// Telas principais da etapa 1: estrutura e estados vazios.
// Cada uma ganha conteúdo nas próximas etapas do roadmap.

export function SemanaScreen() {
  return (
    <>
      <TabHeader title="Esta semana" eyebrow={rotuloSemana(new Date())} />
      <main className="view">
        <EmptyState icon="week" title="Nenhuma receita nesta semana">
          Quando o cardápio estiver pronto, aqui aparecem as receitas a fazer, as marmitas na geladeira e o que dá pra
          fazer com a despensa.
        </EmptyState>
      </main>
    </>
  );
}

export function PlanejarScreen() {
  return (
    <>
      <TabHeader title="Planejar" eyebrow={`Próxima semana · ${rotuloSemana(proximaSemana(new Date()))}`} />
      <main className="view">
        <EmptyState icon="plan" title="Cardápio e lista de compras">
          Aqui você vai montar as receitas da próxima semana e ver a lista de compras por seção do mercado.
        </EmptyState>
      </main>
    </>
  );
}
