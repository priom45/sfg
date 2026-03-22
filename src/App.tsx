import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './contexts/CartContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SiteSettingsProvider } from './contexts/SiteSettingsContext';
import { ToastProvider } from './components/Toast';
import Header from './components/Header';
import Footer from './components/Footer';
import BottomNav from './components/BottomNav';
import FloatingCart from './components/FloatingCart';
import SiteClosedOverlay from './components/SiteClosedOverlay';
import RouteSeo from './components/RouteSeo';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Cart from './pages/Cart';
import OrderSuccess from './pages/OrderSuccess';
import TrackOrder from './pages/TrackOrder';
import About from './pages/About';
import AuthPage from './pages/AuthPage';
import MyOrders from './pages/MyOrders';
import Profile from './pages/Profile';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminMenu from './pages/admin/AdminMenu';
import AdminZones from './pages/admin/AdminZones';
import AdminOffers from './pages/admin/AdminOffers';
import AdminMessages from './pages/admin/AdminMessages';
import AdminWebsite from './pages/admin/AdminWebsite';
import ChefLogin from './pages/chef/ChefLogin';
import ChefDashboard from './pages/chef/ChefDashboard';
import type { ReactNode } from 'react';
import { useSiteSettings } from './hooks/useSiteSettings';

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg">
      <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user || !profile || profile.role !== 'admin') return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

function ChefRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user || !profile || (profile.role !== 'chef' && profile.role !== 'admin')) return <Navigate to="/chef/login" replace />;
  return <>{children}</>;
}

function CustomerAccessGate({ children }: { children: ReactNode }) {
  const { settings, loading } = useSiteSettings();

  return (
    <>
      {children}
      {!loading && settings && !settings.site_is_open && <SiteClosedOverlay settings={settings} />}
    </>
  );
}

function CustomerLayout({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();

  if (!loading && profile) {
    if (profile.role === 'chef') return <Navigate to="/chef" replace />;
    if (profile.role === 'admin') return <Navigate to="/admin" replace />;
  }

  return (
    <CustomerAccessGate>
      <Header />
      <main className="customer-main">{children}</main>
      <FloatingCart />
      <Footer />
      <BottomNav />
    </CustomerAccessGate>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <RouteSeo />
      <SiteSettingsProvider>
        <AuthProvider>
          <CartProvider>
            <ToastProvider>
              <Routes>
                <Route path="/chef/login" element={<ChefLogin />} />
                <Route path="/chef" element={<ChefRoute><ChefDashboard /></ChefRoute>} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route
                  path="/admin/*"
                  element={
                    <AdminRoute>
                      <AdminLayout />
                    </AdminRoute>
                  }
                >
                  <Route index element={<AdminDashboard />} />
                  <Route path="orders" element={<AdminOrders />} />
                  <Route path="menu" element={<AdminMenu />} />
                  <Route path="zones" element={<AdminZones />} />
                  <Route path="offers" element={<AdminOffers />} />
                  <Route path="messages" element={<AdminMessages />} />
                  <Route path="website" element={<AdminWebsite />} />
                </Route>

                <Route path="/" element={<CustomerLayout><Home /></CustomerLayout>} />
                <Route path="/menu" element={<CustomerLayout><Menu /></CustomerLayout>} />
                <Route path="/cart" element={<CustomerLayout><Cart /></CustomerLayout>} />
                <Route path="/order-success/:orderId" element={<CustomerLayout><OrderSuccess /></CustomerLayout>} />
                <Route path="/track" element={<CustomerLayout><TrackOrder /></CustomerLayout>} />
                <Route path="/track/:orderId" element={<CustomerLayout><TrackOrder /></CustomerLayout>} />
                <Route path="/about" element={<CustomerLayout><About /></CustomerLayout>} />
                <Route path="/auth" element={<CustomerAccessGate><AuthPage /></CustomerAccessGate>} />
                <Route path="/profile" element={<CustomerLayout><Profile /></CustomerLayout>} />
                <Route path="/my-orders" element={<CustomerLayout><MyOrders /></CustomerLayout>} />
                <Route path="/privacy" element={<CustomerLayout><PrivacyPolicy /></CustomerLayout>} />
                <Route path="/terms" element={<CustomerLayout><TermsOfService /></CustomerLayout>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ToastProvider>
          </CartProvider>
        </AuthProvider>
      </SiteSettingsProvider>
    </BrowserRouter>
  );
}
