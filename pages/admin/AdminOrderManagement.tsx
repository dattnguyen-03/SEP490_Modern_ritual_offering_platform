import React, { useEffect, useMemo, useState } from 'react';
import { orderService, Order, VendorOrder, VendorOrderItem } from '../../services/orderService';
import OrderStatusTimeline from '../../components/OrderStatusTimeline';

interface AdminOrderManagementProps {
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

const STATUS_BADGE: Record<string, { badge: string; label: string }> = {
  Pending: { badge: 'bg-amber-50 text-amber-600', label: 'Chờ duyệt' },
  Confirmed: { badge: 'bg-sky-50 text-sky-600', label: 'Đã xác nhận' },
  Processing: { badge: 'bg-indigo-50 text-indigo-600', label: 'Đang xử lý' },
  Preparing: { badge: 'bg-indigo-50 text-indigo-600', label: 'Đang xử lý' },
  Paid: { badge: 'bg-emerald-50 text-emerald-600', label: 'Đã thanh toán' },
  Delivering: { badge: 'bg-orange-50 text-orange-600', label: 'Đang giao' },
  Delivered: { badge: 'bg-emerald-50 text-emerald-600', label: 'Đã giao' },
  Completed: { badge: 'bg-green-50 text-green-600', label: 'Hoàn thành' },
  Cancelled: { badge: 'bg-rose-50 text-rose-500', label: 'Đã hủy' },
  Refunded: { badge: 'bg-fuchsia-50 text-fuchsia-600', label: 'Đã hoàn tiền' },
  PaymentFailed: { badge: 'bg-red-50 text-red-600', label: 'TT thất bại' },
};

const normalizeStatus = (status: unknown): string => {
  const map: Record<string, string> = {
    paid: 'Paid',
    confirmed: 'Confirmed',
    processing: 'Processing',
    preparing: 'Processing',
    shipping: 'Delivering',
    delivering: 'Delivering',
    delivered: 'Delivered',
    completed: 'Completed',
    pending: 'Pending',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
    paymentfailed: 'PaymentFailed',
  };
  const key = String(status || '').trim().toLowerCase();
  return map[key] || String(status || '').trim();
};

const hasMeaningfulText = (v: unknown): boolean => {
  if (typeof v !== 'string') return false;
  const n = v.trim().toLowerCase();
  return n !== '' && n !== 'n/a' && n !== 'na' && n !== 'null' && n !== 'undefined';
};

const formatSlaStatusVi = (status: unknown): string => {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'ontime') return 'ĐÚNG HẠN';
  if (s === 'late') return 'TRỄ HẠN';
  return s.toUpperCase();
};

