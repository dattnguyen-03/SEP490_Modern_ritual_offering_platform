import React, { useState, useEffect, useCallback } from 'react';
import { auditService, AuditLog, AuditLogFilter } from '../../services/auditService';
import { userService } from '../../services/userService';
import toast from '../../services/toast';

interface AuditLogPageProps {
  onNavigate: (path: string) => void;
  userRole: 'admin' | 'staff';
}

const ACTION_LABELS: Record<string, string> = {
  'Approve': 'Duyệt',
  'Reject': 'Từ chối',
  'Create': 'Tạo mới',
  'Update': 'Cập nhật',
  'Delete': 'Xóa',
  'Deactivate': 'Vô hiệu hóa',
  'Reactivate': 'Kích hoạt lại',
  'BanUser': 'Khóa người dùng',
  'ReactivateUser': 'Mở khóa người dùng',
  'Verify': 'Xác minh',
  'Withdraw': 'Rút tiền',
  'Refund': 'Hoàn tiền',
  'Transaction': 'Giao dịch',
  'REFUNDAPPROVE': 'Duyệt hoàn tiền',
  'REFUNDREJECT': 'Từ chối hoàn tiền',
  'STAFFREVIEWED': 'NV đã kiểm duyệt',
  'STAFFREVIEW': 'NV kiểm duyệt',
  'CANCEL': 'Hủy bỏ',
  'ESCALATE': 'Khiếu nại',
  'Login': 'Đăng nhập',
  'Logout': 'Đăng xuất',
  'Pay': 'Thanh toán',
  'StaffReviewed': 'NV đã kiểm duyệt',
};

const ENTITY_LABELS: Record<string, string> = {
  'Package': 'Gói sản phẩm',
  'CeremonyCategory': 'Danh mục nghi lễ',
  'Vendor': 'Nhà cung cấp',
  'User': 'Người dùng',
  'SystemConfig': 'Cấu hình hệ thống',
  'Order': 'Đơn hàng',
  'Transaction': 'Giao dịch',
  'Refund': 'Yêu cầu hoàn tiền',
  'RefundRequest': 'Yêu cầu hoàn tiền',
  'WithdrawalRequest': 'Yêu cầu rút tiền',
  'BusinessProfile': 'Hồ sơ kinh doanh',
  'PackageItem': 'Chi tiết gói sản phẩm',
};

