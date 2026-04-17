import React, { useState, useEffect } from 'react';
import { bannerService, BannerResponse } from '../../services/bannerService';
import toast from '../../services/toast';
import Swal from 'sweetalert2';

const VendorBannerManagement: React.FC = () => {
  const [banners, setBanners] = useState<BannerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBanners = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await bannerService.getMyBanners();
      if (response.isSuccess && response.result) {
        // Sort by position
        const sorted = [...response.result].sort((a, b) => a.position - b.position);
        setBanners(sorted);
      } else {
        setError(response.errorMessages?.[0] || 'Không thể tải danh sách banner của shop');
      }
    } catch (err) {
      setError('Đã xảy ra lỗi khi kết nối máy chủ');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBanners();
  }, []);

  const getStatusBadge = (banner: BannerResponse) => {
    const now = new Date();
    const start = new Date(banner.startDate);
    const end = new Date(banner.endDate);

    if (!banner.isActive) {
      return <span className="px-2 py-1 rounded-lg bg-red-100 text-red-600 text-[10px] font-bold uppercase">Ngừng hoạt động</span>;
    }

    if (now < start) {
      return <span className="px-2 py-1 rounded-lg bg-blue-100 text-blue-600 text-[10px] font-bold uppercase">Sắp diễn ra</span>;
    }

    if (now > end) {
      return <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-[10px] font-bold uppercase">Hết hạn</span>;
    }

    return <span className="px-2 py-1 rounded-lg bg-green-100 text-green-600 text-[10px] font-bold uppercase">Đang hiển thị</span>;
  };

  const handleCreateBanner = async () => {
    const { value: formValues } = await Swal.fire({
      title: 'Thêm Banner cho Shop',
      html: `
        <div class="space-y-4 text-left">
          <div class="space-y-1.5">
            <label class="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">Tiêu đề Banner</label>
            <input id="swal-title" class="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary/30 focus:bg-white outline-none transition-all text-sm font-bold text-slate-700 shadow-sm" placeholder="Nhập tiêu đề">
          </div>
          
          <div class="space-y-1.5">
            <label class="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">Hình ảnh (Bắt buộc)</label>
            <input id="swal-image" type="file" accept="image/*" class="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary/30 focus:bg-white outline-none transition-all text-sm font-bold text-slate-700 shadow-sm">
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">Loại liên kết</label>
              <select id="swal-link-type" class="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary/30 focus:bg-white outline-none transition-all text-sm font-bold text-slate-700 shadow-sm">
                <option value="Package">Gói mâm cúng (Package)</option>
                <option value="Vendor">Link Shop của mình</option>
              </select>
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">ID mục tiêu (Gói mâm cúng)</label>
              <input id="swal-target-id" type="text" class="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary/30 focus:bg-white outline-none transition-all text-sm font-bold text-slate-700 shadow-sm" placeholder="Ví dụ: 5">
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">Đường dẫn thủ công (Nếu có)</label>
            <input id="swal-link-url" class="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary/30 focus:bg-white outline-none transition-all text-sm font-bold text-slate-700 shadow-sm" placeholder="/package/1">
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">Vị trí hiển thị</label>
              <input id="swal-position" type="text" class="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary/30 focus:bg-white outline-none transition-all text-sm font-bold text-slate-700 shadow-sm" value="1">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">Ngày bắt đầu</label>
              <input id="swal-start-date" type="date" class="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary/30 focus:bg-white outline-none transition-all text-sm font-bold text-slate-700 shadow-sm">
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">Ngày kết thúc</label>
              <input id="swal-end-date" type="date" class="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary/30 focus:bg-white outline-none transition-all text-sm font-bold text-slate-700 shadow-sm">
            </div>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Tạo Banner',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#8B4513',
      customClass: {
        popup: 'rounded-[3rem] p-10 backdrop-blur-md bg-white/90 border border-gold/20 shadow-2xl',
        confirmButton: 'rounded-2xl font-black uppercase tracking-widest text-xs px-10 py-5 shadow-lg shadow-primary/20 hover:scale-105 transition-all text-white',
        cancelButton: 'rounded-2xl font-black uppercase tracking-widest text-xs px-10 py-5 text-slate-400 hover:bg-slate-50 transition-all'
      },
      preConfirm: () => {
        const title = (document.getElementById('swal-title') as HTMLInputElement).value;
        const imageFile = (document.getElementById('swal-image') as HTMLInputElement).files?.[0];
        const linkType = (document.getElementById('swal-link-type') as HTMLSelectElement).value;
        const linkTargetId = (document.getElementById('swal-target-id') as HTMLInputElement).value;
        const linkUrl = (document.getElementById('swal-link-url') as HTMLInputElement).value;
        const position = (document.getElementById('swal-position') as HTMLInputElement).value;
        const startDate = (document.getElementById('swal-start-date') as HTMLInputElement).value;
        const endDate = (document.getElementById('swal-end-date') as HTMLInputElement).value;

        if (!title || !imageFile || !linkType || !position || !startDate || !endDate) {
          Swal.showValidationMessage('Vui lòng điền đầy đủ các thông tin bắt buộc');
          return false;
        }

        if (new Date(endDate) < new Date(startDate)) {
          Swal.showValidationMessage('Ngày kết thúc phải sau ngày bắt đầu');
          return false;
        }

        const formData = new FormData();
        formData.append('Title', title.trim());
        formData.append('ImageFile', imageFile);
        formData.append('LinkType', linkType);
        if (linkTargetId && linkTargetId.trim()) {
          formData.append('LinkTargetId', linkTargetId.trim());
        }
        if (linkUrl && linkUrl.trim()) {
          formData.append('LinkUrl', linkUrl.trim());
        }
        formData.append('Position', position.trim() || "1");
        formData.append('StartDate', startDate);
        formData.append('EndDate', endDate);

        return formData;
      }
    });

    if (formValues) {
      try {
        Swal.fire({
          title: 'Đang tạo banner...',
          didOpen: () => Swal.showLoading(),
          allowOutsideClick: false,
          customClass: { popup: 'rounded-3xl' }
        });

        const response = await bannerService.createVendorBanner(formValues);
        if (response.isSuccess) {
          toast.success('Đã tạo banner cho shop thành công');
          loadBanners();
        } else {
          toast.error(response.errorMessages?.[0] || 'Lỗi khi tạo banner');
        }
      } catch (err) {
        toast.error('Không thể kết nối máy chủ');
      }
    }
  };

  const handleEditBanner = async (banner: BannerResponse) => {
    const { value: formValues } = await Swal.fire({
      title: 'Cập nhật Banner Shop',
      html: `
        <div class="space-y-4 text-left">
          <div class="space-y-1.5">
            <label class="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">Tiêu đề Banner</label>
            <input id="swal-title" class="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary/30 focus:bg-white outline-none transition-all text-sm font-bold text-slate-700 shadow-sm" value="${banner.title || ''}">
          </div>
          
          <div class="space-y-1.5">
            <label class="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">Thay đổi hình ảnh (Để trống nếu giữ cũ)</label>
            <input id="swal-image" type="file" accept="image/*" class="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary/30 focus:bg-white outline-none transition-all text-sm font-bold text-slate-700 shadow-sm">
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">Loại liên kết</label>
              <select id="swal-link-type" class="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary/30 focus:bg-white outline-none transition-all text-sm font-bold text-slate-700 shadow-sm">
                <option value="Package" ${banner.linkType === 'Package' ? 'selected' : ''}>Gói mâm cúng (Package)</option>
                <option value="Vendor" ${banner.linkType === 'Vendor' ? 'selected' : ''}>Link Shop</option>
              </select>
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">ID mục tiêu (Gói mâm cúng)</label>
              <input id="swal-target-id" type="text" class="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary/30 focus:bg-white outline-none transition-all text-sm font-bold text-slate-700 shadow-sm" value="${banner.linkTargetId || ''}">
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">Đường dẫn thủ công</label>
            <input id="swal-link-url" class="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary/30 focus:bg-white outline-none transition-all text-sm font-bold text-slate-700 shadow-sm" value="${banner.linkUrl || ''}">
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">Vị trí</label>
              <input id="swal-position" type="text" class="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary/30 focus:bg-white outline-none transition-all text-sm font-bold text-slate-700 shadow-sm" value="${banner.position}">
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">Trạng thái</label>
              <select id="swal-active" class="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary/30 focus:bg-white outline-none transition-all text-sm font-bold text-slate-700 shadow-sm">
                <option value="true" ${banner.isActive ? 'selected' : ''}>Hoạt động</option>
                <option value="false" ${!banner.isActive ? 'selected' : ''}>Tạm ngưng</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">Ngày bắt đầu</label>
              <input id="swal-start-date" type="date" class="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary/30 focus:bg-white outline-none transition-all text-sm font-bold text-slate-700 shadow-sm" value="${banner.startDate.split('T')[0]}">
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-wider">Ngày kết thúc</label>
              <input id="swal-end-date" type="date" class="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary/30 focus:bg-white outline-none transition-all text-sm font-bold text-slate-700 shadow-sm" value="${banner.endDate.split('T')[0]}">
            </div>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Cập nhật',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#8B4513',
      customClass: {
        popup: 'rounded-[3rem] p-10 backdrop-blur-md bg-white/90 border border-gold/20 shadow-2xl',
        confirmButton: 'rounded-2xl font-black uppercase tracking-widest text-xs px-10 py-5 shadow-lg shadow-primary/20 hover:scale-105 transition-all text-white',
        cancelButton: 'rounded-2xl font-black uppercase tracking-widest text-xs px-10 py-5 text-slate-400 hover:bg-slate-50 transition-all'
      },
      preConfirm: () => {
        const title = (document.getElementById('swal-title') as HTMLInputElement).value;
        const imageFile = (document.getElementById('swal-image') as HTMLInputElement).files?.[0];
        const linkType = (document.getElementById('swal-link-type') as HTMLSelectElement).value;
        const linkTargetId = (document.getElementById('swal-target-id') as HTMLInputElement).value;
        const linkUrl = (document.getElementById('swal-link-url') as HTMLInputElement).value;
        const position = (document.getElementById('swal-position') as HTMLInputElement).value;
        const startDate = (document.getElementById('swal-start-date') as HTMLInputElement).value;
        const endDate = (document.getElementById('swal-end-date') as HTMLInputElement).value;
        const isActive = (document.getElementById('swal-active') as HTMLSelectElement).value;

        if (new Date(endDate) < new Date(startDate)) {
          Swal.showValidationMessage('Ngày kết thúc phải sau ngày bắt đầu');
          return false;
        }

        const formData = new FormData();
        if (title) formData.append('Title', title);
        if (imageFile) formData.append('ImageFile', imageFile);
        if (linkType) formData.append('LinkType', linkType);
        if (linkTargetId) formData.append('LinkTargetId', linkTargetId);
        if (linkUrl) formData.append('LinkUrl', linkUrl);
        if (position) formData.append('Position', position);
        if (startDate) formData.append('StartDate', startDate);
        if (endDate) formData.append('EndDate', endDate);
        formData.append('IsActive', isActive);

        return formData;
      }
    });

    if (formValues) {
      try {
        Swal.fire({
          title: 'Đang cập nhật...',
          didOpen: () => Swal.showLoading(),
          allowOutsideClick: false,
          customClass: { popup: 'rounded-3xl' }
        });

        const response = await bannerService.updateVendorBanner(banner.bannerId, formValues);
        if (response.isSuccess) {
          toast.success('Đã cập nhật banner thành công');
          loadBanners();
        } else {
          toast.error(response.errorMessages?.[0] || 'Lỗi khi cập nhật banner');
        }
      } catch (err) {
        toast.error('Không thể kết nối máy chủ');
      }
    }
  };

  const handleDeleteBanner = async (id: number) => {
    const result = await Swal.fire({
      title: 'Xóa Banner shop?',
      text: "Banner này sẽ bị xóa khỏi hệ thống của shop bạn.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xác nhận xóa',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#dc2626',
      customClass: {
        popup: 'rounded-3xl',
        confirmButton: 'rounded-xl font-bold px-6 py-3 text-white',
        cancelButton: 'rounded-xl font-bold px-6 py-3'
      }
    });

    if (result.isConfirmed) {
      try {
        const response = await bannerService.deleteVendorBanner(id);
        if (response.isSuccess) {
          toast.success('Đã xóa banner shop');
          loadBanners();
        } else {
          toast.error(response.errorMessages?.[0] || 'Lỗi khi xóa banner');
        }
      } catch (err) {
        toast.error('Không thể kết nối máy chủ');
      }
    }
  };

  return (
    <div className="bg-white rounded-[2rem] border border-gold/10 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-gold/10 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">Quản Lý Banner Shop</h2>
          <p className="text-sm text-black mt-1">Tạo các banner quảng bá cho sản phẩm và shop của bạn trên trang chủ</p>
        </div>
        <button
          onClick={handleCreateBanner}
          className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm uppercase hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-sm">add_circle</span>
          Thêm Banner Shop
        </button>
      </div>

      <div className="p-8">
        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
            <p className="text-black font-semibold tracking-wide">Đang tải dữ liệu banner...</p>
          </div>
        ) : error ? (
          <div className="py-20 text-center bg-red-50 rounded-3xl border border-red-100 p-8">
            <span className="material-symbols-outlined text-5xl text-red-400 mb-4">error</span>
            <p className="text-red-600 font-bold text-lg mb-4">{error}</p>
            <button
              onClick={loadBanners}
              className="px-8 py-3 bg-red-600 text-white rounded-xl font-bold uppercase text-sm hover:bg-red-700 transition-all"
            >
              Thử lại ngay
            </button>
          </div>
        ) : banners.length === 0 ? (
          <div className="py-20 text-center bg-ritual-bg/30 rounded-3xl border border-dashed border-gold/20 flex flex-col items-center">
            <span className="material-symbols-outlined text-6xl text-gold/40 mb-4">view_carousel</span>
            <p className="text-black font-medium text-lg">Shop chưa có banner nào.</p>
            <p className="text-slate-400 text-sm mt-2">Bắt đầu tạo banner đầu tiên để quảng bá shop của bạn.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {banners.map((banner) => (
              <div
                key={banner.bannerId}
                className="group relative bg-white rounded-3xl border border-gold/10 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col"
              >
                {/* Banner Image Preview */}
                <div className="relative aspect-[21/9] overflow-hidden bg-slate-100">
                  <img
                    src={banner.imageUrl}
                    alt={banner.title}
                    onError={bannerService.handleImageError}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute top-4 right-4 flex gap-2">
                    {getStatusBadge(banner)}
                    <span className="px-2 py-1 rounded-lg bg-black/60 text-white text-[10px] font-black backdrop-blur-md">
                      VỊ TRÍ: {banner.position}
                    </span>
                  </div>
                </div>

                {/* Banner Info */}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-black text-primary truncate group-hover:text-gold transition-colors">
                        {banner.title || 'Không có tiêu đề'}
                      </h3>
                      <p className="text-[10px] text-black font-medium mt-0.5 uppercase tracking-wider">
                        {banner.linkType} • Target ID: {banner.linkTargetId}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEditBanner(banner)}
                        className="p-2 text-primary hover:bg-primary/5 rounded-xl transition-all"
                        title="Chỉnh sửa"
                      >
                        <span className="material-symbols-outlined text-xl">edit_square</span>
                      </button>
                      <button
                        onClick={() => handleDeleteBanner(banner.bannerId)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Xóa banner"
                      >
                        <span className="material-symbols-outlined text-xl">delete</span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-gold/5 grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Bắt đầu</p>
                      <p className="text-xs font-bold text-slate-700">{new Date(banner.startDate).toLocaleDateString('vi-VN')}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Kết thúc</p>
                      <p className="text-xs font-bold text-slate-700">{new Date(banner.endDate).toLocaleDateString('vi-VN')}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorBannerManagement;
