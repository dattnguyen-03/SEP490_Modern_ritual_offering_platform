import React, { useState, useEffect } from 'react';
import { guidelineService, CulturalGuideline } from '../../services/guidelineService';
import { packageService } from '../../services/packageService';
import { CeremonyCategory } from '../../types';
import toast from '../../services/toast';
import Swal from 'sweetalert2';

const GuidelineManagement: React.FC = () => {
  const [guidelines, setGuidelines] = useState<CulturalGuideline[]>([]);
  const [categories, setCategories] = useState<CeremonyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedGuideline, setSelectedGuideline] = useState<CulturalGuideline | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  // New/Edit guideline form state
  const [formData, setFormData] = useState({
    categoryId: 0,
    title: '',
    description: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [gData, cData] = await Promise.all([
        guidelineService.getAllGuidelinesForStaff(),
        packageService.getCeremonyCategories()
      ]);
      setGuidelines(gData);
      setCategories(cData);
    } catch (error) {
      toast.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.categoryId === 0 || !formData.title || !formData.description) {
      toast.warning('Vui lòng điền đầy đủ thông tin');
      return;
    }

    try {
      console.log('📤 Submitting guideline data:', formData);
      if (editingId) {
        await guidelineService.updateGuideline(editingId, formData);
        toast.success('Cập nhật cẩm nang thành công');
      } else {
        await guidelineService.createGuideline(formData);
        toast.success('Thêm cẩm nang thành công');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('❌ Failed to save guideline:', error);
      toast.error(error.message || 'Lỗi khi lưu cẩm nang');
    }
  };

  const resetForm = () => {
    setFormData({ categoryId: 0, title: '', description: '' });
    setEditingId(null);
  };

  const handleEdit = (g: CulturalGuideline) => {
    setFormData({
      categoryId: g.categoryId,
      title: g.title,
      description: g.description
    });
    setEditingId(g.guidelineId);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      title: 'Xác nhận xóa?',
      text: "Cẩm nang này sẽ bị ẩn khỏi giao diện khách hàng.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0f172a',
      confirmButtonText: 'Đồng ý ẩn',
      cancelButtonText: 'Hủy'
    });

    if (result.isConfirmed) {
      try {
        await guidelineService.deleteGuideline(id);
        toast.success('Đã ẩn cẩm nang');
        fetchData();
      } catch (error: any) {
        toast.error(error.message || 'Lỗi khi ẩn cẩm nang');
      }
    }
  };

  const handleReactivate = async (id: number) => {
    try {
      await guidelineService.reactivateGuideline(id);
      toast.success('Đã khôi phục hiển thị');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Lỗi khi khôi phục');
    }
  };

  const handleShowDetail = (g: CulturalGuideline) => {
    setSelectedGuideline(g);
    setShowDetailModal(true);
  };

  const filteredGuidelines = guidelines.filter(g => {
    const matchesSearch = g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.categoryName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || g.categoryId.toString() === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-gold/10 shadow-xl shadow-slate-200/50">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Quản lý Cẩm nang Văn hóa</h1>
          <p className="text-black font-medium mt-1">Lưu trữ và bổ sung kiến thức tâm linh chuẩn truyền thống</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-primary text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[13px] hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined">add</span>
          Thêm cẩm nang mới
        </button>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 relative">
          <span className="absolute left-6 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400">search</span>
          <input
            type="text"
            placeholder="Tìm kiếm cẩm nang theo tiêu đề hoặc danh mục..."
            className="w-full pl-16 pr-6 py-5 rounded-3xl border border-slate-100 bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div>
          <select
            className="w-full px-6 py-5 rounded-3xl border border-slate-100 bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all font-black text-slate-700 appearance-none cursor-pointer"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">Tất cả danh mục</option>
            {categories.map(c => (
              <option key={c.categoryId} value={c.categoryId}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">ID</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Danh mục</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tiêu đề hướng dẫn</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Trạng thái</th>
                <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ngày tạo</th>
                <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-8 py-6"><div className="h-8 bg-slate-100 rounded-xl w-full"></div></td>
                  </tr>
                ))
              ) : filteredGuidelines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <span className="material-symbols-outlined text-6xl text-slate-200 mb-4 block">book_4</span>
                    <p className="text-slate-400 font-bold italic">Không tìm thấy cẩm nang nào phù hợp</p>
                  </td>
                </tr>
              ) : filteredGuidelines.map((g) => (
                <tr key={g.guidelineId} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6 text-sm font-black text-primary">#{g.guidelineId}</td>
                  <td className="px-8 py-6">
                    <span className="px-3 py-1 bg-gold/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full whitespace-nowrap">{g.categoryName}</span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="font-bold text-slate-800 line-clamp-1">{g.title}</div>
                    <div className="text-xs text-slate-400 mt-1 line-clamp-1">{g.description}</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${g.isActive ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                      <span className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${g.isActive ? 'text-green-600' : 'text-slate-400'}`}>
                        {g.isActive ? 'Đang hiển thị' : 'Đã ẩn'}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-sm font-bold text-black">
                    {new Date(g.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2 text-right">
                      <button
                        onClick={() => handleShowDetail(g)}
                        className="p-2 text-slate-400 hover:text-blue-500 transition-colors hover:bg-blue-50 rounded-xl"
                        title="Xem chi tiết nội dung"
                      >
                        <span className="material-symbols-outlined">info</span>
                      </button>
                      {/* <button 
                        onClick={() => window.open(`/cultural-guideline/${g.guidelineId}`, '_blank')}
                        className="p-2 text-slate-400 hover:text-slate-600 transition-colors hover:bg-slate-50 rounded-xl"
                        title="Xem bản xem trước của khách hàng"
                      >
                        <span className="material-symbols-outlined">open_in_new</span>
                      </button> */}
                      <button
                        onClick={() => handleEdit(g)}
                        className="p-2 text-slate-400 hover:text-primary transition-colors hover:bg-ritual-bg rounded-xl"
                        title="Chỉnh sửa bài viết"
                      >
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                      {g.isActive ? (
                        <button
                          onClick={() => handleDelete(g.guidelineId)}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors hover:bg-red-50 rounded-xl"
                          title="Ẩn khỏi khách hàng"
                        >
                          <span className="material-symbols-outlined">visibility_off</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(g.guidelineId)}
                          className="p-2 text-slate-400 hover:text-green-500 transition-colors hover:bg-green-50 rounded-xl"
                          title="Khôi phục hiển thị"
                        >
                          <span className="material-symbols-outlined">visibility</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm bg-slate-900/40 animate-fade-in">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-scale-in">
            <div className="px-10 py-8 bg-slate-900 flex justify-between items-center text-white">
              <div>
                <h3 className="text-2xl font-black tracking-tight">
                  {editingId ? 'Cập nhật cẩm nang' : 'Thêm cẩm nang mới'}
                </h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Dành riêng cho nhân viên</p>
              </div>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="size-12 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-10 space-y-8">
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-4">Danh mục lễ cúng</label>
                <select
                  className="w-full px-8 py-5 rounded-3xl border border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all font-bold text-slate-700"
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: parseInt(e.target.value) })}
                >
                  <option value={0}>Chọn danh mục...</option>
                  {categories.map(c => (
                    <option key={c.categoryId} value={c.categoryId}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-4">Tiêu đề bài viết</label>
                <input
                  type="text"
                  className="w-full px-8 py-5 rounded-3xl border border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all font-bold text-slate-800"
                  placeholder="VD: Hướng dẫn cúng đầy tháng chi tiết nhất..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-4">Nội dung hướng dẫn</label>
                <textarea
                  rows={6}
                  className="w-full px-8 py-6 rounded-[2.5rem] border border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all font-medium text-slate-700 leading-relaxed"
                  placeholder="Mô tả chi tiết cách chuẩn bị mâm cỗ, ý nghĩa lễ vật..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="pt-6 flex gap-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 py-5 rounded-3xl font-black uppercase tracking-widest text-xs text-slate-400 bg-slate-50 hover:bg-slate-100 transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-5 rounded-3xl font-black uppercase tracking-widest text-xs text-white bg-primary shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  {editingId ? 'Lưu thay đổi' : 'Lưu bài viết'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {showDetailModal && selectedGuideline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-scale-in">
            <div className="px-10 py-8 bg-ritual-bg flex justify-between items-center border-b border-ritual-bg/20">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                  {selectedGuideline.categoryName}
                </span>
                <span className="text-slate-400 font-bold text-xs font-mono">#{selectedGuideline.guidelineId}</span>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="size-12 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-slate-400">close</span>
              </button>
            </div>

            <div className="p-10 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <h2 className="text-3xl font-black text-primary leading-tight">
                {selectedGuideline.title}
              </h2>

              <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest bg-slate-50 p-4 rounded-2xl w-fit">
                <span className="material-symbols-outlined text-sm">calendar_today</span>
                <span>Ngày tạo: {new Date(selectedGuideline.createdAt).toLocaleDateString('vi-VN')}</span>
              </div>

              <div className="prose prose-slate max-w-none">
                <div className="text-slate-600 leading-relaxed text-lg whitespace-pre-wrap">
                  {selectedGuideline.description}
                </div>
              </div>
            </div>

            <div className="px-10 py-8 border-t border-slate-100 bg-white flex gap-3">
              <button
                onClick={() => { setShowDetailModal(false); handleEdit(selectedGuideline); }}
                className="flex-1 py-4 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20"
              >
                Chỉnh sửa ngay
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-8 py-4 bg-slate-50 text-slate-400 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-100 transition-all"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuidelineManagement;
