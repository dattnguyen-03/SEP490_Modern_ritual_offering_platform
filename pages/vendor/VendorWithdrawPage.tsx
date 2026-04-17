import React, { useState, useEffect } from 'react';
import {
  createWithdrawal,
  getMyWallet,
  WalletInfo,
  getMyWithdrawalRequests,
  WithdrawalListItem
} from '../../services/walletService';
import toast from '../../services/toast';

interface VendorWithdrawPageProps {
  onNavigate: (path: string) => void;
}

const VendorWithdrawPage: React.FC<VendorWithdrawPageProps> = ({ onNavigate }) => {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [allWithdrawals, setAllWithdrawals] = useState<WithdrawalListItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);
  const [expandedTransactionId, setExpandedTransactionId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    amount: '',
    bankName: '',
    accountNumber: '',
    accountHolder: '',
  });

  // Filter withdrawals client-side based on status
  const withdrawals = filterStatus
    ? allWithdrawals.filter(w => w.status === filterStatus)
    : allWithdrawals;

  const fetchData = async () => {
    try {
      setLoading(true);
      const walletData = await getMyWallet('Vendor');
      setWallet(walletData);

      // Fetch all withdrawals WITHOUT status filter
      setLoadingWithdrawals(true);
      const withdrawalData = await getMyWithdrawalRequests();
      setAllWithdrawals(withdrawalData);

      // Pre-fill from wallet if available
      if (withdrawalData.length > 0) {
        const last = withdrawalData[0];
        setFormData(prev => ({
          ...prev,
          bankName: last.bankName || '',
          accountNumber: last.accountNumber || '',
          accountHolder: last.accountHolder || '',
        }));
      }
    } catch (err) {
      console.error('Failed to fetch withdraw data:', err);
      toast.error('Không thể tải dữ liệu ví.');
    } finally {
      setLoading(false);
      setLoadingWithdrawals(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(formData.amount.replace(/\./g, ''));

    if (isNaN(amount) || amount < 50000) {
      toast.error('Số tiền rút tối thiểu là 50.000 ₫.');
      return;
    }

    if (wallet && amount > (wallet.balance || 0)) {
      toast.error('Số dư khả dụng không đủ.');
      return;
    }

    try {
      setSubmitting(true);
      await createWithdrawal({
        amount,
        bankName: formData.bankName,
        accountNumber: formData.accountNumber,
        accountHolder: formData.accountHolder,
        type: 'Vendor'
      });
      toast.success('Yêu cầu rút tiền đã được gửi. Vui lòng chờ hệ thống phê duyệt.');
      setFormData({ ...formData, amount: '' });
      fetchData(); // Refresh
    } catch (err: any) {
      toast.error(err.message || 'Rút tiền thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatVnd = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'N/A';
      }
      return date.toLocaleDateString('vi-VN');
    } catch (err) {
      return 'N/A';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'Đã duyệt';
      case 'Rejected':
        return 'Bị từ chối';
      case 'Pending':
        return 'Chờ duyệt';
      default:
        return status;
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'Withdrawal':
        return 'Rút tiền';
      case 'Deposit':
        return 'Nạp tiền';
      case 'Transfer':
        return 'Chuyển tiền';
      case 'Refund':
        return 'Hoàn tiền';
      case 'Payment':
        return 'Thanh toán';
      case 'Charge':
        return 'Phí';
      default:
        return type;
    }
  };

  const getTransactionStatusLabel = (status: string) => {
    switch (status) {
      case 'Success':
        return '✓ Thành công';
      case 'Failed':
        return '✕ Thất bại';
      case 'Pending':
        return ' Chờ xử lý';
      case 'Cancelled':
        return '✕ Đã hủy';
      default:
        return status;
    }
  };

  const formatNumberInput = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    // Format with dots every 3 digits
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  return (
    <div className="min-h-screen py-12 px-4 md:px-8 font-sans">
      <div className="max-w-[1650px] mx-auto">

        {/* Header Section */}
        <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-start gap-5">
            <button
              onClick={() => onNavigate('/vendor/transactions')}
              className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-700 flex-shrink-0 hover:bg-slate-50 hover:text-black transition-all group"
              title="Quay lại Giao dịch"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Rút tiền</h1>
              <p className="text-black font-bold text-sm">Rút doanh thu từ ví Vendor về tài khoản ngân hàng của bạn.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

          {/* Form Section */}
          <div className="bg-white rounded-[3rem] p-8 md:p-12 border border-slate-200 shadow-sm">
            <div className="mb-10 p-8 bg-black rounded-[2rem] text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full -mr-10 -mt-10" />
              <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-2 relative z-10">Số dư khả dụng</p>
              <h2 className="text-4xl font-black tabular-nums relative z-10">
                {wallet ? formatVnd(wallet.balance || 0) : '0 ₫'}
              </h2>
            </div>

            <div className="mb-8 grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-[1.5rem] p-4 border border-slate-200">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Số tiền bị giữ</p>
                <p className="text-lg font-black text-slate-900">{wallet ? formatVnd(wallet.heldBalance || 0) : '0 ₫'}</p>
              </div>
              <div className="bg-slate-50 rounded-[1.5rem] p-4 border border-slate-200">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Trạng thái ví</p>
                <p className="text-sm font-bold text-green-600">{wallet?.status === 'Active' ? '✓ Hoạt động' : wallet?.status || 'N/A'}</p>
              </div>
            </div>

            <form onSubmit={handleWithdraw} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Số tiền muốn rút (₫)</label>
                <input
                  type="text"
                  required
                  placeholder="Vd: 1.000.000"
                  className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-lg text-slate-900 focus:ring-2 focus:ring-black transition-all"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: formatNumberInput(e.target.value) })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Tên ngân hàng</label>
                  <input
                    type="text"
                    required
                    placeholder="Vd: Vietcombank"
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-black transition-all"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Số tài khoản</label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập số tài khoản"
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-black transition-all"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Tên chủ tài khoản</label>
                <input
                  type="text"
                  required
                  placeholder="VD: NGUYEN VAN A"
                  className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-black transition-all uppercase"
                  value={formData.accountHolder}
                  onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  disabled={submitting || loading}
                  className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-black/20 hover:-translate-y-1 active:translate-y-0 transition-all disabled:opacity-50 disabled:translate-y-0"
                >
                  {submitting ? 'Đang gửi yêu cầu...' : 'Xác nhận rút tiền'}
                </button>
              </div>

              <p className="text-[10px] text-slate-400 text-center font-bold px-4 leading-relaxed">
                Yêu cầu rút tiền sẽ được xử lý trong vòng 24h làm việc. Phí chuyển khoản tùy thuộc vào ngân hàng thụ hưởng.
              </p>
            </form>
          </div>

          {/* Recently Withdrawal Section */}
          <div className="space-y-8">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                <span className="w-1.5 h-6 bg-black rounded-full" />
                Lịch sử rút tiền
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {['', 'Pending', 'Approved', 'Rejected'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${filterStatus === status
                        ? 'bg-black text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                  >
                    {status ? (status === 'Pending' ? 'Chờ duyệt' : status === 'Approved' ? 'Đã duyệt' : 'Bị từ chối') : 'Tất cả'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {loadingWithdrawals ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="bg-white rounded-[2rem] p-6 border border-slate-100 animate-pulse h-24" />
                ))
              ) : withdrawals.length === 0 ? (
                <div className="bg-white rounded-[2rem] p-12 border border-slate-100 text-center">
                  <p className="text-slate-400 font-bold">Chưa có yêu cầu rút tiền {filterStatus ? `trong trạng thái này` : ''}.</p>
                </div>
              ) : (
                withdrawals.map((wd) => (
                  <div key={wd.withdrawalId} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                    {/* Header Row */}
                    <div className="p-6 flex items-center justify-between group hover:border-black transition-all">
                      <div className="flex items-center gap-5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs flex-shrink-0 ${wd.status === 'Approved' ? 'bg-emerald-100 text-emerald-600' :
                            wd.status === 'Rejected' ? 'bg-rose-100 text-rose-600' :
                              'bg-amber-100 text-amber-600'
                          }`}>
                          {wd.status === 'Approved' ? '✓' : wd.status === 'Rejected' ? '✕' : '...'}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900">{formatVnd(wd.amount)}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{wd.bank}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            {formatDate(wd.processedDate || wd.requestedAt || '')}
                          </p>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md inline-block ${wd.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' :
                              wd.status === 'Rejected' ? 'bg-rose-50 text-rose-600' :
                                'bg-amber-50 text-amber-600'
                            }`}>
                            {getStatusLabel(wd.status)}
                          </span>
                        </div>
                        {wd.rejectionReason || wd.transaction ? (
                          <button
                            onClick={() => setExpandedTransactionId(
                              expandedTransactionId === wd.withdrawalId ? null : wd.withdrawalId
                            )}
                            className="ml-4 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all"
                          >
                            {expandedTransactionId === wd.withdrawalId ? '▼ Ẩn' : '▶ Xem'}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {/* Details Section - Show rejection reason and transaction info when expanded */}
                    {expandedTransactionId === wd.withdrawalId && (wd.rejectionReason || wd.transaction) && (
                      <div className="px-6 pb-6 border-t border-slate-100 space-y-3">
                        {wd.rejectionReason && (
                          <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
                            <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest mb-1">Lý do từ chối</p>
                            <p className="text-sm text-rose-700">{wd.rejectionReason}</p>
                          </div>
                        )}
                        {wd.transaction && (
                          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <p className="text-[11px] font-black text-black uppercase tracking-widest mb-3">Giao dịch liên quan</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-slate-400 font-bold">ID:</span>
                                <p className="font-mono text-slate-700 truncate mt-0.5">{wd.transaction.transactionId}</p>
                              </div>
                              <div>
                                <span className="text-slate-400 font-bold">Loại:</span>
                                <p className="text-slate-700 font-bold mt-0.5">{getTransactionTypeLabel(wd.transaction.type)}</p>
                              </div>
                              <div>
                                <span className="text-slate-400 font-bold">Trạng thái:</span>
                                <p className={`font-bold mt-0.5 ${wd.transaction.status === 'Success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {getTransactionStatusLabel(wd.transaction.status)}
                                </p>
                              </div>
                            </div>
                            {wd.transaction.description && (
                              <div className="mt-3">
                                <span className="text-slate-400 font-bold text-xs">Mô tả:</span>
                                <p className="text-slate-600 text-sm leading-relaxed mt-1">{wd.transaction.description}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorWithdrawPage;
