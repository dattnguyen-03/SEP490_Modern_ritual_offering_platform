import React, { useState, useEffect, useCallback } from 'react';
import { refundService, RefundRecord } from '../../services/refundService';
import { orderService } from '../../services/orderService';


const formatVnd = (value: unknown): string => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? `${n.toLocaleString('vi-VN')}đ` : '0đ';
};

const formatDateVi = (value: unknown): string => {
  if (!value) return 'N/A';
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('vi-VN');
};

const getRemainingAutoAccept = (createdAt: string | unknown) => {
  if (!createdAt) return null;
  const created = new Date(String(createdAt)).getTime();
  if (!Number.isFinite(created)) return null;

  const twelveHoursMs = 12 * 60 * 60 * 1000;
  const deadline = created + twelveHoursMs;
  const now = Date.now();
  const diff = deadline - now;

  if (diff <= 0) {
    return { hours: 0, minutes: 0, isOverdue: true } as const;
  }

  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  return { hours, minutes, isOverdue: false } as const;
};


const STATUS_CFG: Record<string, { badge: string; label: string; icon: string }> = {
  Pending:   { badge: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Chờ xử lý', icon: '' },
  Approved:  { badge: 'bg-green-100  text-green-700  border-green-200',  label: 'Đã duyệt',  icon: '' },
  Rejected:  { badge: 'bg-red-100    text-red-700    border-red-200',    label: 'Từ chối',   icon: '' },
  Cancelled: { badge: 'bg-gray-100   text-gray-600   border-gray-300',   label: 'Đã hủy',   icon: '' },
};

const getStatusCfg = (s: string) =>
  STATUS_CFG[s] ?? { badge: 'bg-gray-100 text-gray-600 border-gray-200', label: s, icon: '' };

const SUB_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'Pending', label: 'Chờ xử lý' },
  { id: 'Approved', label: 'Đã duyệt' },
  { id: 'Rejected', label: 'Từ chối' },
];


interface Props {
  onPendingCount?: (count: number) => void;
}


