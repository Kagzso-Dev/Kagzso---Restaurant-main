import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AdminRoute, KitchenRoute, CashierRoute, WaiterRoute } from './PrivateRoutes';
import Layout from './components/Layout';

// ── Components ───────────────────────────────────────────────────
import Login from './pages/Login';

// ── Lazy Loaded Pages ─────────────────────────────────────────────
// This improves initial bundle size and load speed
const AdminDashboard = lazy(() => import('./pages/Admin/Dashboard'));
const AdminMenu = lazy(() => import('./pages/Admin/Menu'));
const AdminTables = lazy(() => import('./pages/Admin/Tables'));
const AdminCategories = lazy(() => import('./pages/Admin/Categories'));
const AdminOrders = lazy(() => import('./pages/Admin/Orders'));
const AdminSettings = lazy(() => import('./pages/Admin/Settings'));
const AdminAnalytics = lazy(() => import('./pages/Admin/Analytics'));
const AdminNotifications = lazy(() => import('./pages/Admin/Notifications'));
const KitchenDashboard = lazy(() => import('./pages/Kitchen/Dashboard'));
const CashierDashboard = lazy(() => import('./pages/Cashier/Dashboard'));
const WorkingProcess = lazy(() => import('./pages/Cashier/WorkingProcess'));
const WaiterDashboard = lazy(() => import('./pages/Waiter/Dashboard'));
const NewOrder = lazy(() => import('./pages/Waiter/NewOrder'));
const DineIn = lazy(() => import('./pages/Waiter/DineIn'));
const TakeAway = lazy(() => import('./pages/Waiter/TakeAway'));
const Unauthorized = lazy(() => import('./pages/Unauthorized'));

/**
 * Global Page Loading Spinner
 * Matches the SaaS brand aesthetic
 */
const PageLoader = () => (
  <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0f172a] z-[9999]">
    <div className="relative w-16 h-16">
      <div className="absolute inset-0 border-4 border-orange-500/20 rounded-full" />
      <div className="absolute inset-0 border-4 border-t-orange-500 rounded-full animate-spin" />
    </div>
    <p className="mt-4 text-gray-500 text-sm font-bold uppercase tracking-widest animate-pulse">Loading Terminal...</p>
  </div>
);

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            <Route element={<Layout />}>



              {/* Admin Routes - Tenant Specific Management */}
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/menu" element={<AdminMenu />} />
                <Route path="/admin/tables" element={<AdminTables />} />
                <Route path="/admin/categories" element={<AdminCategories />} />
                <Route path="/admin/orders" element={<AdminOrders />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
                <Route path="/admin/notifications" element={<AdminNotifications />} />
              </Route>

              {/* Kitchen Routes */}
              <Route element={<KitchenRoute />}>
                <Route path="/kitchen" element={<KitchenDashboard />} />
              </Route>

              {/* Cashier Routes */}
              <Route element={<CashierRoute />}>
                <Route path="/cashier" element={<CashierDashboard />} />
                <Route path="/cashier/working-process" element={<WorkingProcess />} />
                <Route path="/cashier/kitchen-view" element={<KitchenDashboard />} />
              </Route>

              {/* Waiter Routes */}
              <Route element={<WaiterRoute />}>
                <Route path="/waiter" element={<WaiterDashboard />} />
                <Route path="/waiter/new-order" element={<NewOrder />} />
                <Route path="/dine-in" element={<DineIn />} />
                <Route path="/take-away" element={<TakeAway />} />
                <Route path="/waiter/working-process" element={<WorkingProcess />} />
                <Route path="/waiter/kitchen-view" element={<KitchenDashboard />} />
              </Route>

            </Route>

            {/* Root + catch-all: always go to login (Login.jsx redirects logged-in users to their dashboard) */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
