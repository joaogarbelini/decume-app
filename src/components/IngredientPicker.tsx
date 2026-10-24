import { useMemo, useState } from 'react';
import { TACO } from '../data/catalog';
import { criarIngrediente, RecipeError } from '../db/recipes';
import { SECOES, type Ingredient, type ModoControle, type Secao, type Unidade } from '../db/types';
import { casaBusca, semAcento } from '../lib/text';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

const MAX_RESULTADOS = 40;

/** Busca no catálogo e, se não achar, cria o ingrediente na hora. */
export function IngredientPicker({
  catalogo,
  onPick,
  onClose,
  titulo = 'Escolher ingrediente',
  aviso,
  incluir,
  descrever,
  onTextoLivre,
}: {
  catalogo: Map<string, Ingredient>;
  onPick: (i: Ingredient) => void;
  onClose: () => void;
  titulo?: string;
  /** mensagem curta no topo (ex.: o que acabou de ser adicionado) */
  aviso?: string | null;
  /** filtro opcional dos itens oferecidos */
  incluir?: (i: Ingredient) => boolean;
  /** texto da segunda linha; padrão = seção do mercado */
  descrever?: (i: Ingredient) => string;
  /** quando presente, oferece adicionar o texto digitado sem passar pelo catálogo */
  onTextoLivre?: (texto: string) => void;
}) {
  const [busca, setBusca] = useState('');
  const [criando, setCriando] = useState(false);

  const resultados = useMemo(() => {
    const todos = [...catalogo.values()].filter((i) => !incluir || incluir(i)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    if (!busca.trim()) return todos.slice(0, MAX_RESULTADOS);
    // Quem começa com a busca (no nome, numa palavra do nome ou num apelido) vem primeiro.
    const q = semAcento(busca.trim());
    const nota = (i: Ingredient) => {
      const nomes = [i.nome, ...i.apelidos].map(semAcento);
      if (nomes.some((n) => n.startsWith(q))) return 0;
      if (nomes.some((n) => n.split(/[\s-]+/).some((w) => w.startsWith(q)))) return 1;
      return 2;
    };
    return todos
      .filter((i) => casaBusca(busca, i.nome, ...i.apelidos))
      .map((i) => [nota(i), i] as const)
      .sort((a, b) => a[0] - b[0])
      .map(([, i]) => i)
      .slice(0, MAX_RESULTADOS);
  }, [catalogo, busca, incluir]);

  if (criando) {
    return <NovoIngredienteSheet nomeInicial={busca.trim()} onCriado={onPick} onClose={() => setCriando(false)} />;
  }

  return (
    <Sheet title={titulo} onClose={onClose}>
      {aviso && (
        <div className="alert ok" role="status">
          {aviso}
        </div>
      )}
      <label className="search">
        <Icon name="search" />
        <input
          autoFocus
          type="search"
          placeholder="Buscar no catálogo"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar ingrediente"
        />
      </label>
      <div className="list pick-list">
        {resultados.map((i) => (
          <button type="button" className="li pick" key={i.id} onClick={() => onPick(i)}>
            <div className="grow">
              <div className="name">{i.nome}</div>
              <div className="sub">{descrever ? descrever(i) : i.secao}</div>
            </div>
          </button>
        ))}
        {!resultados.length && <p className="muted small pick-empty">Nada no catálogo com "{busca}".</p>}
      </div>
      {onTextoLivre && busca.trim() && (
        <button type="button" className="btn block" onClick={() => onTextoLivre(busca.trim())}>
          <Icon name="plus" />
          Adicionar "{busca.trim()}" à lista
        </button>
      )}
      <button type="button" className="btn ghost block" onClick={() => setCriando(true)}>
        <Icon name="plus" />
        {busca.trim() ? `Criar "${busca.trim()}" no catálogo` : 'Criar ingrediente novo'}
      </button>
    </Sheet>
  );
}

function NovoIngredienteSheet({ nomeInicial, onCriado, onClose }: { nomeInicial: string; onCriado: (i: Ingredient) => void; onClose: () => void }) {
  const [nome, setNome] = useState(nomeInicial);
  const [unidadeBase, setUnidadeBase] = useState<Unidade>('g');
  const [peso, setPeso] = useState('');
  const [secao, setSecao] = useState<Secao>('Mercearia');
  const [modo, setModo] = useState<ModoControle>('exato');
  const [carne, setCarne] = useState(false);
  const [tacoBusca, setTacoBusca] = useState(nomeInicial);
  const [tacoId, setTacoId] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const tacoOpcoes = useMemo(
    () => (tacoBusca.trim().length >= 2 ? TACO.filter((f) => casaBusca(tacoBusca, f.d)).slice(0, 8) : []),
    [tacoBusca],
  );
  const tacoEscolhido = tacoId != null ? TACO.find((f) => f.id === tacoId) : undefined;

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      const pesoNum = Number(peso.replace(',', '.'));
      const ing = await criarIngrediente({
        nome,
        unidadeBase,
        secao,
        modo,
        carneOuPeixe: carne,
        pesoUnidadeG: unidadeBase === 'un' && pesoNum > 0 ? pesoNum : null,
        tacoId,
      });
      onCriado(ing);
    } catch (e) {
      setErro(e instanceof RecipeError ? e.message : 'Não deu para criar o ingrediente.');
      setSalvando(false);
    }
  }

  return (
    <Sheet
      title="Ingrediente novo"
      onClose={onClose}
      footer={
        <button type="button" className="btn block" onClick={salvar} disabled={salvando || !nome.trim()}>
          Criar e usar
        </button>
      }
    >
      <div className="form">
        <label className="field">
          <span className="label">Nome</span>
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Tofu" />
        </label>

        <div className="field">
          <span className="label">Medido em</span>
          <div className="seg" role="radiogroup" aria-label="Medido em">
            {(
              [
                ['g', 'gramas'],
                ['ml', 'ml'],
                ['un', 'unidades'],
              ] as const
            ).map(([v, t]) => (
              <button type="button" role="radio" aria-checked={unidadeBase === v} key={v} className={unidadeBase === v ? 'on' : ''} onClick={() => setUnidadeBase(v)}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {unidadeBase === 'un' && (
          <label className="field">
            <span className="label">Peso médio de 1 unidade (g)</span>
            <input className="input" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="Ex.: 150" />
            <span className="hint">Usado para calcular calorias. Pode deixar em branco.</span>
          </label>
        )}

        <label className="field">
          <span className="label">Seção do mercado</span>
          <select className="input" value={secao} onChange={(e) => setSecao(e.target.value as Secao)}>
            {SECOES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>

        <div className="field">
          <span className="label">Controle na despensa</span>
          <div className="seg" role="radiogroup" aria-label="Controle na despensa">
            <button type="button" role="radio" aria-checked={modo === 'exato'} className={modo === 'exato' ? 'on' : ''} onClick={() => setModo('exato')}>
              Quantidade
            </button>
            <button type="button" role="radio" aria-checked={modo === 'nivel'} className={modo === 'nivel' ? 'on' : ''} onClick={() => setModo('nivel')}>
              Tem / pouco / acabou
            </button>
          </div>
        </div>

        <label className="toggle">
          <input type="checkbox" checked={carne} onChange={(e) => setCarne(e.target.checked)} />
          <span>É carne, frango ou peixe</span>
        </label>

        <div className="field">
          <span className="label">Dados nutricionais (TACO)</span>
          {tacoEscolhido ? (
            <div className="picked">
              <span className="grow">{tacoEscolhido.d}</span>
              <button type="button" className="btn ghost sm" onClick={() => setTacoId(null)}>
                Trocar
              </button>
            </div>
          ) : (
            <>
              <input className="input" value={tacoBusca} onChange={(e) => setTacoBusca(e.target.value)} placeholder="Buscar alimento na TACO" />
              {tacoOpcoes.length > 0 && (
                <div className="list taco-list">
                  {tacoOpcoes.map((f) => (
                    <button type="button" className="li pick" key={f.id} onClick={() => setTacoId(f.id)}>
                      <div className="grow">
                        <div className="name">{f.d}</div>
                        <div className="sub">{Math.round(f.kcal)} kcal por 100 g</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <span className="hint">Opcional. Sem isso, a receita mostra nutrição parcial.</span>
            </>
          )}
        </div>
        {erro && (
          <div className="alert err" role="alert">
            {erro}
          </div>
        )}
      </div>
    </Sheet>
  );
}
