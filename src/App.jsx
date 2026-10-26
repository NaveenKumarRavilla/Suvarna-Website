import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AdminProvider } from './context/AdminContext';
import { AuthProvider } from './context/AuthContext';
import { WishlistProvider } from './context/WishlistContext';
import Header from './components/layout/Header';
import CategoryNav from './components/layout/CategoryNav';
import Footer from './components/layout/Footer';
import WhatsAppButton from './components/layout/WhatsAppButton';
import AdminLayout, { AdminPermission } from './components/admin/AdminLayout';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetailsPage from './pages/ProductDetails';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import WishlistPage from './pages/Wishlist';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Register from './pages/Register';
import Account from './pages/Account';
import Contact from './pages/Contact';
import PolicyPage from './pages/PolicyPage';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminCategories from './pages/admin/AdminCategories';
import AdminProducts from './pages/admin/AdminProducts';
import AdminBanners from './pages/admin/AdminBanners';
import AdminPromoCards from './pages/admin/AdminPromoCards';
import AdminVideos from './pages/admin/AdminVideos';
import AdminOrders from './pages/admin/AdminOrders';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminEnquiries from './pages/admin/AdminEnquiries';
import AdminOffers from './pages/admin/AdminOffers';
import AdminSettings from './pages/admin/AdminSettings';
import AdminPolicies from './pages/admin/AdminPolicies';

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
              <ScrollToTop />
              <div className="flex min-h-screen flex-col">
                <Header />
                <CategoryNav />
                <main className="flex-1">
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
                    </Route>
                    <Route path="*" element={<Home />} />
                  </Routes>
                </main>
                <Footer />
                <WhatsAppButton />
              </div>
            </CartProvider>
          </WishlistProvider>
        </AuthProvider>
      </AdminProvider>
    </BrowserRouter>
  );
}
