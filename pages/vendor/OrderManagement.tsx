import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { orderService, VendorOrder, Order, VendorOrderItem, VendorOrderCalendarItem, PreparationPlan } from '../../services/orderService';
import { getProfile } from '../../services/auth';
import { vendorService } from '../../services/vendorService';
import { showSuccess, showError, showConfirm, showPrompt } from '../../services/toast';
import VendorRefundTab from './VendorRefundTab';
import VendorReviewTab from './VendorReviewTab';
import OrderStatusTimeline from '../../components/OrderStatusTimeline';


interface OrderManagementProps {
  onNavigate: (path: string) => void;
}


const ORDER_STATUS_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'Paid', label: 'Đã thanh toán' },
  { id: 'Confirmed', label: 'Đã xác nhận' },
  { id: 'Processing', label: 'Đang xử lý' },
  { id: 'Delivering', label: 'Đang giao' },
  { id: 'Delivered', label: 'Đã giao' },
  { id: 'Completed', label: 'Hoàn thành' },
  { id: 'Cancelled', label: 'Đã hủy' },
  { id: 'Refunded', label: 'Đã hoàn' },
  { id: 'PaymentFailed', label: 'Thanh toán lỗi' },
];

const NEXT_STATUSES: Record<string, { value: string; label: string }[]> = {
  Paid: [
    { value: 'Confirmed', label: 'Xác nhận đơn' },
    { value: 'Cancelled', label: 'Hủy đơn' }
  ],
  Confirmed: [
    { value: 'Processing', label: 'Bắt đầu xử lý' },
    { value: 'Cancelled', label: 'Hủy đơn' }
  ],
  Processing: [
    { value: 'Delivering', label: 'Bắt đầu giao hàng' },
    { value: 'Cancelled', label: 'Hủy đơn' }
  ],
  Delivering: [
    { value: 'Delivered', label: 'Xác nhận đã giao' },
    { value: 'Cancelled', label: 'Hủy đơn' }
  ],
  Delivered: [],
  Completed: [],
  Cancelled: [],
};

const STATUS_BADGE: Record<string, { badge: string; label: string }> = {
  Pending: { badge: 'bg-yellow-100 text-yellow-700', label: 'Chờ duyệt' },
  Confirmed: { badge: 'bg-blue-100   text-blue-700', label: 'Đã xác nhận' },
  Processing: { badge: 'bg-violet-100 text-violet-700', label: 'Đang xử lý' },
  Preparing: { badge: 'bg-violet-100 text-violet-700', label: 'Đang xử lý' },
  Paid: { badge: 'bg-emerald-100 text-emerald-700', label: 'Đã thanh toán' },
  Delivering: { badge: 'bg-orange-100 text-orange-700', label: 'Đang giao' },
  Delivered: { badge: 'bg-green-100  text-green-700', label: 'Đã giao' },
  Completed: { badge: 'bg-green-100  text-green-700', label: 'Hoàn thành' },
  Cancelled: { badge: 'bg-red-100    text-red-600', label: 'Đã hủy' },
  Refunded: { badge: 'bg-purple-100 text-purple-600', label: 'Đã hoàn tiền' },
  PaymentFailed: { badge: 'bg-red-100    text-red-700', label: 'TT thất bại' },
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const formatVnd = (value: unknown): string => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? `${n.toLocaleString('vi-VN')}đ` : '0đ';
};

const formatPercent = (value: unknown): string => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '0%';
  const pct = n > 1 ? n : n * 100;
  return `${Math.round(pct)}%`;
};

const formatDateVi = (value: unknown): string => {
  if (!value) return 'N/A';
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('vi-VN');
};

const formatDateTimeVi = (value: unknown): string => {
  if (!value) return 'N/A';
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleString('vi-VN');
};

const formatDateOnlyVi = (value: unknown): string => {
  if (!value) return 'N/A';
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('vi-VN');
};

const formatTimeOnlyVi = (value: unknown): string => {
  if (!value) return 'N/A';
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

const formatSlaStatusVi = (value: unknown): string => {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'ontime') return 'Đúng hạn';
  if (status === 'late') return 'Trễ hạn';
  if (status === 'early') return 'Sớm hạn';
  return 'Đúng hạn';
};

const hasMeaningfulText = (v: unknown): boolean => {
  if (typeof v !== 'string') return false;
  const n = v.trim().toLowerCase();
  return n !== '' && n !== 'n/a' && n !== 'na' && n !== 'null' && n !== 'undefined';
};

const normalizeStatus = (v: unknown): string => {
  const map: Record<string, string> = {
    paid: 'Paid', confirmed: 'Confirmed', processing: 'Processing',
    preparing: 'Processing', delivering: 'Delivering', shipping: 'Delivering',
    delivered: 'Delivered', completed: 'Completed', cancelled: 'Cancelled',
    refunded: 'Refunded', paymentfailed: 'PaymentFailed', pending: 'Pending',
  };
  return map[String(v || '').trim().toLowerCase()] ?? String(v || '').trim();
};

const parseDate = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const generateEstimatedTimeOptions = (deliveryTimeStr: string) => {
  if (!deliveryTimeStr) return [];
  const [hours, minutes] = deliveryTimeStr.split(':').map(Number);
  const options: { value: string; label: string }[] = [];

  // Khách nhận lúc HH:mm. Ta sinh các mốc cách nhau 30 phút trong khoảng từ trước 3 tiếng đến trước 1 tiếng.
  // Tổng cộng có 5 mốc: trước 3.0h, trước 2.5h, trước 2.0h, trước 1.5h, trước 1.0h.
  const offsets = [3.0, 2.5, 2.0, 1.5, 1.0];

  offsets.forEach(offset => {
    const totalMinutes = hours * 60 + (minutes || 0) - offset * 60;
    if (totalMinutes >= 0) {
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      const pad = (num: number) => String(num).padStart(2, '0');
      const timeStr = `${pad(h)}:${pad(m)}`;
      options.push({
        value: timeStr,
        label: timeStr
      });
    }
  });

  const uniqueOptions = options.filter((opt, index, self) =>
    self.findIndex(t => t.value === opt.value) === index
  ).sort((a, b) => a.value.localeCompare(b.value));

  return uniqueOptions;
};

const getAvailableTimeRanges = (deliveryTimeStr: string) => {
  if (!deliveryTimeStr) return { ampm: [], hour12Map: { AM: [], PM: [] }, minutesMap: {} };

  const [deliveryHour, deliveryMinute] = deliveryTimeStr.split(':').map(Number);

  const deliveryMinutes = deliveryHour * 60 + (deliveryMinute || 0);
  const minMinutes = deliveryMinutes - 3 * 60; // Trước 3 tiếng
  const maxMinutes = deliveryMinutes - 1 * 60; // Trước 1 tiếng

  const availableHours24: number[] = [];
  const minutesMap: Record<number, number[]> = {};

  for (let h = 0; h < 24; h++) {
    const minsForThisHour: number[] = [];
    for (let m = 0; m < 60; m += 5) {
      const timeInMins = h * 60 + m;
      if (timeInMins >= minMinutes && timeInMins <= maxMinutes) {
        minsForThisHour.push(m);
      }
    }
    if (minsForThisHour.length > 0) {
      availableHours24.push(h);
      minutesMap[h] = minsForThisHour;
    }
  }

  const availableAMPM = new Set<string>();
  const hour12Map: Record<string, { hour12Str: string; hour24: number }[]> = {
    AM: [],
    PM: []
  };

  availableHours24.forEach(h24 => {
    const period = h24 >= 12 ? 'PM' : 'AM';
    availableAMPM.add(period);

    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    const hour12Str = String(h12).padStart(2, '0');

    if (!hour12Map[period].some(x => x.hour12Str === hour12Str)) {
      hour12Map[period].push({ hour12Str, hour24: h24 });
    }
  });

  return {
    ampm: Array.from(availableAMPM),
    hour12Map,
    minutesMap
  };
};

const formatYmdToVi = (ymd: string): string => {
  if (!ymd) return '';
  const [year, month, day] = ymd.split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
};

const toMdy = (ymd: string): string => {
  if (!ymd || !ymd.includes('-')) return ymd;
  const [y, m, d] = ymd.split('-');
  return `${m}-${d}-${y}`;
};

const parseViDateToYmd = (value: string): string | null => {
  const normalized = value.trim();
  const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900) return null;

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;

  return toYmd(date);
};

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const getMonthMatrix = (year: number, month: number) => {
  const firstDay = new Date(year, month - 1, 1);
  const startDay = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks: Array<Array<number | null>> = [];
  let day = 1;

  for (let w = 0; w < 6; w += 1) {
    const week: Array<number | null> = [];
    for (let d = 0; d < 7; d += 1) {
      if ((w === 0 && d < startDay) || day > daysInMonth) {
        week.push(null);
      } else {
        week.push(day);
        day += 1;
      }
    }
    weeks.push(week);
    if (day > daysInMonth) break;
  }

  return weeks;
};

const formatMonthLabel = (year: number, month: number) => `Tháng ${month}/${year}`;

const formatOrderCode = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return 'ORD';
  if (raw.length <= 10) return raw.toUpperCase();
  return `ORD-${raw.slice(-6).toUpperCase()}`;
};

const getCalendarDateKey = (value: unknown): string | null => {
  const d = parseDate(value);
  return d ? toYmd(d) : null;
};

const getCapacityLabel = (value?: string | null) => {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'warning') return 'Gần đầy';
  if (key === 'full') return 'Đã đầy';
  if (key === 'closed') return 'Đã đóng';
  if (key === 'ok') return 'Ổn định';
  return 'N/A';
};

const getStatusBadge = (status: unknown) =>
  STATUS_BADGE[normalizeStatus(status)] ?? { badge: 'bg-gray-100 text-gray-600', label: String(status) };

const getPaymentStatusLabel = (status: unknown): string => {
  const key = String(status || '').trim().toLowerCase();
  const map: Record<string, string> = {
    paid: 'Đã thanh toán',
    pending: 'Chờ thanh toán',
    failed: 'Thanh toán thất bại',
    paymentfailed: 'Thanh toán thất bại',
    refunded: 'Đã hoàn tiền',
    cancelled: 'Đã hủy',
  };
  return map[key] || (key ? String(status) : 'N/A');
};

