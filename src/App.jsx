import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import POS from './pages/POS';
import Products from './pages/Products';
import Clients from './pages/Clients';
import Layout from './components/Layout';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? children : <Navigate to="/login" />;
}

function LoadingScreen() {
  return (
    <div className="h-screen bg-surface-0 flex items-center justify-center">
      <div className="text-center">
        <div className="text-2xl font-bold tracking-wider mb-2">
          buro<span className="text-brand-500">.</span>
        </div>
        <div className="text-txt-3 text-sm">Chargement...</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<POS />} />
        <Route path="produits" element={<Products />} />
        <Route path="clients" element={<Clients />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
