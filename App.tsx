
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate, useSearchParams, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { getCurrentUser, getProfile, isAuthenticated as checkAuth } from './services/auth';
import LoadingScreen from './components/LoadingScreen';


// Customer Pages
import CustomerHomePage from './pages/customer/HomePage';
import CustomerProductList from './pages/customer/ProductListPage';
import CustomerProductDetail from './pages/customer/ProductDetailPage';
import CustomerCheckout from './pages/customer/CheckoutPage';
import PaymentSuccessPage from './pages/customer/PaymentSuccessPage';
import CustomerProfile from './pages/customer/ProfilePage';
import CartPage from './pages/customer/CartPage';
import MyOrdersPage from './pages/customer/MyOrdersPage';
import OrderDetailsPage from './pages/customer/OrderDetailsPage';
import VendorProfilePage from './pages/vendor/VendorProfilePage';
import TransactionHistoryPage from './pages/customer/TransactionHistoryPage';
import AboutUsPage from './pages/customer/AboutUsPage';
import CulturalGuidelinePage from './pages/customer/CulturalGuidelinePage';
import CulturalGuidelineDetailPage from './pages/customer/CulturalGuidelineDetailPage';
import ChatPage from './pages/customer/ChatPage';

// Vendor Pages
import VendorDashboard from './pages/vendor/VendorDashboard';
import VendorShop from './pages/vendor/VendorShop';
import ProductManagement from './pages/vendor/ProductManagement';
import OrderManagement from './pages/vendor/OrderManagement';
import VendorAnalytics from './pages/vendor/VendorAnalytics';
import VendorSettings from './pages/vendor/VendorSettings';
import ShippingConfigPage from './pages/vendor/ShippingConfigPage';
import VendorTransactionPage from './pages/vendor/VendorTransactionPage';
import VendorWithdrawPage from './pages/vendor/VendorWithdrawPage';
import DiscountPolicyManagement from './pages/vendor/DiscountPolicyManagement';
import VendorBannerManagement from './pages/vendor/VendorBannerManagement';
import AddOnManagement from './pages/vendor/AddOnManagement';
import VendorComparePage from './pages/vendor/VendorComparePage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';

// Staff Pages
import StaffDashboard from './pages/staff/StaffDashboard';
import CustomerManagement from './pages/staff/CustomerManagement';
import StaffProductManagement from './pages/staff/StaffProductManagement';
import SystemSettings from './pages/staff/SystemSettings';
import RefundManagement from './pages/staff/RefundManagement';
import VendorVerificationPage from './pages/staff/VendorVerification';
import TransactionManagement from './pages/staff/TransactionManagement';
import AuditLogPage from './pages/staff/AuditLogPage';
import BannerManagement from './pages/staff/BannerManagement';
import GuidelineManagement from './pages/staff/GuidelineManagement';
import { StatisticsPage } from './pages/staff';

// Assistant
import Assistant from './components/Assistant';

import { UserRole } from './types';
import AuthPage from './pages/auth/AuthPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

const PROFILE_SETUP_REQUIRED_KEY = 'modern-ritual-profile-setup-required';

