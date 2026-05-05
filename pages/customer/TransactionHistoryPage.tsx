import React, { useEffect, useState } from 'react';
import { getMyTransactions, getTransactionById, getRelatedTransactions, WalletTransaction, TransactionFilter } from '../../services/walletService';
import toast from '../../services/toast';

interface TransactionHistoryPageProps {
  onNavigate: (path: string) => void;
}

const formatCurrency = (value: number): string => {
  if (!Number.isFinite(value)) return '0đ';
  return `${value.toLocaleString('vi-VN')}đ`;
};

const formatDateTimeVi = (value: string): string => {
  if (!value) return 'Chưa xác định';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getTransactionStatusLabel = (status: string): string => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized.includes('success')) return 'Thành công';
  if (normalized.includes('fail') || normalized.includes('error')) return 'Thất bại';
  if (normalized.includes('pending')) return 'Chờ xử lý';
  if (normalized.includes('processing')) return 'Đang xử lý';
  if (!normalized || normalized === 'n/a') return 'Không có';
  return status;
};

const getTransactionStatusClass = (status: string): string => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized.includes('success') || normalized.includes('thành công')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (normalized.includes('fail') || normalized.includes('error') || normalized.includes('thất bại')) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (normalized.includes('pending') || normalized.includes('processing')) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

const getTransactionTypeLabel = (type: string, amount?: number): string => {
  const normalized = String(type || '').trim().toLowerCase();

  // If system adjustment results in a positive balance (Admin top-up), show as Nạp tiền for cleaner UI
  if ((normalized === 'systemadjustment' || normalized === 'adjust') && (amount || 0) > 0) {
    return 'Nạp tiền';
  }

  switch (normalized) {
    case 'deposit':
    case 'topup':
      return 'Nạp tiền';
    case 'withdrawal':
    case 'withdraw':
      return 'Rút tiền';
    case 'paymentorder':
      return 'Thanh toán đơn hàng';
    case 'systemadjustment':
    case 'adjust':
      return 'Điều chỉnh số dư';
    case 'vendorincome':
      return 'Doanh thu nhà cung cấp';
    case 'refundcustomer':
    case 'refundorder':
      return 'Hoàn tiền';
    case 'vendorcompensation':
      return 'Bồi thường nhà cung cấp';
    case 'penaltyvendor':
    case 'penalty':
      return 'Phạt vi phạm';
    case 'debtsettlement':
      return 'Thanh toán công nợ';
    case 'withholdingdeduction':
      return 'Khấu trừ tạm giữ';
    case 'withholdingrelease':
      return 'Giải phóng tạm giữ';
    case 'platformfee':
      return 'Phí nền tảng';
    default:
      return type || 'Khác';
  }
};

const isIncomingTransaction = (tx: WalletTransaction): boolean => {
  const normalized = String(tx.type || '').trim().toLowerCase();
  // Các loại giao dịch cộng tiền vào ví
  if (
    normalized === 'deposit' ||
    normalized === 'vendorincome' ||
    normalized === 'refundcustomer' ||
    normalized === 'withholdingrelease'
  ) {
    return true;
  }

  // Các loại hay trừ tiền khỏi ví
  if (
    normalized === 'withdrawal' ||
    normalized === 'paymentorder' ||
    normalized === 'penaltyvendor' ||
    normalized === 'platformfee' ||
    normalized === 'withholdingdeduction'
  ) {
    return false;
  }

  // Mặc định: xem amount > 0 là cộng tiền
  return (tx.amount || 0) >= 0;
};

const toDateParam = (value: string | null): string | undefined => {
  if (!value) return undefined;
  // Append T23:59:59 to include the entire day for the 'To' date
  return `${value}T23:59:59`;
};

const buildInitialDateRange = () => {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromDate = new Date(today);
  fromDate.setDate(today.getDate() - 7);
  const from = fromDate.toISOString().slice(0, 10);
  return { from, to };
};

