import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { vendorService, VendorProfile } from '../../services/vendorService';
import { packageService } from '../../services/packageService';
import { bannerService, BannerResponse } from '../../services/bannerService';
import Carousel from '../../components/Carousel';
import { Product } from '../../types';
import toast from '../../services/toast';

// Premium ProductCard for Vendor Shop (synchronized with /shop)
const ProductCard: React.FC<{
  product: Product;
  onNavigate: (path: string) => void;
}> = ({ product, onNavigate }) => (
  <div
    className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all border border-gold/10 group flex flex-col h-full cursor-pointer"
    onClick={() => onNavigate(`/product/${product.id}`)}
  >
    <div className="relative w-full pt-[100%] overflow-hidden bg-slate-50 shrink-0">
      <img
        src={product.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1000'}
        alt={product.name}
        className="absolute top-0 left-0 w-full h-full object-cover group-hover:scale-110 transition-all duration-700"
        onError={(e) => {
          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1000';
        }}
      />
    </div>
    <div className="p-6 flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1 text-gold">
          <span className="text-sm" style={{ color: '#FFD700' }}>★</span>
          <span className="text-xs font-bold">{product.rating}</span>
          <span className="text-[10px] text-slate-400 ml-1">({product.reviews || 0})</span>
        </div>
        {product.totalSold !== undefined && product.totalSold > 0 && (
          <span className="text-[10px] font-medium text-black bg-slate-100 px-2 py-0.5 rounded-full">
            Đã bán {product.totalSold}
          </span>
        )}
      </div>
      <h4 className="text-sm font-bold text-slate-800 line-clamp-2 min-h-[40px] leading-snug mb-2 group-hover:text-primary transition-colors">{product.name}</h4>
      <div className="pt-4 mt-auto border-t border-gold/10 flex items-center justify-between">
        <p className="text-lg font-black text-primary tracking-tight">{product.price.toLocaleString('vi-VN')}đ</p>
        <div className="bg-primary text-white p-2 rounded-xl scale-90 group-hover:scale-100 transition-transform">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>
      </div>
    </div>
  </div>
);

interface VendorProfilePageProps {
  onNavigate: (path: string) => void;
}

const BUSINESS_TYPE_MAP: Record<string, string> = {
  'Individual': 'Cá nhân',
  'HouseholdBusiness': 'Hộ gia đình kinh doanh',
  'HouseholdBussiness': 'Hộ gia đình kinh doanh',
  'Enterprise': 'Doanh nghiệp'
};

const VendorProfilePage: React.FC<VendorProfilePageProps> = ({ onNavigate }) => {
  const { id } = useParams<{ id: string }>();
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [vendorOverallReviews, setVendorOverallReviews] = useState<any[]>([]); // Use any for quick fix or import Review
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'products' | 'about'>('home');
  const [categories, setCategories] = useState<{ categoryId: number; name: string }[]>([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [banners, setBanners] = useState<BannerResponse[]>([]);
  const [loadingBanners, setLoadingBanners] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const profile = await vendorService.getVendorCached(id);
        if (profile) {
          setVendor(profile);
          // Concurrent fetch for products, reviews and categories
          Promise.all([
            packageService.getPackagesByVendor(id),
            // Assuming reviewService is available (need to import it)
            import('../../services/reviewService').then(m => m.reviewService.getReviewsByVendorId(id)),
            packageService.getCeremonyCategories()
          ]).then(([pkgs, reviews, cats]) => {
            const activeCats = cats.filter((c: any) => c.isActive);
            setCategories(activeCats);

            packageService.mapToProductsWithVendors(pkgs).then(products => {
              // Ensure product categories match the dynamic category names for filtering
              const fixedProducts = products.map((p, idx) => {
                const apiPkg = pkgs[idx];
                const catName = activeCats.find(c => c.categoryId === apiPkg.categoryId)?.name;
                return catName ? { ...p, category: catName } : p;
              });
              setProducts(fixedProducts);
            });
            setVendorOverallReviews(reviews);
          }).catch(e => console.warn('⚠️ Error fetching vendor extra data:', e));

        } else {
          toast.error('Không tìm thấy thông tin cửa hàng');
        }
      } catch (error) {
        console.error('Error fetching vendor profile data:', error);
        toast.error('Lỗi khi tải dữ liệu cửa hàng');
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [id]);

  // Fetch banners for this vendor
  useEffect(() => {
    if (!id) return;
    const fetchBanners = async () => {
      setLoadingBanners(true);
      try {
        const response = await bannerService.getActiveBanners(id);
        if (response.isSuccess && response.result) {
          setBanners(response.result);
        }
      } catch (error) {
        console.error('Error fetching vendor banners:', error);
      } finally {
        setLoadingBanners(false);
      }
    };
    fetchBanners();
  }, [id]);

  const handleBannerClick = (slide: any) => {
    if (slide.rawBanner) {
      const url = bannerService.getNavigationUrl(slide.rawBanner);
      onNavigate(url);
    } else {
      onNavigate('/shop');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <h1 className="text-xl font-bold text-slate-800 mb-6 uppercase tracking-widest">Cửa hàng không tồn tại</h1>
        <button onClick={() => onNavigate('/')} className="px-6 py-2 bg-slate-900 text-white text-xs font-bold rounded-none uppercase tracking-widest">Quay lại</button>
      </div>
    );
  }

  const vendorRatingCount = vendorOverallReviews.length;
  const vendorAvgRating = vendorRatingCount > 0
    ? (vendorOverallReviews.reduce((acc: number, r: any) => acc + r.rating, 0) / vendorRatingCount).toFixed(1)
    : (vendor?.ratingAvg || '0.0');

  const joinTimeMonths = vendor.createdAt
    ? Math.floor((new Date().getTime() - new Date(vendor.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30))
    : 0;

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* High Contrast B&W Shop Header */}
      <div className="bg-slate-900 border-b border-black py-20 relative overflow-hidden">
        {/* Subtle decorative elements for 'Ritual' feel */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl"></div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row gap-16 items-center lg:items-start text-center lg:text-left">
            {/* Identity */}
            <div className="flex flex-col lg:flex-row items-center gap-8 w-full lg:w-1/2">
              <div className="w-32 h-32 rounded-full bg-white flex items-center justify-center text-slate-900 text-4xl font-display font-black border-4 border-white/20 overflow-hidden shrink-0 shadow-2xl">
                {(vendor.shopAvatarUrl || vendor.avatarUrl) ? (
                  <img src={vendor.shopAvatarUrl || vendor.avatarUrl || ''} alt={vendor.shopName} className="w-full h-full object-cover" />
                ) : (
                  vendor.shopName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="space-y-6">
                <div>
                  <h1 className="text-4xl md:text-5xl font-display font-black text-white tracking-tight italic">{vendor.shopName}</h1>
                  <div className="flex items-center justify-center lg:justify-start gap-2 mt-4">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.3em]">Cửa hàng đang trực tuyến</p>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigate(`/messages?vendorId=${id || ''}`)}
                    className="px-8 py-3 bg-transparent border-2 border-white/30 text-white text-[11px] font-black rounded-none uppercase tracking-[0.2em] hover:bg-white/10 transition-all"
                  >
                    Nhắn tin
                  </button>
                </div>
              </div>
            </div>

            {/* B&W Stats Grid - High Contrast */}
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-y-10 gap-x-8 w-full">
              <div className="space-y-2 group">
                <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] group-hover:text-white/60 transition-colors">Sản phẩm</p>
                <div className="flex items-baseline gap-2">
                  <div className="w-1 h-6 bg-white/20 group-hover:bg-white transition-colors"></div>
                  <p className="text-3xl font-display font-black text-white leading-none">{products.length}</p>
                </div>
              </div>
              <div className="space-y-2 group">
                <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] group-hover:text-white/60 transition-colors">Đánh giá</p>
                <div className="flex items-baseline gap-2">
                  <div className="w-1 h-6 bg-white/20 group-hover:bg-white transition-colors"></div>
                  <p className="text-3xl font-display font-black text-white leading-none whitespace-nowrap">
                    {vendorAvgRating} <span className="text-xs text-white/30">({vendorRatingCount})</span>
                  </p>
                </div>
              </div>
              <div className="space-y-2 group">
                <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] group-hover:text-white/60 transition-colors">Tham gia</p>
                <div className="flex items-baseline gap-2">
                  <div className="w-1 h-6 bg-white/20 group-hover:bg-white transition-colors"></div>
                  <p className="text-3xl font-display font-black text-white leading-none">{joinTimeMonths}</p>
                  <span className="text-[10px] font-bold text-white/40 uppercase">Tháng</span>
                </div>
              </div>
              <div className="space-y-2 group">
                <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] group-hover:text-white/60 transition-colors">Hạng Shop</p>
                <div className="flex items-baseline gap-2">
                  <div className="w-1 h-6 bg-white/20 group-hover:bg-white transition-colors"></div>
                  <p className="text-3xl font-display font-black text-white leading-none uppercase">{vendor.tierName || 'Bạc'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-100 sticky top-0 bg-white/80 backdrop-blur-md z-20">
        <div className="container mx-auto px-6">
          <div className="flex gap-10">
            {['home', 'products', 'about'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`py-5 text-[11px] font-bold uppercase tracking-[0.2em] transition-all relative ${activeTab === tab ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {tab === 'home' ? 'Trang chủ' : tab === 'products' ? 'Sản phẩm' : 'Thông tin'}
                {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-900"></div>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-16">
        {activeTab === 'home' && (
          <div className="space-y-24">
            {/* Banner Section */}
            {banners.length > 0 ? (
              <div className="md:-mx-6 -mt-8 mb-16">
                <Carousel
                  slides={banners.map(b => ({
                    image: b.imageUrl,
                    title: b.title,
                    subtitle: b.linkType === 'Ritual' ? 'Dịch vụ nổi bật' : 'Chương trình ưu đãi',
                    description: `Khám phá ngay ${b.title} tại ${vendor.shopName}.`,
                    rawBanner: b
                  }))}
                  onCtaClick={handleBannerClick}
                />
              </div>
            ) : (
              <div className="w-full aspect-[21/9] bg-slate-50 flex items-center justify-center border border-slate-100 rounded-[3rem]">
                <h2 className="text-4xl font-bold text-slate-200 tracking-[0.5em] uppercase">{vendor.shopName}</h2>
              </div>
            )}

            <div className="space-y-10">
              <h3 className="text-lg font-bold text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-4">Đề xuất</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {products.slice(0, 10).map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="flex flex-col lg:flex-row gap-12">
            {/* Sidebar Filter */}
            <aside className="w-full lg:w-64 shrink-0 space-y-8">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] mb-6 border-b border-slate-100 pb-4">Danh mục</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setActiveFilter('All')}
                    className={`w-full text-left px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${activeFilter === 'All' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
                  >
                    Tất cả sản phẩm
                  </button>
                  {categories
                    .filter(cat => products.some(p => p.category === cat.name))
                    .map((cat) => (
                      <button
                        key={cat.categoryId}
                        onClick={() => setActiveFilter(cat.name)}
                        className={`w-full text-left px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${activeFilter === cat.name ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
                      >
                        {cat.name}
                      </button>
                    ))}
                </div>
              </div>
            </aside>

            {/* Product Grid */}
            <div className="flex-1 space-y-10">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-lg font-display font-black text-slate-900 uppercase tracking-widest">
                  {activeFilter === 'All' ? 'Tất cả sản phẩm' : activeFilter} ({products.filter(p => activeFilter === 'All' || p.category === activeFilter).length})
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {products
                  .filter(p => activeFilter === 'All' || p.category === activeFilter)
                  .map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onNavigate={onNavigate}
                    />
                  ))}
              </div>

              {products.filter(p => activeFilter === 'All' || p.category === activeFilter).length === 0 && (
                <div className="py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <p className="text-slate-400 font-bold uppercase tracking-widest">Không tìm thấy sản phẩm phù hợp</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="max-w-3xl space-y-20">
            <section className="space-y-6">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest text-slate-400">Giới thiệu</h3>
              <p className="text-lg text-slate-700 leading-relaxed font-medium">
                {vendor.shopDescription || 'Cửa hàng chuyên cung cấp các dịch vụ tâm linh truyền thống.'}
              </p>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-16">
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vị trí</h4>
                <p className="text-sm font-bold text-slate-800">{vendor.shopAddressText || 'Thừa Thiên Huế, Việt Nam'}</p>
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chi tiết</h4>
                <div className="space-y-2 text-sm font-bold text-slate-800">
                  <p className="flex justify-between"><span>Loại hình:</span> <span>{BUSINESS_TYPE_MAP[vendor.businessType || 'Individual'] || vendor.businessType || 'Cá nhân'}</span></p>
                  <p className="flex justify-between"><span>Hạng:</span> <span className="uppercase">{vendor.tierName || 'Bạc'}</span></p>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorProfilePage;
