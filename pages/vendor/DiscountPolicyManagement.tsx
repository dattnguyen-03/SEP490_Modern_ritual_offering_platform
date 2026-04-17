import React, { useState, useEffect } from 'react';
import { discountPolicyService, DiscountPolicy, CreateDiscountPolicyRequest, UpdateDiscountPolicyRequest } from '../../services/discountPolicyService';
import toast from '../../services/toast';

interface DiscountPolicyManagementProps {
  onNavigate: (path: string) => void;
}

const DiscountPolicyManagement: React.FC<DiscountPolicyManagementProps> = ({ onNavigate }) => {
  const [policies, setPolicies] = useState<DiscountPolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<DiscountPolicy | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateDiscountPolicyRequest>({
    minQuantity: 3,
    discountType: 'Percentage',
    discountValue: 5,
    description: '',
  });

  const fetchPolicies = async () => {
    setIsLoading(true);
    try {
      const data = await discountPolicyService.getDiscountPolicies();
      setPolicies(data || []);
    } catch (error) {
      toast.error('Không thể tải danh sách chính sách giảm giá.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleOpenAdd = () => {
    setEditingPolicy(null);
    setFormData({
      minQuantity: 3,
      discountType: 'Percentage',
      discountValue: 5,
      description: '',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (policy: DiscountPolicy) => {
    setEditingPolicy(policy);
    setFormData({
      minQuantity: policy.minQuantity,
      discountType: policy.discountType,
      discountValue: policy.discountValue,
      description: policy.description,
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let success = false;
      if (editingPolicy) {
        success = await discountPolicyService.updateDiscountPolicy(editingPolicy.policyId, {
          ...formData,
          isActive: editingPolicy.isActive,
        });
      } else {
        success = await discountPolicyService.createDiscountPolicy(formData);
      }

      if (success) {
        toast.success(editingPolicy ? 'Cập nhật thành công!' : 'Thêm mới thành công!');
        setShowModal(false);
        fetchPolicies();
      } else {
        toast.error('Thao tác thất bại. Vui lòng thử lại.');
      }
    } catch (error) {
      toast.error('Lỗi khi lưu chính sách.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (policy: DiscountPolicy) => {
    try {
      const success = await discountPolicyService.updateDiscountPolicy(policy.policyId, {
        isActive: !policy.isActive,
      });
      if (success) {
        toast.success(policy.isActive ? 'Đã tạm dừng chính sách.' : 'Đã kích hoạt chính sách.');
        fetchPolicies();
      }
    } catch (error) {
      toast.error('Không thể thay đổi trạng thái.');
    }
  };

  const handleDelete = async (id: number) => {
    const confirm = await toast.confirm({
      title: 'Xác nhận xóa?',
      text: 'Chính sách này sẽ bị xóa khỏi hệ thống.',
      icon: 'warning',
      confirmButtonText: 'Xóa ngay',
    });

    if (confirm.isConfirmed) {
      try {
        const success = await discountPolicyService.deleteDiscountPolicy(id);
        if (success) {
          toast.success('Đã xóa chính sách.');
          fetchPolicies();
        }
      } catch (error) {
        toast.error('Lỗi khi xóa chính sách.');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white py-12 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] animate-pulse">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-16">
      <div className="max-w-7xl mx-auto px-8">
        {/* Header Section */}
        <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Chính Sách Giảm Giá</h1>
            <p className="text-black font-bold text-sm">Thiết lập các ưu đãi khi khách hàng đặt hàng với số lượng lớn.</p>
          </div>

          <button
            onClick={handleOpenAdd}
            className="px-10 py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-black/10 hover:shadow-black/20 hover:-translate-y-1 transition-all flex items-center gap-3 text-xs"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            <span>Thêm chính sách</span>
          </button>
        </div>

        {/* List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {policies.length > 0 ? (
            policies.map((policy) => (
              <div
                key={policy.policyId}
                className={`bg-white rounded-[2.5rem] border-2 transition-all p-8 relative overflow-hidden group ${policy.isActive ? 'border-primary/20 shadow-xl shadow-primary/5' : 'border-slate-100 opacity-75'}`}
              >
                {/* Status Badge */}
                <div className={`absolute top-6 right-6 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${policy.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  {policy.isActive ? 'Đang bật' : 'Đã tắt'}
                </div>

                <div className="flex flex-col h-full">
                  <div className="mb-6">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">Điều kiện áp dụng</p>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Từ {policy.minQuantity} món trở lên</h3>
                  </div>

                  <div className="mb-8">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">Mức giảm giá</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-black text-slate-900 tabular-nums">-{policy.discountValue}</span>
                      <span className="text-2xl font-black text-slate-900">{policy.discountType === 'Percentage' ? '%' : '₫'}</span>
                    </div>
                  </div>

                  <p className="text-black font-medium text-sm mb-10 min-h-[40px] italic">"{policy.description || 'Không có mô tả'}"</p>

                  <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(policy)}
                        className="p-3 bg-slate-50 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-2xl transition-all"
                        title="Chỉnh sửa"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleToggleActive(policy)}
                        className={`p-3 rounded-2xl transition-all ${policy.isActive ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                        title={policy.isActive ? 'Tạm dừng' : 'Kích hoạt'}
                      >
                        {policy.isActive ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    </div>

                    <button
                      onClick={() => policy.policyId && handleDelete(policy.policyId)}
                      className="p-3 bg-red-50 text-red-300 hover:text-red-500 hover:bg-red-100 rounded-2xl transition-all"
                      title="Xóa"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-32 text-center bg-slate-50 rounded-[3rem] border border-dashed border-slate-200">
              <p className="text-slate-400 font-bold italic">Chưa có chính sách giảm giá nào được tạo.</p>
              <button
                onClick={handleOpenAdd}
                className="mt-4 text-primary font-black uppercase tracking-widest text-xs hover:underline"
              >
                Tạo chính sách đầu tiên ngay
              </button>
            </div>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-xl bg-white rounded-[3rem] shadow-2xl overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-2 bg-primary"></div>

              <div className="p-12">
                <div className="flex items-center justify-between mb-10">
                  <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
                    {editingPolicy ? 'Cập nhật' : 'Thêm mới'}
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                    disabled={isSaving}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleSave} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Min Quantity */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-1">Số lượng tối thiểu</label>
                      <div className="relative group">
                        <input
                          type="number"
                          required
                          min={1}
                          inputMode="numeric"
                          value={formData.minQuantity}
                          onChange={(e) => setFormData({ ...formData, minQuantity: Number(e.target.value) })}
                          className="w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] px-6 py-5 outline-none focus:border-primary/30 focus:bg-white transition-all font-bold text-slate-800 text-lg group-hover:bg-white border-slate-100 appearance-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder="Ví dụ: 3"
                        />
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 font-black text-[10px] uppercase tracking-widest group-focus-within:text-primary transition-all">Món</div>
                      </div>
                    </div>

                    {/* Discount Value */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-1">Mức giảm ({formData.discountType === 'Percentage' ? '%' : 'VND'})</label>
                      <div className="relative group">
                        <input
                          type="number"
                          required
                          min={0}
                          inputMode="numeric"
                          max={formData.discountType === 'Percentage' ? 100 : undefined}
                          value={formData.discountValue}
                          onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                          className="w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] px-6 py-5 outline-none focus:border-primary/30 focus:bg-white transition-all font-bold text-slate-800 text-lg group-hover:bg-white border-slate-100 appearance-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder={formData.discountType === 'Percentage' ? 'Ví dụ: 5' : 'Ví dụ: 100,000'}
                        />
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 font-black text-[10px] uppercase tracking-widest group-focus-within:text-primary transition-all">
                          {formData.discountType === 'Percentage' ? '%' : 'VNĐ'}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="md:col-span-2 space-y-3">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-1">Mô tả chính sách (Không bắt buộc)</label>
                      <textarea
                        rows={3}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] px-6 py-5 outline-none focus:border-primary/30 focus:bg-white transition-all font-bold text-slate-800 group-hover:bg-white border-slate-100 resize-none"
                        placeholder="Nhập mô tả ngắn gọn cho chính sách này..."
                      />
                    </div>
                  </div>

                  <div className="pt-8 flex gap-6">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      disabled={isSaving}
                      className="flex-1 py-5 bg-white border-2 border-slate-100 text-slate-400 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-50 hover:text-slate-600 transition-all text-xs"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex-[2] py-5 bg-black text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-black/20 hover:scale-[1.03] active:scale-[0.97] transition-all text-xs flex items-center justify-center gap-3"
                    >
                      {isSaving ? (
                        <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span>Lưu chính sách</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscountPolicyManagement;
