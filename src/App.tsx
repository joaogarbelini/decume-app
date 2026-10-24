import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TabBar } from './components/Layout';
import { AjustesScreen } from './screens/AjustesScreen';
import { CatalogoScreen } from './screens/CatalogoScreen';
import { PlanejarScreen } from './screens/planejar/PlanejarScreen';
import { SemanaScreen } from './screens/SemanaScreen';
import { CozinharScreen } from './screens/cozinhar/CozinharScreen';
import { FinalizarScreen } from './screens/cozinhar/FinalizarScreen';
import { SugestoesScreen } from './screens/sugestoes/SugestoesScreen';
import { DespensaScreen } from './screens/despensa/DespensaScreen';
import { HistoricoScreen } from './screens/despensa/HistoricoScreen';
import { LivroScreen } from './screens/receitas/LivroScreen';
import { ReceitaDetalheScreen } from './screens/receitas/ReceitaDetalheScreen';
import { ReceitaFormScreen } from './screens/receitas/ReceitaFormScreen';
import { ImportarScreen } from './screens/receitas/ImportarScreen';

// HashRouter: funciona no GitHub Pages sem configuração de servidor.
export function App() {
  return (
    <HashRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<SemanaScreen />} />
          <Route path="/planejar" element={<PlanejarScreen />} />
          <Route path="/despensa" element={<DespensaScreen />} />
          <Route path="/despensa/historico" element={<HistoricoScreen />} />
          <Route path="/receitas" element={<LivroScreen />} />
          <Route path="/receitas/nova" element={<ReceitaFormScreen key="nova" />} />
          <Route path="/receitas/importar" element={<ImportarScreen />} />
          <Route path="/receitas/:id" element={<ReceitaDetalheScreen />} />
          <Route path="/receitas/:id/editar" element={<ReceitaFormScreen />} />
          <Route path="/cozinhar/:id" element={<CozinharScreen />} />
          <Route path="/cozinhar/:id/finalizar" element={<FinalizarScreen />} />
          <Route path="/sugestoes" element={<SugestoesScreen />} />
          <Route path="/ajustes" element={<AjustesScreen />} />
          <Route path="/ajustes/catalogo" element={<CatalogoScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <TabBar />
    </HashRouter>
  );
}
