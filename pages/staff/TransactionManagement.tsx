import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getAllTransactions,
  getTransactionById,
  getRelatedTransactions,
  WalletTransaction,
  AllTransactionFilter,
  WalletType
} from '../../services/walletService';
import { orderService, Order, OrderItem } from '../../services/orderService';
import toast from '../../services/toast';

interface TransactionManagementProps {
  onNavigate: (path: string) => void;
  userRole: 'admin' | 'staff';
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const formatDateTimeVi = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const day = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${time} ${day}`;
};

const formatDateTimeFull = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const day = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${time} ${day}`;
};

const getTransactionStatusLabel = (status: any) => {
  const normalized = String(status ?? '').trim().toLowerCase();
  if (normalized === 'success' || normalized === 'succeeded' || normalized === '0') return 'Thành công';
  if (normalized === 'pending' || normalized === '1') return 'Đang xử lý';
  if (normalized === 'failed' || normalized === '2') return 'Thất bại';
  if (normalized === 'cancelled' || normalized === '3') return 'Đã hủy';
  return status;
};

const getTransactionStatusClass = (status: any) => {
  const normalized = String(status ?? '').trim().toLowerCase();
  if (normalized === 'success' || normalized === 'succeeded' || normalized === '0') return 'text-emerald-600 bg-emerald-50';
  if (normalized === 'pending' || normalized === '1') return 'text-amber-600 bg-amber-50';
  if (normalized === 'failed' || normalized === 'cancelled' || normalized === '2' || normalized === '3') return 'text-rose-600 bg-rose-50';
  return 'text-slate-600 bg-slate-50';
};

const getTransactionTypeLabel = (type: string, amount: number): string => {
  const normalized = String(type || '').trim().toLowerCase();

  if ((normalized === 'systemadjustment' || normalized === 'adjust') && amount > 0) {
    return 'Cộng số dư';
  }
  if ((normalized === 'systemadjustment' || normalized === 'adjust') && amount < 0) {
    return 'Khấu trừ';
  }

  const mapping: Record<string, string> = {
    'topup': 'Nạp tiền',
    'deposit': 'Nạp tiền',
    'withdrawal': 'Rút tiền',
    'withdraw': 'Rút tiền',
    'paymentorder': 'Thanh toán đơn',
    'refundorder': 'Hoàn tiền',
    'commission': 'Phí hoa hồng',
    'shippingfee': 'Phí vận chuyển',
    'penalty': 'Phạt vi phạm',
    'penaltyvendor': 'Phạt vi phạm',
    'adjust': 'Điều chỉnh',
    'platformfee': 'Phí hệ thống',
    'debtsettlement': 'Thanh toán nợ',
    'withholdingdeduction': 'Khấu trừ tạm giữ',
    'withholdingrelease': 'Giải phóng tạm giữ',
  };

  return mapping[normalized] || type;
};

const getOrderStatusLabel = (status: string) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return 'Chờ xác nhận';
  if (['paid', 'success', 'succeeded', 'confirmed'].includes(normalized)) return 'Đã thanh toán';
  if (['processing', 'preparing'].includes(normalized)) return 'Đang chuẩn bị';
  if (['shipping', 'delivering', 'out_for_delivery'].includes(normalized)) return 'Đang giao';
  if (['completed', 'delivered', 'done'].includes(normalized)) return 'Hoàn tất';
  if (['cancelled', 'canceled', 'failed'].includes(normalized)) return 'Đã hủy';
  return status;
};

const getOrderStatusChipClass = (status: string) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (['cancelled', 'canceled', 'failed'].includes(normalized)) return 'bg-rose-100 text-rose-500';
  if (['completed', 'delivered', 'done', 'paid', 'success', 'succeeded', 'confirmed'].includes(normalized)) return 'bg-emerald-100 text-emerald-600';
  if (['shipping', 'delivering', 'out_for_delivery'].includes(normalized)) return 'bg-amber-100 text-amber-600';
  return 'bg-slate-100 text-slate-500';
};