const TransactionHistoryPage: React.FC<TransactionHistoryPageProps> = () => {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTx, setDetailTx] = useState<WalletTransaction | null>(null);
  const [detailRaw, setDetailRaw] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [relatedChain, setRelatedChain] = useState<WalletTransaction[]>([]);

  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const fetchData = async (options?: { showToastOnError?: boolean }) => {
    try {
      setLoading(true);
      setError(null);

      const filter: TransactionFilter = {
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        from: toDateParam(fromDate),
        to: toDateParam(toDate),
      };

      const data = await getMyTransactions(filter);
      // Sắp xếp mới -> cũ theo thời gian tạo
      const sorted = [...data].sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
      });

      setTransactions(sorted);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải lịch sử giao dịch.';
      setError(message);
      if (options?.showToastOnError !== false) {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData({ showToastOnError: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter, fromDate, toDate]);

  const handleApplyFilters = () => {
    void fetchData();
  };

  const handleClearFilters = () => {
    setTypeFilter('');
    setStatusFilter('');
    setFromDate('');
    setToDate('');
    void fetchData();
  };

  const handleOpenDetail = async (tx: WalletTransaction) => {
    setDetailOpen(true);
    setDetailTx(tx);
    setDetailRaw((tx.raw as Record<string, unknown> | undefined) || null);
    setDetailError(null);
    setRelatedChain([]);

    if (!tx.id) return;

    try {
      setDetailLoading(true);
      const [fresh, chain] = await Promise.all([
        getTransactionById(tx.id),
        getRelatedTransactions(tx.id),
      ]);
      setDetailTx(fresh);
      setDetailRaw((fresh.raw as Record<string, unknown> | undefined) || null);
      setRelatedChain(chain);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải chi tiết hoặc chuỗi giao dịch liên quan.';
      setDetailError(message);
      toast.error(message);
    } finally {
      setDetailLoading(false);
    }
  };

  // Calculate totals ONLY for successful transactions
  const successfulTransactions = transactions.filter(tx => {
    const status = String(tx.status || '').toLowerCase();
    return status.includes('success') || status.includes('thành công');
  });

  const totalIn = successfulTransactions
    .filter((tx) => isIncomingTransaction(tx))
    .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

  const totalOut = successfulTransactions
    .filter((tx) => !isIncomingTransaction(tx))
    .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

  const totalRefund = successfulTransactions
    .filter((tx) => {
      const type = String(tx.type || '').toLowerCase();
      return type.includes('refund');
    })
    .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

  const netSpending = totalOut - totalRefund;

  const relatedTransactions = (() => {
    if (!detailRaw) return [] as any[];
    const anyRaw = detailRaw as any;
    if (Array.isArray(anyRaw.relatedTransactions)) return anyRaw.relatedTransactions as any[];
    if (Array.isArray(anyRaw.RelatedTransactions)) return anyRaw.RelatedTransactions as any[];
    return [] as any[];
  })();

  const parentTransactionId = (() => {
    if (!detailRaw) return null as string | null;
    const anyRaw = detailRaw as any;
    return (
      (anyRaw.relatedTransactionId as string | undefined) ||
      (anyRaw.RelatedTransactionId as string | undefined) ||
      (anyRaw.parentTransactionId as string | undefined) ||
      (anyRaw.ParentTransactionId as string | undefined) ||
      null
    );
  })();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Lịch sử giao dịch ví</h1>
          <p className="text-sm text-black mt-1">
            Theo dõi chi tiết các khoản nạp, thanh toán và hoàn tiền trong tài khoản của bạn.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-black mb-1 uppercase tracking-widest">
              Loại giao dịch
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-xl border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60"
            >
              <option value="">Tất cả loại giao dịch</option>
              <option value="Deposit">Nạp tiền (Top-up)</option>
              <option value="Withdrawal">Rút tiền</option>
              <option value="PaymentOrder">Thanh toán đơn hàng</option>
              <option value="RefundCustomer">Hoàn tiền</option>
              <option value="SystemAdjustment">Điều chỉnh số dư</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-black mb-1 uppercase tracking-widest">
              Trạng thái
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60"
            >
              <option value="">Tất cả</option>
              <option value="Pending">Chờ xử lý</option>
              <option value="Success">Thành công</option>
              <option value="Failed">Thất bại</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-black mb-1 uppercase tracking-widest">
              Từ ngày
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-xl border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-black mb-1 uppercase tracking-widest">
              Đến ngày
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-xl border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClearFilters}
              disabled={loading}
              className="inline-flex items-center px-6 py-2 rounded-xl text-sm font-bold border-2 border-slate-100 text-black hover:bg-slate-50 hover:border-slate-200 transition-all disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-sm mr-2">restart_alt</span>
              Làm mới bộ lọc
            </button>
          </div>

          <div className="flex flex-wrap gap-2 md:gap-3 text-xs md:text-sm">
            {/* <div className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 font-bold border border-emerald-100 flex items-center gap-2 shadow-sm shadow-emerald-700/5">
              <span className="opacity-70">Tổng tiền vào:</span>
              <span className="tabular-nums">{formatCurrency(totalIn)}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 font-bold border border-rose-100 flex items-center gap-2 shadow-sm shadow-rose-700/5">
              <span className="opacity-70">Tổng tiền ra:</span>
              <span className="tabular-nums">{formatCurrency(totalOut)}</span>
            </div> */}
            <div className="px-3 py-1.5 rounded-xl bg-primary/10 text-black font-black border border-primary/20 flex items-center gap-2 shadow-sm shadow-primary/10">
              <span className="tracking-tight">Chi tiêu thực tế:</span>
              <span className="tabular-nums">{formatCurrency(netSpending)}</span>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs text-rose-600 font-medium">{error}</p>
        )}
      </div>

      {/* List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {transactions.length === 0 && !loading ? (
          <div className="p-8 text-center text-black text-sm">
            Chưa có giao dịch nào trong khoảng thời gian đã chọn.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {transactions.map((tx) => {
              const incoming = isIncomingTransaction(tx);
              const statusLabel = getTransactionStatusLabel(tx.status);
              const statusClass = getTransactionStatusClass(tx.status);

              return (
                <div
                  key={tx.id}
                  className="p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => handleOpenDetail(tx)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-semibold uppercase tracking-widest text-black">
                        {getTransactionTypeLabel(tx.type, tx.amount)}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {tx.description || 'Không có mô tả'}
                    </p>
                    <p className="text-xs text-black mt-1">
                      {formatDateTimeVi(tx.createdAt)}
                      {tx.id && <span className="ml-2 text-black">• Mã GD: {tx.id}</span>}
                    </p>
                  </div>

                  <div className="text-right min-w-[140px]">
                    <p
                      className={`text-base md:text-lg font-extrabold ${incoming ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                    >
                      {incoming ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                    </p>
                    {/* {Number.isFinite(tx.balanceAfter ?? NaN) && (
                      <p className="mt-1 text-xs text-black">
                        Số dư sau giao dịch: {formatCurrency((tx.balanceAfter as number) ?? 0)}
                      </p>
                    )} */}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {detailOpen && detailTx && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4"
          onClick={() => setDetailOpen(false)}
        >
          <div
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-black">Chi tiết giao dịch</p>
                <h2 className="text-lg font-black text-slate-900">{getTransactionTypeLabel(detailTx.type, detailTx.amount)}</h2>
                <p className="text-xs text-black mt-1">
                  Mã giao dịch: <span className="font-mono text-slate-700">{detailTx.id}</span>
                </p>
              </div>
              <button
                onClick={() => setDetailOpen(false)}
                className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-black hover:bg-slate-50 hover:text-slate-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4 text-sm text-slate-700">
              {detailLoading && (
                <p className="text-xs text-black">Đang tải thêm thông tin giao dịch...</p>
              )}
              {detailError && (
                <p className="text-xs text-rose-600 font-medium">{detailError}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-black uppercase tracking-widest mb-1">Số tiền</p>
                  <p className="text-base font-extrabold text-slate-900">
                    {isIncomingTransaction(detailTx) ? '+' : '-'}{formatCurrency(Math.abs(detailTx.amount))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-black uppercase tracking-widest mb-1">Trạng thái</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${getTransactionStatusClass(detailTx.status)}`}>
                    {getTransactionStatusLabel(detailTx.status)}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-black uppercase tracking-widest mb-1">Thời gian</p>
                  <p>{formatDateTimeVi(detailTx.createdAt)}</p>
                </div>
                {detailTx.walletId && (
                  <div>
                    <p className="text-xs text-black uppercase tracking-widest mb-1">Wallet ID</p>
                    <p className="font-mono text-xs">{detailTx.walletId}</p>
                  </div>
                )}
                {detailTx.walletType && (
                  <div>
                    <p className="text-xs text-black uppercase tracking-widest mb-1">Loại ví</p>
                    <p>{detailTx.walletType}</p>
                  </div>
                )}
                {Number.isFinite(detailTx.balanceBefore ?? NaN) && (
                  <div>
                    <p className="text-xs text-black uppercase tracking-widest mb-1">Số dư trước GD</p>
                    <p>{formatCurrency((detailTx.balanceBefore as number) ?? 0)}</p>
                  </div>
                )}
                {/* {Number.isFinite(detailTx.balanceAfter ?? NaN) && (
                  <div>
                    <p className="text-xs text-black uppercase tracking-widest mb-1">Số dư sau GD</p>
                    <p>{formatCurrency((detailTx.balanceAfter as number) ?? 0)}</p>
                  </div>
                )} */}
              </div>

              <div>
                <p className="text-xs text-black uppercase tracking-widest mb-1">Mô tả</p>
                <p className="text-sm text-slate-700 whitespace-pre-line">
                  {detailTx.description || 'Không có mô tả'}
                </p>
              </div>

              {(parentTransactionId || relatedChain.length > 0 || relatedTransactions.length > 0) && (
                <div className="border-t border-dashed border-slate-200 pt-4 mt-2">
                  <p className="text-xs text-black uppercase tracking-widest mb-2">Chuỗi giao dịch liên quan</p>
                  {parentTransactionId && (
                    <p className="text-xs text-black mb-3">
                      Giao dịch cha: <span className="font-mono">{parentTransactionId}</span>
                    </p>
                  )}

                  {relatedChain.length > 0 ? (
                    <div className="space-y-2 text-xs">
                      {[...relatedChain]
                        .sort((a, b) => {
                          const ta = new Date(a.createdAt).getTime();
                          const tb = new Date(b.createdAt).getTime();
                          return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
                        })
                        .map((rt) => {
                          const isCurrent = detailTx && rt.id === detailTx.id;
                          const incoming = isIncomingTransaction(rt);
                          return (
                            <button
                              key={rt.id}
                              type="button"
                              onClick={() => {
                                if (!isCurrent) {
                                  void handleOpenDetail(rt);
                                }
                              }}
                              className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors ${isCurrent
                                ? 'border-primary/60 bg-primary/5'
                                : 'border-slate-200 hover:border-primary/40 hover:bg-slate-50'
                                }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[11px] font-semibold uppercase tracking-widest text-black">
                                    {getTransactionTypeLabel(rt.type, rt.amount)}
                                  </span>
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${getTransactionStatusClass(rt.status)}`}
                                  >
                                    {getTransactionStatusLabel(rt.status)}
                                  </span>
                                  {isCurrent && (
                                    <span className="text-[10px] font-semibold text-primary">(Hiện tại)</span>
                                  )}
                                </div>
                                <p className="truncate text-[13px] text-slate-700">
                                  {rt.description || 'Không có mô tả'}
                                </p>
                                <p className="mt-0.5 text-[11px] text-black">
                                  {formatDateTimeVi(rt.createdAt)}
                                  {rt.id && (
                                    <span className="ml-2 font-mono text-[10px] text-black">{rt.id}</span>
                                  )}
                                </p>
                              </div>
                              <div className="text-right min-w-[90px]">
                                <p
                                  className={`font-extrabold text-[13px] ${incoming ? 'text-emerald-600' : 'text-rose-600'
                                    }`}
                                >
                                  {incoming ? '+' : '-'}{formatCurrency(Math.abs(rt.amount))}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  ) : relatedTransactions.length > 0 ? (
                    <ul className="space-y-1 text-xs text-black">
                      {relatedTransactions.map((rt, idx) => (
                        <li key={rt.transactionId || rt.id || idx}>
                          <span className="font-mono">{rt.transactionId || rt.id || 'N/A'}</span>
                          {typeof rt.type === 'string' && (
                            <span className="ml-1">• {getTransactionTypeLabel(String(rt.type))}</span>
                          )}
                          {typeof rt.amount !== 'undefined' && (
                            <span className="ml-1">• {formatCurrency(Number(rt.amount) || 0)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-black">Không có giao dịch liên quan.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionHistoryPage;