const formatVnd = (value: unknown): string => {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString('vi-VN')}đ` : '0đ';
};

const formatPercent = (value: unknown): string => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '0%';
  const pct = n > 1 ? n : n * 100;
  return `${Math.round(pct)}%`;
};

const formatDateTimeVi = (value: unknown): string => {
  if (!value) return 'N/A';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString('vi-VN');
};

const formatDateVi = (value: unknown): string => {
  if (!value) return 'N/A';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('vi-VN');
};

const formatTimeOnlyVi = (value: unknown): string => {
  if (!value) return 'N/A';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

const getDateKey = (value: unknown): string => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getStatusBadge = (status: unknown) => {
  const normalized = String(status || '').trim();
  return STATUS_BADGE[normalized] ?? { badge: 'bg-slate-100 text-slate-600', label: normalized || 'Chờ duyệt' };
};

const formatOrderCode = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return 'ORD';
  if (raw.length <= 10) return raw.toUpperCase();
  return `ORD-${raw.slice(-6).toUpperCase()}`;
};

const getInitials = (name: string) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const getAvatarColor = (name: string) => {
  const colors = [
    'bg-rose-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500',
    'bg-indigo-500', 'bg-fuchsia-500', 'bg-violet-500', 'bg-teal-500'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
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
  if (!normalized) return fallbackProductImage;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (/^data:image\//i.test(normalized)) return normalized;
  if (/^blob:/i.test(normalized)) return normalized;
  if (normalized.startsWith('//') || normalized.startsWith('/') || normalized.startsWith('./') || normalized.startsWith('../')) return normalized;
  return `/${normalized}`;
};

const AdminOrderManagement: React.FC<AdminOrderManagementProps> = ({ onNavigate }) => {
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await orderService.getAllVendorOrders(1, 300);
      setOrders(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách đơn hàng.';
      setError(message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, selectedCalendarDate]);

  const openOrderDetail = async (orderId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    setSelectedOrder(null);

    try {
      const data = await orderService.getVendorOrderDetails(orderId);
      if (!data) {
        setDetailError('Không tìm thấy đơn hàng.');
        return;
      }
      setSelectedOrder(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải chi tiết đơn hàng.';
      setDetailError(message);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeOrderDetail = () => {
    setSelectedOrder(null);
    setDetailError(null);
    setDetailLoading(false);
  };

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      if (filterStatus !== 'all' && String(order.orderStatus || '').trim() !== filterStatus) return false;
      if (!query) return true;

      const haystack = [
        order.orderId,
        order.customerName,
        order.customerPhone,
        order.vendorName,
        order.deliveryAddress,
        order.orderStatus,
      ].join(' ').toLowerCase();

      return haystack.includes(query);
    });
  }, [orders, filterStatus, searchQuery]);

  const monthKey = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`;

  const calendarOrders = useMemo(() => {
    return filteredOrders.filter((order) => getDateKey(order.deliveryDate || order.createdAt).startsWith(monthKey));
  }, [filteredOrders, monthKey]);

  const calendarDayStats = useMemo(() => {
    const stats = new Map<string, { count: number; revenue: number }>();

    calendarOrders.forEach((order) => {
      const key = getDateKey(order.deliveryDate || order.createdAt);
      if (!key) return;

      const current = stats.get(key) || { count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += Number(order.finalAmount ?? order.totalAmount) || 0;
      stats.set(key, current);
    });

    return stats;
  }, [calendarOrders]);

  const calendarDayCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const offset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{ key: string; day: number } | null> = [];
    for (let index = 0; index < offset; index += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ key, day });
    }

    return cells;
  }, [calendarMonth]);

  const displayOrders = useMemo(() => {
    return selectedCalendarDate
      ? filteredOrders.filter((order) => getDateKey(order.deliveryDate || order.createdAt) === selectedCalendarDate)
      : filteredOrders;
  }, [filteredOrders, selectedCalendarDate]);

  const totalPages = Math.max(1, Math.ceil(displayOrders.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedOrders = displayOrders.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage);

  const shiftCalendarMonth = (offset: number) => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  return (
    <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden overflow-x-hidden min-w-0">
      <div className="p-6 md:p-8 border-b border-gray-200 bg-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Hệ thống quản trị</p>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight mt-1">Danh sách đơn hàng</h2>
            <p className="text-sm text-slate-500 font-semibold mt-1">Theo dõi và quản lý toàn bộ đơn hàng trên nền tảng.</p>
          </div>

          <button
            onClick={loadOrders}
            className="px-5 py-3 rounded-xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all"
          >
            Tải lại
          </button>
        </div>
      </div>

      <div className="p-6 md:p-8">
        <div className="flex flex-col xl:flex-row gap-3 mb-6">
          <div className="flex-1 relative min-w-0">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
            <input
              type="text"
              placeholder="Tìm mã đơn, khách hàng, cửa hàng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-primary focus:ring-2 focus:ring-primary/5 transition-all outline-none text-sm"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full xl:w-56 px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold outline-none focus:border-primary"
          >
            <option value="all">Tất cả trạng thái</option>
            {ORDER_STATUS_TABS.filter((tab) => tab.id !== 'all').map((tab) => (
              <option key={tab.id} value={tab.id}>{tab.label}</option>
            ))}
          </select>
        </div>

        <div className="mb-6 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4 md:p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Lịch theo ngày</p>
              <h3 className="text-lg font-black text-slate-900 mt-1">{calendarMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => shiftCalendarMonth(-1)}
                className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-lg">chevron_left</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedCalendarDate(null)}
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition"
              >
                Bỏ lọc ngày
              </button>
              <button
                type="button"
                onClick={() => shiftCalendarMonth(1)}
                className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center mb-1">
            {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((label) => (
              <div key={label} className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 py-1.5">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {calendarDayCells.map((cell, index) => {
              if (!cell) return <div key={`empty-${index}`} className="min-h-[92px] rounded-2xl border border-transparent" />;
              const stats = calendarDayStats.get(cell.key);
              const isSelected = selectedCalendarDate === cell.key;
              const hasOrders = !!stats?.count;

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => setSelectedCalendarDate((current) => (current === cell.key ? null : cell.key))}
                  className={`min-h-[92px] rounded-2xl border p-2 text-left transition-all ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-xs font-black ${isSelected ? 'text-primary' : 'text-slate-900'}`}>{cell.day}</span>
                    {hasOrders && <span className="text-[10px] font-black rounded-full bg-slate-900 text-white px-2 py-0.5">{stats?.count}</span>}
                  </div>
                  {hasOrders ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-[11px] font-bold text-slate-500">{formatVnd(stats?.revenue || 0)}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-300">Không có đơn</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {loading && (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Đang tải sổ cái...</p>
          </div>
        )}

        {!loading && error && (
          <div className="py-20 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <p className="text-sm font-bold text-rose-500">{error}</p>
          </div>
        )}

        {!loading && !error && displayOrders.length === 0 && (
          <div className="py-20 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <p className="text-sm font-bold text-slate-400 italic">Không có dữ liệu phù hợp</p>
          </div>
        )}

        {!loading && !error && displayOrders.length > 0 && (
          <div className="space-y-5">
            {paginatedOrders.map((order) => {
              const statusBadge = getStatusBadge(order.orderStatus);
              return (
                <div key={order.orderId} className="bg-white border border-slate-200 rounded-[1.75rem] overflow-hidden shadow-sm">
                  <div className="p-6 md:p-8 bg-white flex flex-wrap items-center justify-between gap-6">
                    <div className="flex flex-wrap items-center gap-6 md:gap-10 flex-1">
                      <div className="flex items-center gap-4">
                        <div className={`size-12 rounded-full flex items-center justify-center text-white font-black text-sm shadow-sm ${getAvatarColor(order.customerName || 'N/A')}`}>
                          {getInitials(order.customerName || 'N/A')}
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-0.5">Khách hàng</p>
                          <h4 className="text-lg font-black text-slate-900 leading-tight">{order.customerName || 'N/A'}</h4>
                          <p className="text-[12px] font-bold text-slate-500">{order.customerPhone || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="hidden md:block w-px h-8 bg-slate-200" />

                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1.5">Cửa hàng</p>
                        <h4 className="text-base font-bold text-slate-700 leading-tight">{order.vendorName || 'N/A'}</h4>
                        <p className="text-[12px] font-medium text-slate-400">Shop ID: {order.vendorProfileId?.slice(-6).toUpperCase()}</p>
                      </div>

                      <div className="hidden md:block w-px h-8 bg-slate-200" />

                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1.5">Mã đơn & Ngày đặt</p>
                        <h4 className="text-sm font-black text-slate-900 leading-tight">{formatOrderCode(order.orderId)}</h4>
                        <p className="text-[12px] font-medium text-slate-500 mt-0.5">{formatDateVi(order.createdAt)} lúc {formatTimeOnlyVi(order.createdAt)}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className={`inline-flex px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest shadow-sm ${statusBadge.badge}`}>
                        {statusBadge.label}
                      </span>
                      <p className="text-[11px] font-bold text-slate-900">
                        GIAO HÀNG: <span className="text-primary font-black">{formatDateVi(order.deliveryDate)} {formatTimeOnlyVi(order.deliveryTime)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="px-6 md:px-8 pb-8 space-y-6">
                    <div className="space-y-5">
                      {(order.items || []).map((item: VendorOrderItem) => (
                        <div key={item.itemId} className="flex gap-5 items-start">
                          <div className="size-20 rounded-2xl bg-slate-50 border border-slate-200 flex-shrink-0 overflow-hidden shadow-sm">
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
                          <div className="flex-1 min-w-0">
                            <h5 className="font-black text-slate-900 text-lg leading-tight">{item.packageName}</h5>
                            <p className="text-sm font-bold text-amber-600 mt-1">Gói: {item.variantName} × {item.quantity}</p>
                            
                            <div className="mt-2 space-y-1">
                              {(item.swaps || []).map((sw, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-[12px] font-bold text-amber-500 bg-amber-50/50 px-3 py-1 rounded-lg w-fit">
                                  <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                                  <span>Đổi từ {sw.originalItemName} -&gt; {sw.replacementItemName}</span>
                                </div>
                              ))}
                              {(item.addOns || []).map((ao, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-[12px] font-bold text-emerald-600 bg-emerald-50/50 px-3 py-1 rounded-lg w-fit">
                                  <span className="material-symbols-outlined text-[14px]">add_circle</span>
                                  <span>{ao.addOnName} x{ao.quantity}</span>
                                </div>
                              ))}
                              {item.decorationNote && (
                                <p className="text-[12px] font-medium text-slate-400 italic mt-1 px-3">Ghi chú: {item.decorationNote}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 pt-1">
                            <p className="font-black text-slate-900 text-xl tracking-tight">{formatVnd(item.lineTotal)}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl bg-blue-50/40 border border-blue-100/50 p-4 md:p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-2">Địa chỉ giao</p>
                      <p className="text-[15px] font-bold text-slate-700 leading-relaxed">{order.deliveryAddress || 'N/A'}</p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pt-4 border-t border-slate-100">
                      <p className="text-base font-bold text-slate-400">
                        Tổng cộng (đã gồm ship): <span className="text-2xl font-black text-slate-900 ml-1">{formatVnd(order.finalAmount ?? order.totalAmount)}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => openOrderDetail(order.orderId)}
                        className="px-8 py-3.5 rounded-2xl bg-slate-950 text-white text-[13px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
                      >
                        Xem chi tiết
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border border-slate-200 rounded-2xl bg-white px-4 md:px-6 py-4">
            <p className="text-sm text-black min-w-0">
              Hiển thị <span className="font-semibold">{(safeCurrentPage - 1) * itemsPerPage + 1}</span>
              {' - '}
              <span className="font-semibold">{Math.min(safeCurrentPage * itemsPerPage, displayOrders.length)}</span>
              {' / '}
              <span className="font-semibold">{displayOrders.length}</span> đơn hàng
            </p>

            <div className="flex flex-wrap items-center gap-2 max-w-full">
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
      </div>

      {(detailLoading || detailError || selectedOrder) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-8 overflow-y-auto bg-black/50 backdrop-blur-sm" onClick={closeOrderDetail}>
          <div className="relative w-full max-w-6xl my-4 rounded-[2rem] bg-gray-50 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="bg-white px-6 md:px-8 py-5 flex items-center gap-4 border-b border-gray-100">
              <button
                type="button"
                onClick={closeOrderDetail}
                className="px-5 py-2.5 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-200 hover:bg-gray-50 transition flex-shrink-0 font-bold text-xs uppercase tracking-widest text-gray-600"
              >
                Đóng
              </button>
              <div className="flex-1">
                <h2 className="text-2xl font-black text-gray-900 leading-tight">Chi tiết đơn hàng</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  {(() => {
                    const displayCustomerName =
                      (hasMeaningfulText(selectedOrder?.customer?.fullName) ? selectedOrder?.customer?.fullName : '')
                      || (hasMeaningfulText(selectedOrder?.customerName) ? selectedOrder?.customerName : '')
                      || 'Khách hàng';

                    const displayCustomerPhone =
                      (hasMeaningfulText(selectedOrder?.customer?.phoneNumber) ? selectedOrder?.customer?.phoneNumber : '')
                      || (hasMeaningfulText(selectedOrder?.customerPhone) ? selectedOrder?.customerPhone : '');

                    return (
                      <>
                        <p className="text-sm text-slate-500 font-medium">Khách: {displayCustomerName}</p>
                        {hasMeaningfulText(displayCustomerPhone) && <span className="text-slate-300 mx-1">|</span>}
                        <p className="text-sm text-slate-500 font-bold">{displayCustomerPhone}</p>
                      </>
                    );
                  })()}
                </div>
              </div>
              <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-sm flex-shrink-0 ${getStatusBadge(selectedOrder?.orderStatus).badge}`}>
                {getStatusBadge(selectedOrder?.orderStatus).label}
              </span>
            </div>

            <div className="overflow-y-auto p-4 md:p-6 space-y-5">
              {detailLoading ? (
                <div className="py-20 text-center bg-white rounded-3xl border border-gray-100">
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-primary mb-3" />
                  <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Đang tải dữ liệu...</p>
                </div>
              ) : detailError ? (
                <div className="rounded-[2rem] border border-rose-100 bg-rose-50 p-8 text-rose-600 font-black text-center shadow-inner">
                  {detailError}
                </div>
              ) : selectedOrder ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Top Column: Schedule + Items */}
                    <div className="lg:col-span-12 space-y-5">
                      {/* Delivery schedule card */}
                      {selectedOrder.delivery && (
                        <div className="bg-white rounded-[1.5rem] border border-gray-200 p-6 shadow-sm">
                          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4 pb-2 border-b border-gray-50">LỊCH GIAO THEO NGÀY</h3>
                          <div className="flex flex-wrap items-start justify-between gap-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-3">
                              <p className="text-sm text-slate-500 font-medium">
                                Ngày: <span className="font-black text-slate-900">{formatDateVi(selectedOrder.delivery.deliveryDate)}</span>
                              </p>
                              <p className="text-sm text-slate-500 font-medium">
                                Giờ: <span className="font-black text-slate-900">{selectedOrder.delivery.deliveryTime?.slice(0, 5) || 'N/A'}</span>
                              </p>
                              <p className="text-sm text-slate-500 font-medium">
                                Hạn xác nhận: <span className="font-bold text-slate-900">{formatDateTimeVi(selectedOrder.confirmDeadline || selectedOrder.createdAt)}</span>
                              </p>
                              <p className="text-sm text-slate-500 font-medium">
                                Hạn giao: <span className="font-bold text-slate-900">{formatDateTimeVi(selectedOrder.deliveredDeadline)}</span>
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusBadge(selectedOrder.orderStatus).badge}`}>
                                {getStatusBadge(selectedOrder.orderStatus).label}
                              </span>
                              {selectedOrder.slaStatus && (
                                <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${String(selectedOrder.slaStatus).toLowerCase() === 'ontime' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                                  SLA: {formatSlaStatusVi(selectedOrder.slaStatus)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Product list card */}
                      <div className="bg-white rounded-[1.5rem] border border-gray-200 p-6 shadow-sm">
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-6 pb-2 border-b border-gray-50">SẢN PHẨM ({(selectedOrder.items || []).length})</h3>
                        <div className="space-y-6">
                          {(selectedOrder.items || []).map(item => (
                            <div key={item.itemId} className="flex gap-6 p-6 bg-gray-50/30 rounded-[2rem] border border-gray-100">
                              <div className="size-24 rounded-2xl bg-white border border-gray-200 flex-shrink-0 overflow-hidden shadow-sm">
                                <img
                                  src={toImageSrc(item.imageUrl)}
                                  alt={item.packageName}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackProductImage; }}
                                />
                              </div>

                              <div className="flex-1 min-w-0 flex flex-col">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <h4 className="text-lg font-black text-slate-900 leading-tight mb-1">{item.packageName}</h4>
                                    <p className="text-sm text-slate-500 font-bold">Gói {item.variantName} × {item.quantity}</p>
                                  </div>
                                  <p className="text-sm font-black text-primary">+{formatVnd(item.price)}</p>
                                </div>

                                {/* Swaps */}
                                {Array.isArray(item.swaps) && item.swaps.length > 0 && (
                                  <div className="mt-3 space-y-2">
                                    {item.swaps.map((swap, si) => (
                                      <div key={si} className="flex items-start gap-3 text-xs bg-amber-50 rounded-xl p-3 border border-amber-100/50">
                                        <span className="material-symbols-outlined text-amber-500 text-[18px] mt-0.5">swap_horiz</span>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-bold text-amber-900 mb-1 tracking-tight">Thay đổi vật phẩm</p>
                                          <div className="flex justify-between items-center gap-2">
                                            <p className="text-amber-800 leading-snug">
                                              {swap.replacementDescription || `${swap.originalItemName} → ${swap.replacementItemName}`}
                                            </p>
                                            {(swap.surcharge ?? 0) > 0 && <span className="font-black text-amber-600 flex-shrink-0">+{formatVnd(swap.surcharge ?? 0)}</span>}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Add-ons */}
                                {Array.isArray(item.addOns) && item.addOns.length > 0 && (
                                  <div className="mt-2 space-y-2">
                                    {item.addOns.map((addOn, ai) => (
                                      <div key={ai} className="flex items-start gap-3 text-xs bg-emerald-50 rounded-xl p-3 border border-emerald-100/50">
                                        <span className="material-symbols-outlined text-emerald-500 text-[18px] mt-0.5">add_circle</span>
                                        <div className="flex-1">
                                          <p className="font-bold text-emerald-900 mb-1 tracking-tight">Vật phẩm thêm</p>
                                          <div className="flex justify-between items-center">
                                            <p className="text-emerald-800">{addOn.addOnName || addOn.itemName} <span className="font-black ml-1 text-[10px]">×{addOn.quantity}</span></p>
                                            {(addOn.lineTotal ?? 0) > 0 && <span className="font-black text-emerald-600">+{formatVnd(addOn.lineTotal ?? 0)}</span>}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {item.decorationNote && (
                                  <div className="mt-3 p-4 bg-slate-100/70 rounded-xl border-l-4 border-slate-300">
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1.5">YÊU CẦU TRANG TRÍ</p>
                                    <p className="text-sm text-slate-700 italic font-medium">"{item.decorationNote}"</p>
                                  </div>
                                )}

                                <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
                                  <span className="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em]">TỔNG SẢN PHẨM NÀY:</span>
                                  <span className="text-2xl font-black text-slate-900 tracking-tight">{formatVnd(item.lineTotal)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Status and Progress Stepper */}
                      <OrderStatusTimeline
                        orderId={selectedOrder.orderId}
                        currentStatus={selectedOrder.orderStatus}
                        trackingLists={selectedOrder.trackingLists || []}
                      />
                    </div>

                    {/* Bottom Column: Delivery + Summary */}
                    <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                      <div className="lg:col-span-7 space-y-5">
                        {/* Information Giao Hàng */}
                        <div className="bg-white rounded-[1.5rem] border border-gray-200 p-6 shadow-sm">
                          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-6 pb-2 border-b border-gray-50">THÔNG TIN GIAO HÀNG</h3>
                          <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                            {[
                              { label: 'NGÀY GIAO', value: formatDateVi(selectedOrder.delivery?.deliveryDate) },
                              { label: 'GIỜ GIAO', value: selectedOrder.delivery?.deliveryTime?.slice(0, 5) || 'N/A' },
                              { label: 'PHÍ GIAO', value: formatVnd(selectedOrder.pricing?.shippingFee) },
                              { label: 'KHOẢNG CÁCH', value: `${selectedOrder.delivery?.shippingDistanceKm || 0} km` },
                            ].map(row => (
                              <div key={row.label}>
                                <p className="text-[10px] text-slate-400 font-black tracking-widest mb-1.5 uppercase">{row.label}</p>
                                <p className="text-base font-black text-slate-800">{row.value}</p>
                              </div>
                            ))}
                          </div>

                          {hasMeaningfulText(selectedOrder.delivery?.deliveryAddress) && (
                            <div className="mt-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                              <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-1.5">ĐỊA CHỈ GIAO</p>
                              <p className="text-sm font-bold text-slate-700 leading-relaxed">{selectedOrder.delivery?.deliveryAddress}</p>
                            </div>
                          )}
                          
                          <div className="mt-4 flex flex-wrap gap-4">
                            {selectedOrder.delivery?.deliveryProofImageUrl && (
                              <a
                                href={toImageSrc(Array.isArray(selectedOrder.delivery.deliveryProofImageUrl) ? selectedOrder.delivery.deliveryProofImageUrl[0] : selectedOrder.delivery.deliveryProofImageUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-black text-primary hover:underline uppercase tracking-widest flex items-center gap-1.5"
                              >
                                <span className="material-symbols-outlined text-[18px]">image</span>
                                Xem ảnh giao hàng
                              </a>
                            )}
                            {selectedOrder.delivery?.preparationProofImages && (selectedOrder.delivery.preparationProofImages.length > 0) && (
                              <a
                                href={toImageSrc(selectedOrder.delivery.preparationProofImages[0])}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-black text-primary hover:underline uppercase tracking-widest flex items-center gap-1.5"
                              >
                                <span className="material-symbols-outlined text-[18px]">inventory</span>
                                Xem ảnh chuẩn bị
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-5 space-y-5">
                        {/* Tóm Tắt Summary */}
                        <div className="bg-white rounded-[1.5rem] border border-gray-200 p-6 shadow-sm">
                          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-6 pb-2 border-b border-gray-50">TÓM TẮT</h3>
                          <div className="divide-y divide-gray-100 border border-gray-100 rounded-[1.5rem] overflow-hidden text-sm">
                            {[
                              { label: 'Số lượng', value: String(selectedOrder.pricing?.totalQuantity ?? 1) },
                              { label: 'Tạm tính', value: formatVnd(selectedOrder.pricing?.subTotal) },
                              { label: 'Phí giao', value: formatVnd(selectedOrder.pricing?.shippingFee) },
                              { label: 'Giảm giá', value: formatVnd(selectedOrder.pricing?.discountAmount || 0) },
                              { label: 'Tổng đơn hàng', value: formatVnd(selectedOrder.pricing?.totalAmount), isBold: true },
                              { label: 'Hoa hồng sàn', value: `-${formatPercent(selectedOrder.pricing?.commissionRate || 0.15)}`, color: 'text-rose-500' },
                              { label: 'Phí dịch vụ', value: `-${formatVnd(selectedOrder.pricing?.platformFee)}`, color: 'text-rose-500' },
                            ].map(row => (
                              <div key={row.label} className={`flex justify-between px-5 py-3.5 bg-white ${row.isBold ? 'bg-slate-50/50' : ''}`}>
                                <span className={`${row.color || 'text-slate-500'} font-bold`}>{row.label}</span>
                                <span className={`font-black ${row.color || 'text-slate-900'} text-right`}>{row.value}</span>
                              </div>
                            ))}
                            <div className="flex justify-between px-5 py-5 bg-slate-900 border-t border-slate-800">
                              <span className="font-black text-slate-400 uppercase tracking-widest text-[11px]">Thực nhận</span>
                              <span className="text-xl font-black text-white">{formatVnd(selectedOrder.pricing?.vendorNetAmount)}</span>
                            </div>
                          </div>
                          
                          <div className="mt-4 flex justify-between items-center px-2">
                             <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Trạng thái đơn:</p>
                             <p className="text-[10px] text-slate-900 font-black uppercase tracking-widest">{getStatusBadge(selectedOrder.orderStatus).label}</p>
                          </div>

                          {hasMeaningfulText(selectedOrder.cancelReason) && (
                            <div className="mt-6 p-5 bg-rose-50 rounded-[1.5rem] border border-rose-100 relative overflow-hidden">
                              <div className="absolute top-0 left-0 w-1 h-full bg-rose-400" />
                              <p className="text-[10px] text-rose-500 font-black uppercase tracking-widest mb-2">LÝ DO HỦY</p>
                              <p className="text-sm font-bold text-slate-700 leading-relaxed">{selectedOrder.cancelReason}</p>
                            </div>
                          )}
                        </div>

                        {/* Customer Box */}
                        <div className="bg-white rounded-[1.5rem] border border-gray-200 p-6 shadow-sm">
                          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-6 pb-2 border-b border-gray-50">KHÁCH HÀNG & ĐỐI SOÁT</h3>
                          <div className="divide-y divide-gray-100 border border-gray-100 rounded-[1.5rem] overflow-hidden text-sm">
                            <div className="flex items-center justify-between p-4 bg-white">
                              <span className="text-slate-500 font-bold">Khách hàng</span>
                              <div className="flex items-center gap-3">
                                <div className={`size-8 rounded-full flex items-center justify-center text-white text-[10px] font-black ${getAvatarColor(selectedOrder.customerName || 'N/A')}`}>
                                  {getInitials(selectedOrder.customerName || 'N/A')}
                                </div>
                                <span className="text-sm font-black text-slate-900">{selectedOrder.customerName || selectedOrder.customer?.fullName || 'N/A'}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white">
                              <span className="text-slate-500 font-bold">Số điện thoại</span>
                              <span className="text-sm font-black text-slate-900">{selectedOrder.customerPhone || selectedOrder.customer?.phoneNumber || 'N/A'}</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white">
                              <span className="text-slate-500 font-bold">Cửa hàng</span>
                              <span className="text-sm font-black text-slate-900">{selectedOrder.vendorName || selectedOrder.vendor?.shopName || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrderManagement;