const getOrderTimelineStage = (status: string) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (['cancelled', 'canceled', 'failed'].includes(normalized)) return 1;
  if (['completed', 'delivered', 'done'].includes(normalized)) return 4;
  if (['shipping', 'delivering', 'out_for_delivery'].includes(normalized)) return 3;
  if (['processing', 'preparing'].includes(normalized)) return 2;
  return ['paid', 'success', 'succeeded', 'confirmed'].includes(normalized) ? 1 : 0;
};

const getOrderTimelineLabel = (order: Order, index: number) => {
  const fromTracking = order.trackingLists?.[index];
  if (fromTracking?.title) return fromTracking.title;
  return ['Xác nhận', 'Chuẩn bị', 'Đang giao', 'Hoàn tất'][index] || `Bước ${index + 1}`;
};

const getOrderTimelineDescription = (order: Order, index: number) => {
  const fromTracking = order.trackingLists?.[index];
  if (fromTracking?.description) return fromTracking.description;
  return ['Tiếp nhận và xác nhận đơn', 'Chuẩn bị hàng và vật phẩm', 'Nhân viên đang giao chuyển', 'Hoàn thành phục vụ và nghỉ lễ'][index] || 'Chưa có mô tả';
};

const getOrderTimelineTime = (order: Order, index: number) => {
  const fromTracking = order.trackingLists?.[index];
  if (fromTracking?.createdAt) return formatDateTimeVi(fromTracking.createdAt);
  return '';
};

const formatDescriptionList = (desc: string) => {
  if (!desc) return '';
  try {
    const parsed = JSON.parse(desc);
    if (typeof parsed === 'object' && parsed !== null) {
      const parts = [];
      for (const [k, v] of Object.entries(parsed)) {
        let val = String(v);
        if (k === 'createdAt' || k === 'resolvedAt' || k.endsWith('At') || k.endsWith('Date')) {
          val = formatDateTimeVi(val) || val;
        }
        parts.push(`${k}: ${val}`);
      }
      return parts.join(' | ');
    }
    return desc;
  } catch {
    return desc;
  }
};

interface TransactionGroup {
  id: string;
  orderId: string;
  createdAt: string;
  transactions: WalletTransaction[];
  totalSum: number;
  status: string;
}

