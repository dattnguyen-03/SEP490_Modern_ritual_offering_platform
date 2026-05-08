import React, { useState, useEffect } from 'react';
import { shippingService, ShippingConfig, UpdateShippingConfigRequest } from '../../services/shippingService';
import toast from '../../services/toast';

interface ShippingConfigPageProps {
  onNavigate: (path: string) => void;
}

const ShippingConfigPage: React.FC<ShippingConfigPageProps> = ({ onNavigate }) => {
  const [configs, setConfigs] = useState<ShippingConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ShippingConfig | null>(null);

  // Form values
  const [formData, setFormData] = useState<UpdateShippingConfigRequest>({
    baseDistance: 10,
    basePrice: 2000,
    pricePerKm: 5000,
    maxDistance: 50,
    earliestDeliveryTime: '08:00',
    latestDeliveryTime: '20:00',
    minPreparationHours: 2,
    maxAdvanceBookingDays: 14,
    freeShipThreshold: 1000000,
    isActive: true,
  });

  const fetchConfigs = async () => {
    setIsLoading(true);
    try {
      const data = await shippingService.getShippingConfig();
      if (data) {
        if (Array.isArray(data)) {
          setConfigs(data);
        } else {
          setConfigs([data]);
        }
      } else {
        setConfigs([]);
      }
    } catch (error: any) {
      console.error('❌ Failed to fetch shipping config:', error);
      // Only show error if it's not a 404 (which we now handle in the service, but just in case)
      if (!error.message?.includes('404')) {
        toast.error(error.message || 'Không thể tải danh sách cấu hình vận chuyển');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleOpenAdd = () => {
    setEditingConfig(null);
    setFormData({
      baseDistance: 10,
      basePrice: 2000,
      pricePerKm: 5000,
      maxDistance: 50,
      earliestDeliveryTime: '08:00',
      latestDeliveryTime: '20:00',
      minPreparationHours: 2,
      maxAdvanceBookingDays: 14,
      freeShipThreshold: 1000000,
      isActive: true,
    });
    setShowForm(true);
  };

  const handleOpenEdit = (config: ShippingConfig) => {
    setEditingConfig(config);
    setFormData({
      baseDistance: config.baseDistance,
      basePrice: config.basePrice,
      pricePerKm: config.pricePerKm,
      maxDistance: config.maxDistance,
      earliestDeliveryTime: config.earliestDeliveryTime?.substring(0, 5) || '08:00',
      latestDeliveryTime: config.latestDeliveryTime?.substring(0, 5) || '20:00',
      minPreparationHours: config.minPreparationHours,
      maxAdvanceBookingDays: config.maxAdvanceBookingDays,
      freeShipThreshold: config.freeShipThreshold,
      isActive: config.isActive,
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.earliestDeliveryTime && formData.latestDeliveryTime
      && formData.earliestDeliveryTime >= formData.latestDeliveryTime) {
      toast.error('Giờ giao sớm nhất phải nhỏ hơn giờ giao muộn nhất.');
      return;
    }
    setIsSaving(true);
    try {
      // In a real scenario, we might want the service to return the error message
      const success = await shippingService.updateShippingConfig(formData);
      if (success) {
        toast.success(editingConfig ? 'Cập nhật thành công!' : 'Thêm mới thành công!');
        setShowForm(false);
        await fetchConfigs();
      } else {
        toast.error('Thao tác thất bại. Vui lòng kiểm tra lại dữ liệu và thử lại.');
      }
    } catch (error: any) {
      console.error('❌ Save shipping config error:', error);
      toast.error(error.message || 'Lỗi khi lưu cấu hình.');
    } finally {
      setIsSaving(false);
    }
  };


  const formatCurrency = (amount: number) => {
    // Custom formatting to keep it clean and matching the screenshot style
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  };

  const parseCurrencyInput = (value: string): number => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return 0;
    return Number(digits);
  };

  const formatCurrencyInput = (value: number): string => {
    return Number(value || 0).toLocaleString('vi-VN');
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
          <div className="flex items-start gap-5">
            {/* <button
              onClick={() => onNavigate('/vendor/dashboard')}
              className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-700 flex-shrink-0 hover:bg-slate-50 hover:text-black transition-all group"
              title="Quay lại Bảng điều khiền"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button> */}
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Vận Chuyển</h1>
              <p className="text-black font-bold text-sm">Quản lý các thông số phí giao hàng cho đơn hàng của bạn.</p>
            </div>
          </div>

          <button
            onClick={handleOpenAdd}
            className="px-10 py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-black/10 hover:shadow-black/20 hover:-translate-y-1 transition-all flex items-center gap-3 text-xs"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            <span>Thêm cấu hình</span>
          </button>
        </div>

        {/* List Table */}
        {!showForm && (
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl shadow-slate-200/40 p-2 overflow-hidden">
            <div>
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] w-[28%]">Sơ lược</th>
                    <th className="px-4 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] w-[12%]">Khoảng cách cơ sở</th>
                    <th className="px-4 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] w-[12%]">Phí cố định</th>
                    <th className="px-4 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] w-[12%]">Đơn giá/km thêm</th>
                    <th className="px-4 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] w-[14%]">Ngưỡng Free Ship</th>
                    <th className="px-4 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] w-[12%]">Trạng thái</th>
                    <th className="px-4 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-center w-[10%]">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {configs.length > 0 ? (
                    configs.map((config, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-all group">
                        <td className="px-6 py-8 align-top">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-400 text-xs shadow-inner group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                              {idx + 1}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 text-base">Mặc định</span>
                              <span className="text-[11px] text-slate-500 font-semibold">
                                Giờ giao: {config.earliestDeliveryTime || 'N/A'} - {config.latestDeliveryTime || 'N/A'}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                Chuẩn bị tối thiểu: {config.minPreparationHours ?? 0}h · Đặt trước tối đa: {config.maxAdvanceBookingDays ?? 0} ngày
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-8 font-black text-slate-600 tabular-nums text-sm">{config.baseDistance} km</td>
                        <td className="px-4 py-8">
                          <span className="font-black text-slate-900 text-base tabular-nums tracking-tight">
                            {formatCurrency(config.basePrice)}
                          </span>
                        </td>
                        <td className="px-4 py-8 font-bold text-slate-600 tabular-nums text-sm">+{formatCurrency(config.pricePerKm)}/km</td>
                        <td className="px-4 py-8">
                          <span className="font-bold text-emerald-600 text-sm tabular-nums">≥ {formatCurrency(config.freeShipThreshold)}</span>
                        </td>
                        <td className="px-4 py-8">
                          <div className="flex items-center">
                            <span className={`inline-block px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-colors ${config.isActive
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-slate-100 text-slate-400'
                              }`}>
                              {config.isActive ? 'Đang bật' : 'Đã tắt'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-8 text-center">
                          <button
                            onClick={() => handleOpenEdit(config)}
                            className="p-3 text-slate-300 hover:text-primary hover:bg-primary/5 rounded-2xl transition-all hover:rotate-12"
                            title="Chỉnh sửa"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-10 py-32 text-center text-slate-400 font-bold italic">
                        Chưa có quy định vận chuyển nào được tạo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl p-12 max-w-2xl mx-auto overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-2 bg-primary"></div>
            <div className="flex items-center justify-between mb-12">
              <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
                {editingConfig ? 'Cập nhật' : 'Thêm mới'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
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
                {/* Base Distance */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-1">Khoảng cách cơ sở (km)</label>
                  <div className="relative group">
                    <input
                      type="number"
                      required
                      value={formData.baseDistance}
                      onChange={(e) => setFormData({ ...formData, baseDistance: Number(e.target.value) })}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] px-6 py-5 outline-none focus:border-primary/30 focus:bg-white transition-all font-bold text-slate-800 text-lg group-hover:bg-white border-slate-100"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-200 font-black text-xs uppercase group-focus-within:text-primary transition-colors">km</div>
                  </div>
                </div>

                {/* Base Price */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-1">Phí cố định (VND)</label>
                  <div className="relative group">
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={formatCurrencyInput(formData.basePrice)}
                      onChange={(e) => setFormData({ ...formData, basePrice: parseCurrencyInput(e.target.value) })}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] px-6 py-5 outline-none focus:border-primary/30 focus:bg-white transition-all font-bold text-slate-800 text-lg group-hover:bg-white border-slate-100"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-200 font-black text-xs uppercase group-focus-within:text-primary transition-colors">VND</div>
                  </div>
                </div>

                {/* Price Per Km */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-1">Đơn giá/km thêm (VND)</label>
                  <div className="relative group">
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={formatCurrencyInput(formData.pricePerKm)}
                      onChange={(e) => setFormData({ ...formData, pricePerKm: parseCurrencyInput(e.target.value) })}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] px-6 py-5 outline-none focus:border-primary/30 focus:bg-white transition-all font-bold text-slate-800 text-lg group-hover:bg-white border-slate-100"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-200 font-black text-xs uppercase group-focus-within:text-primary transition-colors">/km</div>
                  </div>
                </div>

                {/* Max Distance */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-1">K/cách tối đa (km)</label>
                  <div className="relative group">
                    <input
                      type="number"
                      required
                      value={formData.maxDistance}
                      onChange={(e) => setFormData({ ...formData, maxDistance: Number(e.target.value) })}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] px-6 py-5 outline-none focus:border-primary/30 focus:bg-white transition-all font-bold text-slate-800 text-lg group-hover:bg-white border-slate-100"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-200 font-black text-xs uppercase group-focus-within:text-primary transition-colors">max</div>
                  </div>
                </div>

                {/* Earliest Delivery Time */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-1">Giờ giao sớm nhất</label>
                  <div className="relative group">
                    <input
                      type="time"
                      required
                      value={formData.earliestDeliveryTime || ''}
                      onChange={(e) => setFormData({ ...formData, earliestDeliveryTime: e.target.value })}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] px-6 py-5 outline-none focus:border-primary/30 focus:bg-white transition-all font-bold text-slate-800 text-lg group-hover:bg-white border-slate-100"
                    />
                  </div>
                </div>

                {/* Latest Delivery Time */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-1">Giờ giao muộn nhất</label>
                  <div className="relative group">
                    <input
                      type="time"
                      required
                      value={formData.latestDeliveryTime || ''}
                      onChange={(e) => setFormData({ ...formData, latestDeliveryTime: e.target.value })}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] px-6 py-5 outline-none focus:border-primary/30 focus:bg-white transition-all font-bold text-slate-800 text-lg group-hover:bg-white border-slate-100"
                    />
                  </div>
                </div>

                {/* Min Preparation Hours */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-1">Giờ chuẩn bị tối thiểu</label>
                  <div className="relative group">
                    <input
                      type="number"
                      min={0}
                      required
                      value={formData.minPreparationHours ?? 0}
                      onChange={(e) => setFormData({ ...formData, minPreparationHours: Number(e.target.value) })}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] px-6 py-5 outline-none focus:border-primary/30 focus:bg-white transition-all font-bold text-slate-800 text-lg group-hover:bg-white border-slate-100"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-200 font-black text-xs uppercase group-focus-within:text-primary transition-colors">giờ</div>
                  </div>
                </div>

                {/* Max Advance Booking Days */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-1">Số ngày đặt trước tối đa</label>
                  <div className="relative group">
                    <input
                      type="number"
                      min={0}
                      required
                      value={formData.maxAdvanceBookingDays ?? 0}
                      onChange={(e) => setFormData({ ...formData, maxAdvanceBookingDays: Number(e.target.value) })}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] px-6 py-5 outline-none focus:border-primary/30 focus:bg-white transition-all font-bold text-slate-800 text-lg group-hover:bg-white border-slate-100"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-200 font-black text-xs uppercase group-focus-within:text-primary transition-colors">ngày</div>
                  </div>
                </div>

                {/* Free Ship Threshold */}
                <div className="space-y-3 md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-1">Ngưỡng miễn phí vận chuyển (VND)</label>
                  <div className="relative group">
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={formatCurrencyInput(formData.freeShipThreshold)}
                      onChange={(e) => setFormData({ ...formData, freeShipThreshold: parseCurrencyInput(e.target.value) })}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] px-6 py-5 outline-none focus:border-primary/30 focus:bg-white transition-all font-bold text-slate-800 text-lg group-hover:bg-white border-slate-100"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-emerald-300 font-black text-[10px] uppercase tracking-widest group-focus-within:text-emerald-500 transition-all">Free Over</div>
                  </div>
                </div>

                {/* Is Active Toggle */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between p-7 bg-slate-50 rounded-[1.5rem] border border-slate-100">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-900 text-sm uppercase tracking-wide">Kích hoạt quy định</span>
                      <span className="text-[10px] text-slate-400 font-bold">Quy định sẽ được áp dụng ngay cho đơn hàng mới.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                      className={`relative w-16 h-8 rounded-full transition-all flex items-center px-1 shadow-inner ${formData.isActive ? 'bg-primary' : 'bg-slate-200'}`}
                    >
                      <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-all ${formData.isActive ? 'translate-x-8' : 'translate-x-0'}`}></div>
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-8 flex gap-6">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
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
                      <span>Lưu cấu hình</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShippingConfigPage;
