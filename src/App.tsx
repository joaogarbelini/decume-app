import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TabBar } from './components/Layout';
import { AjustesScreen } from './screens/AjustesScreen';
import { CatalogoScreen } from './screens/CatalogoScreen';
import { DespensaScreen, PlanejarScreen, ReceitasScreen, SemanaScreen } from './screens/MainScreens';

// HashRouter: funciona no GitHub Pages sem configuração de servidor.
export function App() {
  return (
    <HashRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<SemanaScreen />} />
          <Route path="/planejar" element={<PlanejarScreen />} />
          <Route path="/despensa" element={<DespensaScreen />} />
          <Route path="/receitas" element={<ReceitasScreen />} />
          <Route path="/ajustes" element={<AjustesScreen />} />
          <Route path="/ajustes/catalogo" element={<CatalogoScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <TabBar />
    </HashRouter>
  );
}
