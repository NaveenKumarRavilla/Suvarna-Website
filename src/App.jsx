import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AdminProvider } from './context/AdminContext';
import { AuthProvider } from './context/AuthContext';
import { WishlistProvider } from './context/WishlistContext';
import { useAdmin } from './context/AdminContext';
import Header from './components/layout/Header';
import CategoryNav from './components/layout/CategoryNav';
import Footer from './components/layout/Footer';
import WhatsAppButton from './components/layout/WhatsAppButton';
import AdminLayout, { AdminPermission } from './components/admin/AdminLayout';
const Home = lazy(() => import('./pages/Home'));
const Products = lazy(() => import('./pages/Products'));
const ProductDetailsPage = lazy(() => import('./pages/ProductDetails'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const WishlistPage = lazy(() => import('./pages/Wishlist'));
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Register = lazy(() => import('./pages/Register'));
const Account = lazy(() => import('./pages/Account'));
const Contact = lazy(() => import('./pages/Contact'));
const About = lazy(() => import('./pages/About'));
const Services = lazy(() => import('./pages/Services'));
const PolicyPage = lazy(() => import('./pages/PolicyPage'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminBanners = lazy(() => import('./pages/admin/AdminBanners'));
const AdminPromoCards = lazy(() => import('./pages/admin/AdminPromoCards'));
const AdminVideos = lazy(() => import('./pages/admin/AdminVideos'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers'));
const AdminEnquiries = lazy(() => import('./pages/admin/AdminEnquiries'));
const AdminOffers = lazy(() => import('./pages/admin/AdminOffers'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminPolicies = lazy(() => import('./pages/admin/AdminPolicies'));
const AdminChangePassword = lazy(() => import('./pages/admin/AdminChangePassword'));

function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AdminProvider>
        <AuthProvider>
          <WishlistProvider>
            <CartProvider>
              <ApplicationShell />
            </CartProvider>
          </WishlistProvider>
        </AuthProvider>
      </AdminProvider>
    </BrowserRouter>
  );
}

function ApplicationShell() {
  const { pathname } = useLocation();
  const { storefrontReady, storefrontDataAvailable, storefrontError } = useAdmin();
  const isAdminRoute = pathname.startsWith('/admin');

  if (!isAdminRoute && !storefrontReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p role="status" className="rounded-lg bg-white p-6 text-sm text-slate-600 shadow-card">
          Loading the latest store catalogue…
        </p>
      </main>
    );
  }
  if (!isAdminRoute && !storefrontDataAvailable) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p role="alert" className="max-w-xl rounded-lg bg-white p-6 text-sm text-red-700 shadow-card">
          {storefrontError || 'Store data could not be confirmed. Refresh this page or contact the store administrator.'}
        </p>
      </main>
    );
  }

  return (
    <>
      <ScrollToTop />
      <div className="flex min-h-screen flex-col">
        <Header />
        <CategoryNav />
        <main className="flex-1">
                  <Suspense fallback={<div role="status" className="flex min-h-64 items-center justify-center text-sm text-slate-600">Loading page…</div>}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/product/:id" element={<ProductDetailsPage />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/account" element={<Account />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/services" element={<Services />} />
                    <Route path="/shipping-policy" element={<PolicyPage slug="shipping" />} />
                    <Route path="/return-policy" element={<PolicyPage slug="returns" />} />
                    <Route path="/privacy-policy" element={<PolicyPage slug="privacy" />} />
                    <Route path="/terms-conditions" element={<PolicyPage slug="terms" />} />
                    <Route path="/policy/:slug" element={<PolicyPage />} />
                    <Route path="/wishlist" element={<WishlistPage />} />
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route path="/admin" element={<AdminLayout />}>
                      <Route index element={<AdminDashboard />} />
                      <Route path="categories" element={<AdminPermission permission="categories"><AdminCategories /></AdminPermission>} />
                      <Route path="products" element={<AdminPermission permission="products"><AdminProducts /></AdminPermission>} />
                      <Route path="banners" element={<AdminPermission permission="banners"><AdminBanners /></AdminPermission>} />
                      <Route path="promo-cards" element={<AdminPermission permission="promo-cards"><AdminPromoCards /></AdminPermission>} />
                      <Route path="videos" element={<AdminPermission permission="videos"><AdminVideos /></AdminPermission>} />
                      <Route path="orders" element={<AdminPermission permission="orders"><AdminOrders /></AdminPermission>} />
                      <Route path="customers" element={<AdminPermission permission="customers"><AdminCustomers /></AdminPermission>} />
                      <Route path="enquiries" element={<AdminPermission permission="enquiries"><AdminEnquiries /></AdminPermission>} />
                      <Route path="offers" element={<AdminPermission permission="offers"><AdminOffers /></AdminPermission>} />
                      <Route path="policies" element={<AdminPermission permission="policies"><AdminPolicies /></AdminPermission>} />
                      <Route path="settings" element={<AdminPermission permission="settings"><AdminSettings /></AdminPermission>} />
                      <Route path="change-password" element={<AdminChangePassword />} />
                    </Route>
                    <Route path="*" element={<Home />} />
                  </Routes>
                  </Suspense>
        </main>
        <Footer />
        <WhatsAppButton />
      </div>
    </>
  );
}