const TransactionManagement: React.FC<TransactionManagementProps> = ({ onNavigate, userRole }) => {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<AllTransactionFilter>({
    walletId: '',
    type: '',
    status: '',
    from: '',
    to: '',
    walletType: undefined
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // States for Detail Modal
  const [detailTx, setDetailTx] = useState<WalletTransaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [relatedTxs, setRelatedTxs] = useState<WalletTransaction[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [orderDetail, setOrderDetail] = useState<Order | null>(null);
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [orderDetailError, setOrderDetailError] = useState<string | null>(null);

  const handleOpenOrderDetail = async (orderId?: string) => {
    const normalizedOrderId = String(orderId || '').trim();
    if (!normalizedOrderId || normalizedOrderId === 'N/A') return;

    setOrderDetailLoading(true);
    setOrderDetailError(null);
    setOrderDetail(null);
    setOrderDetailOpen(true);

    try {
      const detail = await orderService.getVendorOrderDetails(normalizedOrderId);
      if (!detail) {
        setOrderDetailError('Không tìm thấy đơn hàng.');
        return;
      }
      setOrderDetail(detail);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải chi tiết đơn hàng.';
      setOrderDetailError(message);
    } finally {
      setOrderDetailLoading(false);
    }
  };

  const closeOrderDetail = () => {
    setOrderDetailOpen(false);
    setOrderDetail(null);
    setOrderDetailError(null);
    setOrderDetailLoading(false);
  };

  // Grouping logic for Ledger view
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, TransactionGroup> = {};

    transactions.forEach(tx => {
      const groupId = tx.transactionGroupId || `UNG-${tx.id}`;
      if (!groups[groupId]) {
        groups[groupId] = {
          id: groupId,
          orderId: tx.orderId || 'N/A',
          createdAt: tx.createdAt,
          transactions: [],
          totalSum: 0,
          status: tx.status || 'Success'
        };
      }
      groups[groupId].transactions.push(tx);
      groups[groupId].totalSum += tx.amount;
    });

    // Sort groups by date descending
    return Object.values(groups).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [transactions]);

  // Search filter
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedTransactions;
    const query = searchQuery.toLowerCase();
    return groupedTransactions.filter(g =>
      g.id.toLowerCase().includes(query) ||
      g.orderId.toLowerCase().includes(query) ||
      g.transactions.some(t => t.description.toLowerCase().includes(query))
    );
  }, [groupedTransactions, searchQuery]);
  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(filteredGroups.length / ITEMS_PER_PAGE);
  const pagedGroups = useMemo(() => {
    return filteredGroups.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filteredGroups, currentPage]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      let data = await getAllTransactions({
        ...filter,
        walletId: filter.walletId || undefined,
        type: filter.type || undefined,
        status: filter.status || undefined,
        from: filter.from || undefined,
        to: filter.to || undefined,
      });

      // BR-057: Staff filtering
      if (userRole === 'staff') {
        data = data.filter(tx =>
          tx.type !== 'PlatformFee' &&
          tx.walletType !== 'System'
        );
      }

      // Sort newest first
      const sorted = [...data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTransactions(sorted);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
      setTransactions([]);
    } finally {
      setLoading(false);
      setCurrentPage(1);
    }
  }, [filter, userRole]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDetail = async (tx: WalletTransaction) => {
    setDetailTx(tx);
    setDetailOpen(true);
    setDetailLoading(true);
    setRelatedTxs([]);
    try {
      const [detail, related] = await Promise.all([
        getTransactionById(tx.id, userRole === 'staff' ? 'Staff' : 'Admin'),
        getRelatedTransactions(tx.id)
      ]);
      setDetailTx(detail);
      setRelatedTxs(related);
    } catch (err) {
      console.error('Failed to fetch transaction detail:', err);
    }
  };

  return (
    <>
      <div className="space-y-6 font-sans text-slate-900 animate-in fade-in duration-500">
        {/* Simple Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quản trị giao dịch</h1>
            <p className="text-sm text-slate-500 mt-1">Đối soát sổ cái và biến động tài chính hệ thống</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-md border border-slate-200">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Hệ thống ổn định</span>
            </div>
          </div>
        </div>

        {/* Toolbar & Filter */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
            <input
              type="text"
              placeholder="Tìm mã Group, Order, mô tả..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white focus:border-primary focus:ring-2 focus:ring-primary/5 transition-all outline-none text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-4 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all ${showAdvancedFilters ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
            >
              <span className="material-symbols-outlined text-lg">tune</span>
              {showAdvancedFilters ? 'Đóng bộ lọc' : 'Lọc nâng cao'}
            </button>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-500 ml-0.5">Loại Ví</label>
                <select
                  value={filter.walletType || ''}
                  onChange={(e) => setFilter({ ...filter, walletType: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium outline-none focus:border-primary"
                >
                  <option value="">Tất cả loại ví</option>
                  <option value="Customer">Ví Khách hàng</option>
                  <option value="Vendor">Ví Nhà cung cấp</option>
                  <option value="System">Ví Hệ thống</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-500 ml-0.5">Loại Giao Dịch</label>
                <select
                  value={filter.type}
                  onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium outline-none focus:border-primary"
                >
                  <option value="">Tất cả loại</option>
                  <option value="PaymentOrder">Thanh toán</option>
                  <option value="RefundOrder">Hoàn tiền</option>
                  <option value="Deposit">Nạp tiền</option>
                  <option value="Withdrawal">Rút tiền</option>
                  <option value="PlatformFee">Phí nền tảng</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-500 ml-0.5">Trạng thái</label>
                <select
                  value={filter.status}
                  onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium outline-none focus:border-primary"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="Success">Thành công</option>
                  <option value="Pending">Đang xử lý</option>
                  <option value="Failed">Thất bại</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setFilter({ walletId: '', type: '', status: '', from: '', to: '', walletType: undefined });
                    setSearchQuery('');
                  }}
                  className="w-full px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-100 transition-all"
                >
                  Đặt lại bộ lọc
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Ledger Simple List */}
        <div className="space-y-8">
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Đang tải sổ cái...</p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="py-20 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <p className="text-sm font-bold text-slate-400 italic">Không có dữ liệu phù hợp</p>
            </div>
          ) : (
            pagedGroups.map((group) => (
              <div key={group.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {/* Simple Group Header */}
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-900">
                      {group.transactions[0]?.description.split(' #')[0] || 'Giao dịch hệ thống'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase">GRP: {group.id.slice(0, 8)}</span>
                      {group.orderId !== 'N/A' && (
                        <button
                          type="button"
                          onClick={() => handleOpenOrderDetail(group.orderId)}
                          className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded uppercase hover:bg-primary hover:text-white transition"
                          title="Mở chi tiết đơn hàng"
                        >
                          REF: {group.orderId.slice(0, 8)}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-slate-500 font-medium">
                    <span>{formatDateTimeVi(group.createdAt)}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getTransactionStatusClass(group.status)}`}>
                      {getTransactionStatusLabel(group.status)}
                    </span>
                  </div>
                </div>

                {/* Minimal Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-slate-100">
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Ví sở hữu</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Nội dung chi tiết</th>
                        <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Biến động</th>
                        <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Số dư sau GD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {group.transactions.map((tx) => (
                        <tr
                          key={tx.id}
                          className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                          onClick={() => handleOpenDetail(tx)}
                        >
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${tx.walletType?.includes('System') ? 'bg-primary' : 'bg-slate-400'
                                }`}></div>
                              <span className="text-sm font-bold text-slate-700">{tx.walletName || 'Hệ thống'}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-sm text-slate-500 line-clamp-1" title={tx.description}>{tx.description}</p>
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            <span className={`text-sm font-bold ${tx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount).replace('₫', '')}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            <span className="text-sm font-medium text-slate-400">
                              {tx.balanceAfter !== null ? formatCurrency(tx.balanceAfter).replace('₫', '') : '--'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Simple Audit Check */}
                <div className="px-5 py-3 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kiểm soát đối ứng</span>
                  <div className={`text-[10px] font-bold uppercase flex items-center gap-1.5 ${Math.abs(group.totalSum) < 0.01 ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                    <span className="material-symbols-outlined text-sm">
                      {Math.abs(group.totalSum) < 0.01 ? 'done_all' : 'error'}
                    </span>
                    Tổng phát sinh: {formatCurrency(group.totalSum)} {Math.abs(group.totalSum) < 0.01 ? '(Cân bằng)' : '(Chênh lệch)'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Standard Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between py-6 border-t border-slate-100 mt-6">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Trang <span className="text-slate-900">{currentPage}</span> / {totalPages}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <span className="material-symbols-outlined text-xl">chevron_left</span>
              </button>

              {/* Simple page numbers for quick jump */}
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => {
                  const p = i + 1;
                  // Only show current, first, last and surrounding pages
                  if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1) {
                    return (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${currentPage === p
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-500 hover:bg-slate-100'
                          }`}
                      >
                        {p}
                      </button>
                    );
                  }
                  if (p === currentPage - 2 || p === currentPage + 2) {
                    return <span key={p} className="text-slate-300">...</span>;
                  }
                  return null;
                })}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <span className="material-symbols-outlined text-xl">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Simple Detail Modal */}
      {detailOpen && detailTx && (
        <div
          className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[200] p-4"
          onClick={() => setDetailOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Chi tiết bút toán #{detailTx.id.slice(0, 8).toUpperCase()}</h3>
              <button onClick={() => setDetailOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Biến động</p>
                  <p className={`text-lg font-bold ${detailTx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {detailTx.amount >= 0 ? '+' : ''}{formatCurrency(detailTx.amount)}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Thời gian</p>
                  <p className="text-sm font-bold text-slate-700">{formatDateTimeFull(detailTx.createdAt)}</p>
                </div>
              </div>

              {detailTx.orderId && detailTx.orderId !== 'N/A' && (
                <div className="p-4 rounded-lg border border-primary/10 bg-primary/5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Đơn hàng liên quan</p>
                    <p className="text-sm font-bold text-slate-900 break-all">{detailTx.orderId}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenOrderDetail(detailTx.orderId)}
                    className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-all"
                  >
                    Xem đơn
                  </button>
                </div>
              )}

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Dữ liệu hệ thống (JSON)</p>
                <pre className="p-4 bg-slate-900 text-emerald-400 rounded-lg text-[11px] font-mono overflow-x-auto">
                  {(() => {
                    const desc = detailTx.description;
                    if (!desc) return '// No metadata';
                    try {
                      return JSON.stringify(JSON.parse(desc), null, 2);
                    } catch {
                      return desc;
                    }
                  })()}
                </pre>
              </div>

              {relatedTxs.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-primary uppercase mb-3">Giao dịch đối ứng ({relatedTxs.length})</p>
                  <div className="space-y-2">
                    {relatedTxs.map(rtx => (
                      <div key={rtx.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="text-xs font-bold text-slate-700 line-clamp-1">{rtx.description}</div>
                        <div className={`text-xs font-bold ${rtx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {rtx.amount >= 0 ? '+' : ''}{formatCurrency(rtx.amount).replace('₫', '')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setDetailOpen(false)}
                className="px-6 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold uppercase hover:bg-slate-800 transition-all"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {orderDetailOpen && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4" onClick={closeOrderDetail}>
          <div
            className="relative w-full max-w-[980px] max-h-[92vh] overflow-hidden rounded-[28px] bg-white shadow-[0_30px_100px_rgba(15,23,42,0.35)] border border-slate-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
              <button
                type="button"
                onClick={closeOrderDetail}
                className="h-10 px-4 rounded-full border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition"
              >
                Đóng
              </button>

              <div className="min-w-0 text-center flex-1">
                <h3 className="text-[22px] sm:text-[28px] font-black text-slate-950 leading-tight truncate">Chi tiết đơn hàng</h3>
                <p className="text-xs sm:text-sm text-slate-500 truncate">
                  Khách: {orderDetail?.customerName || orderDetail?.customer?.fullName || 'N/A'}
                  <span className="mx-2 text-slate-300">|</span>
                  {orderDetail?.customerPhone || orderDetail?.customer?.phoneNumber || 'N/A'}
                </p>
              </div>

              <span className={`shrink-0 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.18em] ${getOrderStatusChipClass(orderDetail?.orderStatus || '')}`}>
                {getOrderStatusLabel(orderDetail?.orderStatus || '')}
              </span>
            </div>

            <div className="overflow-y-auto px-5 sm:px-6 py-5 sm:py-6">
              {orderDetailLoading ? (
                <div className="py-20 text-center">
                  <div className="inline-block h-9 w-9 rounded-full border-4 border-slate-200 border-t-primary animate-spin mb-3" />
                  <p className="text-sm font-bold text-slate-500">Đang tải chi tiết đơn hàng...</p>
                </div>
              ) : orderDetailError ? (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-rose-600 font-bold">
                  {orderDetailError}
                </div>
              ) : orderDetail ? (
                <div className="space-y-5 sm:space-y-6">
                  <section className="rounded-[24px] border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-5 sm:p-6 shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Trạng thái hiện tại</p>
                    <div className="mt-1 sm:mt-2 flex flex-col gap-1">
                      <h4 className="text-3xl sm:text-4xl font-black text-slate-950 leading-tight">
                        {getOrderStatusLabel(orderDetail.orderStatus)}
                      </h4>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 mt-2">Theo dõi đơn hàng</p>
                      <p className="text-sm font-semibold text-slate-600 break-all">{orderDetail.orderId}</p>
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-2">
                      {Array.from({ length: 4 }).map((_, index) => {
                        const activeStage = getOrderTimelineStage(orderDetail.orderStatus);
                        const active = index + 1 <= Math.max(activeStage, 1);
                        return (
                          <div key={index} className="text-center px-1 sm:px-2">
                            <div className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border-4 ${active ? 'border-slate-950 bg-slate-950 text-white shadow-md' : 'border-slate-100 bg-slate-50 text-slate-400'}`}>
                              <span className="text-sm font-black">{index + 1}</span>
                            </div>
                            <p className={`text-sm font-black ${active ? 'text-slate-950' : 'text-slate-400'}`}>{getOrderTimelineLabel(orderDetail, index)}</p>
                            <p className={`mt-1 text-xs leading-5 ${active ? 'text-slate-500' : 'text-slate-300'}`}>
                              {getOrderTimelineDescription(orderDetail, index)}
                            </p>
                            <p className={`mt-1 text-[11px] font-semibold ${active ? 'text-slate-600' : 'text-slate-300'}`}>
                              {getOrderTimelineTime(orderDetail, index) || 'Chưa có mốc'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.85fr] gap-5 sm:gap-6">
                    <div className="rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Thông tin giao hàng</p>
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Ngày giao</p>
                          <p className="mt-1 text-base font-black text-slate-950">{formatDateTimeVi(orderDetail.delivery?.deliveryDate) || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Giờ giao</p>
                          <p className="mt-1 text-base font-black text-slate-950">{orderDetail.delivery?.deliveryTime || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Phí giao</p>
                          <p className="mt-1 text-base font-black text-slate-950">{formatCurrency(Number(orderDetail.pricing?.shippingFee || 0))}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Khoảng cách</p>
                          <p className="mt-1 text-base font-black text-slate-950">{Number(orderDetail.delivery?.shippingDistanceKm || 0).toFixed(1)} km</p>
                        </div>
                      </div>

                      <div className="mt-5 rounded-2xl bg-slate-100 px-4 py-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-500">Địa chỉ giao</p>
                        <p className="mt-1 text-sm sm:text-[15px] font-semibold text-slate-700 leading-6">{orderDetail.delivery?.deliveryAddress || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Tóm tắt</p>
                      <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500">Số lượng</span>
                          <span className="text-slate-950 font-black">{orderDetail.items?.length || 0}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500">Tạm tính</span>
                          <span className="text-slate-950 font-black">{formatCurrency(Number(orderDetail.pricing?.subTotal || 0))}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500">Phí giao</span>
                          <span className="text-slate-950 font-black">{formatCurrency(Number(orderDetail.pricing?.shippingFee || 0))}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500">Giảm giá</span>
                          <span className="text-slate-950 font-black">{formatCurrency(Number(orderDetail.pricing?.discountAmount || 0))}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3">
                          <span className="text-slate-500">Tổng đơn hàng</span>
                          <span className="text-slate-950 font-black">{formatCurrency(Number(orderDetail.pricing?.totalAmount || 0))}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-rose-500">
                          <span className="font-semibold">Hoa hồng sàn</span>
                          <span className="font-black">-{Math.round(Number(orderDetail.pricing?.commissionRate || 0) * 100)}%</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-rose-500">
                          <span className="font-semibold">Phí dịch vụ</span>
                          <span className="font-black">-{formatCurrency(Number(orderDetail.pricing?.platformFee || 0))}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                          <span className="text-slate-500 font-semibold">Thực nhận</span>
                          <span className="text-2xl font-black text-slate-950">{formatCurrency(Number(orderDetail.pricing?.finalAmount || orderDetail.pricing?.totalAmount || 0))}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                          <span className="font-semibold">Trạng thái đối</span>
                          <span className="font-bold">{getTransactionStatusLabel(orderDetail.orderStatus)}</span>
                        </div>
                        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-rose-500">
                          <p className="text-[11px] font-black uppercase tracking-[0.18em]">Lý do hủy</p>
                          <p className="mt-1 text-sm font-semibold">{orderDetail.cancelReason || 'Không có'}</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-slate-200 bg-white overflow-hidden shadow-sm">
                    <div className="px-5 sm:px-6 py-4 border-b border-slate-100 bg-slate-50">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Danh sách sản phẩm</p>
                    </div>
                    <div className="p-5 sm:p-6 space-y-4">
                      {(orderDetail.items || []).map((item: OrderItem) => (
                        <div key={item.itemId} className="flex gap-4 items-start pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                            <img
                              src={item.imageUrl || ''}
                              alt={item.packageName}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = '';
                              }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="text-sm sm:text-base font-black text-slate-950">{item.packageName}</h5>
                            <p className="mt-1 text-sm text-slate-500">{item.variantName} x {item.quantity}</p>
                            {item.decorationNote && <p className="mt-2 text-xs italic text-amber-600">{item.decorationNote}</p>}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm sm:text-base font-black text-primary">{formatCurrency(Number(item.lineTotal || 0))}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
};


export default TransactionManagement;
