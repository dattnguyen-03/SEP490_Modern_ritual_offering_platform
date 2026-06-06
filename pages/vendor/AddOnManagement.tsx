import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { PackageAddOn } from '../../types';
import { addOnService } from '../../services/addOnService';
import toast from '../../services/toast';

interface AddOnManagementProps {
  onNavigate?: (path: string) => void;
}

const AddOnManagement: React.FC<AddOnManagementProps> = ({ onNavigate }) => {
  const [addOns, setAddOns] = useState<PackageAddOn[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingAddOn, setEditingAddOn] = useState<PackageAddOn | null>(null);
  const [formData, setFormData] = useState<Omit<PackageAddOn, 'addOnId'>>({
    addOnName: '',
    description: '',
    retailPrice: 0,
    itemType: 'Food',
    maxQuantity: 1,
    maxQtyPerOrder: 1,
    displayOrder: 0,
    isActive: true,
  });

  useEffect(() => {
    loadAddOns();
  }, []);

  const getItemTypeLabel = (itemType?: string) => {
    const normalized = String(itemType || '').trim().toLowerCase();
    if (normalized === 'food') return 'Thực phẩm';
    if (normalized === 'object') return 'Vật phẩm';
    if (normalized === 'service') return 'Dịch vụ';
    return 'Khác';
  };

  const parseCurrencyInput = (value: string): number => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return 0;
    return Number(digits);
  };

  const formatCurrencyInput = (value: number): string => {
    return Number(value || 0).toLocaleString('vi-VN');
  };

  const loadAddOns = async () => {
    setLoading(true);
    try {
      const data = await addOnService.getAllAddOns();
      setAddOns(data);
    } catch (error) {
      toast.error('Không thể tải danh sách món thêm');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = async (addOn?: PackageAddOn) => {
    if (addOn) {
      setLoadingDetail(true);
      try {
        const detail = await addOnService.getAddOnById(addOn.addOnId);
        const source = detail || addOn;
        if (!detail) {
          toast.warning('Không tải được chi tiết món thêm, đang dùng dữ liệu danh sách.');
        }

        setEditingAddOn(source);
        setFormData({
          addOnName: source.addOnName,
          description: source.description || '',
          retailPrice: source.retailPrice,
          itemType: source.itemType || 'Food',
          maxQuantity: source.maxQuantity,
          maxQtyPerOrder: (source as any).maxQtyPerOrder || 1,
          displayOrder: source.displayOrder,
          isActive: source.isActive,
        });
      } finally {
        setLoadingDetail(false);
      }
    } else {
      setEditingAddOn(null);
      setFormData({
        addOnName: '',
        description: '',
        retailPrice: 0,
        itemType: 'Food',
        maxQuantity: 1,
        maxQtyPerOrder: 1,
        displayOrder: 0,
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingAddOn(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.addOnName.trim()) {
      toast.warning('Vui lòng nhập tên món thêm');
      return;
    }

    try {
      if (editingAddOn) {
        const success = await addOnService.updateAddOn(editingAddOn.addOnId, formData);
        if (success) {
          toast.success('Cập nhật món thêm thành công');
          handleCloseModal();
          loadAddOns();
        } else {
          toast.error('Cập nhật thất bại');
        }
      } else {
        const newAddOn = await addOnService.createAddOn(formData);
        if (newAddOn) {
          toast.success('Thêm món thêm thành công');
          handleCloseModal();
          loadAddOns();
        } else {
          toast.error('Thêm món thêm thất bại');
        }
      }
    } catch (error) {
      toast.error('Có lỗi xảy ra');
    }
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      title: 'Xác nhận xóa?',
      text: 'Hành động này không thể hoàn tác!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#000',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Xóa ngay',
      cancelButtonText: 'Hủy'
    });

    if (result.isConfirmed) {
      try {
        const success = await addOnService.deleteAddOn(id);
        if (success) {
          toast.success('Đã xóa món thêm');
          loadAddOns();
        } else {
          toast.error('Xóa thất bại');
        }
      } catch (error) {
        toast.error('Lỗi khi xóa');
      }
    }
  };

  return (
    <div className="min-h-screen bg-white p-6 md:p-10 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Quản Lý Món Thêm</h1>
            <p className="text-slate-500 font-medium mt-2">Thêm các dịch vụ hoặc vật phẩm đi kèm để khách hàng lựa chọn thêm vào mâm cúng.</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="px-8 py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-black/10 hover:shadow-black/20 hover:-translate-y-1 transition-all flex items-center gap-3 text-xs"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
            </svg>
            Thêm
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {[
            { label: 'Tổng Món Thêm', value: addOns.length, color: 'bg-blue-50 text-blue-600' },
            { label: 'Đang Hoạt Động', value: addOns.filter(a => a.isActive).length, icon: '✨', color: 'bg-green-50 text-green-600' },
            { label: 'Không Hoạt Động', value: addOns.filter(a => !a.isActive).length, icon: '🛑', color: 'bg-red-50 text-red-600' },
          ].map((stat, idx) => (
            <div key={idx} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-5">
              {/* <div className={`w-14 h-14 rounded-2xl ${stat.color} flex items-center justify-center text-2xl`}>
                {stat.icon}
              </div> */}
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* List Section */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-slate-200 border-t-black rounded-full animate-spin"></div>
              <p className="mt-4 text-slate-500 font-bold">Đang tải dữ liệu...</p>
            </div>
          ) : addOns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <h3 className="text-xl font-black text-slate-900">Chưa có món thêm nào</h3>
              <p className="text-slate-500 mt-2 max-w-sm">Hãy bắt đầu bằng cách thêm các vật phẩm như hoa, quả, hoặc dịch vụ đi kèm.</p>
              <button
                onClick={() => handleOpenModal()}
                className="mt-8 px-6 py-3 border-2 border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all"
              >
                Tạo món thêm đầu tiên
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white border-b border-slate-100">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tên Món Thêm</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Loại</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá Bán</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tối đa/mâm</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Trạng Thái</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {addOns.map((addOn) => (
                    <tr key={addOn.addOnId} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                            {addOn.itemType === 'Service' ? '🛠️' : '📦'}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 block truncate">{addOn.addOnName}</span>
                            {addOn.description && (
                              <p className="text-[10px] text-slate-400 font-medium line-clamp-1 truncate">{addOn.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${(addOn.itemType || '').toLowerCase().includes('service')
                          ? 'bg-purple-50 text-purple-600 border border-purple-100'
                          : 'bg-blue-50 text-blue-600 border border-blue-100'
                          }`}>
                          {getItemTypeLabel(addOn.itemType)}
                        </span>
                      </td>
                      <td className="px-8 py-6 font-black text-slate-900">
                        {addOn.retailPrice.toLocaleString()}đ
                      </td>
                      <td className="px-8 py-6 font-bold text-slate-600">
                        {addOn.maxQtyPerOrder || 1}
                      </td>

                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${addOn.isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-slate-300'}`}></div>
                          <span className={`text-xs font-bold ${addOn.isActive ? 'text-green-600' : 'text-slate-400'}`}>
                            {addOn.isActive ? 'Hoạt động' : 'Tạm dừng'}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <button
                            onClick={() => handleOpenModal(addOn)}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-600 hover:bg-black hover:text-white transition-all shadow-sm group-hover:shadow"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(addOn.addOnId)}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm group-hover:shadow"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal chỉnh sửa / thêm món thêm */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={handleCloseModal}></div>
          <form onSubmit={handleSubmit} className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-[2rem] shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200 bg-white rounded-t-[2rem] flex-shrink-0">
              <div className="flex-1">
                <h2 className="text-xl font-black text-gray-900">{editingAddOn ? 'Chỉnh sửa món thêm' : 'Thêm món thêm mới'}</h2>
                <p className="text-sm text-gray-500 mt-0.5">Cập nhật thông tin món thêm cho cửa hàng của bạn</p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition text-gray-500 flex-shrink-0"
              >×</button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {loadingDetail && (
                <div className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  Đang tải chi tiết món thêm...
                </div>
              )}


              <div>
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1.5">Tên món thêm <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formData.addOnName}
                  onChange={(e) => setFormData({ ...formData, addOnName: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm text-gray-900 focus:border-primary focus:outline-none transition font-semibold"
                  placeholder="Ví dụ: Heo quay nguyên con 3kg..."
                />
              </div>

              <div>
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1.5">Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm text-gray-700 focus:border-primary focus:outline-none transition resize-none"
                  placeholder="Mô tả ngắn gọn về món thêm..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1.5">Loại món thêm</label>
                  <select
                    value={formData.itemType}
                    onChange={(e) => setFormData({ ...formData, itemType: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm text-sky-700 font-bold bg-sky-50 focus:border-primary focus:outline-none transition"
                  >
                    <option value="Food">Thực phẩm</option>
                    <option value="Object">Vật phẩm</option>
                    <option value="Service">Dịch vụ</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1.5">Giá bán (VNĐ) <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatCurrencyInput(formData.retailPrice)}
                    onChange={(e) => setFormData({ ...formData, retailPrice: parseCurrencyInput(e.target.value) })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm text-gray-900 focus:border-primary focus:outline-none transition font-semibold"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1.5">Số lượng tối đa trên mỗi mâm</label>
                <input
                  type="number"
                  min="1"
                  value={formData.maxQtyPerOrder}
                  onChange={(e) => setFormData({ ...formData, maxQtyPerOrder: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm text-gray-900 focus:border-primary focus:outline-none transition font-semibold"
                  placeholder="Ví dụ: 1, 2, 5..."
                />
                <p className="text-[10px] text-slate-500 mt-1 italic">* Giới hạn số lượng món thêm này mà khách có thể chọn cho mỗi mâm cúng chính.</p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl border-2 border-gray-200 bg-white">
                <div>
                  <p className="font-black text-slate-900">Trạng thái hoạt động</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">Cho phép khách hàng nhìn thấy và đặt món thêm này.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${formData.isActive ? 'bg-black' : 'bg-slate-300'}`}
                >
                  <span
                    className={`${formData.isActive ? 'translate-x-6' : 'translate-x-1'} inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ease-in-out`}
                  />
                </button>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-5 border-t border-gray-200 bg-white rounded-b-[2rem] flex-shrink-0">
              <button
                type="button"
                onClick={handleCloseModal}
                className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-2xl font-black text-sm hover:bg-gray-50 transition-all"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-black text-white rounded-2xl font-black text-sm hover:opacity-90 transition-all shadow-md"
              >
                {editingAddOn ? 'Lưu thay đổi' : 'Xác nhận thêm'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AddOnManagement;
