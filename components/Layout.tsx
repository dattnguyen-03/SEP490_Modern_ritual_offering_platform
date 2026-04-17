import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Swal from 'sweetalert2';
import { getCurrentUser } from '../services/auth';
import { cartService } from '../services/cartService';
import { fetchNotifications, fetchUnreadNotificationCount, NotificationItem, markAllNotificationsAsReadApi, markNotificationAsRead } from '../services/notificationService';
import { cancelPayosTopup, createTopupLink, getMyWallet, WalletInfo, WalletType } from '../services/walletService';
import { packageService } from '../services/packageService';
import { CeremonyCategory } from '../types';
import CartDropdown from './CartDropdown';
import { guidelineService } from '../services/guidelineService';
import toast from '../services/toast';
import headerLogo from '../assets/logo1.png';
import darkLogo from '../assets/image.png';
import { CulturalGuideline } from '../services/guidelineService';
import { useTheme } from '../hooks/useTheme';

const PENDING_CHECKOUT_KEY = 'pendingCheckoutRequest';
const TOPUP_SUCCESS_TOAST_KEY = 'checkoutTopupSuccessToast';
const TOPUP_CANCEL_TOAST_KEY = 'checkoutTopupCancelToast';

interface NavItem {
  path?: string;
  label: string;
  submenu?: { path: string; label: string }[];
}

