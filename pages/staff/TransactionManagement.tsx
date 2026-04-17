import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getAllTransactions,
  getTransactionById,
  getRelatedTransactions,
  WalletTransaction,
  AllTransactionFilter
} from '../../services/walletService';
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

const getTransactionStatusLabel = (status: string) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'success' || normalized === 'succeeded') return 'Thành công';
  if (normalized === 'pending') return 'Đang xử lý';
  if (normalized === 'failed') return 'Thất bại';
  if (normalized === 'cancelled') return 'Đã hủy';
  return status;
};

const getTransactionStatusClass = (status: string) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'success' || normalized === 'succeeded') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (normalized === 'pending') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (normalized === 'failed' || normalized === 'cancelled') return 'bg-rose-50 text-rose-700 border-rose-100';
  return 'bg-slate-50 text-slate-700 border-slate-200';
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

const TransactionManagement: React.FC<TransactionManagementProps> = ({ onNavigate, userRole }) => {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AllTransactionFilter>({
    walletId: '',
    type: '',
    status: '',
    from: '',
    to: ''
  });

  const [detailTx, setDetailTx] = useState<WalletTransaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [relatedTxs, setRelatedTxs] = useState<WalletTransaction[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Pagination for admin/staff view as data can be huge
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

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
    } finally {
      setDetailLoading(false);
    }
  };

  const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);
  const pagedTransactions = transactions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const totalIn = useMemo(() => {
    return transactions
      .filter(tx => tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);

  const totalOut = useMemo(() => {
    return transactions
      .filter(tx => tx.amount < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  }, [transactions]);

  return (
    <div className="bg-transparent font-sans">
      <div className="max-w-7xl mx-auto py-4">

        {/* Header */}
        <div className="mb-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                Quản trị giao dịch
                {userRole === 'staff' && (
                  <span className="bg-slate-900 text-white px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-widest">Quyền nhân viên</span>
                )}
              </h1>
              <p className="text-sm text-black mt-1">
                Theo dõi, rà soát và đối soát toàn bộ biến động tài chính trong hệ thống.
              </p>
            </div>

            {userRole === 'admin' && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="px-4 py-2 rounded-xl bg-amber-50 text-amber-800 text-xs font-black border border-amber-100">
                  Chế độ quản trị hệ thống
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filters Card */}
        <div className="bg-white border-slate-200 rounded-[2rem] p-8 shadow-sm mb-10 border">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mã Ví</label>
              <input
                type="text"
                placeholder="Tìm ví..."
                className="w-full rounded-xl border-slate-200 text-sm font-bold text-slate-700 bg-slate-50 border-none px-4 py-3 focus:ring-2 focus:ring-primary/40 transition-all"
                value={filter.walletId || ''}
                onChange={(e) => setFilter({ ...filter, walletId: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Loại GD</label>
              <select
                className="w-full rounded-xl border-slate-200 text-sm font-bold text-slate-700 bg-slate-50 border-none px-4 py-3 focus:ring-2 focus:ring-primary/40 transition-all cursor-pointer"
                value={filter.type || ''}
                onChange={(e) => setFilter({ ...filter, type: e.target.value })}
              >
                <option value="">Tất cả loại giao dịch</option>
                <option value="Deposit">Nạp tiền</option>
                <option value="Withdrawal">Rút tiền</option>
                <option value="PaymentOrder">Thanh toán đơn</option>
                <option value="RefundOrder">Hoàn tiền</option>
                <option value="Penalty">Phạt vi phạm</option>
                {userRole === 'admin' && <option value="PlatformFee">Phí hệ thống</option>}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Trạng thái</label>
              <select
                className="w-full rounded-xl border-slate-200 text-sm font-bold text-slate-700 bg-slate-50 border-none px-4 py-3 focus:ring-2 focus:ring-primary/40 transition-all cursor-pointer"
                value={filter.status || ''}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="Success">Thành công</option>
                <option value="Pending">Đang xử lý</option>
                <option value="Failed">Thất bại</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Từ ngày</label>
              <input
                type="date"
                className="w-full rounded-xl border-slate-200 text-sm font-bold text-slate-700 bg-slate-50 border-none px-4 py-3 focus:ring-2 focus:ring-primary/40 transition-all cursor-pointer"
                value={filter.from || ''}
                onChange={(e) => setFilter({ ...filter, from: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Đến ngày</label>
              <input
                type="date"
                className="w-full rounded-xl border-slate-200 text-sm font-bold text-slate-700 bg-slate-50 border-none px-4 py-3 focus:ring-2 focus:ring-primary/40 transition-all cursor-pointer"
                value={filter.to || ''}
                onChange={(e) => setFilter({ ...filter, to: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between mt-8 gap-6 border-t border-slate-50 pt-8">
            <button
              onClick={() => setFilter({ walletId: '', type: '', status: '', from: '', to: '' })}
              className="inline-flex items-center px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest border-2 border-slate-100 text-slate-400 hover:bg-slate-50 hover:border-slate-200 transition-all"
            >
              Làm mới bộ lọc
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <div className="px-5 py-2.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-black flex items-center gap-2 border border-emerald-100/50">
                Tổng vào: <span className="text-emerald-800 font-extrabold tabular-nums">{formatCurrency(totalIn)}</span>
              </div>
              <div className="px-5 py-2.5 bg-rose-50 text-rose-700 rounded-full text-xs font-black flex items-center gap-2 border border-rose-100/50">
                Tổng ra: <span className="text-rose-800 font-extrabold tabular-nums">{formatCurrency(totalOut)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* List Content */}
        <div className="bg-white border-slate-200 rounded-2xl shadow-sm border overflow-hidden min-h-[400px]">
          {loading ? (
            <div className="p-20 text-center text-slate-400 font-bold animate-pulse">Đang rà soát chuỗi giao dịch...</div>
          ) : transactions.length === 0 ? (
            <div className="p-20 text-center text-slate-400 font-black italic">Không tìm thấy bản ghi.</div>
          ) : (
            <>
              <div className="divide-y divide-slate-100">
                {pagedTransactions.map((tx) => {
                  const incoming = tx.amount >= 0;
                  return (
                    <div
                      key={tx.id}
                      onClick={() => handleOpenDetail(tx)}
                      className="p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-4 md:gap-8 cursor-pointer hover:bg-slate-50 transition-all group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-600 transition-colors">
                            {getTransactionTypeLabel(tx.type, tx.amount)}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getTransactionStatusClass(tx.status)}`}>
                            {getTransactionStatusLabel(tx.status)}
                          </span>
                        </div>
                        <h4 className="text-lg font-black text-slate-900 group-hover:text-primary transition-colors leading-tight">
                          {tx.description || 'Giao dịch không đính kèm mô tả'}
                        </h4>
                        <p className="text-xs text-black mt-2 flex items-center gap-4">
                          <span>{formatDateTimeVi(tx.createdAt)}</span>
                          <span className="opacity-40 select-none">•</span>
                          <span className="font-mono text-slate-400">Ví: {tx.walletId ? tx.walletId.slice(0, 15) : 'Hệ thống'}...</span>
                        </p>
                      </div>

                      <div className="text-right min-w-[200px]">
                        <p className={`text-base md:text-lg font-extrabold tabular-nums ${incoming ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {incoming ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                        </p>
                        {/* {tx.balanceAfter !== null && (
                            <p className="mt-1 text-xs text-black">
                              Số dư sau giao dịch: {formatCurrency(Math.abs(tx.balanceAfter as number))}
                            </p>
                          )} */}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination UI similar to Customer UI or better */}
              {totalPages > 1 && (
                <div className="p-8 border-t border-slate-50 bg-slate-50/20 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Trang <span className="text-slate-900">{currentPage}</span> / {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all disabled:opacity-20"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all disabled:opacity-20"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal Detail */}
      {detailOpen && detailTx && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[200] p-4"
          onClick={() => setDetailOpen(false)}
        >
          <div
            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chi tiết giao dịch</p>
                <h2 className="text-xl font-black text-slate-900">
                  {getTransactionTypeLabel(detailTx.type, detailTx.amount)}
                </h2>
                <p className="text-xs text-slate-400 font-mono">Mã GD: {detailTx.id}</p>
              </div>
              <button
                onClick={() => setDetailOpen(false)}
                className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-8 space-y-10">
              <div className="grid grid-cols-2 gap-8">
                <div className="col-span-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ví chủ thể</p>
                  <p className="font-mono text-xs font-bold text-primary p-3 bg-primary/5 rounded-xl border border-primary/10 truncate">
                    {detailTx.walletId}
                    {detailTx.walletType && (
                      <span className="ml-2 px-1.5 py-0.5 bg-primary text-white text-[8px] rounded uppercase font-black">
                        {detailTx.walletType === 'System' ? 'Hệ thống' :
                          detailTx.walletType === 'Vendor' ? 'Nhà cung cấp' :
                            detailTx.walletType === 'Customer' ? 'Khách hàng' :
                              detailTx.walletType}
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Số tiền</p>
                  <p className={`text-2xl font-black tabular-nums tracking-tighter ${detailTx.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {detailTx.amount >= 0 ? '+' : ''}{formatCurrency(detailTx.amount)}
                  </p>
                </div>
                {/* <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dư sau GD</p>
                    <p className="text-2xl font-black text-slate-900 tabular-nums tracking-tighter">
                      {detailTx.balanceAfter !== null ? formatCurrency(detailTx.balanceAfter as number) : '--'}
                    </p>
                  </div> */}
              </div>

              <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Mô tả và Ghi chú</p>
                <p className="text-sm text-slate-700 font-bold leading-relaxed italic">{detailTx.description || 'Giao dịch hệ thống không ghi chú.'}</p>
              </div>

              {relatedTxs.length > 0 && (
                <div className="pt-6 border-t border-slate-50">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-4">Các giao dịch liên đới ({relatedTxs.length})</p>
                  <div className="space-y-3">
                    {relatedTxs.map(rtx => (
                      <div key={rtx.id} className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm">
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{getTransactionTypeLabel(rtx.type, rtx.amount)}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">{formatDateTimeVi(rtx.createdAt).split(' ')[0]}</p>
                        </div>
                        <p className={`text-sm font-black tabular-nums ${rtx.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {rtx.amount >= 0 ? '+' : ''}{formatCurrency(rtx.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionManagement;
