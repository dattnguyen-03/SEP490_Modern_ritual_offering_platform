import React, { useState, useEffect } from 'react';
import { staffService, CeremonyCategory } from '../../services/staffService';
import Swal from 'sweetalert2';
import toast from '../../services/toast';

interface SystemSettingsProps {
  onNavigate: (path: string) => void;
  onLogout?: () => void;
}

interface SystemConfig {
  id: string;
  category: 'general' | 'payment' | 'delivery' | 'notification';
  name: string;
  value: string | boolean | number;
  description: string;
  editable: boolean;
}

const SystemSettings: React.FC<SystemSettingsProps> = ({ onNavigate, onLogout }) => {
  const [activeCategory, setActiveCategory] = useState<'general' | 'payment' | 'delivery' | 'notification' | 'ceremony'>('ceremony');
  const [editingConfig, setEditingConfig] = useState<SystemConfig | null>(null);
  const [ceremonyCategories, setCeremonyCategories] = useState<CeremonyCategory[]>([]);
  const [isCeremonyLoading, setIsCeremonyLoading] = useState(false);
  const [isCeremonyModalOpen, setIsCeremonyModalOpen] = useState(false);
  const [editingCeremony, setEditingCeremony] = useState<CeremonyCategory | null>(null);

  const [configs, setConfigs] = useState<SystemConfig[]>([]);

  const categories = [
    { id: 'ceremony', label: 'Thể loại nghi lễ', icon: '' },
  ];

  const stats = [
    { label: 'Cấu hình hoạt động', value: '24', icon: '' },
    { label: 'Cần kiểm tra', value: '3', icon: '' },
    { label: 'Uptime', value: '99.8%', icon: '' },
    { label: 'Người dùng online', value: '156', icon: '' },
  ];

  const filteredConfigs = configs.filter(config => config.category === activeCategory);

  const handleSaveConfig = (config: SystemConfig, newValue: string | boolean | number) => {
    setConfigs(configs.map(c =>
      c.id === config.id ? { ...c, value: newValue } : c
    ));
    setEditingConfig(null);
  };

  // --- Ceremony Categories Logic ---
  const fetchCeremonyCategories = async () => {
    try {
      setIsCeremonyLoading(true);
      const data = await staffService.getCeremonyCategories();
      setCeremonyCategories(data);
    } catch (error) {
      console.error('Failed to fetch ceremony categories:', error);
      toast.error('Không thể tải danh sách thể loại nghi lễ');
    } finally {
      setIsCeremonyLoading(false);
    }
  };

  useEffect(() => {
    if (activeCategory === 'ceremony') {
      fetchCeremonyCategories();
    }
  }, [activeCategory]);

  const handleOpenCeremonyModal = (category?: CeremonyCategory) => {
    setEditingCeremony(category || null);
    setIsCeremonyModalOpen(true);
  };

  const handleSaveCeremony = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;

    if (!name.trim()) {
      toast.error('Vui lòng nhập tên thể loại');
      return;
    }

    try {
      if (editingCeremony) {
        await staffService.updateCeremonyCategory(editingCeremony.categoryId, { name, description });
        toast.success('Cập nhật thể loại thành công');
      } else {
        await staffService.createCeremonyCategory({ name, description });
        toast.success('Thêm thể loại mới thành công');
      }
      setIsCeremonyModalOpen(false);
      fetchCeremonyCategories();
    } catch (error: any) {
      toast.error(error.message || 'Thao tác thất bại');
    }
  };

  const handleReactivateCeremony = async (id: number) => {
    try {
      await staffService.reactivateCeremonyCategory(id);
      toast.success('Khôi phục thể loại thành công');
      fetchCeremonyCategories();
    } catch (error: any) {
      toast.error(error.message || 'Khôi phục thất bại');
    }
  };

  const handleDeleteCeremony = async (id: number) => {
    const result = await Swal.fire({
      title: 'Tạm ngưng thể loại?',
      text: "Thể loại này sẽ không hiển thị công khai trên hệ thống.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0f172a',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy'
    });

    if (result.isConfirmed) {
      try {
        await staffService.deleteCeremonyCategory(id);
        toast.success('Đã tạm ngưng thể loại');
        fetchCeremonyCategories();
      } catch (error: any) {
        toast.error(error.message || 'Thao tác thất bại');
      }
    }
  };

  const renderCeremonyTab = () => {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Quản lý thể loại nghi lễ</h2>
          <button
            onClick={() => handleOpenCeremonyModal()}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition shadow-sm flex items-center gap-2"
          >
            <span>➕</span> Thêm thể loại
          </button>
        </div>

        {isCeremonyLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ceremonyCategories.map((cat) => (
              <div
                key={cat.categoryId}
                className={`p-5 border rounded-2xl bg-white transition shadow-sm group ${cat.isActive ? 'border-slate-200 hover:border-slate-300' : 'border-slate-100 opacity-75'
                  }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{cat.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`size-2 rounded-full ${cat.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                      <span className="text-xs font-medium text-black">
                        {cat.isActive ? 'Đang hoạt động' : 'Tạm ngưng'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => handleOpenCeremonyModal(cat)}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                      title="Chỉnh sửa"
                    >
                      ✏️
                    </button>
                    {cat.isActive ? (
                      <button
                        onClick={() => handleDeleteCeremony(cat.categoryId)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Tạm ngưng"
                      >
                        🗑️
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivateCeremony(cat.categoryId)}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                        title="Khôi phục"
                      >
                        🔄
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2 min-h-[40px]">
                  {cat.description || 'Chưa có mô tả cho thể loại này.'}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Ceremony Modal */}
        {isCeremonyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingCeremony ? 'Cập nhật thể loại' : 'Thêm thể loại nghi lễ'}
                </h3>
                <button
                  onClick={() => setIsCeremonyModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleSaveCeremony} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Tên thể loại</label>
                  <input
                    name="name"
                    type="text"
                    defaultValue={editingCeremony?.name}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 outline-none transition"
                    placeholder="VD: Lễ Cúng Giao Thừa"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Mô tả</label>
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={editingCeremony?.description}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 outline-none transition"
                    placeholder="Mô tả ý nghĩa của lễ cúng..."
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCeremonyModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition shadow-md"
                  >
                    {editingCeremony ? 'Lưu thay đổi' : 'Tạo thể loại'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderConfigValue = (config: SystemConfig) => {
    if (typeof config.value === 'boolean') {
      return (
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.value}
            onChange={(e) => handleSaveConfig(config, e.target.checked)}
            disabled={!config.editable}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-900"></div>
        </label>
      );
    }

    if (editingConfig?.id === config.id) {
      return (
        <div className="flex gap-2">
          <input
            type={typeof config.value === 'number' ? 'number' : 'text'}
            defaultValue={config.value.toString()}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const value = (e.target as HTMLInputElement).value;
                handleSaveConfig(config, typeof config.value === 'number' ? parseFloat(value) : value);
              }
            }}
          />
          <button
            onClick={() => {
              const input = document.querySelector('input[type="text"], input[type="number"]') as HTMLInputElement;
              const value = input.value;
              handleSaveConfig(config, typeof config.value === 'number' ? parseFloat(value) : value);
            }}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
          >
            Lưu
          </button>
          <button
            onClick={() => setEditingConfig(null)}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:border-slate-300 transition"
          >
            Hủy
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-900">{config.value.toString()}</span>
        {config.editable && (
          <button
            onClick={() => setEditingConfig(config)}
            className="px-3 py-1 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
          >
            Sửa
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white py-8 px-4 md:px-8">
      <div className="max-w-[1600px] mx-auto">
        {/* Header Section */}
        <div className="mb-12">
          <div className="flex items-start justify-between gap-6 mb-2">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900">Quản lý Cấu hình Hệ thống</h1>
              <p className="text-black font-bold mt-2">Quản lý thể loại nghi lễ và cấu hình nền tảng</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6 lg:gap-8">
          {/* Sidebar Navigation */}
          <div className="col-span-12 lg:col-span-3">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden sticky top-24">
              <div className="px-6 py-8 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Danh mục</h2>
              </div>

              <div className="divide-y divide-slate-100">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id as any)}
                    className={`w-full px-6 py-4 text-left font-bold text-sm transition-all flex items-center gap-3 ${activeCategory === cat.id
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    <span className="text-lg">{cat.icon || '⚙️'}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="col-span-12 lg:col-span-9">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              {activeCategory === 'ceremony' ? (
                <div className="p-6 md:p-8 space-y-8">
                  {/* Header with Add Button */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-100">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900">Thể loại Nghi Lễ</h2>
                      <p className="text-sm text-black mt-1 font-medium">Quản lý các loại nghi lễ có sẵn trên nền tảng</p>
                    </div>
                    <button
                      onClick={() => handleOpenCeremonyModal()}
                      className="px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-slate-800 transition-all shadow-md hover:shadow-lg flex items-center gap-2 whitespace-nowrap"
                    >
                      <span className="text-lg">➕</span> Thêm thể loại
                    </button>
                  </div>

                  {/* Category Grid */}
                  {isCeremonyLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <div className="animate-spin rounded-full h-10 w-10 border-3 border-slate-200 border-t-slate-900 mb-4"></div>
                      <p className="text-black font-bold">Đang tải danh sách...</p>
                    </div>
                  ) : ceremonyCategories.length === 0 ? (
                    <div className="text-center py-16">
                      <p className="text-black font-bold text-lg">Chưa có thể loại nào</p>
                      <p className="text-slate-400 text-sm mt-1">Hãy thêm thể loại nghi lễ đầu tiên của bạn</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {ceremonyCategories.map((cat) => (
                        <div
                          key={cat.categoryId}
                          className={`group rounded-2xl border-2 transition-all duration-200 p-5 ${cat.isActive
                            ? 'border-slate-200 bg-gradient-to-br from-white to-slate-50/30 hover:border-slate-300 hover:shadow-md'
                            : 'border-slate-100 bg-slate-50/50 opacity-60'
                            }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base font-black text-slate-900 line-clamp-1">{cat.name}</h3>
                              <div className="flex items-center gap-2 mt-2">
                                <span className={`inline-flex h-2 w-2 rounded-full ${cat.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                <span className="text-xs font-bold text-black uppercase tracking-widest">
                                  {cat.isActive ? 'Hoạt động' : 'Tạm ngưng'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <p className="text-sm text-slate-600 line-clamp-3 min-h-[60px] leading-relaxed mb-4">
                            {cat.description || 'Chưa có mô tả cho thể loại này'}
                          </p>

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-4 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleOpenCeremonyModal(cat)}
                              className="flex-1 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition text-sm font-bold"
                              title="Chỉnh sửa"
                            >
                              ✏️ Sửa
                            </button>
                            {cat.isActive ? (
                              <button
                                onClick={() => handleDeleteCeremony(cat.categoryId)}
                                className="flex-1 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg transition text-sm font-bold"
                                title="Tạm ngưng"
                              >
                                Tắt
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivateCeremony(cat.categoryId)}
                                className="flex-1 px-3 py-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition text-sm font-bold"
                                title="Khôi phục"
                              >
                                Bật
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 md:p-8">
                  <div className="pb-6 border-b border-slate-100">
                    <h2 className="text-2xl font-black text-slate-900">
                      {categories.find(c => c.id === activeCategory)?.label}
                    </h2>
                    <p className="text-sm text-black mt-1 font-medium">
                      Quản lý các cấu hình của danh mục này
                    </p>
                  </div>

                  <div className="space-y-4 mt-6">
                    {filteredConfigs.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-black font-bold">Chưa có cấu hình nào</p>
                      </div>
                    ) : (
                      filteredConfigs.map((config) => (
                        <div
                          key={config.id}
                          className="p-5 border border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50/30 transition-all"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base font-black text-slate-900 mb-1">{config.name}</h3>
                              <p className="text-sm text-slate-600 mb-3">{config.description}</p>
                              <span className="inline-block text-xs text-black font-mono bg-slate-100 px-3 py-1 rounded-lg">
                                {config.id}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-between">
                            {renderConfigValue(config)}
                          </div>

                          {!config.editable && (
                            <div className="mt-3 text-xs text-slate-400 font-medium italic">
                              ℹ️ Cài đặt này không thể chỉnh sửa
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ceremony Modal */}
      {isCeremonyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
              <h3 className="text-xl font-black text-slate-900">
                {editingCeremony ? '✏️ Cập nhật thể loại' : '➕ Thêm thể loại nghi lễ'}
              </h3>
              <button
                onClick={() => setIsCeremonyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition text-xl"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveCeremony} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-widest">Tên thể loại</label>
                <input
                  name="name"
                  type="text"
                  defaultValue={editingCeremony?.name}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none transition font-medium"
                  placeholder="VD: Lễ Cúng Giao Thừa"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-black text-slate-900 mb-2 uppercase tracking-widest">Mô tả</label>
                <textarea
                  name="description"
                  rows={4}
                  defaultValue={editingCeremony?.description}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none transition font-medium"
                  placeholder="Mô tả ý nghĩa của lễ cúng này..."
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCeremonyModalOpen(false)}
                  className="flex-1 px-4 py-3 border-2 border-slate-200 text-slate-600 font-black rounded-xl hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-slate-900 text-white font-black rounded-xl hover:bg-slate-800 transition shadow-md"
                >
                  {editingCeremony ? 'Lưu thay đổi' : 'Tạo thể loại'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemSettings;