const AuditLogPage: React.FC<AuditLogPageProps> = ({ onNavigate, userRole }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AuditLogFilter>({});
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [selectedEntityName, setSelectedEntityName] = useState<string | null>(null);
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await auditService.getAuditLogs(filter);
      // Sắp xếp mới nhất lên đầu nếu backend chưa làm
      const sorted = data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(sorted);
      setCurrentPage(1); // Reset page on new fetch
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      toast.error('Không thể tải nhật ký hệ thống.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleShowDetail = async (id: string) => {
    setLoadingDetail(true);
    setSelectedLog(null);
    setSelectedEntityName(null);
    try {
      const data = await auditService.getAuditLogById(id);
      setSelectedLog(data);

      // Resolve Entity Name
      if (data.entityType === 'User') {
        try {
          const user = await userService.getUserById(data.entityId);
          setSelectedEntityName(user.fullName || user.email);
        } catch {
          setSelectedEntityName(null);
        }
      }

      // Resolve Performer Name if missing
      if (!data.performedByName && data.performedBy && data.performedBy !== 'system') {
        try {
          const user = await userService.getUserById(data.performedBy);
          data.performedByName = user.fullName || user.email;
          setSelectedLog({ ...data }); // Trigger re-render
        } catch {
          // Keep as is
        }
      }
    } catch (err) {
      console.error('Failed to fetch log detail:', err);
      toast.error('Không thể tải chi tiết nhật ký.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const getActionStyle = (action: string) => {
    const act = action?.toLowerCase() || '';
    if (act.includes('create') || act.includes('add')) return 'bg-emerald-100 text-emerald-700';
    if (act.includes('update') || act.includes('edit') || act.includes('change')) return 'bg-amber-100 text-amber-700';
    if (act.includes('delete') || act.includes('remove')) return 'bg-rose-100 text-rose-700';
    if (act.includes('approve') || act.includes('verify')) return 'bg-blue-100 text-blue-700';
    if (act.includes('reject') || act.includes('cancel')) return 'bg-slate-100 text-slate-700';
    return 'bg-slate-100 text-slate-600';
  };

  const parseJson = (str: string | undefined) => {
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  };

  const translateStatus = (status: string | null) => {
    if (!status) return 'Trống';
    const s = status.trim();
    const mapping: Record<string, string> = {
      'Pending': 'Chờ xử lý',
      'Approved': 'Đã duyệt',
      'Rejected': 'Đã từ chối',
      'Active': 'Đang hoạt động',
      'Inactive': 'Ngừng hoạt động',
      'Banned': 'Đã bị khóa',
      'Verified': 'Đã xác minh',
      'None': 'Không có',
    };
    return mapping[s] || s;
  };

  const translateDescription = (text: string | null) => {
    if (!text) return 'Không có mô tả';
    let result = text;
    // Common backend phrases
    result = result.replace(/Staff approved package/gi, 'Nhân viên đã duyệt gói');
    result = result.replace(/Staff rejected package/gi, 'Nhân viên đã từ chối gói');
    result = result.replace(/Banned user/gi, 'Đã khóa người dùng');
    result = result.replace(/Reactivated user/gi, 'Đã kích hoạt lại người dùng');
    result = result.replace(/reason:/gi, 'lý do:');
    result = result.replace(/Admin changed/gi, 'Quản trị viên đã thay đổi');
    result = result.replace(/Log in success/gi, 'Đăng nhập thành công');
    return result;
  };
  const [roleFilter, setRoleFilter] = useState<string>('');
  const filteredLogs = logs.filter(l => !roleFilter || l.performedRole === roleFilter);
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const currentLogs = filteredLogs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    const resolvePageNames = async () => {
      const idsToFetch = new Set<string>();
      currentLogs.forEach(log => {
        if (log.entityType === 'User' && log.entityId && !resolvedNames[log.entityId]) idsToFetch.add(log.entityId);
        if (log.performedBy && log.performedBy !== 'system' && !resolvedNames[log.performedBy]) idsToFetch.add(log.performedBy);
      });

      if (idsToFetch.size === 0) return;

      const results: Record<string, string> = {};
      const fetchPromises = Array.from(idsToFetch).map(async (id) => {
        try {
          const user = await userService.getUserById(id);
          results[id] = user.fullName || user.email;
        } catch {
          // If fail, we don't try again for this session to avoid spamming
          results[id] = 'N/A';
        }
      });

      await Promise.allSettled(fetchPromises);
      if (Object.keys(results).length > 0) {
        setResolvedNames(prev => ({ ...prev, ...results }));
      }
    };

    if (currentLogs.length > 0) {
      resolvePageNames();
    }
  }, [currentPage, logs]); // Removed resolvedNames and currentLogs to avoid infinite loops

  return (
    <div className="bg-white min-h-screen py-12 px-4 md:px-8 font-sans">
      <div className="max-w-[1800px] mx-auto">

        {/* Header Section */}
        <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-start gap-5">
            {/* <button
              onClick={() => onNavigate(userRole === 'admin' ? '/admin/dashboard' : '/staff/dashboard')}
              className="px-6 py-4 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-700 flex-shrink-0 hover:bg-slate-50 transition-all group font-black text-[10px] uppercase tracking-widest"
            >
              Quay lại Dashboard
            </button> */}
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Nhật ký hệ thống</h1>
              <p className="text-slate-500 font-bold text-sm uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Giám sát & Nhật ký vận hành
              </p>
            </div>
          </div>
          <button
            onClick={fetchLogs}
            className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Làm mới
          </button>
        </div>

        {/* Filter Section */}
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Hành động</label>
              <select
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-black transition-all cursor-pointer"
                value={filter.action || ''}
                onChange={(e) => {
                  setFilter({ ...filter, action: e.target.value });
                  setCurrentPage(1);
                }}
              >
                <option value="">Tất cả hành động</option>
                {Array.from(new Set(logs.map(log => log.action))).map(action => (
                  <option key={action} value={action}>{ACTION_LABELS[action] || action}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Đối tượng</label>
              <select
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-black transition-all cursor-pointer"
                value={filter.entityType || ''}
                onChange={(e) => {
                  setFilter({ ...filter, entityType: e.target.value });
                  setCurrentPage(1);
                }}
              >
                <option value="">Tất cả đối tượng</option>
                {Array.from(new Set(logs.map(log => log.entityType))).map(entity => (
                  <option key={entity} value={entity}>{ENTITY_LABELS[entity] || entity}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Vai trò</label>
              <select
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-black transition-all cursor-pointer"
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">Tất cả vai trò</option>
                {Array.from(new Set(logs.map(log => log.performedRole))).map(role => (
                  <option key={role} value={role}>
                    {role === 'Admin' ? 'Quản trị viên' : role === 'Staff' ? 'Nhân viên' : role === 'system' ? 'Hệ thống' : role}
                  </option>
                ))}
              </select>
            </div>
            {/* <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Người thực hiện</label>
              <select
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-black transition-all cursor-pointer"
                value={filter.performedBy || ''}
                onChange={(e) => {
                  setFilter({ ...filter, performedBy: e.target.value });
                  setCurrentPage(1);
                }}
              >
                <option value="">Tất cả người thực hiện</option>
                {Array.from(new Map(logs.map(log => [log.performedBy, log.performedByName || (log.performedBy === 'system' ? 'Hệ thống' : log.performedBy.slice(0, 8))])).entries()).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div> */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Từ ngày</label>
              <input
                type="date"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-black transition-all cursor-pointer"
                value={filter.from || ''}
                onChange={(e) => setFilter({ ...filter, from: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Đến ngày</label>
              <input
                type="date"
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-black transition-all cursor-pointer"
                value={filter.to || ''}
                onChange={(e) => setFilter({ ...filter, to: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilter({});
                  setRoleFilter('');
                  setCurrentPage(1);
                }}
                className="w-full h-[46px] bg-slate-100 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all"
              >
                Xóa lọc
              </button>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Thời gian</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Hành động</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Đối tượng</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Thực hiện bởi</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Chi tiết</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array(10).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-8 py-6"><div className="h-4 bg-slate-100 rounded w-full" /></td>
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center">
                      <p className="text-slate-400 font-bold">Không tìm thấy dữ liệu nhật ký.</p>
                    </td>
                  </tr>
                ) : (
                  currentLogs.map((log) => (
                    <tr key={log.auditId} className="hover:bg-white transition-colors group">
                      <td className="px-8 py-6 whitespace-nowrap">
                        <p className="text-sm font-bold text-slate-900">{new Date(log.timestamp).toLocaleDateString('vi-VN')}</p>
                        <p className="text-[10px] text-slate-400 font-black tabular-nums">{new Date(log.timestamp).toLocaleTimeString('vi-VN')}</p>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getActionStyle(log.action)}`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                        <p className="text-[8px] text-slate-400 font-black mt-1 uppercase tracking-widest">
                          {log.performedRole === 'Admin' ? 'Quản trị viên' : log.performedRole === 'Staff' ? 'Nhân viên' : log.performedRole}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-sm font-black text-slate-700">{ENTITY_LABELS[log.entityType] || log.entityType}</p>
                        <p className="text-[10px] text-slate-400 font-bold truncate max-w-[150px]" title={log.entityId}>
                          {resolvedNames[log.entityId] && resolvedNames[log.entityId] !== 'N/A' ? resolvedNames[log.entityId] : log.entityId}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-sm font-bold text-slate-900">{log.performedByName || 'Hệ thống'}</p>
                        <p className="text-[10px] text-slate-400 font-black truncate max-w-[150px]" title={log.performedBy}>
                          {resolvedNames[log.performedBy] && resolvedNames[log.performedBy] !== 'N/A' ? resolvedNames[log.performedBy] : log.performedBy}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-xs text-slate-600 line-clamp-1 max-w-[200px]" title={log.description}>{translateDescription(log.description)}</p>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button
                          onClick={() => handleShowDetail(log.auditId)}
                          className="px-5 py-2.5 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-200 hover:bg-gray-50 transition flex-shrink-0 font-bold text-xs uppercase tracking-widest text-gray-600"
                        >
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {!loading && logs.length > 0 && (
            <div className="bg-white px-8 py-4 flex items-center justify-between border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Hiển thị <span className="text-slate-900">{Math.min(logs.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}</span>
                - <span className="text-slate-900">{Math.min(logs.length, currentPage * ITEMS_PER_PAGE)}</span>
                trên <span className="text-slate-900">{logs.length}</span> kết quả
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-500 hover:bg-black hover:text-white transition-all shadow-sm disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-500"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = currentPage <= 3 ? i + 1 : (currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i);
                    if (pageNum < 1 || pageNum > totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-10 h-10 rounded-xl font-bold text-[10px] transition-all ${currentPage === pageNum ? 'bg-black text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-500 hover:bg-black hover:text-white transition-all shadow-sm disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-500"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {(selectedLog || loadingDetail) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedLog(null)} />
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl relative z-10 overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 md:p-12">
              <div className="flex justify-between items-start mb-10">
                <div>
                  <h4 className="text-3xl font-black text-slate-900 mb-2">Chi tiết nhật ký</h4>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-5 py-2.5 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-200 hover:bg-gray-50 transition flex-shrink-0 font-bold text-xs uppercase tracking-widest text-gray-600"
                >
                  Đóng
                </button>
              </div>

              {loadingDetail ? (
                <div className="py-20 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-100 border-t-black mx-auto" />
                </div>
              ) : selectedLog && (
                <div className="space-y-8 max-h-[85vh] overflow-y-auto pr-4 custom-scrollbar">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Thời gian</p>
                      <p className="font-bold text-slate-900">{new Date(selectedLog.timestamp).toLocaleString('vi-VN')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hành động</p>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getActionStyle(selectedLog.action)}`}>
                        {ACTION_LABELS[selectedLog.action] || selectedLog.action}
                      </span>
                    </div>
                    {/* <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">IP Address</p>
                      <p className="font-bold text-slate-900">{selectedLog.ipAddress || 'N/A'}</p>
                    </div> */}
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Đối tượng</p>
                      <p className="font-bold text-slate-900">{selectedEntityName || ENTITY_LABELS[selectedLog.entityType] || selectedLog.entityType}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Người thực hiện</p>
                      <p className="font-bold text-slate-900">{selectedLog.performedByName || 'Hệ thống'}</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-[2rem] p-8 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Nội dung thay đổi</p>
                    <div className="space-y-6">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Mô tả</p>
                        <p className="text-lg font-black text-slate-800 leading-relaxed">{translateDescription(selectedLog.description)}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {selectedLog.oldValue && (
                          <div>
                            <p className="text-[10px] font-black text-rose-400 uppercase mb-2 tracking-widest">Giá trị cũ</p>
                            <pre className="text-xs bg-white border border-slate-100 p-4 rounded-xl overflow-auto max-h-[200px] text-slate-800 font-mono font-bold">
                              {selectedLog.oldValue.startsWith('{')
                                ? JSON.stringify(parseJson(selectedLog.oldValue), null, 2)
                                : translateStatus(selectedLog.oldValue)}
                            </pre>
                          </div>
                        )}
                        {selectedLog.newValue && (
                          <div>
                            <p className="text-[10px] font-black text-emerald-400 uppercase mb-2 tracking-widest">Giá trị mới</p>
                            <pre className="text-sm bg-white border border-slate-100 p-4 rounded-xl overflow-auto max-h-[200px] text-slate-800 font-mono font-bold shadow-sm">
                              {selectedLog.newValue.startsWith('{')
                                ? JSON.stringify(parseJson(selectedLog.newValue), null, 2)
                                : translateStatus(selectedLog.newValue)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
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

export default AuditLogPage;
