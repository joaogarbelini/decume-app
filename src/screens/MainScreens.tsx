import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { EmptyState, TabHeader } from '../components/Layout';
import { db } from '../db/db';
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

export function DespensaScreen() {
  const total = useLiveQuery(() => db.ingredients.count(), []);
  return (
    <>
      <TabHeader title="Despensa" eyebrow="O que tem em casa" />
      <main className="view">
        <EmptyState
          icon="jar"
          title="Despensa vazia"
          action={
            <Link className="btn ghost" to="/ajustes/catalogo">
              Ver catálogo de ingredientes
            </Link>
          }
        >
          O controle de estoque vem logo. O catálogo{total ? ` com ${total} ingredientes` : ''} já está pronto, ligado à
          tabela TACO.
        </EmptyState>
      </main>
    </>
  );
}

export function ReceitasScreen() {
  return (
    <>
      <TabHeader title="Receitas" eyebrow="Seu livro" />
      <main className="view">
        <EmptyState icon="book" title="Seu livro de receitas está vazio">
          Em breve: cadastro por formulário e importação por link do TudoGostoso, com revisão antes de salvar.
        </EmptyState>
      </main>
    </>
  );
}
