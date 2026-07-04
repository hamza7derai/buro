import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Products from './pages/Products';
import ProductForm from './pages/ProductForm';
import Packs from './pages/Packs';
import PackBuilder from './pages/PackBuilder';
import Clients from './pages/Clients';
import Commandes from './pages/Commandes';
import PurchaseOrders from './pages/PurchaseOrders';
import PurchaseOrderForm from './pages/PurchaseOrderForm';
import Analytics from './pages/Analytics';
import Layout from './components/Layout';
import { POSCartProvider } from './context/POSCartContext';
import StoreLayout from './components/StoreLayout';
import StoreHome from './pages/store/Home';
import StoreCategories from './pages/store/Categories';
import StoreCategoryDetail from './pages/store/CategoryDetail';
import StoreProductDetail from './pages/store/ProductDetail';
import StoreManuels from './pages/store/Manuels';
import StorePacks from './pages/store/Packs';
import StorePackDetail from './pages/store/PackDetail';
import StorePanier from './pages/store/Panier';
import StoreCheckout from './pages/store/Checkout';
import StoreProfil from './pages/store/Profil';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? children : <Navigate to="/admin/login" />;
}

function LoadingScreen() {
  return (
    <div className="h-screen bg-surface-0 flex items-center justify-center">
      <div className="text-center">
        <div className="text-2xl font-bold tracking-wider mb-2">
          younasser
        </div>
        <div className="text-txt-3 text-sm">Chargement...</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/admin/login" element={<Login />} />
      <Route path="/admin" element={
        <PrivateRoute>
          <POSCartProvider>
            <Layout />
          </POSCartProvider>
        </PrivateRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="pos" element={<POS />} />
        <Route path="produits" element={<Products />} />
        <Route path="produits/nouveau" element={<ProductForm />} />
        <Route path="produits/:id" element={<ProductForm />} />
        <Route path="packs" element={<Packs />} />
        <Route path="packs/nouveau" element={<PackBuilder />} />
        <Route path="packs/:id" element={<PackBuilder />} />
        <Route path="clients" element={<Clients />} />
        <Route path="commandes" element={<Commandes />} />
        <Route path="achats" element={<PurchaseOrders />} />
        <Route path="achats/nouveau" element={<PurchaseOrderForm />} />
        <Route path="achats/:id" element={<PurchaseOrderForm />} />
        <Route path="analytics" element={<Analytics />} />
      </Route>
      <Route path="/" element={<StoreLayout />}>
        <Route index element={<StoreHome />} />
        <Route path="categories" element={<StoreCategories />} />
        <Route path="categories/:slug" element={<StoreCategoryDetail />} />
        <Route path="produit/:id" element={<StoreProductDetail />} />
        <Route path="manuels" element={<StoreManuels />} />
        <Route path="packs" element={<StorePacks />} />
        <Route path="packs/:id" element={<StorePackDetail />} />
        <Route path="panier" element={<StorePanier />} />
        <Route path="checkout" element={<StoreCheckout />} />
        <Route path="profil" element={<StoreProfil />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