const VendorRefundTab: React.FC<Props> = ({ onPendingCount }) => {
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // Detail modal + action
  const [selected, setSelected] = useState<RefundRecord | null>(null);
  const [orderTotal, setOrderTotal] = useState<number | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [imageModal, setImageModal] = useState<string | null>(null);

  // Quick action confirm modal (từ list card)
  const [confirmRefund, setConfirmRefund] = useState<RefundRecord | null>(null);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);
  const [confirmNote, setConfirmNote] = useState('');
  const [confirmProcessing, setConfirmProcessing] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);


  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const data = await refundService.getAllRefunds();
      setRefunds(data);
      onPendingCount?.(data.filter(r => r.status === 'Pending').length);
    } catch {
      // silently ignore – no critical state to break parent
    } finally {
      setLoading(false);
    }
  }, [onPendingCount]);

  useEffect(() => { fetch(); }, [fetch]);


  const openDetail = async (r: RefundRecord, preAction: 'approve' | 'reject' | null = null) => {
    setSelected(r);
    setAction(preAction);
    setNote('');
    setActionError(null);
    setSuccessMsg(null);
    // Fetch order details to get total amount
    try {
      const order = await orderService.getVendorOrderDetails(r.orderId);
      if (order) {
        setOrderTotal(order.pricing?.subTotal || null);
      }
    } catch {
      setOrderTotal(null);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setOrderTotal(null);
  };

  const handleProcess = async () => {
    if (!selected || !action) return;
    if (!note.trim()) {
      setActionError(action === 'reject' ? 'Vui lòng nhập lý do từ chối' : 'Vui lòng nhập ghi chú duyệt hoàn tiền');
      return;
    }
    setProcessing(true);
    setActionError(null);
    try {
      const ok = await refundService.vendorRespondRefund(
        selected.refundId,
        action === 'approve',
        note
      );

      if (ok) {
        setSuccessMsg(action === 'approve' ? 'Đã duyệt yêu cầu hoàn tiền!' : 'Đã từ chối yêu cầu!');
        setNote('');
        setAction(null);
        await fetch();
        const updated = await refundService.getRefundById(selected.refundId).catch(() => null);
        if (updated) setSelected(updated);
      } else {
        setActionError('Thao tác thất bại. Vui lòng thử lại.');
      }
    } catch (e: any) {
      setActionError(e.message || 'Có lỗi xảy ra.');
    } finally {
      setProcessing(false);
    }
  };

  const handleQuickAction = async () => {
    if (!confirmRefund || !confirmAction) return;
    if (!confirmNote.trim()) {
      setConfirmError(confirmAction === 'reject' ? 'Vui lòng nhập lý do từ chối' : 'Vui lòng nhập ghi chú duyệt hoàn tiền');
      return;
    }
    setConfirmProcessing(true);
    setConfirmError(null);
    try {
      const ok = await refundService.vendorRespondRefund(
        confirmRefund.refundId,
        confirmAction === 'approve',
        confirmNote
      );

      if (ok) {
        // Success - close confirm modal and refresh
        setConfirmRefund(null);
        setConfirmAction(null);
        setConfirmNote('');
        await fetch();
        // Show success toast
        setSuccessMsg(confirmAction === 'approve' ? ' Đã duyệt yêu cầu hoàn tiền!' : ' Đã từ chối yêu cầu!');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setConfirmError('Thao tác thất bại. Vui lòng thử lại.');
      }
    } catch (e: any) {
      setConfirmError(e.message || 'Có lỗi xảy ra.');
    } finally {
      setConfirmProcessing(false);
    }
  };

  const filtered = refunds
    .filter(r => filterTab === 'all' || r.status === filterTab)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const currentRefunds = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);



  return (
    <>
      <div className="flex flex-wrap gap-1 pb-4 mb-6 border-b border-gray-200">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setFilterTab(tab.id);
              setCurrentPage(1);
            }}
            className={`whitespace-nowrap px-5 py-3 rounded-t-xl font-bold text-sm transition-all border-b-2 ${filterTab === tab.id
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-black hover:text-slate-800 hover:bg-gray-100'
              }`}
          >
            {tab.label}
            {tab.id !== 'all' && (
              <span className="ml-1.5 text-[10px] font-black opacity-60">
                ({refunds.filter(r => r.status === tab.id).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-gray-200 shadow-sm text-center">
          <div className="text-5xl mb-4"></div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Chưa có yêu cầu nào</h3>
          <p className="text-gray-500">Không có yêu cầu hoàn tiền ở trạng thái này.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {currentRefunds.map(refund => {
            const cfg = getStatusCfg(refund.status);
            const remaining = refund.status === 'Pending' ? getRemainingAutoAccept(refund.createdAt) : null;
            return (
              <div
                key={refund.refundId}
                className="bg-white rounded-[2rem] border border-gray-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
              >
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
                      <span className="font-mono text-gray-900 font-bold">
                        #{(refund.orderCode || refund.orderId.substring(0, 8)).toUpperCase()}
                      </span>
                    </div>
                    <div className="hidden md:block w-px h-8 bg-gray-300" />
                    <div>
                      <span className="text-xs font-bold uppercase text-slate-400 tracking-widest block mb-0.5">Ngày gửi</span>
                      <span className="text-gray-700 text-sm">{formatDateVi(refund.createdAt)}</span>
                    </div>
                    {/* {refund.refundAmount > 0 && (
                      <>
                        <div className="hidden md:block w-px h-8 bg-gray-300" />
                        <div>
                          <span className="text-xs font-bold uppercase text-slate-400 tracking-widest block mb-0.5">Số tiền hoàn</span>
                          <span className="text-primary font-black">{formatVnd(refund.refundAmount)}</span>
                        </div>
                      </>
                    )} */}
                  </div>
                  <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border flex-shrink-0 ${cfg.badge}`}>
                    {cfg.icon} {cfg.label}
                  </span>
                </div>

                {/* Card body */}
                <div className="p-5 md:p-6 space-y-4">
                  {/* Reason row */}

                  {/* Products + Amount row */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Products column (left) - names only */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Sản phẩm yêu cầu hoàn</p>
                      {refund.items.length > 0 ? (
                        <div className="space-y-2">
                          {refund.items.slice(0, 2).map((item, idx) => (
                            <div key={item.refundItemId || `${refund.refundId}-${idx}`} className="text-sm">
                              <p className="text-gray-800 font-medium">
                                {item.packageName} <span className="text-gray-500 font-normal">x {item.quantity}</span>
                              </p>
                            </div>
                          ))}
                          {refund.items.length > 2 && (
                            <p className="text-xs text-gray-500 italic mt-2">+{refund.items.length - 2} sản phẩm khác</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Không có sản phẩm</p>
                      )}
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Lý do</p>
                        <p className="text-gray-700 text-sm">{refund.reason || 'Không có lý do'}</p>
                      </div>
                    </div>

                    {/* Amount column (right) - item prices + total */}
                    {refund.refundAmount >= 0 && (
                      <div className="flex flex-col gap-2 sm:pl-4 sm:border-l border-gray-200 flex-shrink-0 text-right">
                        {/* <div>
                          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Chi tiết(bao gồm ship)</p>
                          <div className="space-y-1 mb-3">
                              <div className="text-sm">
                                <span className="font-bold text-primary">
                                  {formatVnd(refund.orderFinalAmount)}
                                </span>
                              </div>
                          </div>
                        </div> */}
                        <div className="pt-2 border-t border-gray-200">
                          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Tổng tiền hoàn :</p>
                          <p className="text-2xl font-black text-primary">{formatVnd(refund.refundAmount)}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {refund.status === 'Pending' && remaining && (
                    <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                      {remaining.isOverdue ? (
                        <span>
                          Yêu cầu này đã quá <span className="font-bold">12 giờ</span> chờ phản hồi. Hệ thống có thể đã tự động chấp nhận hoặc chuyển sang bước xử lý tiếp theo.
                        </span>
                      ) : (
                        <span>
                          Hệ thống cho phép tối đa <span className="font-bold">12 giờ</span> kể từ khi khách gửi yêu cầu.<br />
                          Hiện bạn còn khoảng{' '}
                          <span className="font-bold">
                            {remaining.hours} giờ {remaining.minutes} phút
                          </span>{' '}
                          để phản hồi trước khi hệ thống <span className="font-bold">tự động chấp nhận</span> yêu cầu hoàn tiền này.
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-wrap justify-end pt-2 border-t border-gray-100">
                    {refund.status === 'Pending' && (
                      <>
                        <button
                          onClick={() => { setConfirmRefund(refund); setConfirmAction('approve'); setConfirmNote(''); setConfirmError(null); }}
                          className="px-4 py-2 bg-green-600 text-white font-bold text-sm rounded-xl hover:bg-green-700 transition"
                        > Duyệt</button>
                        <button
                          onClick={() => { setConfirmRefund(refund); setConfirmAction('reject'); setConfirmNote(''); setConfirmError(null); }}
                          className="px-4 py-2 bg-red-500 text-white font-bold text-sm rounded-xl hover:bg-red-600 transition"
                        > Từ chối</button>
                      </>
                    )}
                    <button
                      onClick={() => openDetail(refund)}
                      className="px-4 py-2 bg-primary text-white font-bold text-sm rounded-xl hover:bg-primary/90 transition shadow-md shadow-primary/20"
                    >Xem chi tiết</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-3 px-6 py-4 border border-slate-200 bg-white rounded-2xl shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Hiển thị <span className="text-slate-900">{Math.min(filtered.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}</span>
            - <span className="text-slate-900">{Math.min(filtered.length, currentPage * ITEMS_PER_PAGE)}</span>
            trên <span className="text-slate-900">{filtered.length}</span> kết quả
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white rounded-xl flex items-center justify-center text-black hover:bg-black hover:text-white transition-all shadow-sm disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-black border border-slate-200 text-[10px] font-bold uppercase tracking-widest"
            >
              Trước
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-10 h-10 rounded-xl font-bold text-[10px] transition-all ${currentPage === pageNum ? 'bg-black text-white shadow-lg' : 'bg-white text-black hover:bg-slate-50 border border-slate-200'}`}
                >
                  {pageNum}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-white rounded-xl flex items-center justify-center text-black hover:bg-black hover:text-white transition-all shadow-sm disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-black border border-slate-200 text-[10px] font-bold uppercase tracking-widest"
            >
              Sau
            </button>
          </div>
        </div>
      )}

      {confirmRefund && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40 p-4"
          onClick={() => setConfirmRefund(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal title */}
            <div className={`mb-4 p-4 rounded-xl text-center font-bold ${confirmAction === 'approve'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-600'
              }`}>
              {confirmAction === 'approve'
                ? ' Xác nhận duyệt hoàn tiền'
                : ' Xác nhận từ chối yêu cầu'}
            </div>

            {/* Refund summary */}
            <div className="mb-4 p-4 bg-gray-50 rounded-xl space-y-2 text-sm">
              <p><span className="text-gray-600">Mã yêu cầu:</span> <span className="font-bold text-primary">{confirmRefund.refundId}</span></p>
              {/* <p><span className="text-gray-600">Số tiền:</span> <span className="font-bold text-primary">{formatVnd(confirmRefund.refundAmount)}</span></p> */}
              <p><span className="text-gray-600">Lý do:</span> <span className="text-gray-700">{confirmRefund.reason || 'N/A'}</span></p>
            </div>

            {/* Note textarea for reject */}
            {confirmAction === 'reject' && (
              <>
                <textarea
                  value={confirmNote}
                  onChange={e => { setConfirmNote(e.target.value); setConfirmError(null); }}
                  placeholder="Lý do từ chối (bắt buộc)..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-300/50 focus:border-red-400 resize-none mb-4"
                />
                {confirmError && (
                  <p className="text-xs text-red-500 font-medium mb-4">{confirmError}</p>
                )}
              </>
            )}
 
            {/* Note textarea for approve (mandatory) */}
            {confirmAction === 'approve' && (
              <>
                <textarea
                  value={confirmNote}
                  onChange={e => { setConfirmNote(e.target.value); setConfirmError(null); }}
                  placeholder="Ghi chú duyệt (bắt buộc)..."
                  rows={2}
                  className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 resize-none mb-4 ${
                    confirmError ? 'border-red-400 ring-red-300/50' : 'border-gray-200 focus:ring-green-300/50 focus:border-green-400'
                  }`}
                />
                {confirmError && (
                  <p className="text-xs text-red-500 font-medium mb-4">{confirmError}</p>
                )}
              </>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmRefund(null)}
                disabled={confirmProcessing}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 transition disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleQuickAction}
                disabled={confirmProcessing}
                className={`flex-1 py-2.5 text-white rounded-xl text-sm font-bold transition disabled:opacity-50 ${confirmAction === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-500 hover:bg-red-600'
                  }`}
              >
                {confirmProcessing ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}


      {selected && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto"
          onClick={closeDetail}
        >
          <div
            className="bg-gray-50 w-full max-w-2xl my-8 rounded-[2rem] shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="bg-white px-8 py-6 flex items-center gap-4 border-b border-gray-100">
              <button
                onClick={closeDetail}
                className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-200 hover:bg-gray-50 transition flex-shrink-0"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-1">
                <h2 className="text-xl font-black text-gray-900">Chi tiết yêu cầu hoàn tiền</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Đơn hàng #{(selected.orderCode || selected.orderId.substring(0, 8)).toUpperCase()}
                </p>
              </div>
              <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border ${getStatusCfg(selected.status).badge}`}>
                {getStatusCfg(selected.status).icon} {getStatusCfg(selected.status).label}
              </span>
            </div>

            <div className="p-6 space-y-5">
              {/* Customer info */}
              <div className="bg-white p-5 rounded-[1.5rem] border border-gray-200">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Thông tin khách hàng</h3>
                <p className="font-bold text-lg text-primary">{selected.customerName}</p>
                <div className="flex flex-wrap gap-4 mt-1.5 text-sm text-gray-500">
                  {selected.customerPhone && <span> {selected.customerPhone}</span>}
                  {selected.customerEmail && <span> {selected.customerEmail}</span>}
                </div>
              </div>
              {/* Refund Info Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-[1.5rem] border border-gray-200">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Giá đơn hàng + Phí vận chuyển</h3>
                  <p className="font-bold text-2xl text-gray-900">{formatVnd(selected.orderFinalAmount || orderTotal || 0)}</p>
                </div>

                <div className="bg-white p-5 rounded-[1.5rem] border border-gray-200">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Số tiền yêu cầu hoàn</h3>
                  <p className="font-bold text-2xl text-primary">{formatVnd(selected.refundAmount)}</p>
                </div>
              </div>

              {/* Time & Note */}
              <div className="bg-white p-5 rounded-[1.5rem] border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Ngày tạo</h3>
                    <p className="text-gray-900 font-medium">{selected.createdAt ? new Date(selected.createdAt).toLocaleString('vi-VN') : 'N/A'}</p>
                  </div>
                  {selected.processedAt && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Ngày xử lý</h3>
                      <p className="text-gray-900 font-medium">{new Date(selected.processedAt).toLocaleString('vi-VN')}</p>
                    </div>
                  )}
                </div>
                {selected.status === 'Pending' && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                    {(() => {
                      const rem = getRemainingAutoAccept(selected.createdAt);
                      if (!rem) return 'Hệ thống sẽ tự động xử lý yêu cầu sau tối đa 12 giờ kể từ khi khách gửi nếu bạn không phản hồi.';
                      if (rem.isOverdue) {
                        return 'Yêu cầu này đã vượt quá 12 giờ chờ phản hồi. Hệ thống có thể đã tự động chấp nhận hoặc chuyển sang bước xử lý tiếp theo.';
                      }
                      return `Hệ thống cho phép tối đa 12 giờ kể từ khi khách gửi yêu cầu. Hiện bạn còn khoảng ${rem.hours} giờ ${rem.minutes} phút để phản hồi trước khi hệ thống tự động chấp nhận yêu cầu.`;
                    })()}
                  </div>
                )}
              </div>

              {/* Reason */}
              <div className="bg-white p-5 rounded-[1.5rem] border border-gray-200">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Lý do hoàn tiền</h3>
                <p className="text-gray-700 leading-relaxed">{selected.reason || 'Không có lý do'}</p>
              </div>

              {/* Vendor Response */}
              {selected.vendorResponse && (
                <div className="bg-white p-5 rounded-[1.5rem] border border-gray-200">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Phản hồi của bạn</h3>
                  <p className="text-blue-700 leading-relaxed italic">"{selected.vendorResponse}"</p>
                </div>
              )}

              {/* Proof images */}
              {selected.proofImages.length > 0 && (
                <details className="group bg-white p-5 rounded-[1.5rem] border border-gray-200" open>
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Hình ảnh bằng chứng (Khách hàng)</h3>
                    <span className="material-symbols-outlined text-slate-300 group-open:rotate-180 transition-transform">expand_more</span>
                  </summary>
                  <div className="grid grid-cols-4 gap-3 mt-4">
                    {selected.proofImages.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setImageModal(url)}
                        className="aspect-square rounded-xl overflow-hidden border border-gray-200 hover:ring-2 hover:ring-primary transition"
                      >
                        <img src={url} alt={`proof-${i}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Nhấn ảnh để xem phóng to</p>
                </details>
              )}

              {/* Vendor Preparation Images */}
              {selected.vendorPreparationImages && selected.vendorPreparationImages.length > 0 && (
                <details className="group bg-white p-5 rounded-[1.5rem] border border-gray-200">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Hình ảnh chuẩn bị (Vendor)</h3>
                    <span className="material-symbols-outlined text-slate-300 group-open:rotate-180 transition-transform">expand_more</span>
                  </summary>
                  <div className="grid grid-cols-4 gap-3 mt-4">
                    {selected.vendorPreparationImages.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setImageModal(url)}
                        className="aspect-square rounded-xl overflow-hidden border border-gray-200 hover:ring-2 hover:ring-primary transition"
                      >
                        <img src={url} alt={`prep-${i}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Nhấn ảnh để xem phóng to</p>
                </details>
              )}

              {/* Vendor Delivery Images */}
              {selected.vendorDeliveryImages && selected.vendorDeliveryImages.length > 0 && (
                <details className="group bg-white p-5 rounded-[1.5rem] border border-gray-200">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Hình ảnh giao hàng (Vendor)</h3>
                    <span className="material-symbols-outlined text-slate-300 group-open:rotate-180 transition-transform">expand_more</span>
                  </summary>
                  <div className="grid grid-cols-4 gap-3 mt-4">
                    {selected.vendorDeliveryImages.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setImageModal(url)}
                        className="aspect-square rounded-xl overflow-hidden border border-gray-200 hover:ring-2 hover:ring-primary transition"
                      >
                        <img src={url} alt={`delivery-${i}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Nhấn ảnh để xem phóng to</p>
                </details>
              )}

              {/* Items */}
              {selected.items.length > 0 && (
                <div className="bg-white p-5 rounded-[1.5rem] border border-gray-200">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                    Sản phẩm yêu cầu hoàn ({selected.items.length})
                  </h3>
                  <div className="space-y-3">
                    {selected.items.map((item, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{item.packageName}</p>
                          <p className="text-xs text-gray-500">{item.variantName} × {item.quantity}</p>
                        </div>
                        {item.refundAmount > 0 && (
                          <p className="font-black text-primary text-sm">{formatVnd(item.refundAmount)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin note (after processed) */}
              {selected.adminNote && (
                <div className={`p-4 rounded-[1.5rem] border ${selected.status === 'Approved' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
                  }`}>
                  <h4 className={`text-xs font-bold uppercase tracking-widest mb-2 ${selected.status === 'Approved' ? 'text-green-500' : 'text-red-400'
                    }`}>Ghi chú xử lý</h4>
                  <p className="text-sm text-gray-700">{selected.adminNote}</p>
                  {selected.processedAt && (
                    <p className="text-xs text-gray-400 mt-2">
                      Xử lý lúc: {new Date(selected.processedAt).toLocaleString('vi-VN')}
                    </p>
                  )}
                </div>
              )}

              {/* Success message */}
              {successMsg && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-[1.5rem] text-sm text-green-700 font-medium">
                  {successMsg}
                </div>
              )}

              {/* Action panel */}
              {selected.status === 'Pending' && (
                <div className="bg-white p-5 rounded-[1.5rem] border border-gray-200">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Xử lý yêu cầu</h3>

                  {/* Step 1 – choose */}
                  {!action && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setAction('approve'); setActionError(null); }}
                        className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition text-sm"
                      > Duyệt hoàn tiền</button>
                      <button
                        onClick={() => { setAction('reject'); setActionError(null); }}
                        className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition text-sm"
                      > Từ chối</button>
                    </div>
                  )}

                  {/* Step 2 – confirm */}
                  {action && (
                    <div className="space-y-3">
                      <div className={`p-3 rounded-xl text-sm font-bold ${action === 'approve' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                        }`}>
                        {action === 'approve' ? ' Xác nhận duyệt hoàn tiền' : ' Xác nhận từ chối yêu cầu'}
                      </div>
                      <textarea
                        value={note}
                        onChange={e => { setNote(e.target.value); setActionError(null); }}
                        placeholder={action === 'reject' ? 'Lý do từ chối (bắt buộc)...' : 'Ghi chú duyệt hoàn tiền (bắt buộc)...'}
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                      />
                      {actionError && (
                        <p className="text-xs text-red-500 font-medium">{actionError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAction(null)}
                          className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 transition"
                        >Quay lại</button>
                        <button
                          onClick={handleProcess}
                          disabled={processing}
                          className={`flex-1 py-2.5 text-white rounded-xl text-sm font-bold transition disabled:opacity-50 ${action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'
                            }`}
                        >
                          {processing ? 'Đang xử lý...' : 'Xác nhận'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {imageModal && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200] p-2 md:p-6"
          onClick={() => setImageModal(null)}
        >
          <button
            className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition"
            onClick={() => setImageModal(null)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={imageModal}
            alt="proof fullscreen"
            className="w-[min(92vw,780px)] h-[min(88vh,980px)] rounded-2xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default VendorRefundTab;
