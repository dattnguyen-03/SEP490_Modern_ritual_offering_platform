import React, { useState, useEffect, useCallback } from 'react';
import { staffService, VendorVerification, VendorVerificationDetail, VERIFICATION_STATUS_LABELS, BUSINESS_TYPE_LABELS } from '../../services/staffService';
import toast from '../../services/toast';

const formatDateVi = (value: string | null, includeTime = true): string => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
};

const STATUS_BADGE_STYLE: Record<string, string> = {
  Inactive: 'bg-gray-100 text-gray-600 border-gray-200',
  Pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Verified: 'bg-green-100 text-green-700 border-green-200',
  Rejected: 'bg-red-100 text-red-700 border-red-200',
};

interface Props {
  onNavigate: (path: string) => void;
}

const VendorVerificationPage: React.FC<Props> = ({ onNavigate }) => {
  const [verifications, setVerifications] = useState<VendorVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [selectedProfile, setSelectedProfile] = useState<VendorVerificationDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [actionNote, setActionNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageModal, setImageModal] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const fetchVerifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await staffService.getVendorVerifications(filterStatus);
      setVerifications(data);
      setCurrentPage(1);
    } catch (error) {
      toast.error('Không thể tải danh sách xác minh.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  const handleViewDetail = async (profileId: string) => {
    try {
      setIsDetailLoading(true);
      const detail = await staffService.getVendorVerificationDetail(profileId);
      setSelectedProfile(detail);
      setActionNote('');
    } catch (error) {
      toast.error('Không thể tải chi tiết xác minh.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleVerify = async (status: number) => {
    if (!selectedProfile) return;
    if (status === 4 && !actionNote.trim()) {
      toast.error('Vui lòng nhập lý do từ chối.');
      return;
    }

    try {
      setIsProcessing(true);
      let success = false;

      if (status === 3) {
        success = await staffService.approveVendor(selectedProfile.profileId, actionNote);
        if (success) toast.success('Đã duyệt yêu cầu xác minh.');
      } else if (status === 4) {
        // For reject, we use actionNote as both rejectionReason and staffNote for simplicity
        success = await staffService.rejectVendor(selectedProfile.profileId, actionNote, actionNote);
        if (success) toast.success('Đã từ chối yêu cầu.');
      }

      if (success) {
        setSelectedProfile(null);
        fetchVerifications();
      }
    } catch (error: any) {
      toast.error(error.message || 'Thao tác thất bại.');
    } finally {
      setIsProcessing(false);
    }
  };

  const tabs = [
    { label: 'Tất cả', value: '' },
    { label: 'Chờ duyệt', value: '2' },
    { label: 'Đã xác minh', value: '3' },
    { label: 'Đã từ chối', value: '4' },
  ];

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Xác minh nhà cung cấp</h1>
          <p className="text-black font-medium">Quản lý và phê duyệt hồ sơ đăng ký bán hàng.</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilterStatus(tab.value)}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${filterStatus === tab.value
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                  : 'text-black hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-4" />
          <p className="text-black font-bold">Đang tải danh sách...</p>
        </div>
      ) : verifications.length === 0 ? (
        <div className="bg-white p-20 rounded-3xl border-2 border-dashed border-slate-200 text-center">
          {/* <div className="text-6xl mb-4 text-slate-300"></div> */}
          <h3 className="text-xl font-bold text-slate-800">Không tìm thấy yêu cầu nào</h3>
          <p className="text-slate-400">Hiện tại không có hồ sơ vendor nào cần xử lý trong mục này.</p>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="max-w-[1800px] mx-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-5 text-xs font-black uppercase text-slate-400 tracking-widest">Vendor</th>
                  <th className="px-6 py-5 text-xs font-black uppercase text-slate-400 tracking-widest">Loại hình</th>
                  <th className="px-6 py-5 text-xs font-black uppercase text-slate-400 tracking-widest">Số tài liệu</th>
                  <th className="px-6 py-5 text-xs font-black uppercase text-slate-400 tracking-widest">Ngày đăng ký</th>
                  <th className="px-6 py-5 text-xs font-black uppercase text-slate-400 tracking-widest text-center">Trạng thái</th>
                  <th className="px-6 py-5 text-xs font-black uppercase text-slate-400 tracking-widest text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {verifications
                  .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                  .map((v) => (
                    <tr key={v.profileId} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-sm bg-slate-100 flex-shrink-0">
                            {v.shopAvatarUrl ? (
                              <img src={v.shopAvatarUrl} alt={v.shopName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xl">🏪</div>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 line-clamp-1">{v.shopName}</p>
                            <p className="text-xs text-black">{v.fullName} · {v.phoneNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm font-semibold text-slate-600">
                          {BUSINESS_TYPE_LABELS[v.businessType] || v.businessType}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-800">{v.documentCount}</span>
                          <span className="text-xs text-slate-400">tài liệu</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm text-black">
                        {formatDateVi(v.createdAt)}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide border whitespace-nowrap ${STATUS_BADGE_STYLE[v.verificationStatus]}`}>
                          {VERIFICATION_STATUS_LABELS[v.verificationStatus] || v.verificationStatus}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button
                          onClick={() => handleViewDetail(v.profileId)}
                          className="p-3 bg-slate-50 text-slate-900 rounded-xl font-bold text-xs hover:bg-slate-900 hover:text-white transition-all shadow-sm group-hover:shadow-md"
                        >
                          Chi tiết hồ sơ
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {verifications.length > ITEMS_PER_PAGE && (
            <div className="bg-slate-50/50 px-8 py-4 flex items-center justify-between border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Hiển thị <span className="text-slate-900">{Math.min(verifications.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}</span>
                - <span className="text-slate-900">{Math.min(verifications.length, currentPage * ITEMS_PER_PAGE)}</span>
                trên <span className="text-slate-900">{verifications.length}</span> kết quả
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
                  {Array.from({ length: Math.ceil(verifications.length / ITEMS_PER_PAGE) }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-10 h-10 rounded-xl font-bold text-[10px] transition-all ${currentPage === pageNum ? 'bg-black text-white' : 'bg-white text-black hover:bg-slate-50 shadow-sm border border-slate-100'}`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(verifications.length / ITEMS_PER_PAGE), prev + 1))}
                  disabled={currentPage === Math.ceil(verifications.length / ITEMS_PER_PAGE)}
                  className="px-4 py-2 bg-white rounded-xl flex items-center justify-center text-black hover:bg-black hover:text-white transition-all shadow-sm disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-black border border-slate-200 text-[10px] font-bold uppercase tracking-widest"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedProfile(null)}>
          <div className="bg-slate-50 w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="bg-white p-8 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-3xl overflow-hidden shadow-lg bg-slate-100 flex-shrink-0">
                  {selectedProfile.shopAvatarUrl ? (
                    <img src={selectedProfile.shopAvatarUrl} alt={selectedProfile.shopName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">🏪</div>
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 italic tracking-tight uppercase">{selectedProfile.shopName}</h2>
                  <p className="text-black font-bold">Xác minh danh tính Vendor</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProfile(null)}
                className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors shadow-inner"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Shop Info */}
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Thông tin chủ shop</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Họ và tên:</span>
                        <span className="font-bold text-slate-900">{selectedProfile.fullName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Giới tính:</span>
                        <span className="font-bold text-slate-900">{selectedProfile.gender === 'Male' ? 'Nam' : selectedProfile.gender === 'Female' ? 'Nữ' : 'Khác'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Ngày sinh:</span>
                        <span className="font-bold text-slate-900">{formatDateVi(selectedProfile.dateOfBirth, false)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Số điện thoại:</span>
                        <span className="font-bold text-slate-900">{selectedProfile.phoneNumber}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Mã số thuế:</span>
                        <span className="font-bold text-primary">{selectedProfile.taxCode}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Loại kinh doanh:</span>
                        <span className="font-bold text-slate-900">{BUSINESS_TYPE_LABELS[selectedProfile.businessType] || selectedProfile.businessType}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Thông tin shop</h3>
                    <div className="space-y-3 text-sm">
                      <p className="text-slate-600 leading-relaxed italic">"{selectedProfile.shopDescription}"</p>
                      <div className="pt-2">
                        <span className="text-slate-400 block mb-1">Địa chỉ:</span>
                        <span className="font-bold text-slate-900 leading-tight block">{selectedProfile.shopAddressText}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-slate-400">Năng suất (đơn/ngày):</span>
                        <span className="font-black text-slate-900">{selectedProfile.dailyCapacity}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Trạng thái nhà cung cấp:</span>
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase border ${selectedProfile.vendorStatus === 'Hoạt Động' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {selectedProfile.vendorStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Documents List */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Tài liệu ({selectedProfile.documents.length})</h3>
                  <div className="space-y-4">
                    {selectedProfile.documents.length === 0 ? (
                      <p className="text-slate-400 text-center py-8 italic">Không có tài liệu đính kèm.</p>
                    ) : (
                      selectedProfile.documents.map((doc) => (
                        <div key={doc.documentId} className="group relative bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-slate-900 hover:bg-white transition-all shadow-sm">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{doc.documentTypeName}</label>
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => setImageModal(doc.fileUrl)}
                              className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-tighter hover:bg-primary transition-colors"
                            >
                              Xem ảnh
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Action Note */}
              {selectedProfile.verificationStatus === 'Pending' && (
                <div className="space-y-4 bg-slate-900 p-8 rounded-[2rem] shadow-2xl shadow-slate-200 border-2 border-slate-800">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Quy trình phê duyệt</h3>
                  </div>
                  <textarea
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder="Nhập phản hồi cho vendor (Ví dụ: Tài liệu mờ, Cần bổ sung GPKD...)"
                    className="w-full bg-slate-800 border-none rounded-2xl px-6 py-4 text-white placeholder-slate-500 text-sm focus:ring-4 focus:ring-primary/20 transition-all outline-none min-h-[100px]"
                  />
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleVerify(3)}
                      disabled={isProcessing}
                      className="flex-1 bg-white hover:bg-green-400 text-slate-900 hover:text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed group flex items-center justify-center gap-2"
                    >
                      <span>{isProcessing ? 'Đang xử lý...' : 'Chấp thuận hồ sơ'}</span>
                      {!isProcessing && <span className="text-lg">✓</span>}
                    </button>
                    <button
                      onClick={() => handleVerify(4)}
                      disabled={isProcessing}
                      className="flex-1 bg-slate-800 hover:bg-rose-500 border-2 border-slate-700 hover:border-rose-400 text-slate-400 hover:text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <span>Từ chối</span>
                      {!isProcessing && <span className="text-lg">✕</span>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {imageModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 flex items-center justify-center p-8" onClick={() => setImageModal(null)}>
          <button className="absolute top-8 right-8 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center text-white text-2xl" onClick={() => setImageModal(null)}>✕</button>
          <img src={imageModal} alt="Zoomed document" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

export default VendorVerificationPage;
