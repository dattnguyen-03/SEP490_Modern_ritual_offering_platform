import React, { useState, useEffect, useCallback } from 'react';
import { refundService, RefundRecord } from '../../services/refundService';

const formatVnd = (value: unknown): string => {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return '0đ';
  return `${amount.toLocaleString('vi-VN')}đ`;
};

const formatDateVi = (value: unknown): string => {
  if (!value) return 'N/A';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const STATUS_CONFIG: Record<string, { badge: string; label: string; icon: string }> = {
  Pending: { badge: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Chờ xử lý', icon: '' },
  Approved: { badge: 'bg-green-100 text-green-700 border-green-200', label: 'Đã duyệt', icon: '' },
  Rejected: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Đã từ chối', icon: '' },
};

const getStatusCfg = (status: string) =>
  STATUS_CONFIG[status] ?? { badge: 'bg-gray-100 text-gray-600 border-gray-200', label: status, icon: '' };

const TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'Pending', label: 'Chờ xử lý' },
  { id: 'Approved', label: 'Đã duyệt' },
  { id: 'Rejected', label: 'Từ chối' },
];

interface Props {
  onNavigate?: (path: string) => void;
}

const RefundManagement: React.FC<Props> = ({ onNavigate }) => {
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState('all');
  const [selected, setSelected] = useState<RefundRecord | null>(null);
  const [processing, setProcessing] = useState(false);
  const [actionNote, setActionNote] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [imageModal, setImageModal] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  const fetchRefunds = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await refundService.getAllRefunds('Staff', 1, 100);
      setRefunds(data);
    } catch {
      setError('Không thể tải danh sách yêu cầu hoàn tiền. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRefunds(); }, [fetchRefunds]);

  const filtered = refunds
    .filter(r => filterTab === 'all' || r.status === filterTab)
    .filter(r => {
      if (!searchText.trim()) return true;
      const q = searchText.toLowerCase();
      return (
        r.customerName.toLowerCase().includes(q) ||
        r.orderId.toLowerCase().includes(q) ||
        r.orderCode.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const stats = {
    total: refunds.length,
    pending: refunds.filter(r => r.status === 'Pending').length,
    approved: refunds.filter(r => r.status === 'Approved').length,
    rejected: refunds.filter(r => r.status === 'Rejected').length,
    totalAmount: refunds.filter(r => r.status === 'Approved').reduce((s, r) => s + r.refundAmount, 0),
  };

  const handleApproveRefund = async (id: string) => {
    try {
      setProcessing(true);
      await refundService.approveRefund(id, 'Approved by staff');
      setSuccessMsg('Đã chấp nhận hoàn tiền');
      await fetchRefunds();
      setSelected(null);
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectRefund = async (id: string) => {
    try {
      setProcessing(true);
      await refundService.rejectRefund(id, 'Rejected by staff');
      setSuccessMsg('Đã từ chối hoàn tiền');
      await fetchRefunds();
      setSelected(null);
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleSendReview = async () => {
    if (!selected) return;
    if (!actionNote.trim()) {
      setActionError('Vui lòng nhập ghi chú cho admin.');
      return;
    }

    setProcessing(true);
    setActionError(null);
    setSuccessMsg(null);

    try {
      const success = await refundService.reviewRefund(selected.refundId, actionNote.trim());

      if (success) {
        setSuccessMsg('Đã gửi ghi chú cho admin.');
        setActionNote('');
        await fetchRefunds();
        const updated = await refundService.getRefundById(selected.refundId, 'Staff').catch(() => null);
        if (updated) setSelected(updated);
      } else {
        setActionError('Gửi ghi chú thất bại. Vui lòng thử lại.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Có lỗi xảy ra.');
    } finally {
      setProcessing(false);
    }
  };

  const openDetail = (r: RefundRecord) => {
    setSelected(r);
    setActionNote('');
    setActionError(null);
    setSuccessMsg(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-primary mb-4" />
          <p className="text-black font-medium">Đang tải danh sách yêu cầu hoàn tiền...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center bg-white rounded-3xl shadow-sm border border-gray-200 p-10 max-w-sm w-full">
          <p className="text-red-500 font-semibold text-base mb-6">⚠️ {error}</p>
          <button
            onClick={fetchRefunds}
            className="bg-primary text-white font-bold py-3 px-8 rounded-xl hover:bg-primary/90 transition"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Quản lý hoàn tiền</h1>
        <p className="text-gray-600 mt-1">Ghi chú và chuyển tiếp yêu cầu cho admin</p>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Tổng yêu cầu', value: stats.total, color: 'text-primary', icon: '' },
          { label: 'Chờ xử lý', value: stats.pending, color: 'text-yellow-600', icon: '' },
          { label: 'Đã duyệt', value: stats.approved, color: 'text-green-600', icon: '' },
          { label: 'Từ chối', value: stats.rejected, color: 'text-red-500', icon: '' },
          { label: 'Tổng hoàn tiền', value: formatVnd(stats.totalAmount), color: 'text-blue-600', icon: '' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <p className="text-xl mb-1">{s.icon}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + Tabs */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-4">
        <div className="relative w-full md:w-80">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Tìm theo tên, mã đơn, lý do..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1 pb-4 mb-6 border-b border-gray-200">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterTab(tab.id)}
            className={`whitespace-nowrap px-5 py-3 rounded-t-xl font-bold text-sm transition-all border-b-2 ${filterTab === tab.id
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-black hover:text-slate-800 hover:bg-gray-100'
              }`}
          >
            {tab.label}
            {tab.id !== 'all' && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-current/10">
                {refunds.filter(r => r.status === tab.id).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-gray-200 shadow-sm text-center">
          <h3 className="text-xl font-bold text-gray-800 mb-2">Chưa có yêu cầu nào</h3>
          <p className="text-gray-500">Không có yêu cầu hoàn tiền nào ở trạng thái này.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(refund => {
            const cfg = getStatusCfg(refund.status);
            return (
              <div key={refund.refundId}
                className="bg-white rounded-[2rem] border border-gray-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">

                {/* Card header */}
                <div className="p-5 md:p-6 flex flex-col md:flex-row gap-3 justify-between items-start md:items-center border-b border-gray-100 bg-gray-50/50">
                  <div className="flex flex-wrap gap-4 md:items-center">
                    <div>
                      <span className="text-xs font-bold uppercase text-slate-400 tracking-widest block mb-0.5">Khách hàng</span>
                      <span className="text-gray-900 font-semibold">{refund.customerName}</span>
                    </div>
                    <div className="hidden md:block w-px h-8 bg-gray-300" />
                    <div>
                      <span className="text-xs font-bold uppercase text-slate-400 tracking-widest block mb-0.5">Mã đơn</span>
                      <span className="font-mono text-gray-900 font-bold">#{refund.orderCode || refund.orderId.substring(0, 8).toUpperCase()}</span>
                    </div>
                    <div className="hidden md:block w-px h-8 bg-gray-300" />
                    <div>
                      <span className="text-xs font-bold uppercase text-slate-400 tracking-widest block mb-0.5">Ngày gửi</span>
                      <span className="text-gray-700 font-medium text-sm">{formatDateVi(refund.createdAt)}</span>
                    </div>
                    <div className="hidden md:block w-px h-8 bg-gray-300" />
                    <div>
                      <span className="text-xs font-bold uppercase text-slate-400 tracking-widest block mb-0.5">Số tiền hoàn</span>
                      <span className="text-primary font-black">{formatVnd(refund.refundAmount)}</span>
                    </div>
                  </div>
                  <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wide border flex-shrink-0 whitespace-nowrap ${cfg.badge}`}>
                    {cfg.icon} {cfg.label}
                  </span>
                </div>

                {/* Card body */}
                <div className="p-5 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Lý do hoàn tiền</p>
                    <p className="text-gray-700 text-sm leading-relaxed line-clamp-2">{refund.reason || 'Không có lý do'}</p>
                    {refund.items.length > 0 && (
                      <p className="text-xs text-gray-400 mt-2">
                        {refund.items.length} sản phẩm yêu cầu hoàn
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3 flex-shrink-0">
                    <button
                      onClick={() => openDetail(refund)}
                      className="px-5 py-2.5 bg-primary text-white font-bold text-sm rounded-xl hover:bg-primary/90 transition shadow-lg shadow-primary/20"
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
      {/* Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-gray-50 w-full max-w-3xl my-8 rounded-[2rem] shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="bg-white px-8 py-6 flex items-center gap-4 border-b border-gray-100">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                   <h2 className="text-xl font-black text-gray-900">Chi tiết khiếu nại hoàn tiền</h2>
                   <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                     selected.status === 'Approved' ? 'bg-green-50 text-green-600 border-green-100' : 
                     selected.status === 'Rejected' ? 'bg-red-50 text-red-600 border-red-100' :
                     'bg-orange-50 text-orange-600 border-orange-100'
                   }`}>
                    {selected.status === 'Pending' ? 'ESCALATED' : getStatusCfg(selected.status).label}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                  ID: {selected.refundId}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-200 hover:bg-gray-50 transition flex-shrink-0"
              >
                <span className="material-symbols-outlined text-gray-400">close</span>
              </button>
            </div>
            <div className="bg-white">
              {/* Header Info Grid */}
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer Box */}
                <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 flex gap-4 items-start">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                    <span className="material-symbols-outlined text-2xl">person</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Khách hàng</p>
                    <p className="font-bold text-slate-800 text-lg leading-tight truncate">{selected.customerName}</p>
                    <p className="text-sm font-medium text-slate-500 mt-1">{selected.customerPhone || 'Không có SĐT'}</p>
                  </div>
                </div>

                {/* Shop Box */}
                <div className="bg-purple-50/30 p-6 rounded-[2rem] border border-purple-100/50 flex gap-4 items-start">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600 flex-shrink-0">
                    <span className="material-symbols-outlined text-2xl">storefront</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-1">Cửa hàng</p>
                    <p className="font-bold text-slate-800 text-lg leading-tight truncate">{selected.shopName}</p>
                    <p className="text-sm font-medium text-slate-500 mt-1 truncate">ID: {selected.vendorId}</p>
                  </div>
                </div>
              </div>

              <div className="px-8 pb-8 space-y-8">
                {/* Products Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400 text-xl">shopping_bag</span>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Sản phẩm yêu cầu hoàn tiền</h3>
                  </div>
                  <div className="space-y-3">
                    {selected.items.map((item, i) => (
                      <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 flex gap-4 items-center shadow-sm">
                        <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-100 flex-shrink-0">
                          <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-300">
                             <span className="material-symbols-outlined">image</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 truncate text-base">{item.packageName}</p>
                          <p className="text-xs text-slate-400 font-medium">Phân loại: {item.variantName || 'Mặc định'}</p>
                          <p className="text-lg font-black text-primary mt-0.5">{formatVnd(item.refundAmount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Evidence Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Customer Evidence */}
                  <div className="bg-rose-50/30 p-6 rounded-[2.5rem] border border-rose-100/50 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-rose-400 text-xl">error</span>
                      <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest">Lý do khách hàng</h3>
                    </div>
                    <div className="p-4 bg-white/60 rounded-2xl border border-rose-100/50 shadow-sm italic text-slate-700 text-sm leading-relaxed">
                      "{selected.reason || 'Không có mô tả chi tiết'}"
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {selected.proofImages.map((url, idx) => (
                        <div key={idx} className="relative group/img">
                          <button onClick={() => setImageModal(url)} className="block w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:border-primary transition-all">
                            <img src={url} className="w-full h-full object-cover" />
                          </button>
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white/90 px-1.5 py-0.5 rounded text-[8px] font-black text-slate-500 shadow-sm border border-slate-100 whitespace-nowrap">Ảnh hư</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Shop Response */}
                  <div className="bg-emerald-50/30 p-6 rounded-[2.5rem] border border-emerald-100/50 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-400 text-xl">check_circle</span>
                      <h3 className="text-xs font-black text-emerald-600 uppercase tracking-widest">Phản hồi từ Shop</h3>
                    </div>
                    <div className="p-4 bg-white/60 rounded-2xl border border-emerald-100/50 shadow-sm italic text-slate-700 text-sm leading-relaxed">
                      "{selected.vendorResponse || 'Shop chưa có phản hồi chi tiết'}"
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {selected.vendorPreparationImages?.map((url, idx) => (
                        <div key={idx} className="relative group/img">
                          <button onClick={() => setImageModal(url)} className="block w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:border-primary transition-all">
                            <img src={url} className="w-full h-full object-cover" />
                          </button>
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white/90 px-1.5 py-0.5 rounded text-[8px] font-black text-slate-500 shadow-sm border border-slate-100 whitespace-nowrap">Ảnh chuẩn bị</span>
                        </div>
                      ))}
                      {selected.vendorDeliveryImages?.map((url, idx) => (
                        <div key={idx} className="relative group/img">
                          <button onClick={() => setImageModal(url)} className="block w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:border-primary transition-all">
                            <img src={url} className="w-full h-full object-cover" />
                          </button>
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white/90 px-1.5 py-0.5 rounded text-[8px] font-black text-slate-500 shadow-sm border border-slate-100 whitespace-nowrap">Ảnh giao</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action panel */}
                {selected.status === 'Pending' && (
                  <div className="bg-slate-50 p-8 border-t border-slate-100 flex items-center justify-between -mx-8 -mb-8 mt-8">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-500">Tổng tiền hoàn trả:</span>
                      <span className="text-2xl font-black text-primary">{formatVnd(selected.refundAmount)}</span>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleRejectRefund(selected.refundId)}
                        disabled={processing}
                        className="px-8 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition active:scale-95 text-sm"
                      > Từ chối</button>
                      <button
                        onClick={() => handleApproveRefund(selected.refundId)}
                        disabled={processing}
                        className="px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition shadow-lg shadow-blue-200 active:scale-95 text-sm"
                      > Chấp nhận hoàn tiền</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image fullscreen */}
      {imageModal && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200] p-4"
          onClick={() => setImageModal(null)}
        >
          <button
            className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition"
            onClick={() => setImageModal(null)}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <img
            src={imageModal}
            alt="Proof fullscreen"
            className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default RefundManagement;