interface LayoutProps {
  children: React.ReactNode;
  activeRoute: string;
  onNavigate: (path: string) => void;
  userRole?: string;
  onLogout?: () => void;
  hideHeader?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, activeRoute, onNavigate, onLogout, userRole, hideHeader = false }) => {
  const [theme, toggleTheme] = useTheme();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState<number>(0);
  const [isCartDropdownOpen, setIsCartDropdownOpen] = useState<boolean>(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState<boolean>(false);
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState<boolean>(false);
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationLoading, setNotificationLoading] = useState<boolean>(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [walletLoading, setWalletLoading] = useState<boolean>(false);
  const [topupLoading, setTopupLoading] = useState<boolean>(false);
  const [userName, setUserName] = useState<string>('');
  const [categories, setCategories] = useState<CeremonyCategory[]>([]);
  const [guidelineCategories, setGuidelineCategories] = useState<{ id: number; name: string }[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await packageService.getCeremonyCategories();
        setCategories(data.filter(c => c.isActive));
      } catch (error) {
        console.error('❌ Failed to fetch categories for menu:', error);
      }
    };
    fetchCategories();

    const fetchGuidelineCategories = async () => {
      try {
        const data = await guidelineService.getGuidelines();
        const activeGuidelines = data.filter(g => g.isActive);
        const uniqueCats = Array.from(
          new Map(activeGuidelines.map((g) => [g.categoryId, g.categoryName])).entries()
        ).map(([id, name]) => ({ id, name }));
        setGuidelineCategories(uniqueCats);
      } catch (error) {
        console.error('❌ Failed to fetch guideline categories for menu:', error);
      }
    };
    fetchGuidelineCategories();
  }, []);

  const cartDropdownTimeout = useRef<NodeJS.Timeout | null>(null);
  const accountDropdownTimeout = useRef<NodeJS.Timeout | null>(null);
  const walletDropdownTimeout = useRef<NodeJS.Timeout | null>(null);
  const notificationDropdownTimeout = useRef<NodeJS.Timeout | null>(null);

  const notificationRef = useRef<HTMLDivElement>(null);
  const walletRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const cartRef = useRef<HTMLDivElement>(null);
  const isTopupReturnHandled = useRef(false);

  const isVendorNotification = (item: NotificationItem): boolean => {
    const t = (item.title || '').toLowerCase();
    const m = (item.message || '').toLowerCase();
    const type = String(item.type || '').toLowerCase();

    if (type === 'orderplaced') return true;
    if (
      t.includes('người mua') || m.includes('người mua') ||
      t.includes('có đơn hàng mới') || m.includes('có đơn hàng mới') ||
      t.includes('vừa đặt') || m.includes('vừa đặt') ||
      t.includes('doanh thu') || m.includes('doanh thu') ||
      t.includes('rút tiền') || m.includes('rút tiền') ||
      t.includes('quyết toán') || m.includes('quyết toán') ||
      t.includes('đánh giá') || m.includes('đánh giá') ||
      (t.includes('sản phẩm') && (t.includes('duyệt') || t.includes('từ chối') || t.includes('mới'))) ||
      (m.includes('sản phẩm') && (m.includes('duyệt') || m.includes('từ chối') || m.includes('mới'))) ||
      (item.redirectUrl || '').includes('/vendor/')
    ) {
      return true;
    }

    return false;
  };

  const isVendorAreaCurrent = activeRoute.startsWith('/vendor/');
  const currentRoles = getCurrentUser()?.roles;
  const hasVendorRoleNow = userRole === 'vendor' || (Array.isArray(currentRoles) && currentRoles.includes('vendor'));

  const filteredNotifications = React.useMemo(() => {
    if (hasVendorRoleNow) {
      return notifications.filter(item => isVendorAreaCurrent ? isVendorNotification(item) : !isVendorNotification(item));
    }
    return notifications;
  }, [notifications, isVendorAreaCurrent, hasVendorRoleNow]);

  const displayUnreadCount = filteredNotifications.filter(n => !n.isRead).length;

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((item) => {
      if (filteredNotifications.some(fn => fn.notificationId === item.notificationId)) {
        return { ...item, isRead: true };
      }
      return item;
    }));
    setUnreadNotificationCount(prev => Math.max(0, prev - displayUnreadCount));
  };

  const loadNotifications = async () => {
    try {
      setNotificationLoading(true);
      const data = await fetchNotifications(1, 20);
      setNotifications(data.items);
      setUnreadNotificationCount(data.items.filter((item) => !item.isRead).length);
    } catch (error) {
      console.error('❌ Failed to fetch notifications:', error);
    } finally {
      setNotificationLoading(false);
    }
  };

  const resolveNotificationRedirectPath = (item: NotificationItem): string => {
    const rawUrl = item.redirectUrl;
    const rawTarget = item.target;
    const title = (item.title || '').toLowerCase();
    const message = (item.message || '').toLowerCase();

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

    const hasVendorRole = normalizedRoles.includes('vendor');
    const hasCustomerRole = normalizedRoles.includes('customer');

    const extractOrderId = (text: string): string | null => {
      const raw = String(text || '');
      // Common formats:
      // - "#6f06d1dc"
      // - "Đơn hàng 6f06d1dc" / "Đơn hàng #6f06d1dc"
      // - UUIDs: "d3610b22-e872-485b-c46f-08de9179d13a"
      const patterns: RegExp[] = [
        /#\s*([0-9a-f-]{6,64})/i,
        /đơn\s*hàng\s*#?\s*([0-9a-f-]{6,64})/i,
        /order\s*#?\s*([0-9a-f-]{6,64})/i,
      ];

      for (const re of patterns) {
        const m = raw.match(re);
        if (m?.[1]) return m[1];
      }

      return null;
    };

    const extractPackageId = (text: string): string | null => {
      const raw = String(text || '');
      const patterns: RegExp[] = [
        /package(?:id)?\s*[:=#]?\s*(\d{1,12})/i,
        /gói\s*#?\s*(\d{1,12})/i,
        /sản\s*phẩm\s*#?\s*(\d{1,12})/i,
        /\/packages\/(\d{1,12})(?:\b|\/|\?|#)?/i,
      ];

      for (const re of patterns) {
        const m = raw.match(re);
        if (m?.[1]) return m[1];
      }

      return null;
    };

    const extractPackageName = (text: string): string | null => {
      const raw = String(text || '').trim();
      if (!raw) return null;

      const quoteMatches = [
        raw.match(/["“”']([^"“”']{2,120})["“”']/),
      ];

      for (const match of quoteMatches) {
        const candidate = String(match?.[1] || '').trim();
        if (candidate) return candidate;
      }

      const fallback = raw.match(/sản\s*phẩm\s*[:\-]?\s*([^\.\n]{2,120})/i)?.[1];
      const cleaned = String(fallback || '').trim();
      return cleaned || null;
    };

    const normalizedUserRole = (userRole || '').trim().toLowerCase();
    const isVendorArea = activeRoute.startsWith('/vendor/') || normalizedUserRole === 'vendor';
    const isVendorContext = isVendorArea || hasVendorRole;
    const isOrderNotification = title.includes('đơn hàng') || message.includes('đơn hàng') || String(item.type || '').toLowerCase().includes('order');
    // Use the actual notification heuristic to decide its scope
    const isStaffContext = activeRoute.startsWith('/staff/') || normalizedUserRole === 'staff' || normalizedRoles.includes('staff');
    const isAdminContext = activeRoute.startsWith('/admin/') || normalizedUserRole === 'admin' || normalizedRoles.includes('admin');
    const isRefundNotification =
      title.includes('hoàn tiền') ||
      message.includes('hoàn tiền') ||
      title.includes('khiếu nại') ||
      message.includes('khiếu nại') ||
      title.includes('review') ||
      message.includes('review') ||
      String(item.type || '').toLowerCase().includes('refund');
    const isStaffReviewedRefundNotification =
      (title.includes('staff review') || message.includes('staff review')) &&
      (title.includes('khiếu nại') || message.includes('khiếu nại') || title.includes('hoàn tiền') || message.includes('hoàn tiền'));
    const isWithdrawalNotification =
      title.includes('rút tiền') ||
      message.includes('rút tiền') ||
      title.includes('withdraw') ||
      message.includes('withdraw') ||
      String(item.type || '').toLowerCase().includes('withdraw');

    if (isVendorContext && isOrderNotification) {
      const directOrderId = extractOrderId(`${rawUrl || ''} ${rawTarget || ''} ${item.title || ''} ${item.message || ''}`);
      if (directOrderId) {
        return `/vendor/orders?tab=orders&orderId=${encodeURIComponent(directOrderId)}`;
      }
      return '/vendor/orders?tab=orders';
    }

    if (isVendorContext && (
      title.includes('rút tiền') ||
      message.includes('rút tiền') ||
      title.includes('yêu cầu rút') ||
      message.includes('yêu cầu rút')
    )) {
      return '/vendor/withdraw';
    }

    if (isRefundNotification) {
      if (isAdminContext) return '/admin/dashboard?tab=disputes';
      if (isStaffContext) return '/staff-refunds';
      if (isVendorContext) {
        if (title.includes('review') || message.includes('review') || title.includes('đánh giá') || message.includes('đánh giá')) {
          return '/vendor/orders?tab=reviews';
        }
        return '/vendor/orders?tab=refunds';
      }
    }

    if (isStaffReviewedRefundNotification) {
      if (isAdminContext) return '/admin/dashboard?tab=disputes';
      if (isStaffContext) return '/staff-refunds';
    }

    if (
      title.includes('khiếu nại đã được staff review') ||
      message.includes('khiếu nại đã được staff review') ||
      title.includes('yêu cầu hoàn tiền đã được staff review') ||
      message.includes('yêu cầu hoàn tiền đã được staff review')
    ) {
      if (isAdminContext) return '/admin/dashboard?tab=disputes';
      if (isStaffContext) return '/staff-refunds';
    }

    if (isWithdrawalNotification) {
      if (isAdminContext) return '/admin/dashboard?tab=withdrawals';
      if (isStaffContext) return '/staff-transactions';
    }

    if (title.includes('quyết toán') || title.includes('ví') || message.includes('quyết toán')) {
      return '/wallet/transactions';
    }

    // Staff product/AI-screening notifications: open exact product if possible.
    if (
      isStaffContext && (
        title.includes('sản phẩm') ||
        message.includes('sản phẩm') ||
        title.includes('ai screening') ||
        message.includes('ai screening') ||
        title.includes('vendor chỉnh sửa') ||
        message.includes('vendor chỉnh sửa')
      )
    ) {
      const packageId = extractPackageId(`${rawUrl || ''} ${rawTarget || ''} ${item.title || ''} ${item.message || ''}`);
      const packageName = extractPackageName(`${item.title || ''}. ${item.message || ''}`);

      const isVendorActionRequiredNotice =
        title.includes('vendor chỉnh sửa') ||
        message.includes('vendor chỉnh sửa') ||
        title.includes('vendoractionrequired') ||
        message.includes('vendoractionrequired');
      const isApprovedNotice =
        title.includes('được duyệt') ||
        message.includes('được duyệt') ||
        title.includes('approved') ||
        message.includes('approved');

      const params = new URLSearchParams();
      if (packageId) params.set('productId', packageId);
      if (packageName) params.set('productName', packageName);
      if (isVendorActionRequiredNotice) params.set('status', 'VendorActionRequired');
      if (isApprovedNotice) params.set('status', 'Approved');

      const query = params.toString();
      return query ? `/staff-product?${query}` : '/staff-product';
    }

    if (isStaffContext && (title.includes('nhà cung cấp') || message.includes('nhà cung cấp') || title.includes('hồ sơ') || message.includes('hồ sơ'))) {
      return '/staff-vendors';
    }

    // Vendor/product notifications: open exact product if possible.
    if (isVendorContext && (title.includes('sản phẩm') || message.includes('sản phẩm'))) {
      const packageId = extractPackageId(`${rawUrl || ''} ${rawTarget || ''} ${item.title || ''} ${item.message || ''}`);
      const packageName = extractPackageName(`${item.title || ''}. ${item.message || ''}`);
      const isNeedEditNotice =
        title.includes('cần chỉnh sửa') ||
        message.includes('cần chỉnh sửa') ||
        title.includes('vendoractionrequired') ||
        message.includes('vendoractionrequired') ||
        title.includes('từ chối') ||
        message.includes('từ chối');
      const isApprovedNotice =
        title.includes('được duyệt') ||
        message.includes('được duyệt') ||
        title.includes('approved') ||
        message.includes('approved');

      const params = new URLSearchParams();
      if (packageId) params.set('productId', packageId);
      if (packageName) params.set('productName', packageName);
      // Keep status empty for "need edit" notifications because backend may use VendorActionRequired.
      if (isNeedEditNotice) params.delete('status');
      if (isApprovedNotice) params.set('status', 'Approved');

      const query = params.toString();
      return query ? `/vendor/products?${query}` : '/vendor/products';
    }

    const tryOrderRouteFromText = (text: string): string => {
      const orderId = extractOrderId(text);
      if (!orderId) return '';

      if (isVendorContext) return `/vendor/orders?tab=orders&orderId=${encodeURIComponent(orderId)}`;
      if (isStaffContext) return '/staff/dashboard';
      if (isAdminContext) return '/admin/dashboard';
      return `/profile/orders/${encodeURIComponent(orderId)}`;
    };

    // Fallback: if backend didn't send redirectUrl, try deriving from target/message/title
    if (!rawUrl) {
      // Prefer explicit target (if backend sets it)
      if (typeof rawTarget === 'string' && rawTarget.trim()) {
        const fromTarget = tryOrderRouteFromText(rawTarget);
        if (fromTarget) return fromTarget;
      }

      const fromMessage = tryOrderRouteFromText(item.message || '');
      if (fromMessage) return fromMessage;

      const fromTitle = tryOrderRouteFromText(item.title || '');
      if (fromTitle) return fromTitle;

      // If it's an order notification but we can't parse the id, still take vendor/customer to the proper orders page.
      if (isOrderNotification && isVendorContext) return '/vendor/orders?tab=orders';
      if (isOrderNotification && !isVendorContext) return '/profile/orders';

      return '';
    }

    const trimmed = rawUrl.trim();
    if (!trimmed) return '';

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    // Backend sometimes sends '/orders' (no id). Our app routes are role-scoped.
    if (/^\/orders\/?(\?.*)?$/i.test(trimmed)) {
      if (isVendorContext) return '/vendor/orders?tab=orders';
      if (isStaffContext) return '/staff/dashboard';
      if (isAdminContext) return '/admin/dashboard';
      return '/profile/orders';
    }

    const orderMatch = trimmed.match(/^\/orders\/([^/?#]+)/i);
    if (orderMatch) {
      const orderId = orderMatch[1];
      if (isVendorContext) return `/vendor/orders?tab=orders&orderId=${encodeURIComponent(orderId)}`;
      return `/profile/orders/${encodeURIComponent(orderId)}`;
    }

    if (trimmed === '/vendor/reviews') {
      return '/vendor/orders?tab=reviews';
    }

    return trimmed;
  };

  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const count = await fetchUnreadNotificationCount();
        setUnreadNotificationCount(count);
      } catch (error) {
        console.error('❌ Failed to fetch unread notification count:', error);
      }
    };

    if (userName) {
      loadUnreadCount();
    }
  }, [userName]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (isNotificationDropdownOpen && notificationRef.current && !notificationRef.current.contains(target)) {
        setIsNotificationDropdownOpen(false);
      }
      if (isWalletDropdownOpen && walletRef.current && !walletRef.current.contains(target)) {
        setIsWalletDropdownOpen(false);
      }
      if (isAccountDropdownOpen && accountRef.current && !accountRef.current.contains(target)) {
        setIsAccountDropdownOpen(false);
      }
      if (isCartDropdownOpen && cartRef.current && !cartRef.current.contains(target)) {
        setIsCartDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotificationDropdownOpen, isWalletDropdownOpen, isAccountDropdownOpen, isCartDropdownOpen]);

  // Fetch user info
  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setUserName(user.name || user.email?.split('@')[0] || 'Người dùng');
    }
  }, [activeRoute]);

  // Fetch cart count
  useEffect(() => {
    const fetchCartCount = async () => {
      const user = getCurrentUser();
      if (!user) return;

      try {
        const cart = await cartService.getCart();
        if (cart && cart.cartItems) {
          const totalItems = cart.cartItems.reduce((sum, item) => sum + item.quantity, 0);
          setCartCount(totalItems);
        } else {
          setCartCount(0);
        }
      } catch (error) {
        console.error('❌ Failed to fetch cart count:', error);
      }
    };

    fetchCartCount();

    // Listen for cart update events
    const handleCartUpdate = () => {
      console.log('🔄 Cart updated, refreshing count...');
      fetchCartCount();
    };

    window.addEventListener('cartUpdated', handleCartUpdate);

    // Refresh cart count every 30 seconds
    const interval = setInterval(fetchCartCount, 30000);

    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate);
      clearInterval(interval);
    };
  }, [activeRoute]);

  // Detect PayOS return status
  useLayoutEffect(() => {
    if (isTopupReturnHandled.current) return;

    const params = new URLSearchParams(window.location.search);
    const status = (params.get('status') || '').toUpperCase();
    const isCancelled = params.get('cancel') === 'true' || status === 'CANCELLED';
    const isSuccess = status === 'PAID' || status === 'SUCCESS' || status === 'SUCCEEDED';
    const hasPaymentParams =
      params.has('code') ||
      params.has('id') ||
      params.has('cancel') ||
      params.has('status') ||
      params.has('orderCode');

    if (!hasPaymentParams) return;

    const pendingRaw = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
    let pendingCheckoutReturnPath: string | null = null;
    if (pendingRaw) {
      try {
        const pendingData = JSON.parse(pendingRaw) as { returnPath?: string };
        if (typeof pendingData?.returnPath === 'string' && pendingData.returnPath.length > 0) {
          pendingCheckoutReturnPath = pendingData.returnPath;
        }
      } catch (error) {
      }
    }

    if (isCancelled) {
      const orderCodeRaw = params.get('orderCode');
      if (orderCodeRaw) {
        const oc = Number(String(orderCodeRaw).trim());
        if (Number.isFinite(oc) && oc > 0) {
          cancelPayosTopup(oc).catch((err) => {
            console.warn('PayOS cancel-topup:', err);
          });
        }
      }

      if (pendingCheckoutReturnPath) {
        sessionStorage.setItem(TOPUP_CANCEL_TOAST_KEY, '1');
        sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
        isTopupReturnHandled.current = true;
        window.location.replace(pendingCheckoutReturnPath);
        return;
      }
      toast.info('Đã hủy chuyển khoản nạp tiền.');
    } else if (isSuccess) {
      if (pendingCheckoutReturnPath) {
        sessionStorage.setItem(TOPUP_SUCCESS_TOAST_KEY, '1');
        sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
        isTopupReturnHandled.current = true;
        window.location.replace(pendingCheckoutReturnPath);
        return;
      }
      toast.success('Nạp tiền thành công.');
    }

    params.delete('code');
    params.delete('id');
    params.delete('cancel');
    params.delete('status');
    params.delete('orderCode');

    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
    window.history.replaceState({}, document.title, nextUrl);

    isTopupReturnHandled.current = true;
  }, []);

  const getNavItems = (): NavItem[] => {
    return [
      { path: '/', label: 'Trang chủ' },
      {
        label: 'Sản phẩm',
        submenu: [
          { path: '/shop', label: 'Tất cả sản phẩm' },
          ...(categories.length > 0
            ? categories.map(cat => ({
              path: `/shop?category=${encodeURIComponent(cat.name)}`,
              label: cat.name
            }))
            : [
              { path: '/shop?category=Full Moon', label: 'Cúng Đầy Tháng' },
              { path: '/shop?category=House Warming', label: 'Cúng Tân Gia' },
              { path: '/shop?category=Grand Opening', label: 'Cúng Khai Trương' },
              { path: '/shop?category=Ancestral', label: 'Cúng Giỗ' },
              { path: '/shop?category=Year End', label: 'Cúng Tết' }
            ])
        ]
      },

      {
        path: '/cultural-guideline',
        label: 'Cẩm nang văn hóa',
        submenu: guidelineCategories.length > 0
          ? [
            { path: '/cultural-guideline', label: 'Tất cả hướng dẫn' },
            ...guidelineCategories.map(cat => ({
              path: `/cultural-guideline?categoryId=${cat.id}`,
              label: cat.name
            }))
          ]
          : undefined
      },
      { path: '/about', label: 'Về chúng tôi' },
    ];
  };


  const handleLogoutClick = async () => {
    const result = await toast.confirm({
      title: 'Đăng xuất?',
      text: 'Bạn có chắc muốn đăng xuất khỏi tài khoản không?',
      icon: 'warning',
      confirmButtonText: 'Đăng xuất',
      cancelButtonText: 'Hủy'
    });

    if (!result.isConfirmed) return;

    try {
      if (onLogout) {
        await onLogout();
      }
    } catch (error) {
      console.error('❌ Logout failed:', error);
      toast.error('Không thể đăng xuất. Vui lòng thử lại.');
    }
  };

  const handleNavigateToCart = () => {
    const user = getCurrentUser();
    if (!user) {
      toast.warning('Vui lòng đăng nhập để vào giỏ hàng');
      return;
    }
    onNavigate('/cart');
  };

  const handleMainNavClick = (path: string) => {
    onNavigate(path);
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('vi-VN').format(value);
  };

  const toSafeNumber = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const normalized = value.replace(/,/g, '').trim();
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  };

  const getWalletAmount = (
    wallet: WalletInfo | null,
    field: 'balance' | 'heldBalance' | 'debt'
  ): number => {
    if (!wallet) return 0;

    const keyMap: Record<'balance' | 'heldBalance' | 'debt', string[]> = {
      balance: ['Balance', 'balance', 'availableBalance', 'AvailableBalance'],
      heldBalance: ['HeldBalance', 'heldBalance'],
      debt: ['Debt', 'debt'],
    };

    for (const key of keyMap[field]) {
      if (Object.prototype.hasOwnProperty.call(wallet, key)) {
        const candidate = wallet[key as keyof WalletInfo];
        return toSafeNumber(candidate);
      }
    }

    return 0;
  };

  const parseAmountInput = (value: string): number => {
    return Number(String(value || '').replace(/[^0-9]/g, ''));
  };

  const formatAmountInput = (value: string): string => {
    const amount = parseAmountInput(value);
    if (!Number.isFinite(amount) || amount <= 0) return '';
    return formatCurrency(amount);
  };

  const resolveHeaderWalletType = (): WalletType => {
    const user = getCurrentUser();
    const normalizedRoles = Array.from(
      new Set(
        [
          ...(Array.isArray(user?.roles) ? user.roles : []),
          user?.role || '',
        ]
          .filter((role): role is string => typeof role === 'string' && role.trim().length > 0)
          .map((role) => role.toLowerCase())
      )
    );

    const normalizedUserRole = (userRole || '').trim().toLowerCase();
    const isStaffScope =
      normalizedRoles.includes('staff') ||
      normalizedUserRole === 'staff' ||
      activeRoute.startsWith('/staff');
    const isAdminScope =
      normalizedRoles.includes('admin') ||
      normalizedUserRole === 'admin' ||
      activeRoute.startsWith('/admin');

    if (isStaffScope || isAdminScope) return 'System';
    if (activeRoute.startsWith('/vendor/')) return 'Vendor';
    return 'Customer';
  };

  const fetchWalletBalance = async () => {
    try {
      setWalletLoading(true);
      const wallet = await getMyWallet(resolveHeaderWalletType());
      setWalletInfo(wallet);
    } catch (error) {
      console.error('❌ Failed to fetch wallet:', error);
    } finally {
      setWalletLoading(false);
    }
  };

  useEffect(() => {
    if (isWalletDropdownOpen && !walletInfo) {
      fetchWalletBalance();
    }
  }, [isWalletDropdownOpen, walletInfo, activeRoute]);

  useEffect(() => {
    setWalletInfo(null);
  }, [activeRoute, userRole]);

  const handleWalletClick = async () => {
    await fetchWalletBalance();
    if (window.innerWidth < 768) {
      setIsWalletDropdownOpen(prev => !prev);
    }
  };

  const extractTopupUrl = (data: Record<string, unknown>): string | null => {
    const keys = ['checkoutUrl', 'paymentLink', 'payUrl', 'url', 'link'];
    for (const key of keys) {
      const value = data[key];
      if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
        return value;
      }
    }
    return null;
  };

  const handleTopupClick = async () => {
    if (isBackofficeRole) {
      toast.info('Nạp tiền không áp dụng trong trang quản trị.');
      return;
    }

    const promptResult = await Swal.fire({
      title: 'Nạp tiền vào ví',
      text: 'Nhập số tiền cần nạp (VND)',
      input: 'text',
      inputValue: formatCurrency(100000),
      inputAttributes: {
        inputmode: 'numeric',
        autocomplete: 'off',
      },
      didOpen: () => {
        const input = Swal.getInput() as HTMLInputElement | null;
        if (!input) return;

        input.value = formatAmountInput(input.value) || input.value;
        input.addEventListener('input', () => {
          input.value = formatAmountInput(input.value);
        });
      },
      showCancelButton: true,
      confirmButtonText: 'Tạo link nạp tiền',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#8B4513',
      cancelButtonColor: '#64748b',
      customClass: {
        popup: 'rounded-2xl',
        confirmButton: 'rounded-lg font-bold px-6 py-3',
        cancelButton: 'rounded-lg font-bold px-6 py-3',
      },
      inputValidator: (value) => {
        const normalized = parseAmountInput(String(value || ''));
        if (!Number.isFinite(normalized) || normalized <= 0) {
          return 'Vui lòng nhập số tiền hợp lệ.';
        }
        return undefined;
      },
    });

    if (!promptResult.isConfirmed) return;

    const amount = parseAmountInput(String(promptResult.value || ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Số tiền không hợp lệ.');
      return;
    }

    try {
      setTopupLoading(true);
      const result = await createTopupLink(amount, 'Customer');
      const resultData = result as Record<string, unknown>;
      const paymentUrl = extractTopupUrl(resultData);

      if (!paymentUrl) {
        toast.error('Không nhận được link thanh toán từ hệ thống.');
        return;
      }

      sessionStorage.setItem(
        PENDING_CHECKOUT_KEY,
        JSON.stringify({
          returnPath: `${window.location.pathname}${window.location.search || ''}`,
        }),
      );

      setIsWalletDropdownOpen(false);
      window.location.href = paymentUrl;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tạo link nạp tiền.';
      toast.error(message);
    } finally {
      setTopupLoading(false);
    }
  };

  const availableBalance = getWalletAmount(walletInfo, 'balance');
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
  const hasVendorRole = normalizedRoles.includes('vendor');
  const hasCustomerRole = normalizedRoles.includes('customer');
  const normalizedUserRole = (userRole || '').trim().toLowerCase();
  const isStaffContext =
    normalizedRoles.includes('staff') ||
    normalizedUserRole === 'staff' ||
    activeRoute.startsWith('/staff');
  const isBackofficeRole =
    isStaffContext ||
    normalizedRoles.includes('admin') ||
    normalizedUserRole === 'admin' ||
    activeRoute.startsWith('/admin');
  const hasStaffRole = normalizedRoles.includes('staff');
  const hasAdminRole = normalizedRoles.includes('admin');
  const canSwitchRole = hasVendorRole;
  const isVendorArea = activeRoute.startsWith('/vendor/');
  const isRestrictedAccountMenu = isBackofficeRole || isVendorArea;

  const getLogoRedirectPath = (): string => {
    // Public vendor profile should behave like storefront, not vendor backoffice.
    if (activeRoute === '/vendor/:id') return '/';
    if (isVendorArea || hasVendorRole) return '/vendor/dashboard';
    if (activeRoute.startsWith('/staff') || hasStaffRole) return '/staff/dashboard';
    if (activeRoute.startsWith('/admin') || hasAdminRole) return '/admin/dashboard';
    return '/';
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-white dark:bg-[#111113]">
      {!hideHeader && (
        <header className="sticky top-0 z-50 bg-white dark:bg-[#1c1c1e] border-b border-gray-200 dark:border-white/10">
          <div className="max-w-[92rem] mx-auto px-4 md:px-6 xl:px-8 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 lg:gap-8 xl:gap-10 min-w-0">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-2 text-black hover:text-primary transition-colors focus:outline-none"
                aria-label="Toggle menu"
              >
                <span className="material-symbols-outlined text-3xl">menu</span>
              </button>
              <div
                className="cursor-pointer"
                onClick={() => onNavigate(getLogoRedirectPath())}
              >
                <div className="w-[170px] h-[56px] md:w-[190px] md:h-[62px] lg:w-[210px] lg:h-[68px]">
                  <img
                    src={theme === 'dark' ? darkLogo : headerLogo}
                    alt="Modern Ritual Offering"
                    className="w-full h-full object-contain object-left"
                  />
                </div>
              </div>
              {isVendorArea ? (
                <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-[0.2em]">
                  {/* <span className="material-symbols-outlined text-base">storefront</span>
                  Trang ban hang */}
                </div>
              ) : !isBackofficeRole && (
                <nav className="hidden lg:flex items-center gap-6 xl:gap-8 min-w-0">
                  {getNavItems().map((item) => (
                    <div
                      key={item.label}
                      className="relative group"
                      onMouseEnter={() => item.submenu && setOpenDropdown(item.label)}
                      onMouseLeave={() => setOpenDropdown(null)}
                    >
                      <button
                        onClick={() => item.path && handleMainNavClick(item.path)}
                        className={`text-sm font-semibold transition-colors border-b-2 py-1 flex items-center gap-1 whitespace-nowrap ${item.path === activeRoute ? 'text-primary border-primary' : 'text-black border-transparent hover:text-primary hover:border-primary'
                          }`}
                      >
                        {item.label}
                        {item.submenu && <span className="text-xs">▼</span>}
                      </button>

                      {item.submenu && (
                        <div className={`absolute left-0 top-full pt-2 z-50 transition-all duration-200 ${openDropdown === item.label ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible pointer-events-none -translate-y-2'}`}>
                          <div className={`bg-white border border-gray-100 shadow-xl rounded-2xl overflow-hidden ${(item.submenu?.length ?? 0) > 5 ? 'w-[600px] p-6' : 'w-56 p-2'}`}>
                            <div className={`${(item.submenu?.length ?? 0) > 5 ? 'grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2' : 'flex flex-col'}`}>
                              {(item.submenu || []).map((submenuItem, idx) => (
                                <button
                                  key={`${submenuItem.path}-${idx}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigate(submenuItem.path);
                                    setOpenDropdown(null);
                                  }}
                                  className={`w-full text-left text-sm text-black hover:bg-primary/5 hover:text-primary transition-colors rounded-xl font-medium ${(item.submenu?.length ?? 0) > 5 ? 'py-2 px-3 flex items-center gap-2' : 'py-3 px-4 mb-1 last:mb-0'}`}
                                >
                                  {(item.submenu?.length ?? 0) > 5 && idx === 0 && (
                                    <span className="material-symbols-outlined text-primary text-base">apps</span>
                                  )}
                                  {submenuItem.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </nav>
              )}
            </div>
            <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
              {/* Dark/Light Mode Toggle */}
              <button
                id="theme-toggle-btn"
                onClick={toggleTheme}
                className="flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 dark:border-white/10 text-black dark:text-slate-300 hover:border-primary hover:text-primary dark:hover:text-yellow-400 dark:hover:border-yellow-400/50 transition-all bg-white dark:bg-white/5 shadow-sm"
                title={theme === 'dark' ? 'Chuyển sang sáng' : 'Chuyển sang tối'}
                aria-label="Toggle dark mode"
              >
                {theme === 'dark' ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 7C9.24 7 7 9.24 7 12s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-12.37l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0zM7.05 18.36l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z" />
                  </svg>
                )}
              </button>
              {/* {!isVendorArea && !isBackofficeRole && (
                <div className="hidden md:flex items-center gap-2 text-primary font-bold">
                <span className="text-sm">1900 8888</span>
                </div>
              )} */}

              {userName && (
                <>
                  {!isBackofficeRole && (
                    <button
                      onClick={() => onNavigate('/messages')}
                      className="relative flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 text-black hover:border-primary hover:text-primary transition-all bg-white shadow-sm"
                      title="Tin nhắn"
                    >
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z" />
                      </svg>
                    </button>
                  )}

                  <div
                    className="relative hidden md:block"
                    onMouseEnter={() => {
                      if (notificationDropdownTimeout.current) {
                        clearTimeout(notificationDropdownTimeout.current);
                      }
                      setIsNotificationDropdownOpen(true);
                      if (filteredNotifications.length === 0 && !notificationLoading) {
                        loadNotifications();
                      }
                    }}
                    onMouseLeave={() => {
                      notificationDropdownTimeout.current = setTimeout(() => {
                        setIsNotificationDropdownOpen(false);
                      }, 200);
                    }}
                    ref={notificationRef}
                  >
                    <button
                      onClick={() => {
                        const next = !isNotificationDropdownOpen;
                        setIsNotificationDropdownOpen(next);
                        if (next && filteredNotifications.length === 0 && !notificationLoading) {
                          loadNotifications();
                        }
                      }}
                      className="relative flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 text-black hover:border-primary hover:text-primary transition-all bg-white shadow-sm"
                      title="Thông báo"
                    >
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M12 2C10.3431 2 9 3.34315 9 5V5.34196C6.71873 6.16519 5.125 8.33675 5.125 10.75V15L4 16.75V17.5H20V16.75L18.875 15V10.75C18.875 8.33675 17.2813 6.16519 15 5.34196V5C15 3.34315 13.6569 2 12 2ZM10.75 19C10.75 20.2426 11.7574 21.25 13 21.25C14.2426 21.25 15.25 20.2426 15.25 19H10.75Z" />
                      </svg>

                      {displayUnreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-0.5">
                          {displayUnreadCount > 9 ? '9+' : displayUnreadCount}
                        </span>
                      )}
                    </button>

                    {isNotificationDropdownOpen && (
                      <div
                        className="absolute right-0 mt-3 w-96 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.12)] border border-gray-100 z-50 overflow-hidden"
                        onMouseEnter={() => {
                          if (notificationDropdownTimeout.current) {
                            clearTimeout(notificationDropdownTimeout.current);
                          }
                        }}
                      >
                        <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-amber-50 via-white to-amber-50">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-700">Thông báo</p>
                            <p className="text-xs text-black mt-0.5">Cập nhật mới nhất về đơn hàng và đánh giá</p>
                          </div>
                          <button
                            onClick={() => {
                              markAllNotificationsAsRead();
                              markAllNotificationsAsReadApi();
                            }}
                            className="text-[11px] font-semibold text-primary hover:text-primary/80 underline-offset-2 hover:underline"
                          >
                            Đánh dấu đã đọc
                          </button>
                        </div>

                        <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                          {notificationLoading && filteredNotifications.length === 0 && (
                            <div className="px-5 py-6 text-sm text-black">Đang tải thông báo...</div>
                          )}

                          {!notificationLoading && filteredNotifications.length === 0 && (
                            <div className="px-5 py-6 text-sm text-black">Hiện chưa có thông báo nào.</div>
                          )}

                          {filteredNotifications.map((item) => (
                            <div
                              key={String(item.notificationId)}
                              className={`px-5 py-4 flex gap-3 hover:bg-slate-50 transition-colors cursor-pointer ${!item.isRead ? 'bg-amber-50/60' : ''}`}
                              onClick={async () => {
                                if (!item.isRead) {
                                  setNotifications((prev) => prev.map((n) => n.notificationId === item.notificationId ? { ...n, isRead: true } : n));
                                  setUnreadNotificationCount((prev) => Math.max(0, prev - 1));
                                  markNotificationAsRead(item.notificationId);
                                }

                                const targetUrl = resolveNotificationRedirectPath(item);
                                if (targetUrl) {
                                  if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
                                    window.location.href = targetUrl;
                                  } else {
                                    onNavigate(targetUrl);
                                  }
                                }
                              }}
                            >
                              <div
                                className={`mt-1 size-2.5 rounded-full flex-shrink-0 ${item.type === 'orderplaced' || item.type === 'order'
                                  ? 'bg-emerald-500'
                                  : item.type === 'review' || item.type === 'rating'
                                    ? 'bg-sky-500'
                                    : 'bg-amber-500'
                                  }`}
                              ></div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-800 mb-1 truncate">
                                  {item.title}
                                </p>
                                <p className="text-xs text-black leading-snug line-clamp-2">
                                  {item.message}
                                </p>
                                <div className="mt-2 flex items-center justify-between text-[11px] text-black">
                                  <span>{new Date(item.createdAt).toLocaleString('vi-VN')}</span>
                                  {(item.type === 'orderplaced' || item.type === 'order') && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                                      Đơn hàng
                                    </span>
                                  )}
                                  {(item.type === 'review' || item.type === 'rating') && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold">
                                      Đánh giá
                                    </span>
                                  )}
                                  {item.type === 'system' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">
                                      Hệ thống
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {(userName || onLogout) && !isVendorArea && !isStaffContext && (
                <div
                  className="relative"
                  onMouseEnter={() => {
                    if (window.innerWidth >= 768) {
                      if (walletDropdownTimeout.current) {
                        clearTimeout(walletDropdownTimeout.current);
                      }
                      setIsWalletDropdownOpen(true);
                    }
                  }}
                  onMouseLeave={() => {
                    if (window.innerWidth >= 768) {
                      walletDropdownTimeout.current = setTimeout(() => {
                        setIsWalletDropdownOpen(false);
                      }, 200);
                    }
                  }}
                  ref={walletRef}
                >
                  <button
                    onClick={handleWalletClick}
                    disabled={walletLoading || topupLoading}
                    className="flex items-center justify-center w-10 h-10 md:w-auto md:h-auto md:px-3 md:py-2 rounded-lg border border-gray-300 text-primary hover:border-primary transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    title="Ví của tôi"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 7C3 5.34315 4.34315 4 6 4H19C20.1046 4 21 4.89543 21 6V8H17.5C15.567 8 14 9.567 14 11.5C14 13.433 15.567 15 17.5 15H21V17C21 18.6569 19.6569 20 18 20H6C4.34315 20 3 18.6569 3 17V7ZM17.5 10C16.6716 10 16 10.6716 16 11.5C16 12.3284 16.6716 13 17.5 13H22V10H17.5ZM6 6C5.44772 6 5 6.44772 5 7V7.2C5.31304 7.07116 5.65584 7 6 7H19V6H6Z" />
                    </svg>
                  </button>

                  {isWalletDropdownOpen && (
                    <div
                      className="absolute top-full right-0 mt-3 w-72 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300"
                      onMouseEnter={() => {
                        if (walletDropdownTimeout.current) {
                          clearTimeout(walletDropdownTimeout.current);
                        }
                      }}
                    >
                      <div className="p-5">
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center gap-2">
                            <div className="size-2 rounded-full bg-green-500"></div>
                            <span className="text-[10px] font-black text-black uppercase tracking-[0.2em]">Số dư khả dụng</span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); fetchWalletBalance(); }}
                            className={`p-1.5 rounded-lg hover:bg-slate-100 text-black hover:text-primary transition-all duration-500 ${walletLoading ? 'animate-spin text-primary' : ''}`}
                            title="Làm mới"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        </div>

                        <div className="mb-6">
                          {walletLoading && !walletInfo ? (
                            <div className="h-10 w-full bg-slate-100 animate-pulse rounded-xl"></div>
                          ) : (
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-3xl font-black text-primary tracking-tight">
                                {formatCurrency(availableBalance)}
                              </span>
                              <span className="text-xs font-bold text-black mb-1">VND</span>
                            </div>
                          )}
                        </div>

                        {!isBackofficeRole && (
                          <button
                            onClick={async () => {
                              await handleTopupClick();
                            }}
                            disabled={topupLoading || walletLoading}
                            className="w-full bg-primary hover:bg-primary/95 text-white p-3 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-3 group active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
                          >
                            <div className="size-7 rounded-lg bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                              </svg>
                            </div>
                            <span className="font-bold text-sm tracking-wide">Nạp thêm tiền</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Account Dropdown */}
              {userName && (
                <div
                  className="relative"
                  onMouseEnter={() => {
                    if (window.innerWidth >= 768) {
                      if (accountDropdownTimeout.current) {
                        clearTimeout(accountDropdownTimeout.current);
                      }
                      setIsAccountDropdownOpen(true);
                    }
                  }}
                  onMouseLeave={() => {
                    if (window.innerWidth >= 768) {
                      accountDropdownTimeout.current = setTimeout(() => {
                        setIsAccountDropdownOpen(false);
                      }, 200);
                    }
                  }}
                  ref={accountRef}
                >
                  <button
                    onClick={() => {
                      if (isRestrictedAccountMenu) {
                        setIsAccountDropdownOpen(prev => !prev);
                      } else if (window.innerWidth < 768) {
                        setIsAccountDropdownOpen(prev => !prev);
                      } else {
                        onNavigate('/profile');
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 rounded-lg border border-gray-300 text-primary font-bold text-sm hover:border-primary transition-all"
                    title={'Hồ sơ cá nhân'}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                    <span className="hidden lg:inline max-w-[120px] truncate">{userName}</span>
                  </button>

                  {/* Dropdown Menu */}
                  {isAccountDropdownOpen && (
                    <div
                      className="absolute top-full right-0 mt-0 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-slideDown"
                      onMouseEnter={() => {
                        if (accountDropdownTimeout.current) {
                          clearTimeout(accountDropdownTimeout.current);
                        }
                      }}
                    >
                      {!isRestrictedAccountMenu && (
                        <button
                          onClick={() => {
                            onNavigate('/profile');
                            setIsAccountDropdownOpen(false);
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                          </svg>
                          Hồ sơ cá nhân
                        </button>
                      )}
                      {!isRestrictedAccountMenu && (
                        <button
                          onClick={() => {
                            onNavigate('/profile/orders');
                            setIsAccountDropdownOpen(false);
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M13 12h7v1.5h-7zm0-2.5h7V11h-7zm0 5h7V16h-7zM21 4H3c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 15h-9V6h9v13z" />
                          </svg>
                          Đơn hàng của tôi
                        </button>
                      )}
                      {!isRestrictedAccountMenu && canSwitchRole && (
                        <button
                          onClick={() => {
                            onNavigate(isVendorArea ? '/' : '/vendor/dashboard');
                            setIsAccountDropdownOpen(false);
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M3 5a2 2 0 012-2h14a2 2 0 012 2v2H3V5zm0 4h18v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9zm4 3v2h10v-2H7z" />
                          </svg>
                          {isVendorArea ? 'Trang mua hàng' : 'Trang bán hàng'}
                        </button>
                      )}
                      {!isRestrictedAccountMenu && (
                        <button
                          onClick={() => {
                            onNavigate('/wallet/transactions');
                            setIsAccountDropdownOpen(false);
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M5 4h14a2 2 0 012 2v2H3V6a2 2 0 012-2zm-2 7h18v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7zm9 2a3 3 0 100 6 3 3 0 000-6z" />
                          </svg>
                          Lịch sử giao dịch
                        </button>
                      )}
                      {onLogout && (
                        <button
                          onClick={async () => {
                            setIsAccountDropdownOpen(false);
                            await handleLogoutClick();
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3 border-t border-gray-100"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                          </svg>
                          Đăng xuất
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {userName && canSwitchRole && (
                <button
                  onClick={() => onNavigate(isVendorArea ? '/' : '/vendor/dashboard')}
                  className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-primary font-bold text-sm hover:border-primary transition-all whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[18px]">storefront</span>
                  {isVendorArea ? 'Trang mua hàng' : 'Trang bán hàng'}
                </button>
              )}

              {/* Cart with Dropdown */}
              {!isVendorArea && !isBackofficeRole && (
                <div
                  className="relative"
                  onMouseEnter={() => {
                    if (window.innerWidth >= 768) {
                      if (!getCurrentUser()) return;
                      if (cartDropdownTimeout.current) clearTimeout(cartDropdownTimeout.current);
                      setIsCartDropdownOpen(true);
                    }
                  }}
                  onMouseLeave={() => {
                    if (window.innerWidth >= 768) {
                      cartDropdownTimeout.current = setTimeout(() => {
                        setIsCartDropdownOpen(false);
                      }, 200);
                    }
                  }}
                  ref={cartRef}
                >
                  <button
                    onClick={() => {
                      if (window.innerWidth < 768) {
                        setIsCartDropdownOpen(prev => !prev);
                      } else {
                        handleNavigateToCart();
                      }
                    }}
                    className="relative flex items-center justify-center w-10 h-10 md:w-auto md:h-auto md:px-4 md:py-2 rounded-lg border border-gray-300 text-primary font-bold text-sm hover:border-primary transition-all"
                    title="Giỏ hàng"
                  >
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                    {cartCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center">
                        {cartCount > 99 ? '99+' : cartCount}
                      </span>
                    )}
                  </button>
                  <CartDropdown
                    isOpen={isCartDropdownOpen}
                    onClose={() => setIsCartDropdownOpen(false)}
                    onNavigateToCart={handleNavigateToCart}
                    onNavigateToShop={() => onNavigate('/shop')}
                  />
                </div>
              )}

              {/* Call to Action Button */}
              {!userName && (
                <button
                  onClick={() => onNavigate('/auth')}
                  className="border-2 border-primary text-primary hover:bg-primary/5 rounded-lg px-6 py-2 text-sm font-bold transition-all"
                >
                  Đăng nhập
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Mobile Menu Drawer */}
      <div
        className={`fixed inset-0 z-[100] transition-visibility duration-300 ${isMobileMenuOpen ? 'visible' : 'invisible'}`}
      >
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setIsMobileMenuOpen(false)}
        />

        <div
          className={`absolute inset-y-0 left-0 w-[85%] max-w-sm bg-white shadow-2xl transition-transform duration-300 ease-out flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-ritual-bg/30">
            <h2 className="text-xl font-display font-black text-primary italic">VIET RITUAL</h2>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 text-black hover:text-primary"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-6">
            <div className="px-6 space-y-6">
              {userName ? (
                <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="size-12 rounded-full bg-primary flex items-center justify-center text-white">
                      <span className="material-symbols-outlined text-2xl">person</span>
                    </div>
                    <div>
                      <p className="text-sm font-black text-primary truncate max-w-[160px]">{userName}</p>
                      <p className="text-[10px] font-bold text-black uppercase tracking-widest mt-0.5">Thành viên</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { onNavigate('/profile'); setIsMobileMenuOpen(false); }}
                      className="text-[10px] font-black uppercase tracking-wider text-primary bg-white border border-primary/20 py-2 rounded-lg text-center"
                    >
                      Hồ sơ
                    </button>
                    <button
                      onClick={handleLogoutClick}
                      className="text-[10px] font-black uppercase tracking-wider text-red-600 bg-white border border-red-100 py-2 rounded-lg text-center"
                    >
                      Đăng xuất
                    </button>
                    {canSwitchRole && (
                      <button
                        onClick={() => {
                          onNavigate(isVendorArea ? '/' : '/vendor/dashboard');
                          setIsMobileMenuOpen(false);
                        }}
                        className="col-span-2 text-[10px] font-black uppercase tracking-wider text-primary bg-white border border-primary/20 py-2 rounded-lg text-center"
                      >
                        {isVendorArea ? 'Qua trang mua hàng' : 'Qua trang bán hàng'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { onNavigate('/auth'); setIsMobileMenuOpen(false); }}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20"
                >
                  Đăng nhập
                </button>
              )}

              {!isBackofficeRole && (
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-black uppercase tracking-[0.2em] mb-4 pl-2">Khám phá</p>
                  {getNavItems().map((item) => (
                    <div key={item.label} className="space-y-1">
                      <button
                        onClick={() => {
                          if (!item.submenu) {
                            item.path && onNavigate(item.path);
                            setIsMobileMenuOpen(false);
                          } else {
                            setOpenDropdown(openDropdown === item.label ? null : item.label);
                          }
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-sm transition-colors ${activeRoute === item.path ? 'bg-primary text-white' : 'text-black hover:bg-slate-50'}`}
                      >
                        <span>{item.label}</span>
                        {item.submenu && (
                          <span className={`material-symbols-outlined text-lg transition-transform ${openDropdown === item.label ? 'rotate-180' : ''}`}>
                            expand_more
                          </span>
                        )}
                      </button>
                      {item.submenu && openDropdown === item.label && (
                        <div className="pl-4 space-y-1 mt-1 font-medium bg-slate-50/50 rounded-2xl py-2">
                          {item.submenu.map((sub, idx) => (
                            <button
                              key={idx}
                              onClick={() => { onNavigate(sub.path); setIsMobileMenuOpen(false); }}
                              className="w-full text-left px-4 py-2.5 text-xs text-black hover:text-primary transition-colors"
                            >
                              - {sub.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!isBackofficeRole && (
                <div className="space-y-1 pt-4 border-t border-gray-100">
                  <p className="text-[10px] font-black text-black uppercase tracking-[0.2em] mb-4 pl-2">Cá nhân</p>
                  <button
                    onClick={() => { onNavigate('/cart'); setIsMobileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-black font-bold text-sm hover:bg-slate-50"
                  >
                    <span className="material-symbols-outlined text-xl">shopping_cart</span>
                    <span>Giỏ hàng ({cartCount})</span>
                  </button>
                  <button
                    onClick={() => { setIsWalletDropdownOpen(true); setIsMobileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-black font-bold text-sm hover:bg-slate-50"
                  >
                    <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
                    <span>Ví của tôi</span>
                  </button>
                  <button
                    onClick={() => { onNavigate('/profile/orders'); setIsMobileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-black font-bold text-sm hover:bg-slate-50"
                  >
                    <span className="material-symbols-outlined text-xl">list_alt</span>
                    <span>Đơn hàng của tôi</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="p-8 border-t border-gray-100">
            <div className="flex items-center gap-3 text-primary font-black mb-1">
              <span className="material-symbols-outlined text-xl">call</span>
              <span className="text-lg">Hotline: 1900 8888</span>
            </div>
            <p className="text-[10px] font-bold text-black italic">Hỗ trợ khách hàng 24/7</p>
          </div>
        </div>
      </div>

      <main className="flex-grow w-full bg-white dark:bg-[#111113]">
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 md:px-8 lg:px-10">
          {children}
        </div>
      </main>

      {!hideHeader && (
        <footer className="bg-white dark:bg-[#1c1c1e] border-t border-gray-200 dark:border-white/10 pt-16 pb-8">
          <div className="max-w-7xl mx-auto px-6 md:px-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
              <div className="flex flex-col gap-6">
                <div className="w-[312px] h-[96px] md:w-[360px] md:h-[120px]">
                  <img
                    src={theme === 'dark' ? darkLogo : headerLogo}
                    alt="Modern Ritual Offering"
                    className="w-full h-full object-contain object-left"
                  />
                </div>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Dịch vụ cung cấp mâm cúng trọn gói. Chúng tôi gìn giữ nét văn hóa tâm linh Việt qua sự tinh tế và chuyên nghiệp.
                </p>
              </div>
              <div>
                <h4 className="text-primary font-black uppercase text-xs mb-6">Dịch vụ</h4>
                <ul className="space-y-3 text-sm text-gray-500">
                  <li className="hover:text-primary cursor-pointer">Cúng Đầy Tháng</li>
                  <li className="hover:text-primary cursor-pointer">Cúng Tân Gia</li>
                  <li className="hover:text-primary cursor-pointer">Cúng Khai Trương</li>
                </ul>
              </div>
              <div>
                <h4 className="text-primary font-black uppercase text-xs mb-6">Liên hệ</h4>
                <div className="space-y-3 text-sm text-gray-500">
                  <p>Quận 1, TP. HCM</p>
                  <p>contact@ritual.vn</p>
                </div>
              </div>
            </div>
            <div className="pt-8 border-t border-gray-200 text-center">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">© 2026 Modern Ritual Offering  Service. Thành tâm - Tín trực.</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

export default Layout;