// Route Wrapper Component
const AppContent: React.FC<{
  userRole: UserRole;
  isAuthenticated: boolean;
  onLogout: () => void;
  onRoleChange: (role: UserRole) => void;
}> = ({ userRole, isAuthenticated, onLogout, onRoleChange }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = getCurrentUser();
  const normalizedRoles = Array.from(
    new Set(
      [
        ...(Array.isArray(currentUser?.roles) ? currentUser.roles : []),
        currentUser?.role || '',
      ]
        .filter((role): role is string => typeof role === 'string' && role.trim().length > 0)
        .map((role) => role.toLowerCase())
    )
  );
  const hasVendorRole = userRole === 'vendor' || normalizedRoles.includes('vendor');
  const hasCustomerRole = userRole === 'customer' || normalizedRoles.includes('customer');
  const isProfileSetupRequired =
    isAuthenticated &&
    hasCustomerRole &&
    localStorage.getItem(PROFILE_SETUP_REQUIRED_KEY) === 'true';

  useEffect(() => {
    if (!isAuthenticated) return;
    if (location.pathname !== '/') return;

    if (userRole === 'staff') {
      navigate('/staff/dashboard', { replace: true });
      return;
    }

    if (userRole === 'admin') {
      navigate('/admin/dashboard', { replace: true });
      return;
    }

    if (userRole === 'vendor') {
      navigate('/vendor/dashboard', { replace: true });
    }
  }, [isAuthenticated, userRole, location.pathname, navigate]);

  const handleLogin = (role: UserRole, firstTimeLogin?: boolean) => {
    onRoleChange(role);

    if (role === 'customer') {
      localStorage.setItem(PROFILE_SETUP_REQUIRED_KEY, firstTimeLogin ? 'true' : 'false');
    } else {
      localStorage.setItem(PROFILE_SETUP_REQUIRED_KEY, 'false');
    }

    // If first-time login for customer, redirect to profile setup
    if (firstTimeLogin && role === 'customer') {
      navigate('/profile?firstTime=true');
      return;
    }

    // Normal login flow
    if (role === 'customer') {
      navigate('/');
    } else if (role === 'vendor') {
      navigate('/vendor/dashboard');
    } else if (role === 'staff') {
      navigate('/staff/dashboard');
    } else if (role === 'admin') {
      navigate('/admin/dashboard');
    }
  };

  const handleNavigate = (path: string) => {
    if (isProfileSetupRequired && path !== '/profile') {
      navigate('/profile?firstTime=true');
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    navigate(path);
  };

  // ProfilePageWrapper to detect firstTime query param
  const ProfilePageWrapper: React.FC = () => {
    const [searchParams] = useSearchParams();
    const isFirstTime = isProfileSetupRequired || searchParams.get('firstTime') === 'true';

    return (
      <Layout
        activeRoute="/profile"
        onNavigate={handleNavigate}
        userRole={userRole}
        onLogout={onLogout}
        hideHeader={isFirstTime}
      >
        <CustomerProfile onNavigate={handleNavigate} />
      </Layout>
    );
  };

  const StaffPageFrame: React.FC<{
    activeRoute: string;
    children: React.ReactNode;
  }> = ({ activeRoute, children }) => {
    const navItems = [
      { label: 'Tổng quan', icon: 'dashboard', path: '/staff/dashboard' },
      { label: 'Xác minh vendor', icon: 'verified_user', path: '/staff-vendors' },

      { label: 'Sản phẩm', icon: 'inventory_2', path: '/staff-product' },
      { label: 'Khiếu nại', icon: 'warning', path: '/staff-refunds' },
      // { label: 'Giao dịch', icon: 'payments', path: '/staff-transactions' },
      // { label: 'Thống kê', icon: 'analytics', path: '/staff-statistics' },
      { label: 'Banner', icon: 'ad', path: '/staff-banners' },
      { label: 'Cẩm nang', icon: 'book_4', path: '/staff-guidelines' },
      { label: 'Cấu hình hệ thống', icon: 'settings', path: '/staff-settings' },
    ];

    return (
      <div className="min-h-screen bg-gradient-to-br from-ritual-bg via-white to-gold/5 py-12 px-4 md:px-8">
        <div className="flex flex-col lg:flex-row gap-10 items-start">
          <aside className="w-full lg:w-80 flex-shrink-0 lg:sticky lg:top-[120px] z-30">
            <div className="bg-white rounded-[2.5rem] p-4 border border-gold/10 shadow-xl backdrop-blur-sm bg-white/90">
              <div className="px-6 py-8 mb-4 border-b border-gold/5">
                <h1 className="text-2xl font-display font-black text-primary tracking-tight">Bảng điều khiển nhân viên</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Quản lý vận hành</p>
              </div>
              <div className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => handleNavigate(item.path)}
                    className={`flex items-center w-full px-6 py-4 rounded-3xl font-bold text-sm uppercase transition-all tracking-wider ${activeRoute === item.path
                      ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
                      : 'text-slate-500 hover:bg-ritual-bg hover:text-primary'
                      }`}
                  >
                    <span className="material-symbols-outlined mr-4 text-xl">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="flex-1 w-full">
            {children}
          </div>
        </div>
      </div>
    );
  };

  const VendorPageFrame: React.FC<{
    activeRoute: string;
    children: React.ReactNode;
  }> = ({ activeRoute, children }) => {
    const navItems = [
      { label: 'Tổng quan', icon: 'dashboard', path: '/vendor/dashboard' },
      { label: 'Trang cửa hàng', icon: 'storefront', path: '/vendor/shop' },
      { label: 'Sản phẩm', icon: 'inventory_2', path: '/vendor/products' },
      { label: 'Đơn hàng', icon: 'receipt_long', path: '/vendor/orders' },
      // { label: 'Thống kê', icon: 'analytics', path: '/vendor/analytics' },
      { label: 'Giao hàng', icon: 'local_shipping', path: '/vendor/shipping' },
      { label: 'Khuyến mãi', icon: 'sell', path: '/vendor/discounts' },
      { label: 'Giao dịch', icon: 'payments', path: '/vendor/transactions' },
      { label: 'Biểu ngữ', icon: 'ad', path: '/vendor/banners' },
      { label: 'Tin nhắn', icon: 'chat', path: '/vendor/messages' },
      { label: 'Rút tiền', icon: 'account_balance_wallet', path: '/vendor/withdraw' },
      { label: 'Món Thêm', icon: 'extension', path: '/vendor/add-ons' },
      { label: 'Cài đặt', icon: 'settings', path: '/vendor/settings' },
    ];

    return (
      <div className="min-h-screen bg-gradient-to-br from-ritual-bg via-white to-gold/5 py-12 px-4 md:px-8">
        <div className="flex flex-col lg:flex-row gap-10 items-start">
          <aside className="w-full lg:w-80 flex-shrink-0 lg:sticky lg:top-[120px] z-30">
            <div className="bg-white rounded-[2.5rem] p-4 border border-gold/10 shadow-xl backdrop-blur-sm bg-white/90">
              <div className="px-6 py-8 mb-4 border-b border-gold/5">
                <h1 className="text-2xl font-display font-black text-primary tracking-tight">Bảng điều khiển vendor</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Quản lý gian hàng</p>
              </div>
              <div className="flex flex-col gap-1 max-h-[65vh] overflow-y-auto pr-1">
                {navItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => handleNavigate(item.path)}
                    className={`flex items-center w-full px-6 py-4 rounded-3xl font-bold text-sm uppercase transition-all tracking-wider ${activeRoute === item.path
                      ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
                      : 'text-slate-500 hover:bg-ritual-bg hover:text-primary'
                      }`}
                  >
                    <span className="material-symbols-outlined mr-4 text-xl">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="flex-1 w-full">
            {children}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Routes>
      {/* Auth Route - không có Layout */}
      <Route path="/auth" element={<AuthPage onNavigate={handleNavigate} onLogin={handleLogin} />} />
      <Route path="/confirm-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage onNavigate={handleNavigate} />} />
      <Route path="/reset-password" element={<ForgotPasswordPage onNavigate={handleNavigate} />} />

      {/* Customer Routes */}
      <Route path="/" element={isProfileSetupRequired ? <Navigate to="/profile?firstTime=true" replace /> : <Layout activeRoute="/" onNavigate={handleNavigate} userRole={userRole} onLogout={isAuthenticated ? onLogout : undefined}><CustomerHomePage onNavigate={handleNavigate} /></Layout>} />
      <Route path="/shop" element={isProfileSetupRequired ? <Navigate to="/profile?firstTime=true" replace /> : <Layout activeRoute="/shop" onNavigate={handleNavigate} userRole={userRole} onLogout={isAuthenticated ? onLogout : undefined}><CustomerProductList onNavigate={handleNavigate} /></Layout>} />
      <Route path="/product/:id" element={isProfileSetupRequired ? <Navigate to="/profile?firstTime=true" replace /> : <Layout activeRoute="/product/:id" onNavigate={handleNavigate} userRole={userRole} onLogout={isAuthenticated ? onLogout : undefined}><CustomerProductDetail onNavigate={handleNavigate} /></Layout>} />
      <Route path="/ritual/:id" element={isProfileSetupRequired ? <Navigate to="/profile?firstTime=true" replace /> : <Layout activeRoute="/ritual/:id" onNavigate={handleNavigate} userRole={userRole} onLogout={isAuthenticated ? onLogout : undefined}><CustomerProductDetail onNavigate={handleNavigate} /></Layout>} />
      <Route path="/package/:id" element={isProfileSetupRequired ? <Navigate to="/profile?firstTime=true" replace /> : <Layout activeRoute="/package/:id" onNavigate={handleNavigate} userRole={userRole} onLogout={isAuthenticated ? onLogout : undefined}><CustomerProductDetail onNavigate={handleNavigate} /></Layout>} />
      <Route path="/vendor/:id" element={isProfileSetupRequired ? <Navigate to="/profile?firstTime=true" replace /> : <VendorProfilePage onNavigate={handleNavigate} />} />
      <Route path="/cart" element={isProfileSetupRequired ? <Navigate to="/profile?firstTime=true" replace /> : <Layout activeRoute="/cart" onNavigate={handleNavigate} userRole={userRole} onLogout={isAuthenticated ? onLogout : undefined}><CartPage onNavigate={handleNavigate} /></Layout>} />
      <Route path="/checkout" element={isAuthenticated && hasCustomerRole ? (isProfileSetupRequired ? <Navigate to="/profile?firstTime=true" replace /> : <Layout activeRoute="/checkout" onNavigate={handleNavigate} userRole={userRole} onLogout={onLogout}><CustomerCheckout onNavigate={handleNavigate} /></Layout>) : <Navigate to="/auth" />} />
      <Route path="/payment-success" element={isAuthenticated && hasCustomerRole ? (isProfileSetupRequired ? <Navigate to="/profile?firstTime=true" replace /> : <PaymentSuccessPage onNavigate={handleNavigate} />) : <Navigate to="/auth" />} />
      <Route path="/profile" element={isAuthenticated && hasCustomerRole ? <ProfilePageWrapper /> : <Navigate to="/auth" />} />
      <Route path="/profile/orders" element={isAuthenticated && hasCustomerRole ? (isProfileSetupRequired ? <Navigate to="/profile?firstTime=true" replace /> : <Layout activeRoute="/profile/orders" onNavigate={handleNavigate} userRole={userRole} onLogout={onLogout}><MyOrdersPage /></Layout>) : <Navigate to="/auth" />} />
      <Route path="/profile/orders/:id" element={isAuthenticated && hasCustomerRole ? (isProfileSetupRequired ? <Navigate to="/profile?firstTime=true" replace /> : <Layout activeRoute="/profile/orders/:id" onNavigate={handleNavigate} userRole={userRole} onLogout={onLogout}><OrderDetailsPage /></Layout>) : <Navigate to="/auth" />} />
      <Route path="/wallet/transactions" element={isAuthenticated ? <Layout activeRoute="/wallet/transactions" onNavigate={handleNavigate} userRole={userRole} onLogout={onLogout}><TransactionHistoryPage onNavigate={handleNavigate} /></Layout> : <Navigate to="/auth" />} />
      <Route path="/about" element={<Layout activeRoute="/about" onNavigate={handleNavigate} userRole={userRole} onLogout={isAuthenticated ? onLogout : undefined}><AboutUsPage onNavigate={handleNavigate} /></Layout>} />
      <Route path="/cultural-guideline" element={<Layout activeRoute="/cultural-guideline" onNavigate={handleNavigate} userRole={userRole} onLogout={isAuthenticated ? onLogout : undefined}><CulturalGuidelinePage onNavigate={handleNavigate} /></Layout>} />
      <Route path="/cultural-guideline/:id" element={<Layout activeRoute="/cultural-guideline" onNavigate={handleNavigate} userRole={userRole} onLogout={isAuthenticated ? onLogout : undefined}><CulturalGuidelineDetailPage onNavigate={handleNavigate} /></Layout>} />
      <Route path="/messages" element={isAuthenticated ? <Layout activeRoute="/messages" onNavigate={handleNavigate} userRole={userRole} onLogout={onLogout}><ChatPage /></Layout> : <Navigate to="/auth" />} />

      {/* Vendor Routes */}
      <Route path="/vendor/dashboard" element={isAuthenticated && hasVendorRole ? <Layout activeRoute="/vendor/dashboard" onNavigate={handleNavigate} userRole={'vendor'} onLogout={onLogout}><VendorPageFrame activeRoute="/vendor/dashboard"><VendorDashboard onNavigate={handleNavigate} /></VendorPageFrame></Layout> : <Navigate to="/auth" />} />
      <Route path="/vendor/shop" element={isAuthenticated && hasVendorRole ? <Layout activeRoute="/vendor/shop" onNavigate={handleNavigate} userRole={'vendor'} onLogout={onLogout}><VendorPageFrame activeRoute="/vendor/shop"><VendorShop onNavigate={handleNavigate} /></VendorPageFrame></Layout> : <Navigate to="/auth" />} />
      <Route path="/vendor/products" element={isAuthenticated && hasVendorRole ? <Layout activeRoute="/vendor/products" onNavigate={handleNavigate} userRole={'vendor'} onLogout={onLogout}><VendorPageFrame activeRoute="/vendor/products"><ProductManagement onNavigate={handleNavigate} /></VendorPageFrame></Layout> : <Navigate to="/auth" />} />
      <Route path="/vendor/orders" element={isAuthenticated && hasVendorRole ? <Layout activeRoute="/vendor/orders" onNavigate={handleNavigate} userRole={'vendor'} onLogout={onLogout}><VendorPageFrame activeRoute="/vendor/orders"><OrderManagement onNavigate={handleNavigate} /></VendorPageFrame></Layout> : <Navigate to="/auth" />} />
      <Route path="/vendor/analytics" element={isAuthenticated && hasVendorRole ? <Layout activeRoute="/vendor/analytics" onNavigate={handleNavigate} userRole={'vendor'} onLogout={onLogout}><VendorPageFrame activeRoute="/vendor/analytics"><VendorAnalytics onNavigate={handleNavigate} /></VendorPageFrame></Layout> : <Navigate to="/auth" />} />
      <Route path="/vendor/settings" element={isAuthenticated && hasVendorRole ? <Layout activeRoute="/vendor/settings" onNavigate={handleNavigate} userRole={'vendor'} onLogout={onLogout}><VendorPageFrame activeRoute="/vendor/settings"><VendorSettings onNavigate={handleNavigate} /></VendorPageFrame></Layout> : <Navigate to="/auth" />} />
      <Route path="/vendor/shipping" element={isAuthenticated && hasVendorRole ? <Layout activeRoute="/vendor/shipping" onNavigate={handleNavigate} userRole={'vendor'} onLogout={onLogout}><VendorPageFrame activeRoute="/vendor/shipping"><ShippingConfigPage onNavigate={handleNavigate} /></VendorPageFrame></Layout> : <Navigate to="/auth" />} />
      <Route path="/vendor/discounts" element={isAuthenticated && hasVendorRole ? <Layout activeRoute="/vendor/discounts" onNavigate={handleNavigate} userRole={'vendor'} onLogout={onLogout}><VendorPageFrame activeRoute="/vendor/discounts"><DiscountPolicyManagement onNavigate={handleNavigate} /></VendorPageFrame></Layout> : <Navigate to="/auth" />} />
      <Route path="/vendor/transactions" element={isAuthenticated && hasVendorRole ? <Layout activeRoute="/vendor/transactions" onNavigate={handleNavigate} userRole={'vendor'} onLogout={onLogout}><VendorPageFrame activeRoute="/vendor/transactions"><VendorTransactionPage onNavigate={handleNavigate} /></VendorPageFrame></Layout> : <Navigate to="/auth" />} />
      <Route path="/vendor/banners" element={isAuthenticated && hasVendorRole ? <Layout activeRoute="/vendor/banners" onNavigate={handleNavigate} userRole={'vendor'} onLogout={onLogout}><VendorPageFrame activeRoute="/vendor/banners"><VendorBannerManagement /></VendorPageFrame></Layout> : <Navigate to="/auth" />} />
      <Route path="/vendor/messages" element={isAuthenticated && hasVendorRole ? <Layout activeRoute="/vendor/messages" onNavigate={handleNavigate} userRole={'vendor'} onLogout={onLogout}><VendorPageFrame activeRoute="/vendor/messages"><ChatPage /></VendorPageFrame></Layout> : <Navigate to="/auth" />} />
      <Route path="/vendor/withdraw" element={isAuthenticated && hasVendorRole ? <Layout activeRoute="/vendor/withdraw" onNavigate={handleNavigate} userRole={'vendor'} onLogout={onLogout}><VendorPageFrame activeRoute="/vendor/withdraw"><VendorWithdrawPage onNavigate={handleNavigate} /></VendorPageFrame></Layout> : <Navigate to="/auth" />} />
      <Route path="/vendor/add-ons" element={isAuthenticated && hasVendorRole ? <Layout activeRoute="/vendor/add-ons" onNavigate={handleNavigate} userRole={'vendor'} onLogout={onLogout}><VendorPageFrame activeRoute="/vendor/add-ons"><AddOnManagement onNavigate={handleNavigate} /></VendorPageFrame></Layout> : <Navigate to="/auth" />} />

      {/* Staff Routes */}
      <Route path="/staff/dashboard" element={isAuthenticated && userRole === 'staff' ? <Layout activeRoute="/staff/dashboard" onNavigate={handleNavigate} userRole={userRole} onLogout={onLogout}><StaffDashboard onNavigate={handleNavigate} onLogout={onLogout} /></Layout> : <Navigate to="/auth" />} />
      <Route path="/staff-customers" element={isAuthenticated && userRole === 'staff' ? <Layout activeRoute="/staff-customers" onNavigate={handleNavigate} userRole={userRole} onLogout={onLogout}><StaffPageFrame activeRoute="/staff-customers"><CustomerManagement onNavigate={handleNavigate} onLogout={onLogout} /></StaffPageFrame></Layout> : <Navigate to="/auth" />} />
      <Route path="/staff-product" element={isAuthenticated && userRole === 'staff' ? <Layout activeRoute="/staff-product" onNavigate={handleNavigate} userRole={userRole} onLogout={onLogout}><StaffPageFrame activeRoute="/staff-product"><StaffProductManagement onNavigate={handleNavigate} onLogout={onLogout} /></StaffPageFrame></Layout> : <Navigate to="/auth" />} />
      <Route path="/staff-settings" element={isAuthenticated && userRole === 'staff' ? <Layout activeRoute="/staff-settings" onNavigate={handleNavigate} userRole={userRole} onLogout={onLogout}><StaffPageFrame activeRoute="/staff-settings"><SystemSettings onNavigate={handleNavigate} onLogout={onLogout} /></StaffPageFrame></Layout> : <Navigate to="/auth" />} />
      <Route path="/staff-refunds" element={isAuthenticated && userRole === 'staff' ? <Layout activeRoute="/staff-refunds" onNavigate={handleNavigate} userRole={userRole} onLogout={onLogout}><StaffPageFrame activeRoute="/staff-refunds"><RefundManagement onNavigate={handleNavigate} /></StaffPageFrame></Layout> : <Navigate to="/auth" />} />
      <Route path="/staff-vendors" element={isAuthenticated && userRole === 'staff' ? <Layout activeRoute="/staff-vendors" onNavigate={handleNavigate} userRole={userRole} onLogout={onLogout}><StaffPageFrame activeRoute="/staff-vendors"><VendorVerificationPage onNavigate={handleNavigate} /></StaffPageFrame></Layout> : <Navigate to="/auth" />} />
      <Route path="/staff-transactions" element={isAuthenticated && userRole === 'staff' ? <Layout activeRoute="/staff-transactions" onNavigate={handleNavigate} userRole={userRole} onLogout={onLogout}><StaffPageFrame activeRoute="/staff-transactions"><TransactionManagement onNavigate={handleNavigate} userRole="staff" /></StaffPageFrame></Layout> : <Navigate to="/auth" />} />
      <Route path="/staff-banners" element={isAuthenticated && userRole === 'staff' ? <Layout activeRoute="/staff-banners" onNavigate={handleNavigate} userRole={userRole} onLogout={onLogout}><StaffPageFrame activeRoute="/staff-banners"><BannerManagement /></StaffPageFrame></Layout> : <Navigate to="/auth" />} />
      <Route path="/staff-guidelines" element={isAuthenticated && userRole === 'staff' ? <Layout activeRoute="/staff-guidelines" onNavigate={handleNavigate} userRole={userRole} onLogout={onLogout}><StaffPageFrame activeRoute="/staff-guidelines"><GuidelineManagement /></StaffPageFrame></Layout> : <Navigate to="/auth" />} />
      <Route path="/staff-statistics" element={isAuthenticated && userRole === 'staff' ? <Layout activeRoute="/staff-statistics" onNavigate={handleNavigate} userRole={userRole} onLogout={onLogout}><StaffPageFrame activeRoute="/staff-statistics"><StatisticsPage /></StaffPageFrame></Layout> : <Navigate to="/auth" />} />

      {/* Admin Routes */}
      <Route path="/admin/dashboard" element={isAuthenticated && userRole === 'admin' ? <Layout activeRoute="/admin/dashboard" onNavigate={handleNavigate} userRole={userRole} onLogout={onLogout}><AdminDashboard onNavigate={handleNavigate} /></Layout> : <Navigate to="/auth" />} />
      <Route path="/admin/transactions" element={isAuthenticated && userRole === 'admin' ? <Layout activeRoute="/admin/transactions" onNavigate={handleNavigate} userRole={userRole} onLogout={onLogout}><TransactionManagement onNavigate={handleNavigate} userRole="admin" /></Layout> : <Navigate to="/auth" />} />
      <Route path="/admin/audit-logs" element={isAuthenticated && userRole === 'admin' ? <Layout activeRoute="/admin/audit-logs" onNavigate={handleNavigate} userRole={userRole} onLogout={onLogout}><AuditLogPage onNavigate={handleNavigate} userRole="admin" /></Layout> : <Navigate to="/auth" />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

const App: React.FC = () => {
  const [userRole, setUserRole] = useState<UserRole>('guest');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Restore authentication state from localStorage on mount
  useEffect(() => {
    console.log('🔄 Checking authentication state on app mount...');

    const restoreAuth = async () => {
      // Check if user is authenticated
      const authenticated = checkAuth();

      if (authenticated) {
        // Get user data from localStorage
        const currentUser = getCurrentUser();

        if (currentUser && currentUser.role) {
          console.log('✅ User found in localStorage:', currentUser);
          setUserRole(currentUser.role as UserRole);
          setIsAuthenticated(true);

          if (currentUser.role === 'customer') {
            try {
              const profile = await getProfile();
              const hasFullName = !!profile.fullName?.trim();
              const hasPhoneNumber = !!profile.phoneNumber?.trim();
              const hasDateOfBirth = !!profile.dateOfBirth;

              let hasAddress = !!profile.addressText?.trim();
              if (!hasAddress) {
                const token = localStorage.getItem('smart-child-token');
                if (token) {
                  const addressResponse = await fetch('/api/addresses', {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                      Accept: 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                  });

                  if (addressResponse.ok) {
                    const addressData = await addressResponse.json().catch(() => null);
                    const addressList = Array.isArray(addressData)
                      ? addressData
                      : (addressData?.isSuccess && Array.isArray(addressData.result) ? addressData.result : []);
                    hasAddress = addressList.some((addr: any) => !!(addr?.addressText || addr?.fullAddress || '').trim());
                  }
                }
              }

              const isIncomplete = !(hasFullName && hasPhoneNumber && hasDateOfBirth && hasAddress);
              localStorage.setItem(PROFILE_SETUP_REQUIRED_KEY, isIncomplete ? 'true' : 'false');
            } catch (profileError) {
              console.warn('⚠️ Failed to verify profile completeness on restore:', profileError);
            }
          } else {
            localStorage.setItem(PROFILE_SETUP_REQUIRED_KEY, 'false');
          }

          console.log('✅ Authentication state restored');
        } else {
          console.log('⚠️ Token found but no user data');
        }
      } else {
        console.log('ℹ️ No authentication token found');
        localStorage.setItem(PROFILE_SETUP_REQUIRED_KEY, 'false');
      }

      // Mark auth check as complete
      setIsAuthChecking(false);
    };

    void restoreAuth();
  }, []);

  const handleLogout = async () => {
    console.log('🔄 App logout initiated...');

    // Import and call complete logout with API
    const { logoutComplete } = await import('./services/auth');
    await logoutComplete();

    // Update React state
    setUserRole('guest');
    setIsAuthenticated(false);
  };

  const handleRoleChange = (role: UserRole) => {
    setUserRole(role);
    setIsAuthenticated(true);
  };

  // Show loading screen while checking authentication
  if (isAuthChecking) {
    return <LoadingScreen message="Đang kiểm tra đăng nhập..." subMessage="Bảo mật là ưu tiên hàng đầu" />;
  }

  return (
    <BrowserRouter>
      <AppContent
        userRole={userRole}
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
        onRoleChange={handleRoleChange}
      />
      <Assistant />
    </BrowserRouter>
  );
};

export default App;
