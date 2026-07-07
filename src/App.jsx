import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { POSCartProvider } from './context/POSCartContext';
import LoadingSpinner from './components/LoadingSpinner';

// Admin/POS layout + pages
const Layout = lazy(() => import('./components/Layout'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const POS = lazy(() => import('./pages/POS'));
const Products = lazy(() => import('./pages/Products'));
const ProductForm = lazy(() => import('./pages/ProductForm'));
const Packs = lazy(() => import('./pages/Packs'));
const PackBuilder = lazy(() => import('./pages/PackBuilder'));
const Clients = lazy(() => import('./pages/Clients'));
const Commandes = lazy(() => import('./pages/Commandes'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const PurchaseOrderForm = lazy(() => import('./pages/PurchaseOrderForm'));
const Analytics = lazy(() => import('./pages/Analytics'));

// Storefront layout + pages
const StoreLayout = lazy(() => import('./components/StoreLayout'));
const StoreHome = lazy(() => import('./pages/store/Home'));
const StoreCategories = lazy(() => import('./pages/store/Categories'));
const StoreCategoryDetail = lazy(() => import('./pages/store/CategoryDetail'));
const StoreProductDetail = lazy(() => import('./pages/store/ProductDetail'));
const StoreManuels = lazy(() => import('./pages/store/Manuels'));
const StoreRecentlyViewed = lazy(() => import('./pages/store/RecentlyViewed'));
const StorePacks = lazy(() => import('./pages/store/Packs'));
const StoreSchoolPacks = lazy(() => import('./pages/store/SchoolPacks'));
const StorePackDetail = lazy(() => import('./pages/store/PackDetail'));
const StorePanier = lazy(() => import('./pages/store/Panier'));
const StoreCheckout = lazy(() => import('./pages/store/Checkout'));
const StoreProfil = lazy(() => import('./pages/store/Profil'));
const StoreNotFound = lazy(() => import('./pages/store/NotFound'));

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

// GitHub Pages SPA support: public/404.html redirects unknown paths to
// /?redirect=<original-path>, so on mount we replay that path via the router
// (clean URL, no extra network round-trip) and drop the query param.
function RedirectHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    if (redirect) {
      navigate(redirect, { replace: true });
    }
  }, [navigate]);

  return null;
}

export default function App() {
  return (
    <>
      <RedirectHandler />
      <Suspense fallback={<LoadingSpinner />}>
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
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
          <Route path="/" element={<StoreLayout />}>
            <Route index element={<StoreHome />} />
            <Route path="categories" element={<StoreCategories />} />
            <Route path="categories/:slug" element={<StoreCategoryDetail />} />
            <Route path="produit/:slug" element={<StoreProductDetail />} />
            <Route path="manuels" element={<StoreManuels />} />
            <Route path="recemment-consultes" element={<StoreRecentlyViewed />} />
            <Route path="packs" element={<StorePacks />} />
            <Route path="packs/ecole/:schoolId" element={<StoreSchoolPacks />} />
            <Route path="packs/:slug" element={<StorePackDetail />} />
            <Route path="panier" element={<StorePanier />} />
            <Route path="checkout" element={<StoreCheckout />} />
            <Route path="profil" element={<StoreProfil />} />
            <Route path="*" element={<StoreNotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
