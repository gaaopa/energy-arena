import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AlunosPage } from './pages/AlunosPage';
import { AlunoDetailPage } from './pages/AlunoDetailPage';
import { CheckInPage } from './pages/CheckInPage';
import { PlanosPage } from './pages/PlanosPage';
import { MatriculasPage } from './pages/MatriculasPage';
import { PagamentosPage } from './pages/PagamentosPage';
import { UnidadesPage } from './pages/UnidadesPage';
import { UsuariosPage } from './pages/UsuariosPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/alunos" element={<AlunosPage />} />
          <Route path="/alunos/:id" element={<AlunoDetailPage />} />
          <Route path="/checkin" element={<CheckInPage />} />
          <Route path="/planos" element={<PlanosPage />} />
          <Route path="/matriculas" element={<MatriculasPage />} />
          <Route path="/pagamentos" element={<PagamentosPage />} />
          <Route path="/unidades" element={<UnidadesPage />} />
          <Route path="/usuarios" element={<UsuariosPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