const getAvatarColor = (name: string) => {
  const colors = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const fallbackProductImage = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 88 88">
      <rect width="88" height="88" rx="14" fill="#F1F5F9"/>
      <rect x="18" y="18" width="52" height="52" rx="10" fill="#E2E8F0"/>
      <text x="44" y="52" text-anchor="middle" font-size="20" font-family="Arial, sans-serif" fill="#64748B">SP</text>
    </svg>`
)}`;

const toImageSrc = (value?: string | null): string => {
  const normalized = String(value || '').trim();
  if (!hasMeaningfulText(normalized)) return fallbackProductImage;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (/^data:image\//i.test(normalized)) return normalized;
  if (/^blob:/i.test(normalized)) return normalized;
  if (normalized.startsWith('//')) return normalized;
  if (normalized.startsWith('/') || normalized.startsWith('./') || normalized.startsWith('../')) return normalized;
  // If API returns a relative path like "uploads/...", make it root-relative.
  return `/${normalized}`;
};

// ─── Component ────────────────────────────────────────────────────────────────

const OrderManagement: React.FC<OrderManagementProps> = ({ onNavigate: _onNavigate }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const itemsPerPage = 5;
  const fromDateInputRef = useRef<HTMLInputElement | null>(null);
  const toDateInputRef = useRef<HTMLInputElement | null>(null);

  type EnrichedOrderData = Partial<VendorOrder> & {
    itemImageByItemId?: Record<string, string | null | undefined>;
    items?: VendorOrderItem[];
  };

  interface PreparationItem {
    id: string;
    name: string;
    variant: string;
    quantity: number;
    orderId: string;
    deliveryTime: string;
    customerName: string;
    addOns: { name: string; quantity: number }[];
    swaps: string[];
    isPrepared: boolean;
  }

  // ── orders state ────────────────────────────────────────────────────────────
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [enrichedData, setEnrichedData] = useState<Record<string, EnrichedOrderData>>({});
  const [vendorShopName, setVendorShopName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fromDateText, setFromDateText] = useState('');
  const [toDateText, setToDateText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // ── calendar state ─────────────────────────────────────────────────────────
  const today = new Date();
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth() + 1);
  const [calendarOrders, setCalendarOrders] = useState<VendorOrderCalendarItem[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(toYmd(today));
  const [dailyPlanItems, setDailyPlanItems] = useState<Array<{
    orderId: string;
    deliveryTime?: string;
    status?: string;
    statusLabel?: string;
    customerName?: string;
    customerPhone?: string;
    finalAmount?: number;
  }>>([]);
  const [dailyPlanDetail, setDailyPlanDetail] = useState<PreparationPlan | null>(null);
  const [showDailyPrepPlan, setShowDailyPrepPlan] = useState(false);
  const [dailyPlanLoading, setDailyPlanLoading] = useState(false);
  const [dailyPlanError, setDailyPlanError] = useState<string | null>(null);
  const [selectedDailyPlanItem, setSelectedDailyPlanItem] = useState<{ orderId: string; deliveryTime?: string; status?: string } | null>(null);

  // ── preparation state ───────────────────────────────────────────────────────
  const [prepPlan, setPrepPlan] = useState<any>(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepDate, setPrepDate] = useState(toYmd(new Date()));

  // ── detail modal state ──────────────────────────────────────────────────────
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null);
  const [deliveryProofImages, setDeliveryProofImages] = useState<File[]>([]);
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerPeriod, setPickerPeriod] = useState<'AM' | 'PM'>('PM');
  const [pickerHour12, setPickerHour12] = useState('05');
  const [pickerMinute, setPickerMinute] = useState(0);
  const [pausingOrders, setPausingOrders] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseDates, setPauseDates] = useState<string[]>([]);
  const [pauseNote, setPauseNote] = useState('');

  // ── tab state ───────────────────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState<'orders' | 'refunds' | 'reviews' | 'preparation'>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'refund' || tab === 'refunds') return 'refunds';
    if (tab === 'review' || tab === 'reviews') return 'reviews';
    if (tab === 'preparation') return 'preparation';
    return 'orders';
  });
  const [pendingRefunds, setPendingRefunds] = useState(0);

  const getTodayYmd = (): string => toYmd(new Date());

  const applyDatePreset = (preset: 'today' | 'last7' | 'last30' | 'thisMonth' | 'clear') => {
    const today = new Date();
    const end = toYmd(today);

    if (preset === 'clear') {
      setFromDate('');
      setToDate('');
      setFromDateText('');
      setToDateText('');
      return;
    }

    if (preset === 'today') {
      setFromDate(end);
      setToDate(end);
      return;
    }

    if (preset === 'thisMonth') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(toYmd(start));
      setToDate(end);
      return;
    }

    const days = preset === 'last7' ? 6 : 29;
    const start = new Date(today);
    start.setDate(today.getDate() - days);
    setFromDate(toYmd(start));
    setToDate(end);
  };

  const handleFromDateChange = (value: string) => {
    setFromDate(value);
    setFromDateText(formatYmdToVi(value));
    if (toDate && value && toDate < value) {
      setToDate(value);
      setToDateText(formatYmdToVi(value));
    }
  };

  const handleToDateChange = (value: string) => {
    setToDate(value);
    setToDateText(formatYmdToVi(value));
    if (fromDate && value && value < fromDate) {
      setFromDate(value);
      setFromDateText(formatYmdToVi(value));
    }
  };

  const handleFromDateTextChange = (rawValue: string) => {
    const sanitized = rawValue.replace(/[^\d/]/g, '').slice(0, 10);
    setFromDateText(sanitized);

    const parsed = parseViDateToYmd(sanitized);
    if (parsed) {
      handleFromDateChange(parsed);
    }
  };

  const handleToDateTextChange = (rawValue: string) => {
    const sanitized = rawValue.replace(/[^\d/]/g, '').slice(0, 10);
    setToDateText(sanitized);

    const parsed = parseViDateToYmd(sanitized);
    if (parsed) {
      handleToDateChange(parsed);
    }
  };

  const handleFromDateTextBlur = () => {
    const parsed = parseViDateToYmd(fromDateText);
    setFromDateText(parsed ? formatYmdToVi(parsed) : formatYmdToVi(fromDate));
  };

  const handleToDateTextBlur = () => {
    const parsed = parseViDateToYmd(toDateText);
    setToDateText(parsed ? formatYmdToVi(parsed) : formatYmdToVi(toDate));
  };

  const openNativeDatePicker = (input: HTMLInputElement | null) => {
    if (!input) return;
    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerInput.showPicker === 'function') {
      pickerInput.showPicker();
      return;
    }
    pickerInput.click();
  };

  // ── fetch orders ────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // setCurrentPage(1); // Removed as per diff
      const [data, profile] = await Promise.all([
        orderService.getVendorOrders(),
        getProfile().catch(() => null),
      ]);
      setOrders(data);
      setVendorShopName((profile?.shopName || '').trim());
    } catch {
      setError('Không thể tải danh sách đơn hàng. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [mainTab]);

  const fetchPrepPlan = useCallback(async () => {
    if (mainTab !== 'preparation') return;
    try {
      setPrepLoading(true);
      // Format prepDate (YYYY-MM-DD) to MM-DD-YYYY as requested
      const plan = await orderService.getPreparationPlan(toMdy(prepDate));
      setPrepPlan(plan);
    } catch (err) {
      console.error("Failed to fetch prep plan:", err);
    } finally {
      setPrepLoading(false);
    }
  }, [mainTab, prepDate]);

  useEffect(() => {
    fetchPrepPlan();
  }, [fetchPrepPlan]);

  const fetchCalendarOrders = useCallback(async () => {
    if (mainTab !== 'orders') return;
    try {
      setCalendarLoading(true);
      setCalendarError(null);
      const items = await orderService.getVendorOrderCalendar(calendarYear, calendarMonth);
      setCalendarOrders(items);
    } catch {
      setCalendarError('Không thể tải lịch đơn hàng. Vui lòng thử lại.');
    } finally {
      setCalendarLoading(false);
    }
  }, [mainTab, calendarYear, calendarMonth]);

  useEffect(() => {
    fetchCalendarOrders();
  }, [fetchCalendarOrders]);

  const orderLookup = useMemo(() => {
    return orders.reduce<Record<string, VendorOrder>>((acc, order) => {
      if (order.orderId) acc[order.orderId] = order;
      return acc;
    }, {});
  }, [orders]);

  const fetchDailyPlan = useCallback(async () => {
    if (mainTab !== 'orders') return;
    try {
      setDailyPlanLoading(true);
      setDailyPlanError(null);
      const dateParam = toMdy(selectedCalendarDate);
      const plan = await orderService.getPreparationPlan(dateParam, true);
      setDailyPlanDetail(plan || null);
      if (!plan) {
        setDailyPlanItems([]);
        return;
      }

      const items: Array<{
        orderId: string;
        deliveryTime?: string;
        status?: string;
        statusLabel?: string;
        customerName?: string;
        customerPhone?: string;
        finalAmount?: number;
      }> = [];

      if (Array.isArray(plan.ordersByStatus)) {
        plan.ordersByStatus.forEach((item) => {
          const orderId = String(item.orderId || '').trim();
          if (!orderId) return;
          items.push({
            orderId,
            deliveryTime: String(item.deliveryTime || '').slice(0, 5),
            status: item.orderStatus,
            statusLabel: item.orderStatusLabel,
            customerName: item.customerName,
            customerPhone: item.customerPhone,
            finalAmount: Number(item.finalAmount) || undefined,
          });
        });
      }

      const merged = items.map((item) => {
        const order = orderLookup[item.orderId];
        return {
          ...item,
          status: item.status || order?.orderStatus,
          deliveryTime: item.deliveryTime || order?.deliveryTime?.slice(0, 5),
          customerName: item.customerName || order?.customerName,
          customerPhone: item.customerPhone || order?.customerPhone,
          finalAmount: Number(item.finalAmount) || order?.finalAmount,
        };
      });

      setDailyPlanItems(merged);
    } catch {
      setDailyPlanError('Không thể tải danh sách đơn hàng theo ngày.');
      setDailyPlanDetail(null);
    } finally {
      setDailyPlanLoading(false);
    }
  }, [mainTab, selectedCalendarDate, orderLookup]);

  useEffect(() => {
    fetchDailyPlan();
  }, [fetchDailyPlan]);

  useEffect(() => {
    const firstDay = toYmd(new Date(calendarYear, calendarMonth - 1, 1));
    setSelectedCalendarDate(firstDay);
  }, [calendarYear, calendarMonth]);

  useEffect(() => {
    setShowDailyPrepPlan(false);
  }, [selectedCalendarDate]);

  // Enrich visible orders when page or orders change
  useEffect(() => {
    const enrichVisibleOrders = async () => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      const visibleOrders = orders.slice(startIndex, startIndex + itemsPerPage);

      const ordersToEnrich = visibleOrders.filter(o => !enrichedData[o.orderId] || (!enrichedData[o.orderId].customerName && !o.customerName));

      if (ordersToEnrich.length === 0) return;

      console.log(`🔍 Enriching ${ordersToEnrich.length} orders...`);

      const results = await Promise.allSettled(
        ordersToEnrich.map(o => orderService.getVendorOrderDetails(o.orderId))
      );

      const newEnrichments: Record<string, EnrichedOrderData> = { ...enrichedData };
      results.forEach((res, index) => {
        if (res.status === 'fulfilled' && res.value) {
          const orderId = ordersToEnrich[index].orderId;

          const itemImageByItemId: Record<string, string | null> = {};
          (res.value.items || []).forEach((it) => {
            itemImageByItemId[String(it.itemId)] = it.imageUrl || null;
          });

          newEnrichments[orderId] = {
            customerName: res.value.customer?.fullName || res.value.customerName,
            customerAvatar: res.value.customerAvatar || (res.value.customer as any)?.avatarUrl || '',
            customerPhone: res.value.customerPhone || res.value.customer?.phoneNumber,
            itemImageByItemId,
            items: res.value.items as unknown as VendorOrderItem[],
          };
        }
      });

      setEnrichedData(prev => ({ ...prev, ...newEnrichments }));
    };

    if (orders.length > 0) {
      enrichVisibleOrders();
    }
  }, [orders, currentPage, itemsPerPage]); // Removed enrichedData to avoid infinite loop

  // ── update order status ─────────────────────────────────────────────────────
  const handleUpdateStatus = async () => {
    if (!selectedOrder || !newStatus) return;
    if ((newStatus === 'Delivered' || newStatus === 'Delivering') && deliveryProofImages.length === 0) {
      const fieldRequired = newStatus === 'Delivering' ? 'ảnh chuẩn bị' : 'ảnh chứng minh';
      setStatusError(`Vui lòng cung cấp ít nhất 1 ${fieldRequired}.`);
      return;
    }
    const oversizedFiles = deliveryProofImages.filter(file => file.size > 1 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setStatusError(`Ảnh ${oversizedFiles[0].name} quá lớn (>1MB). Vui lòng chọn ảnh nhỏ hơn.`);
      return;
    }

    let formattedDeliveryTime: string | undefined;
    if (newStatus === 'Confirmed') {
      if (!estimatedDelivery) {
        setStatusError('Vui lòng chọn thời gian giao hàng dự kiến.');
        return;
      }
      // estimatedDelivery now only holds the time string "HH:mm" (e.g. "17:00")
      // We combine it with selectedOrder.delivery.deliveryDate (YYYY-MM-DD) to form "YYYY-MM-DDTHH:mm:ss"
      const datePart = selectedOrder?.delivery?.deliveryDate
        ? selectedOrder.delivery.deliveryDate.substring(0, 10)
        : toYmd(new Date());
      formattedDeliveryTime = `${datePart}T${estimatedDelivery}:00`;
    }

    setStatusUpdating(true);
    setStatusError(null);
    setStatusSuccess(null);
    try {
      if (newStatus === 'Cancelled') {
        await orderService.cancelOrder(selectedOrder.orderId, statusReason, 'vendor');
      } else {
        await orderService.updateOrderStatus(
          selectedOrder.orderId,
          newStatus,
          statusReason,
          deliveryProofImages,
          formattedDeliveryTime
        );
      }
      const [detail, list] = await Promise.all([
        orderService.getVendorOrderDetails(selectedOrder.orderId),
        orderService.getVendorOrders(),
      ]);
      setSelectedOrder(detail);
      setOrders(list);
      setNewStatus('');
      setStatusReason('');
      setDeliveryProofImages([]);
      setEstimatedDelivery('');
      setStatusSuccess(
        newStatus === 'Delivered' ? 'Đơn hàng đã giao thành công. Khách hàng sẽ xác nhận để hoàn thành đơn.' :
          newStatus === 'Cancelled' ? 'Đơn hàng đã được hủy thành công.' :
            (newStatus === 'Delivering' || newStatus === 'Shipping') ? 'Bắt đầu giao hàng! Khách hàng đã có thể theo dõi vị trí.' :
              'Cập nhật trạng thái thành công!'
      );
    } catch (e: any) {
      setStatusError(e.message || 'Cập nhật thất bại. Vui lòng thử lại.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const openDetail = async (orderId: string) => {
    setSelectedOrder(null);
    setDetailLoading(true);
    setStatusError(null);
    try {
      const detail = await orderService.getVendorOrderDetails(orderId);
      if (!detail) {
        throw new Error("Không tìm thấy dữ liệu đơn hàng.");
      }
      setSelectedOrder(detail);
    } catch (e: any) {
      console.error("Open detail error:", e);
      setStatusError("Lỗi khi tải chi tiết đơn hàng: " + (e.message || "Vui lòng thử lại sau."));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeOrderDetail = () => {
    setSelectedOrder(null);
    setSelectedDailyPlanItem(null);
    setNewStatus('');
    setStatusReason('');
    setStatusError(null);
    setStatusSuccess(null);
    setDeliveryProofImages([]);
    setEstimatedDelivery('');
    setShowTimePicker(false);
  };

  const handlePauseOrders = () => {
    setPauseDates([toYmd(new Date())]); // Default to today
    setPauseNote('');
    setShowPauseModal(true);
  };

  const submitPauseOrders = async () => {
    if (pauseDates.length === 0) {
      showError('Vui lòng chọn ít nhất một ngày.');
      return;
    }

    setPausingOrders(true);
    try {
      const response = await vendorService.setDayOff(pauseDates, pauseNote);
      if (response.isSuccess) {
        showSuccess('Đã tạm dừng nhận đơn thành công!');
        setShowPauseModal(false);
        fetchCalendarOrders();
      } else {
        showError(response.errorMessages?.[0] || 'Không thể tạm dừng nhận đơn. Vui lòng thử lại.');
      }
    } catch (error) {
      console.error('Pause orders error:', error);
      showError('Lỗi kết nối hệ thống.');
    } finally {
      setPausingOrders(false);
    }
  };

  const handlePauseSelectedDay = async () => {
    const result = await showPrompt({
      title: 'Tạm dừng nhận đơn',
      text: `Nhập lý do tạm dừng cho ngày ${formatYmdToVi(selectedCalendarDate)}:`,
      inputPlaceholder: 'Ví dụ: Nghỉ lễ, việc riêng...',
      confirmButtonText: 'Xác nhận tạm dừng',
    });

    if (!result.isConfirmed) return;

    const reason = result.value || 'Tạm dừng thủ công';

    setPausingOrders(true);
    try {
      const response = await vendorService.setDayOff([selectedCalendarDate], reason);
      if (response.isSuccess) {
        showSuccess('Đã tạm dừng nhận đơn thành công!');
        fetchCalendarOrders();
      } else {
        showError(response.errorMessages?.[0] || 'Thao tác thất bại.');
      }
    } catch (error) {
      console.error('Pause day error:', error);
      showError('Lỗi kết nối hệ thống.');
    } finally {
      setPausingOrders(false);
    }
  };

  const handleRemoveDayOff = async () => {
    const confirmed = await showConfirm({
      title: 'Mở lại nhận đơn',
      text: `Bạn có chắc chắn muốn mở lại nhận đơn cho ngày ${formatYmdToVi(selectedCalendarDate)}?`,
      icon: 'question'
    });

    if (!confirmed.isConfirmed) {
      return;
    }

    setPausingOrders(true);
    try {
      const response = await vendorService.removeDayOff(selectedCalendarDate);
      if (response.isSuccess) {
        showSuccess('Đã mở lại nhận đơn thành công!');
        fetchCalendarOrders();
      } else {
        showError(response.errorMessages?.[0] || 'Không thể mở lại nhận đơn. Vui lòng thử lại.');
      }
    } catch (error) {
      console.error('Remove day off error:', error);
      showError('Lỗi kết nối hệ thống.');
    } finally {
      setPausingOrders(false);
    }
  };

  // ── derived ─────────────────────────────────────────────────────────────────
  const filteredOrders = orders
    .filter(o => filterStatus === 'all' || normalizeStatus(o.orderStatus) === filterStatus)
    .filter(o => {
      if (!fromDate && !toDate) return true;
      const d = parseDate(o.createdAt);
      if (!d) return false;
      const ymd = toYmd(d);
      if (fromDate && ymd < fromDate) return false;
      if (toDate && ymd > toDate) return false;
      return true;
    });

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedOrders = filteredOrders.slice(
    (safeCurrentPage - 1) * itemsPerPage,
    safeCurrentPage * itemsPerPage,
  );

  const calendarOrdersByDate = useMemo(() => {
    return calendarOrders.reduce<Record<string, VendorOrderCalendarItem>>((acc, item) => {
      const key = getCalendarDateKey(item.date);
      if (!key) return acc;
      acc[key] = item;
      return acc;
    }, {});
  }, [calendarOrders]);

  const selectedDaySummary = useMemo(() => {
    return calendarOrdersByDate[selectedCalendarDate] || null;
  }, [calendarOrdersByDate, selectedCalendarDate]);

  const handlePrevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear((prev) => prev - 1);
    } else {
      setCalendarMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear((prev) => prev + 1);
    } else {
      setCalendarMonth((prev) => prev + 1);
    }
  };

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, fromDate, toDate, mainTab]);

  // Consolidated preparation data
  const preparationItems: PreparationItem[] = orders
    .filter(o => ['Confirmed', 'Processing'].includes(normalizeStatus(o.orderStatus)))
    .filter(o => {
      // Default to showing today's preparation
      const d = parseDate(o.createdAt);
      const deliveryDate = parseDate(o.deliveryDate);
      if (!deliveryDate) return false;
      const ymd = toYmd(deliveryDate);

      if (fromDate && ymd < fromDate) return false;
      if (toDate && ymd > toDate) return false;

      // If no filter, show everything confirmed/processing
      return true;
    })
    .sort((a, b) => {
      const dateA = `${a.deliveryDate}T${a.deliveryTime || '00:00'}`;
      const dateB = `${b.deliveryDate}T${b.deliveryTime || '00:00'}`;
      return dateA.localeCompare(dateB);
    })
    .flatMap(o => {
      const enrichment = enrichedData[o.orderId] || {};
      const items = (enrichment.items || o.items || []) as VendorOrderItem[];
      return items.map(it => ({
        id: `${o.orderId}-${it.itemId}`,
        name: it.packageName,
        variant: it.variantName,
        quantity: it.quantity,
        orderId: o.orderId,
        deliveryTime: o.deliveryTime?.slice(0, 5) || 'N/A',
        customerName: enrichment.customerName || o.customerName || 'Khách hàng',
        addOns: (it.addOns || []).map(a => ({ name: a.addOnName || a.itemName || 'Món kèm', quantity: a.quantity })),
        swaps: (it.swaps || []).map(s => s.replacementItemName || s.replacementDescription || s.originalItemName || 'Thay thế'),
        isPrepared: false // In a real app, this would be persisted
      }));
    });

  useEffect(() => {
    setFromDateText(formatYmdToVi(fromDate));
  }, [fromDate]);

  useEffect(() => {
    setToDateText(formatYmdToVi(toDate));
  }, [toDate]);

  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (currentTab !== mainTab) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('tab', mainTab);
      setSearchParams(newParams, { replace: true });
    }
  }, [mainTab, searchParams, setSearchParams]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    const orderId = searchParams.get('orderId');

    if (tab === 'refund' || tab === 'refunds') {
      setMainTab('refunds');
    }

    if (orderId) {
      openDetail(orderId);
    }
  }, [searchParams]);

  // ── loading / error screens ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-primary mb-4" />
          <p className="text-black font-medium">Đang tải danh sách đơn hàng...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-white">
        <div className="text-center bg-white rounded-3xl shadow-sm border border-gray-200 p-10 max-w-sm w-full">
          <p className="text-red-500 font-semibold text-base mb-6">⚠️ {error}</p>
          <button
            onClick={fetchOrders}
            className="bg-primary text-white font-bold py-3 px-8 rounded-xl hover:bg-primary/90 transition"
          >Thử lại</button>
        </div>
      </div>
    );
  }

  const hasDailyPrepPlan = Boolean(
    dailyPlanDetail && Array.isArray(dailyPlanDetail.variantsToPrepare) && dailyPlanDetail.variantsToPrepare.length > 0
  );

  return (
    <div className="bg-white min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 md:px-8">

        {/* Header Section */}
        <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-start gap-5">
            {/* <button
              onClick={() => _onNavigate('/vendor/dashboard')}
              className="px-6 py-4 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-700 flex-shrink-0 hover:bg-slate-50 hover:text-black transition-all group font-black text-[10px] uppercase tracking-widest"
            >
              Quay lại Dashboard
            </button> */}
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Đơn Hàng</h1>
              <p className="text-black font-bold text-sm">Theo dõi và xử lý các đơn hàng của bạn.</p>
            </div>
          </div>

          <button
            onClick={handlePauseOrders}
            disabled={pausingOrders}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-sm border ${pausingOrders
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
              : 'bg-white text-red-600 border-red-100 hover:bg-red-50 hover:border-red-200'
              }`}
          >
            <span className="material-symbols-outlined text-xl">
              {pausingOrders ? 'hourglass_empty' : 'pause_circle'}
            </span>
            {pausingOrders ? 'Đang xử lý...' : 'Tạm dừng nhận đơn'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Tổng đơn', value: orders.length, color: 'text-primary' },
            { label: 'Đã giao', value: orders.filter(o => ['Delivered', 'Completed'].includes(normalizeStatus(o.orderStatus))).length, color: 'text-green-600' },
            { label: 'Chờ xử lý', value: orders.filter(o => ['Paid', 'Confirmed', 'Processing', 'Delivering', 'Pending'].includes(normalizeStatus(o.orderStatus))).length, color: 'text-amber-600' },
            { label: 'Doanh thu', value: `${(orders.reduce((s, o) => s + (Number(o.vendorNetAmount) || 0), 0) / 1_000_000).toFixed(1)}M ₫`, color: 'text-blue-600' },
            { label: 'Yêu cầu hoàn', value: pendingRefunds, color: 'text-orange-500' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs font-bold text-black uppercase tracking-widest mb-1">{s.label}</p>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-6 bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm w-fit">
          {(['orders', 'refunds', 'reviews'] as const).map(id => (
            <button
              key={id}
              onClick={() => setMainTab(id)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${mainTab === id
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-black hover:text-slate-800 hover:bg-gray-50'
                }`}
            >
              {id === 'refunds' && pendingRefunds > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-black bg-orange-500 text-white rounded-full">
                  {pendingRefunds}
                </span>
              )}
              {id === 'orders' ? 'Đơn Hàng' : (id === 'refunds' ? 'Yêu cầu hoàn tiền' : 'Đánh giá')}
            </button>
          ))}
        </div>


        {mainTab === 'orders' && (
          <>
            {/* Calendar view */}
            <div className="mb-8 grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-6">
              <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Lịch đơn hàng</h3>
                    <p className="text-xs text-slate-500 font-semibold">{formatMonthLabel(calendarYear, calendarMonth)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="size-9 rounded-xl border border-gray-200 bg-white text-slate-700 hover:bg-gray-50 transition"
                      aria-label="Tháng trước"
                    >
                      <span className="material-symbols-outlined text-lg">chevron_left</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="size-9 rounded-xl border border-gray-200 bg-white text-slate-700 hover:bg-gray-50 transition"
                      aria-label="Tháng sau"
                    >
                      <span className="material-symbols-outlined text-lg">chevron_right</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  {WEEKDAY_LABELS.map(label => (
                    <div key={label} className="text-center py-1 rounded-lg bg-slate-50 text-slate-500">{label}</div>
                  ))}
                </div>

                {calendarLoading ? (
                  <div className="py-16 text-center">
                    <div className="inline-block animate-spin rounded-full h-9 w-9 border-t-4 border-b-4 border-primary mb-3" />
                    <p className="text-slate-500 font-bold">Đang tải lịch...</p>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {getMonthMatrix(calendarYear, calendarMonth).map((week, wIdx) => (
                      <div key={wIdx} className="grid grid-cols-7 gap-2">
                        {week.map((day, dIdx) => {
                          if (!day) {
                            return <div key={`empty-${wIdx}-${dIdx}`} className="h-24 rounded-2xl bg-slate-50" />;
                          }

                          const ymd = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const daySummary = calendarOrdersByDate[ymd];
                          const totalOrders = daySummary?.totalOrders || 0;
                          const isSelected = selectedCalendarDate === ymd;
                          const isToday = ymd === getTodayYmd();

                          return (
                            <button
                              key={ymd}
                              type="button"
                              onClick={() => setSelectedCalendarDate(ymd)}
                              className={`group h-28 rounded-2xl border text-left p-2.5 transition-all relative overflow-hidden ${isSelected
                                ? daySummary?.isClosed
                                  ? 'border-red-500 bg-red-100/50 shadow-md ring-2 ring-red-500/20'
                                  : 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/10'
                                : daySummary?.isClosed
                                  ? 'border-red-300 bg-red-50 shadow-sm'
                                  : daySummary?.capacityStatus?.toLowerCase() === 'warning'
                                    ? 'border-amber-400 bg-amber-50/30'
                                    : 'border-gray-100 bg-white hover:bg-slate-50 hover:border-slate-300'
                                }`}
                            >
                              <div className="flex flex-col h-full">
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`text-xs font-black ${isToday ? 'text-primary' : daySummary?.isClosed ? 'text-red-700' : 'text-slate-500'}`}>{day}</span>
                                  {daySummary?.isClosed && (
                                    <span className="material-symbols-outlined text-sm text-red-500 opacity-60">lock</span>
                                  )}
                                </div>

                                <div className="flex-1 space-y-1">
                                  {totalOrders > 0 && (
                                    <div className="flex flex-col">
                                      <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md w-fit">
                                        {totalOrders} đơn hàng
                                      </span>
                                      <span className="text-[9px] font-bold text-slate-900 mt-1 leading-none truncate">
                                        {daySummary?.totalRevenue && daySummary.totalRevenue >= 1000000
                                          ? `${(daySummary.totalRevenue / 1000000).toFixed(1).replace('.0', '')}Mđ`
                                          : formatVnd(daySummary?.totalRevenue || 0)}
                                      </span>
                                    </div>
                                  )}

                                  {daySummary?.isClosed ? (
                                    <div className="mt-auto">
                                      {/* <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-sm ${
                                        daySummary.closeReason === 'Manual' ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-700'
                                      }`}>
                                        TẠM ĐÓNG
                                      </span> */}
                                      <p className="text-[9px] text-slate-400 italic mt-0.5 leading-tight truncate">
                                        {daySummary.closeReason === 'Manual' ? '"Nghỉ có việc riêng"' : '"Tự động đóng: đạt giới hạn"'}
                                      </p>
                                    </div>
                                  ) : daySummary?.capacityStatus?.toLowerCase() === 'warning' ? (
                                    <div className="mt-auto">
                                      <span className="text-[10px] font-black text-amber-700">SẮP ĐẦY</span>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Chi tiết ngày {formatYmdToVi(selectedCalendarDate)}</h3>
                    <p className="text-xs text-slate-500 font-semibold">{dailyPlanItems.length} đơn hàng</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedDaySummary?.isClosed ? (
                      <button
                        type="button"
                        onClick={handleRemoveDayOff}
                        disabled={pausingOrders}
                        className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs font-black uppercase tracking-widest transition border border-emerald-100"
                      >
                        {pausingOrders ? '...' : 'Mở nhận đơn'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handlePauseSelectedDay}
                        disabled={pausingOrders}
                        className="px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 text-xs font-black uppercase tracking-widest transition border border-red-100"
                      >
                        {pausingOrders ? '...' : 'Tạm đóng ngày này'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowDailyPrepPlan(true)}
                      disabled={!hasDailyPrepPlan}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition ${hasDailyPrepPlan
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                      Kế hoạch chuẩn bị ngày hôm nay
                    </button>
                    {(calendarError || dailyPlanError) && (
                      <button
                        type="button"
                        onClick={() => {
                          fetchCalendarOrders();
                          fetchDailyPlan();
                        }}
                        className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-black text-black hover:bg-gray-50"
                      >
                        Thử lại
                      </button>
                    )}
                  </div>
                </div>

                {calendarError && (
                  <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                    {calendarError}
                  </div>
                )}

                {dailyPlanError && (
                  <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                    {dailyPlanError}
                  </div>
                )}

                {calendarLoading || dailyPlanLoading ? (
                  <div className="py-14 text-center">
                    <div className="inline-block animate-spin rounded-full h-9 w-9 border-t-4 border-b-4 border-primary mb-3" />
                    <p className="text-slate-500 font-bold">Đang tải chi tiết...</p>
                  </div>
                ) : dailyPlanItems.length === 0 ? (
                  <div className="py-12 text-center border border-dashed border-gray-200 rounded-2xl">
                    <div className="size-14 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                      <span className="material-symbols-outlined text-slate-300 text-3xl">event_busy</span>
                    </div>
                    <p className="text-sm font-bold text-slate-500">Không có đơn hàng cho ngày này.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dailyPlanItems.map((item, idx) => {
                      const status = getStatusBadge(item.status || 'Pending');
                      return (
                        <button
                          key={`${item.orderId}-${idx}`}
                          type="button"
                          onClick={() => {
                            setSelectedDailyPlanItem(item);
                            openDetail(item.orderId);
                          }}
                          className="flex w-full items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-gray-50/60 px-4 py-3 text-left transition hover:bg-white hover:shadow-sm"
                        >
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                              {formatOrderCode(item.orderId)}
                            </p>
                            <p className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                              <span className="material-symbols-outlined text-[14px]">alarm</span>
                              Hẹn giao: {item.deliveryTime || 'N/A'}
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${status.badge}`}>
                            {item.statusLabel || status.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Status tabs */}
            <div className="flex flex-wrap gap-1 pb-4 mb-8 border-b border-gray-200">
              {ORDER_STATUS_TABS.map(tab => (
                <button key={tab.id} onClick={() => setFilterStatus(tab.id)}
                  className={`whitespace-nowrap px-5 py-3 rounded-t-xl font-bold text-sm transition-all border-b-2 ${filterStatus === tab.id
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-black hover:text-slate-800 hover:bg-gray-100'
                    }`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Order cards */}
            <div className="space-y-6">
              {filteredOrders.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl border border-gray-200 shadow-sm text-center">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Chưa có đơn hàng nào</h3>
                  <p className="text-gray-500">Không có đơn hàng nào ở trạng thái này.</p>
                </div>
              ) : (
                paginatedOrders.map(order => {
                  const cfg = getStatusBadge(order.orderStatus);
                  const enrichment = enrichedData[order.orderId] || {};
                  return (
                    <div key={order.orderId} className="bg-white rounded-[2rem] border border-gray-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">

                      {/* Card header */}
                      {(() => {
                        const enrichment = enrichedData[order.orderId] || {};
                        const displayName = enrichment.customerName || order.customerName || 'Khách hàng';

                        const displayPhone = enrichment.customerPhone || order.customerPhone;

                        return (
                          <div className="p-6 md:p-8 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center border-b border-gray-100 bg-gray-50/50">
                            <div className="flex flex-col md:flex-row gap-6 md:items-center">
                              <div className="flex items-center gap-3">
                                {/* {displayAvatar ? (
                                  <img src={displayAvatar} alt={displayName} className="size-12 rounded-full object-cover border-2 border-white shadow-sm" />
                                ) : (
                                  <div className={`size-12 rounded-full ${getAvatarColor(displayName)} flex items-center justify-center text-white font-bold text-lg border-2 border-white shadow-sm`}>
                                    {getInitials(displayName)}
                                  </div>
                                )} */}
                                <div>
                                  <span className="text-xs font-bold uppercase text-black tracking-widest block mb-0.5">Khách hàng</span>
                                  <span className="text-gray-900 font-bold text-lg">{displayName}</span>
                                  {displayPhone && (
                                    <span className="text-xs text-black block">{displayPhone}</span>
                                  )}
                                </div>
                              </div>

                              <div className="hidden md:block w-px h-8 bg-gray-200" />

                              <div>
                                <span className="text-xs font-bold uppercase text-black tracking-widest block mb-1">Cửa hàng</span>
                                <span className="text-gray-900 font-semibold">{vendorShopName || order.vendorName || 'N/A'}</span>
                              </div>

                              <div className="hidden md:block w-px h-8 bg-gray-200" />
                              <div>
                                <span className="text-xs font-bold uppercase text-black tracking-widest block mb-1">Ngày đặt</span>
                                <span className="text-gray-900 font-medium">{formatDateTimeVi(order.createdAt)}</span>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-sm ${getStatusBadge(order.orderStatus).badge}`}>
                                {getStatusBadge(order.orderStatus).label}
                              </span>
                              <div className="flex items-center gap-1.5 text-black">
                                <span className="text-[11px] font-bold uppercase tracking-wider">Giao hàng:</span>
                                <span className="text-xs font-semibold text-black">
                                  {formatDateVi(order.deliveryDate)} lúc {order.deliveryTime?.slice(0, 5) || '00:00'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Card body – items */}
                      <div className="p-6 md:p-8">
                        <div className="space-y-4">
                          {(() => {
                            const displayItems = (enrichment.items || order.items || []) as VendorOrderItem[];
                            return displayItems.map(item => (
                              <div key={item.itemId} className="flex gap-4 items-start py-2 border-b border-gray-50 last:border-0 translate-y-2">
                                <div className="size-16 rounded-xl bg-gray-100 border border-gray-200 flex-shrink-0 overflow-hidden">
                                  <img
                                    src={toImageSrc(enrichment.itemImageByItemId?.[String(item.itemId)] ?? item.imageUrl)}
                                    alt={item.packageName}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const img = e.currentTarget;
                                      if (img.src !== fallbackProductImage) img.src = fallbackProductImage;
                                    }}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-bold text-gray-800 text-base">{item.packageName}</h5>
                                  <p className="text-sm text-black mt-0.5">Gói: {item.variantName} × {item.quantity}</p>

                                  {/* Swaps in list card */}
                                  {Array.isArray(item.swaps) && item.swaps.length > 0 && (
                                    <div className="mt-1 space-y-0.5">
                                      {item.swaps.map((swap, si) => (
                                        <div key={si} className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                          <span className="material-symbols-outlined text-[12px]">swap_horiz</span>
                                          <span className="truncate">{swap.replacementDescription || `${swap.originalItemName} → ${swap.replacementItemName}`}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Add-ons in list card */}
                                  {Array.isArray(item.addOns) && item.addOns.length > 0 && (
                                    <div className="mt-1 space-y-0.5">
                                      {item.addOns.map((addOn, ai) => (
                                        <div key={ai} className="flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                          <span className="material-symbols-outlined text-[12px]">add_circle</span>
                                          <span className="truncate">{addOn.addOnName || addOn.itemName} x{addOn.quantity}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {item.decorationNote && (
                                    <p className="text-[11px] text-amber-600 mt-1 italic leading-tight">Ghi chú: {item.decorationNote}</p>
                                  )}
                                  {item.isRequestRefund && (
                                    <div className="mt-1 flex">
                                      <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded text-[9px] font-black uppercase tracking-tighter border border-orange-100 flex items-center gap-1">
                                        <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3" />
                                        </svg>
                                        Khách hoàn tiền
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="font-bold text-primary text-base">{formatVnd(item.lineTotal)}</p>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>

                        {/* Delivery address */}
                        <div className="mt-4 p-3 bg-blue-50 rounded-xl">
                          <p className="text-xs text-blue-400 font-semibold uppercase tracking-wide mb-1">Địa chỉ giao</p>
                          <p className="text-sm text-gray-700">{order.deliveryAddress}</p>
                        </div>
                      </div>

                      {/* Card footer */}
                      <div className="p-6 md:p-8 pt-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm text-gray-500">Tổng cộng (đã gồm ship):</span>
                            <span className="text-2xl font-black text-primary">{formatVnd(order.totalAmount)}</span>
                          </div>
                          {order.finalAmount && order.finalAmount !== order.totalAmount && (
                            <p className="text-xs text-black mt-1">Sơ bộ: {formatVnd(order.totalAmount)} · Thực nhận: {formatVnd(order.finalAmount)}</p>
                          )}
                        </div>
                        <button
                          onClick={() => openDetail(order.orderId)}
                          disabled={detailLoading}
                          className="bg-primary text-white font-bold py-3 px-6 rounded-xl hover:bg-primary/90 transition shadow-lg shadow-primary/20 disabled:opacity-60 w-full sm:w-auto"
                        >
                          {detailLoading ? 'Đang tải...' : 'Xem chi tiết'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {filteredOrders.length > itemsPerPage && (
              <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-3 border border-gray-200 rounded-2xl bg-white px-4 md:px-6 py-4">
                <p className="text-sm text-black">
                  Hiển thị{' '}
                  <span className="font-semibold">{(safeCurrentPage - 1) * itemsPerPage + 1}</span>
                  {' - '}
                  <span className="font-semibold">{Math.min(safeCurrentPage * itemsPerPage, filteredOrders.length)}</span>
                  {' / '}
                  <span className="font-semibold">{filteredOrders.length}</span>
                  {' đơn hàng'}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={safeCurrentPage === 1}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Trước
                  </button>

                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-9 h-9 px-2 rounded-lg text-sm font-bold transition-all ${safeCurrentPage === page
                        ? 'bg-primary text-white'
                        : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={safeCurrentPage === totalPages}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </>
        )}




        {mainTab === 'refunds' && (
          <VendorRefundTab onPendingCount={setPendingRefunds} />
        )}

        {mainTab === 'reviews' && (
          <VendorReviewTab />
        )}

      </div>

      {detailLoading && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 shadow-2xl text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-primary mb-3" />
            <p className="text-black font-medium">Đang tải chi tiết đơn hàng...</p>
          </div>
        </div>
      )}

      {showDailyPrepPlan && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto"
          onClick={() => setShowDailyPrepPlan(false)}
        >
          <div
            className="bg-gray-50 w-full max-w-5xl my-4 rounded-[2rem] shadow-2xl overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white px-6 md:px-8 py-5 flex items-center justify-between gap-4 border-b border-gray-100">
              <div>
                <h2 className="text-2xl font-black text-gray-900">Kế hoạch chuẩn bị ngày hôm nay</h2>
                <p className="text-sm text-slate-500 font-semibold mt-1">
                  Ngày: <span className="text-slate-900 font-bold">{formatYmdToVi(selectedCalendarDate)}</span>
                </p>
              </div>
              <button
                onClick={() => setShowDailyPrepPlan(false)}
                className="px-5 py-2.5 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-200 hover:bg-gray-50 transition flex-shrink-0 font-bold text-xs uppercase tracking-widest text-gray-600"
              >
                Đóng
              </button>
            </div>

            <div className="p-4 md:p-6 overflow-y-auto">
              {!dailyPlanDetail || dailyPlanDetail.variantsToPrepare.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                  <div className="size-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-slate-300 text-3xl">inventory_2</span>
                  </div>
                  <p className="text-sm font-bold text-slate-500">Không có đơn hàng cần chuẩn bị cho ngày này.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                  <div className="xl:col-span-4 space-y-6">
                    <div className="bg-white rounded-[2.5rem] border border-gray-200 overflow-hidden shadow-sm sticky top-6">
                      <div className="p-6 border-b border-gray-100 bg-emerald-50/30">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm shadow-emerald-100 text-emerald-600 border border-emerald-100">
                            <span className="material-symbols-outlined">shopping_basket</span>
                          </div>
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Tổng món kèm cần soạn</h4>
                        </div>
                      </div>
                      <div className="p-6 space-y-3">
                        {(dailyPlanDetail.totalAddOnsToPrepare || []).map((ao: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-gray-50/50 rounded-2xl border border-gray-100 hover:bg-emerald-50/50 hover:border-emerald-100 transition-all group">
                            <div className="flex items-center gap-3">
                              <div className="size-2 rounded-full bg-emerald-400" />
                              <span className="text-sm font-bold text-slate-700 group-hover:text-emerald-900 transition-colors">{ao.addOnName}</span>
                            </div>
                            <div className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-sm font-black text-emerald-600">
                              x{ao.totalQuantity}
                            </div>
                          </div>
                        ))}
                        {(!dailyPlanDetail.totalAddOnsToPrepare || dailyPlanDetail.totalAddOnsToPrepare.length === 0) && (
                          <p className="text-center text-sm text-slate-400 italic py-4">Không có món kèm nào</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="xl:col-span-8 space-y-6">
                    <div className="bg-white rounded-[2.5rem] border border-gray-200 overflow-hidden shadow-sm">
                      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Chi tiết gói lễ &amp; Phân bổ</h4>
                        <div className="px-3 py-1 bg-primary/10 rounded-lg text-xs font-black text-primary">
                          {dailyPlanDetail.totalPendingOrders} đơn hàng
                        </div>
                      </div>

                      <div className="divide-y divide-gray-100">
                        {dailyPlanDetail.variantsToPrepare.map((variant: any, vIdx: number) => (
                          <div key={vIdx} className="p-5">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-1 h-9 rounded-full bg-primary flex-shrink-0" />
                                <div>
                                  <h5 className="font-black text-slate-900 text-sm leading-tight">{variant.packageName}</h5>
                                  <p className="text-[11px] font-bold text-primary/80 mt-0.5 uppercase tracking-wide">{variant.variantName}</p>
                                </div>
                              </div>
                              <div className="bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap">
                                Tổng {variant.totalQuantityRequired} Món
                              </div>
                            </div>

                            <div className="space-y-2 ml-4 border-l-2 border-gray-100 pl-4">
                              {(variant.allocations || []).map((alloc: any, aIdx: number) => (
                                <button
                                  key={aIdx}
                                  type="button"
                                  onClick={() => {
                                    const matched = dailyPlanItems.find((item) => item.orderId === alloc.orderId);
                                    setSelectedDailyPlanItem({
                                      orderId: alloc.orderId,
                                      deliveryTime: (alloc.deliveryTime || '').slice(0, 5) || matched?.deliveryTime,
                                      status: matched?.status,
                                    });
                                    setShowDailyPrepPlan(false);
                                    openDetail(alloc.orderId);
                                  }}
                                  className="w-full bg-gray-50 rounded-xl border border-gray-100 px-4 py-3 text-left transition hover:bg-white hover:shadow-sm"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatOrderCode(alloc.orderId)}</span>
                                      <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded-md">
                                        {(alloc.deliveryTime || '').slice(0, 5) || 'N/A'}
                                      </span>
                                    </div>
                                    <span className="text-sm font-black text-slate-800">×{alloc.allocatedQuantity} Món</span>
                                  </div>

                                  {(Array.isArray(alloc.swaps) && alloc.swaps.length > 0)
                                    || (Array.isArray(alloc.addOns) && alloc.addOns.length > 0)
                                    || hasMeaningfulText(alloc.decorationNote) ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {(alloc.swaps || []).map((s: string, sIdx: number) => (
                                        <span key={sIdx} className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold">
                                          {String(s).replace(/🔄\s*/g, '').replace(/^Đổi:\s*/i, '').trim()}
                                        </span>
                                      ))}
                                      {(alloc.addOns || []).map((a: string, aIdx2: number) => (
                                        <span key={aIdx2} className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-semibold">
                                          {String(a).replace(/^\+\s*/g, '').trim()}
                                        </span>
                                      ))}
                                      {hasMeaningfulText(alloc.decorationNote) && (
                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-500 text-[10px] italic">
                                          {alloc.decorationNote}
                                        </span>
                                      )}
                                    </div>
                                  ) : null}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedOrder && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto"
          onClick={closeOrderDetail}
        >
          <div
            className="bg-gray-50 w-full max-w-6xl my-4 rounded-[2rem] shadow-2xl overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="bg-white px-6 md:px-8 py-5 flex items-center gap-4 border-b border-gray-100">
              <button
                onClick={closeOrderDetail}
                className="px-5 py-2.5 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-200 hover:bg-gray-50 transition flex-shrink-0 font-bold text-xs uppercase tracking-widest text-gray-600"
              >
                Đóng
              </button>
              <div className="flex-1 flex items-center gap-4">
                {/* {selectedOrder.customer?.avatarUrl || selectedOrder.customerAvatar ? (
                  <img src={selectedOrder.customer?.avatarUrl || selectedOrder.customerAvatar} alt={selectedOrder.customer?.fullName} className="size-12 rounded-full object-cover border-2 border-white shadow-sm" />
                ) : (
                  <div className={`size-12 rounded-full ${getAvatarColor(selectedOrder.customer?.fullName || 'C')} flex items-center justify-center text-white font-bold text-lg border-2 border-white shadow-sm`}>
                    {getInitials(selectedOrder.customer?.fullName || 'C')}
                  </div>
                )} */}
                <div>
                  <h2 className="text-2xl font-black text-gray-900">Chi tiết đơn hàng</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    {(() => {
                      const displayCustomerName =
                        (hasMeaningfulText(selectedOrder.customer?.fullName) ? selectedOrder.customer?.fullName : '')
                        || (hasMeaningfulText(selectedOrder.customerName) ? selectedOrder.customerName : '')
                        || 'Khách hàng';

                      const displayCustomerPhone =
                        (hasMeaningfulText(selectedOrder.customer?.phoneNumber) ? selectedOrder.customer?.phoneNumber : '')
                        || (hasMeaningfulText(selectedOrder.customerPhone) ? selectedOrder.customerPhone : '');

                      return (
                        <>
                          <p className="text-sm text-gray-500">Khách: {displayCustomerName}</p>
                          {hasMeaningfulText(displayCustomerPhone) && <span className="text-gray-300">|</span>}
                          <p className="text-sm text-gray-500">{displayCustomerPhone}</p>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
              <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest flex-shrink-0 ${getStatusBadge(selectedOrder.orderStatus).badge}`}>
                {getStatusBadge(selectedOrder.orderStatus).label}
              </span>
            </div>

            <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5 overflow-y-auto">

              {/* Left column: items + delivery */}
              <div className="lg:col-span-12 space-y-4">

                {selectedOrder.delivery && (
                  <div className="bg-white rounded-[1.25rem] border border-gray-200 p-4 md:p-5 shadow-sm">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3">Lịch giao theo ngày</h3>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                        <p className="text-xs text-slate-500">
                          Ngày: <span className="font-bold text-slate-900">{formatDateVi(selectedOrder.delivery.deliveryDate)}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          Giờ: <span className="font-bold text-slate-900">{selectedOrder.delivery.deliveryTime?.slice(0, 5) || 'N/A'}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          Hạn xác nhận: <span className="font-bold text-slate-900">{formatDateTimeVi(selectedOrder.confirmDeadline || selectedOrder.createdAt)}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          Hạn giao: <span className="font-bold text-slate-900">{formatDateTimeVi(selectedOrder.deliveredDeadline)}</span>
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusBadge(selectedOrder.orderStatus).badge}`}>
                          {getStatusBadge(selectedOrder.orderStatus).label}
                        </span>
                        {selectedOrder.slaStatus && (
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${String(selectedOrder.slaStatus).toLowerCase() === 'ontime' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            SLA: {formatSlaStatusVi(selectedOrder.slaStatus)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Items */}
                <div className="bg-white rounded-[1.25rem] border border-gray-200 p-4 md:p-5 shadow-sm">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3 pb-2 border-b border-gray-100">
                    Sản phẩm ({(selectedOrder.items || []).length})
                  </h3>
                  <div className="space-y-3">
                    {(selectedOrder.items || []).map(item => (
                      <div key={item.itemId} className="flex gap-4 p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
                        <div className="size-20 rounded-xl bg-white border border-gray-200 flex-shrink-0 overflow-hidden shadow-sm">
                          <img
                            src={toImageSrc(item.imageUrl)}
                            alt={item.packageName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const img = e.currentTarget;
                              if (img.src !== fallbackProductImage) img.src = fallbackProductImage;
                            }}
                          />
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="flex justify-between items-start mb-1">
                            <div>
                              <h4 className="font-bold text-gray-900 leading-tight mb-0.5">{item.packageName}</h4>
                              <p className="text-[13px] text-black font-medium">{item.variantName} × {item.quantity}</p>
                            </div>
                            <p className="text-[12px] font-old text-blue-500">+{formatVnd(item.price)}</p>
                          </div>

                          {/* Swaps/Replacements */}
                          {Array.isArray(item.swaps) && item.swaps.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              {item.swaps.map((swap, si) => (
                                <div key={si} className="flex items-start gap-2 text-[11px] bg-amber-50 rounded-lg p-2 border border-amber-100/50">
                                  <span className="material-symbols-outlined text-amber-500 text-[16px]">swap_horiz</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-amber-900 leading-none mb-1">Thay đổi vật phẩm</p>
                                    <div className="flex justify-between items-center gap-2">
                                      <p className="text-amber-800 leading-tight truncate">
                                        {swap.replacementDescription || `${swap.originalItemName} → ${swap.replacementItemName}`}
                                      </p>
                                      {(swap.surcharge ?? 0) > 0 && <span className="font-black text-amber-600 flex-shrink-0">+{formatVnd(swap.surcharge ?? 0)}</span>}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add-ons/Extra Items */}
                          {Array.isArray(item.addOns) && item.addOns.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              {item.addOns.map((addOn, ai) => (
                                <div key={ai} className="flex items-start gap-2 text-[11px] bg-emerald-50 rounded-lg p-2 border border-emerald-100/50">
                                  <span className="material-symbols-outlined text-emerald-500 text-[16px]">add_circle</span>
                                  <div className="flex-1">
                                    <p className="font-bold text-emerald-900 leading-none mb-1">Vật phẩm thêm</p>
                                    <div className="flex justify-between items-center">
                                      <p className="text-emerald-800">{addOn.addOnName || addOn.itemName} <span className="font-black text-[10px] ml-1">×{addOn.quantity}</span></p>
                                      {(addOn.lineTotal ?? 0) > 0 && <span className="font-black text-emerald-600">+{formatVnd(addOn.lineTotal ?? 0)}</span>}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {item.decorationNote && (
                            <div className="mt-3 px-3 py-2 bg-slate-100 rounded-lg border-l-4 border-slate-300">
                              <p className="text-[11px] text-black font-black uppercase tracking-wider mb-0.5">Yêu cầu trang trí</p>
                              <p className="text-xs text-slate-700 italic">"{item.decorationNote}"</p>
                            </div>
                          )}

                          {item.isRequestRefund && (
                            <div className="mt-2 text-rose-600 bg-rose-50 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border border-rose-100 w-fit flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[14px]">undo</span>
                              Khách yêu cầu hoàn tiền
                            </div>
                          )}

                          {/* Item Total */}
                          <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center">
                            <span className="text-[10px] text-black-400 font-black uppercase tracking-[0.2em]">Tổng sản phẩm này:</span>
                            <span className="text-lg font-black text-primary">{formatVnd(item.lineTotal)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Timeline - Full Width */}
                <OrderStatusTimeline
                  orderId={selectedOrder.orderId}
                  currentStatus={selectedOrder.orderStatus}
                  trackingLists={selectedOrder.trackingLists || []}
                />

              </div>

              {/* Balanced row: delivery (left) + summary/customer (right) */}
              <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5 items-start">
                {/* Delivery info + status update - Left side */}
                <div className={selectedOrder.delivery ? 'lg:col-span-7 space-y-4' : 'lg:col-span-12 space-y-4'}>
                  {selectedOrder.delivery && (
                    <div className="bg-white rounded-[1.25rem] border border-gray-200 p-4 md:p-5 shadow-sm">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3">Thông tin giao hàng</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Ngày giao', value: formatDateVi(selectedOrder.delivery.deliveryDate) },
                          { label: 'Giờ giao', value: selectedOrder.delivery.deliveryTime?.slice(0, 5) || 'N/A' },
                          { label: 'Phí giao', value: formatVnd(selectedOrder.pricing?.shippingFee) },
                          { label: 'Khoảng cách', value: `${selectedOrder.delivery.shippingDistanceKm} km` },
                        ].map(row => (
                          <div key={row.label}>
                            <p className="text-gray-400 text-xs font-semibold uppercase">{row.label}</p>
                            <p className="font-medium text-gray-800 mt-0.5">{row.value}</p>
                          </div>
                        ))}
                      </div>

                      {hasMeaningfulText(selectedOrder.delivery.deliveryAddress) && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-xl">
                          <p className="text-xs text-blue-400 font-semibold uppercase mb-1">Địa chỉ giao</p>
                          <p className="text-sm text-gray-700 line-clamp-3">{selectedOrder.delivery.deliveryAddress}</p>
                        </div>
                      )}

                      {(() => {
                        const proof = selectedOrder.delivery.deliveryProofImageUrl;
                        const firstProof = Array.isArray(proof) ? proof[0] : proof;
                        if (!firstProof) return null;

                        const deliveryProofUrl = firstProof as string;
                        return (
                          <div className="mt-3">
                            <a
                              href={deliveryProofUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-sm font-semibold text-primary hover:underline"
                            >
                              Xem ảnh giao hàng
                            </a>
                          </div>
                        );
                      })()}

                      {Array.isArray((selectedOrder.delivery as any).preparationProofImages)
                        && (selectedOrder.delivery as any).preparationProofImages.length > 0 ? (
                        (() => {
                          const prepProofUrl = (selectedOrder.delivery as any).preparationProofImages[0] as string;
                          return (
                            <div className="mt-2">
                              <a
                                href={prepProofUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center text-sm font-semibold text-primary hover:underline"
                              >
                                Xem ảnh chuẩn bị
                              </a>
                            </div>
                          );
                        })()
                      ) : null}
                    </div>
                  )}

                  {(NEXT_STATUSES[normalizeStatus(selectedOrder.orderStatus)] ?? []).length > 0 && (
                    <div className="bg-white rounded-[1.25rem] border border-gray-200 p-4 md:p-5 shadow-sm">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3">Cập nhật trạng thái</h3>
                      <div className="space-y-2.5">
                        <select
                          value={newStatus}
                          onChange={e => {
                            const nextValue = e.target.value;
                            setNewStatus(nextValue);
                            // Only clear images if not moving to a state that requires them
                            if (nextValue !== 'Delivered' && nextValue !== 'Delivering') {
                              setDeliveryProofImages([]);
                            }

                            // Tự động chọn ngày giao hàng và tính giờ giao dự kiến mặc định
                            if (nextValue === 'Confirmed' && selectedOrder?.delivery?.deliveryTime) {
                              const timePart = selectedOrder.delivery.deliveryTime || '12:00';
                              const timeSegments = timePart.split(':');
                              const hours = Number(timeSegments[0]) || 12;
                              const minutes = Number(timeSegments[1]) || 0;

                              // Mặc định lùi lại 2 tiếng trước giờ khách nhận (nằm trong khoảng 1 - 3 tiếng)
                              let targetHours = hours - 2;
                              if (targetHours < 0) targetHours = 0;

                              const pad = (num: number) => String(num).padStart(2, '0');
                              const defaultTime = `${pad(targetHours)}:${pad(minutes)}`;
                              setEstimatedDelivery(defaultTime);
                            } else {
                              setEstimatedDelivery('');
                            }

                            setStatusError(null);
                            setStatusSuccess(null);
                          }}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
                        >
                          <option value="">-- Chọn trạng thái --</option>
                          {(NEXT_STATUSES[normalizeStatus(selectedOrder.orderStatus)] ?? []).map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                        {newStatus === 'Confirmed' && (
                          <div className="space-y-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-100 transition-all duration-300">
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider block mb-1">
                                Ngày giao hàng (Cố định theo đơn)
                              </label>
                              <div className="px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-100 text-slate-600 font-bold">
                                {selectedOrder?.delivery?.deliveryDate ? formatDateVi(selectedOrder.delivery.deliveryDate) : 'N/A'}
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider block mb-1">
                                Giờ giao hàng dự kiến <span className="text-red-500">*</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  let h24 = 17;
                                  let m = 0;
                                  if (estimatedDelivery && estimatedDelivery.includes(':')) {
                                    const parts = estimatedDelivery.split(':');
                                    h24 = Number(parts[0]) || 17;
                                    m = Number(parts[1]) || 0;
                                  }
                                  const period = h24 >= 12 ? 'PM' : 'AM';
                                  let h12 = h24 % 12;
                                  if (h12 === 0) h12 = 12;

                                  setPickerPeriod(period);
                                  setPickerHour12(String(h12).padStart(2, '0'));
                                  setPickerMinute(m);
                                  setShowTimePicker(true);
                                }}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-white text-slate-800 font-bold flex items-center justify-between hover:border-primary hover:ring-2 hover:ring-primary/10 transition"
                              >
                                <span>
                                  {estimatedDelivery ? (() => {
                                    const [h24Str, mStr] = estimatedDelivery.split(':');
                                    const h24 = Number(h24Str);
                                    const period = h24 >= 12 ? 'PM' : 'AM';
                                    let h12 = h24 % 12;
                                    if (h12 === 0) h12 = 12;
                                    return `${String(h12).padStart(2, '0')}:${mStr} ${period}`;
                                  })() : '-- Chọn giờ giao --'}
                                </span>
                                <span className="material-symbols-outlined text-slate-400 text-lg">schedule</span>
                              </button>
                            </div>

                            {selectedOrder?.delivery?.deliveryDate && selectedOrder?.delivery?.deliveryTime && (() => {
                              const timePart = selectedOrder.delivery.deliveryTime || '12:00';
                              const [hours, minutes] = timePart.split(':').map(Number);
                              const pad = (num: number) => String(num).padStart(2, '0');

                              let startHours = hours - 3;
                              if (startHours < 0) startHours = 0;

                              let endHours = hours - 1;
                              if (endHours < 0) endHours = 0;

                              const rangeStr = `${pad(startHours)}:${pad(minutes || 0)} - ${pad(endHours)}:${pad(minutes || 0)}`;
                              return (
                                <p className="text-[11px] text-amber-600 font-semibold mt-1">
                                  💡 Gợi ý: Giao từ {rangeStr} (trước giờ khách nhận từ 1 - 3 tiếng để chuẩn bị mâm cúng chu đáo). Khách nhận lúc {selectedOrder.delivery.deliveryTime?.slice(0, 5)}.
                                </p>
                              );
                            })()}
                          </div>
                        )}
                        {newStatus === 'Cancelled' && (
                          <textarea
                            value={statusReason}
                            onChange={e => setStatusReason(e.target.value)}
                            placeholder="Lý do hủy đơn..."
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                          />
                        )}
                        {(newStatus === 'Delivered' || newStatus === 'Delivering') && (
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-black">
                              {newStatus === 'Delivered' ? 'Ảnh chứng minh (Đã giao)' : 'Ảnh chuẩn bị mâm cúng'}
                            </label>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => setDeliveryProofImages(Array.from(e.target.files || []))}
                              className="w-full text-sm text-black file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                            />
                            {deliveryProofImages.length > 0 && (
                              <p className="text-xs text-black">Đã chọn {deliveryProofImages.length} ảnh</p>
                            )}
                          </div>
                        )}
                        {statusError && <p className="text-xs text-red-500 font-medium">{statusError}</p>}
                        {statusSuccess && <p className="text-xs text-green-600 font-medium">{statusSuccess}</p>}
                        <button
                          onClick={handleUpdateStatus}
                          disabled={!newStatus || statusUpdating}
                          className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition text-sm disabled:opacity-50 shadow-md shadow-primary/20"
                        >
                          {statusUpdating ? 'Đang cập nhật...' : 'Xác nhận'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Customer & Settlement - Right side */}
                <div className={selectedOrder.delivery ? 'lg:col-span-5 space-y-4' : 'lg:col-span-12 space-y-4'}>
                  {/* Order summary */}
                  <div className="bg-white rounded-[1.25rem] border border-gray-200 p-4 md:p-5 shadow-sm">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4 pb-3 border-b border-gray-100">Tóm tắt</h3>
                    <div className="text-sm divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                      {[
                        { label: 'Số lượng', value: String(selectedOrder.pricing?.totalQuantity ?? selectedOrder.items?.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) ?? 0) },
                        { label: 'Tạm tính', value: formatVnd(selectedOrder.pricing?.subTotal) },
                        { label: 'Phí giao', value: formatVnd(selectedOrder.pricing?.shippingFee) },
                        { label: 'Giảm giá', value: formatVnd(selectedOrder.pricing?.discountAmount) },
                        { label: 'Tổng đơn hàng', value: formatVnd(selectedOrder.pricing?.totalAmount), isBold: true },
                        { label: 'Hoa hồng sàn', value: `-${formatPercent(selectedOrder.pricing?.commissionRate)}`, color: 'text-rose-500' },
                        { label: 'Phí dịch vụ', value: `-${formatVnd(selectedOrder.pricing?.platformFee)}`, color: 'text-rose-500' },
                      ].map(row => (
                        <div key={row.label} className={`flex justify-between px-4 py-2.5 bg-white ${(row as any).isBold ? 'border-t border-gray-50 bg-gray-50/30' : ''}`}>
                          <span className={`${(row as any).color || 'text-gray-500'} text-[13px] font-medium`}>{row.label}</span>
                          <span className={`font-semibold ${(row as any).color || 'text-gray-800'} text-right`}>{row.value}</span>
                        </div>
                      ))}
                      <div className="flex justify-between px-4 py-3 bg-primary/5 border-t border-primary/10">
                        <span className="font-bold text-gray-700">Thực nhận</span>
                        <span className="text-xl font-black text-primary">{formatVnd(selectedOrder.pricing?.vendorNetAmount)}</span>
                      </div>
                      <div className="px-4 py-2 bg-white border-t border-gray-50">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Trạng thái đơn:</span>
                          <span className="font-bold">{getStatusBadge(selectedOrder.orderStatus).label}</span>
                        </div>
                      </div>
                      {selectedOrder.payment?.paidAt && (
                        <p className="text-xs text-black text-right px-4 py-2 bg-white">Thanh toán lúc: {formatDateTimeVi(selectedOrder.payment.paidAt)}</p>
                      )}
                    </div>

                    {hasMeaningfulText(selectedOrder.cancelReason) && (
                      <div className="mt-3 p-3 bg-red-50 rounded-xl border border-red-100">
                        <p className="text-xs text-red-500 font-semibold uppercase tracking-wide mb-1">Lý do hủy</p>
                        <p className="text-sm text-gray-700">{selectedOrder.cancelReason}</p>
                      </div>
                    )}
                  </div>

                  {/* Customer & Settlement */}

                </div>
              </div>


            </div>
          </div>
        </div>
      )}
      {/* Pause Orders Modal */}
      {showPauseModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-300">
            <div className="px-8 pt-8 pb-6 border-b border-gray-100 relative">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Tạm dừng nhận đơn</h3>
              <p className="text-slate-500 font-bold text-sm mt-1">Chọn ngày và để lại lý do tạm dừng.</p>
              <button
                onClick={() => setShowPauseModal(false)}
                className="absolute top-8 right-8 text-slate-400 hover:text-black transition"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-8 space-y-6">
              {/* Date selection - simple implementation for now, can be improved */}
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-widest mb-3">Ngày tạm dừng</label>
                <div className="flex flex-wrap gap-2">
                  {pauseDates.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700">
                      {formatYmdToVi(d)}
                      <button
                        onClick={() => setPauseDates(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-slate-400 hover:text-red-500 transition"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                  ))}
                  <div className="relative">
                    <button
                      onClick={() => fromDateInputRef.current?.showPicker?.()}
                      className="flex items-center justify-center size-9 rounded-xl border border-dashed border-slate-300 text-slate-400 hover:border-primary hover:text-primary transition"
                    >
                      <span className="material-symbols-outlined">add</span>
                    </button>
                    <input
                      type="date"
                      ref={fromDateInputRef}
                      className="absolute inset-0 opacity-0 cursor-pointer w-0 h-0"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && !pauseDates.includes(val)) {
                          setPauseDates(prev => [...prev, val].sort());
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-black uppercase tracking-widest mb-3">Lý do (Ghi chú)</label>
                <textarea
                  value={pauseNote}
                  onChange={(e) => setPauseNote(e.target.value)}
                  placeholder="Ví dụ: Nghỉ lễ, Bảo trì cửa hàng..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none h-32"
                />
              </div>
            </div>

            <div className="px-8 pb-8 pt-2 flex gap-3">
              <button
                onClick={() => setShowPauseModal(false)}
                className="flex-1 px-6 py-4 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition"
              >
                Hủy bỏ
              </button>
              <button
                onClick={submitPauseOrders}
                disabled={pausingOrders || pauseDates.length === 0}
                className="flex-[1.5] px-6 py-4 rounded-2xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 shadow-lg shadow-red-200 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
              >
                {pausingOrders ? (
                  <>
                    <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang xử lý...
                  </>
                ) : 'Xác nhận tạm dừng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Picker Modal */}
      {showTimePicker && selectedOrder?.delivery?.deliveryTime && (() => {
        const timeRanges = getAvailableTimeRanges(selectedOrder.delivery.deliveryTime);
        const hours12List = timeRanges.hour12Map[pickerPeriod] || [];
        const activeHour24 = hours12List.find(h => h.hour12Str === pickerHour12)?.hour24 ?? (pickerPeriod === 'PM' ? 17 : 5);
        const minutesList = timeRanges.minutesMap[activeHour24] || [0];

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 transition-all duration-300">
            <div className="max-w-2xl w-full bg-white rounded-[2rem] overflow-hidden grid grid-cols-12 shadow-2xl animate-in fade-in zoom-in duration-200 relative border border-gold/10">
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowTimePicker(false)}
                className="absolute top-6 right-6 size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-black hover:bg-slate-200 transition-all z-10"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>

              {/* Left Panel - Teal color */}
              <div className="col-span-12 md:col-span-5 bg-[#14b8a6] p-8 flex flex-col justify-between text-white min-h-[220px] md:min-h-auto">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">Giờ Giao Hàng</p>
                  <h2 className="text-6xl font-black mt-4 tracking-tight">
                    {pickerHour12}:{String(pickerMinute).padStart(2, '0')}
                    <span className="text-2xl font-bold ml-2 uppercase text-white/90">{pickerPeriod}</span>
                  </h2>
                </div>
                <p className="text-[11px] text-white/80 leading-relaxed font-medium">
                  Chọn giờ theo từng ô để chỉnh nhanh như form đồng hồ.
                </p>
              </div>

              {/* Right Panel - Pickers */}
              <div className="col-span-12 md:col-span-7 p-6 md:p-8 flex flex-col justify-between bg-white">
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">Chọn Thời Gian</h3>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5 mb-6">Chọn giờ, phút và sáng / chiều</p>

                  <div className="grid grid-cols-3 gap-4 md:gap-6">
                    {/* GIỜ */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Giờ</p>
                      <div className="h-44 overflow-y-auto border border-slate-100 rounded-2xl p-1.5 space-y-1 scrollbar-thin bg-slate-50/50 shadow-inner flex flex-col items-center">
                        {hours12List.length > 0 ? (
                          hours12List.map(h => {
                            const isSelected = h.hour12Str === pickerHour12;
                            return (
                              <button
                                key={h.hour12Str}
                                type="button"
                                onClick={() => {
                                  setPickerHour12(h.hour12Str);
                                  const newMins = timeRanges.minutesMap[h.hour24] || [0];
                                  if (!newMins.includes(pickerMinute)) {
                                    setPickerMinute(newMins[0] || 0);
                                  }
                                }}
                                className={`w-full py-2 text-center text-sm font-black rounded-xl transition-all ${isSelected
                                    ? 'bg-black text-white shadow-md'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-black'
                                  }`}
                              >
                                {h.hour12Str}
                              </button>
                            );
                          })
                        ) : (
                          <p className="text-[10px] text-slate-400 font-semibold py-8 text-center">Không có giờ hợp lệ</p>
                        )}
                      </div>
                    </div>

                    {/* PHÚT */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Phút</p>
                      <div className="h-44 overflow-y-auto border border-slate-100 rounded-2xl p-1.5 space-y-1 scrollbar-thin bg-slate-50/50 shadow-inner flex flex-col items-center">
                        {minutesList.map(m => {
                          const isSelected = m === pickerMinute;
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setPickerMinute(m)}
                              className={`w-full py-2 text-center text-sm font-black rounded-xl transition-all ${isSelected
                                  ? 'bg-black text-white shadow-md'
                                  : 'text-slate-600 hover:bg-slate-100 hover:text-black'
                                }`}
                            >
                              {String(m).padStart(2, '0')}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* BUỔI */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Buổi</p>
                      <div className="space-y-2 flex flex-col items-center w-full">
                        {['AM', 'PM'].map(p => {
                          const isAvailable = timeRanges.ampm.includes(p);
                          const isSelected = p === pickerPeriod;
                          return (
                            <button
                              key={p}
                              type="button"
                              disabled={!isAvailable}
                              onClick={() => {
                                setPickerPeriod(p as any);
                                const list12 = timeRanges.hour12Map[p as any] || [];
                                if (list12.length > 0) {
                                  const firstH = list12[0];
                                  setPickerHour12(firstH.hour12Str);
                                  const newMins = timeRanges.minutesMap[firstH.hour24] || [0];
                                  setPickerMinute(newMins[0] || 0);
                                }
                              }}
                              className={`w-full py-3.5 text-center text-xs font-black rounded-xl border transition-all ${!isAvailable
                                  ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-50'
                                  : isSelected
                                    ? 'bg-black text-white border-black shadow-md'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                              {p}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                  <p className="text-[9px] text-slate-400 font-semibold max-w-[160px] leading-tight">
                    Thời gian sẽ được kiểm tra theo hạn chuẩn bị trước khi gửi shipper.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTimePicker(false)}
                      className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-50 transition-all"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        let h24 = Number(pickerHour12);
                        if (pickerPeriod === 'PM' && h24 < 12) h24 += 12;
                        if (pickerPeriod === 'AM' && h24 === 12) h24 = 0;

                        const pad = (num: number) => String(num).padStart(2, '0');
                        const finalTime = `${pad(h24)}:${pad(pickerMinute)}`;
                        setEstimatedDelivery(finalTime);
                        setShowTimePicker(false);
                        setStatusError(null);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-black text-white font-bold text-xs hover:opacity-90 shadow-md shadow-slate-200 transition-all"
                    >
                      Xác nhận
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default OrderManagement;
