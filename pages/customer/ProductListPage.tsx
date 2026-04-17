import React, { useState, useEffect } from 'react';
import { MOCK_PRODUCTS } from '../../constants';
import { AppRoute, Occasion, Product, CeremonyCategory } from '../../types';
import { useSearchParams } from 'react-router-dom';
import { packageService } from '../../services/packageService';
import { cartService } from '../../services/cartService';
import { getCurrentUser } from '../../services/auth';
import { addressService } from '../../services/addressService';
import { vendorService } from '../../services/vendorService';
import toast from '../../services/toast';
import LoadingScreen from '../../components/LoadingScreen';

const ProductListPage: React.FC<{ onNavigate: (route: AppRoute | string) => void }> = ({ onNavigate }) => {
  const [searchParams] = useSearchParams();
  const [activeFilter, setActiveFilter] = useState<Occasion | 'All'>('All');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [priceRanges, setPriceRanges] = useState({
    p1: false, // Dưới 1 triệu
    p2: false, // 1-3 triệu
    p3: false, // 3-5 triệu
    p4: false, // Trên 5 triệu
  });
  const [ratingFilters, setRatingFilters] = useState({
    r5: false, // 5 sao
    r4: false, // 4 sao
    r3: false, // 3 sao
  });
  const [sortBy, setSortBy] = useState('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<CeremonyCategory[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllNearProducts, setShowAllNearProducts] = useState(false);
  const pageSize = 12;

  const nearProductsThreshold = 60;
  const allNearProducts = products
    .filter(p => p.distanceKm !== undefined && p.distanceKm <= nearProductsThreshold)
    .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));

  const nearProducts = showAllNearProducts ? allNearProducts : allNearProducts.slice(0, 3);

  const getProductDetailPath = (rawId: string): string => {
    const numericId = Number(String(rawId).trim());
    if (Number.isInteger(numericId) && numericId > 0) {
      return `/product/${numericId}`;
    }
    return `/product/${encodeURIComponent(String(rawId).trim())}`;
  };

  const handleNavigateToProductDetail = (rawId: string) => {
    onNavigate(getProductDetailPath(rawId));
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        console.log(' Starting to fetch data...');

        // Fetch categories first
        const apiCategories = await packageService.getCeremonyCategories();
        console.log(' Received categories:', apiCategories);
        setCategories(apiCategories);

        // Prefer backend-calculated nearby packages when logged in
        const nearbyResult = getCurrentUser()
          ? await packageService.getNearbyPackages(1, 30).catch(() => null)
          : null;

        const nearbyDistanceByPackageId = new Map<string, number>();
        (nearbyResult?.items || []).forEach((it) => {
          const pid = String((it as any).packageId ?? (it as any).id ?? '').trim();
          const dist = Number((it as any).distanceKm);
          if (pid && Number.isFinite(dist)) nearbyDistanceByPackageId.set(pid, dist);
        });

        const apiPackages = await packageService.getAllPackages();
        console.log(' Received packages:', apiPackages);

        if (apiPackages.length > 0) {
          const mappedProducts = await packageService.mapToProductsWithVendors(apiPackages);

          // Update product categories based on dynamic names if possible
          // This ensures filtering works with the names from API
          const enhancedProducts = await Promise.all(mappedProducts.map(async p => {
            const distanceKm = nearbyDistanceByPackageId.get(String(p.id)) ?? undefined;

            let categoryName = p.category as string;
            const apiPkg = apiPackages.find(pkg => String(pkg.packageId) === String(p.id) || String((pkg as any).id) === String(p.id));
            if (apiPkg && apiPkg.categoryId) {
              const categoryObj = apiCategories.find(c => c.categoryId === apiPkg.categoryId);
              if (categoryObj) {
                categoryName = categoryObj.name;
              }
            }
            return { ...p, category: categoryName as Occasion, distanceKm };
          }));

          console.log(' Mapped products with dynamic categories and distance:', enhancedProducts);
          setProducts(enhancedProducts);
        } else {
          setProducts([]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const category = searchParams.get('category');
    if (category) {
      setActiveFilter(category as Occasion);
    } else {
      setActiveFilter('All');
    }
  }, [searchParams]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [searchParams, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchQuery, priceRanges, ratingFilters, sortBy]);

  const filterByPrice = (price: number) => {
    if (!Object.values(priceRanges).some(v => v)) return true;
    if (priceRanges.p1 && price < 1000000) return true;
    if (priceRanges.p2 && price >= 1000000 && price < 3000000) return true;
    if (priceRanges.p3 && price >= 3000000 && price < 5000000) return true;
    if (priceRanges.p4 && price >= 5000000) return true;
    return false;
  };

  const filterByRating = (rating: number) => {
    if (!Object.values(ratingFilters).some(v => v)) return true;
    if (ratingFilters.r5 && rating >= 5) return true;
    if (ratingFilters.r4 && rating >= 4 && rating < 5) return true;
    if (ratingFilters.r3 && rating >= 3 && rating < 4) return true;
    return false;
  };

  const filterBySearch = (product: Product) => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return true;

    const searchable = [
      product.name,
      product.description,
      product.vendorName,
      product.category,
      product.tag,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchable.includes(keyword);
  };

  const filteredProducts = products.filter(p => {
    const categoryMatch = activeFilter === 'All' || p.category === activeFilter;
    const priceMatch = filterByPrice(p.price);
    const ratingMatch = filterByRating(p.rating);
    const searchMatch = filterBySearch(p);
    return categoryMatch && priceMatch && ratingMatch && searchMatch;
  }).sort((a, b) => {
    if (sortBy === 'price-asc') return a.price - b.price;
    if (sortBy === 'price-desc') return b.price - a.price;

    const distA = a.distanceKm ?? Infinity;
    const distB = b.distanceKm ?? Infinity;

    // Popular and closest vendors
    if (sortBy === 'popular') {
      if (distA !== Infinity || distB !== Infinity) {
        if (distA !== distB) return distA - distB;
      }

      // Popularity logic fallback: totalSold > Rating > Reviews
      if ((b.totalSold || 0) !== (a.totalSold || 0)) return (b.totalSold || 0) - (a.totalSold || 0);
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.reviews - a.reviews;
    }

    return 0;
  });

  const totalPages = Math.ceil(filteredProducts.length / pageSize);

  // Tránh lặp lại sản phẩm đã hiện ở mục "Gần bạn" (loại bỏ tất cả sản phẩm thuộc nhóm này khỏi danh sách chung)
  const isShowingNearSection = allNearProducts.length > 0 && activeFilter === 'All' && currentPage === 1 && !searchQuery;
  const displayProducts = isShowingNearSection
    ? filteredProducts.filter(p => !allNearProducts.some(near => near.id === p.id))
    : filteredProducts;

  const paginatedProducts = displayProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const ProductCard: React.FC<{ product: Product }> = ({ product: p }) => (
    <div
      key={p.id}
      className="bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border border-gold/10 group flex flex-col h-full relative"
    >
      {p.distanceKm !== undefined && p.distanceKm <= nearProductsThreshold && (
        <div className="absolute top-4 left-4 z-20 bg-green-500/90 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-green-500/20">
          <span className="material-symbols-outlined text-[14px]">near_me</span>
          Gần bạn
        </div>
      )}
      <div
        className="relative w-full pt-[85%] md:pt-[95%] overflow-hidden cursor-pointer shrink-0"
        onClick={() => handleNavigateToProductDetail(p.id)}
      >
        <img className="absolute top-0 left-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out" src={p.image} alt={p.name} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
      <div
        className="p-4 md:p-6 cursor-pointer flex-1 flex flex-col"
        onClick={() => handleNavigateToProductDetail(p.id)}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <div className="flex text-gold">
              {[...Array(5)].map((_, i) => (
                <span key={i} className={`text-[10px] ${i < Math.floor(p.rating) ? 'text-gold' : 'text-slate-200'}`}>★</span>
              ))}
            </div>
            <span className="text-[11px] font-black text-black">({p.reviews})</span>
          </div>
          {p.totalSold !== undefined && p.totalSold > 0 && (
            <span className="text-[10px] font-bold text-black bg-slate-100 px-2 py-1 rounded-lg">
              Đã bán {p.totalSold}
            </span>
          )}
        </div>

        <h3 className="text-base md:text-lg font-bold mb-3 md:mb-4 group-hover:text-primary transition-colors leading-tight line-clamp-2 h-10 md:h-12">{p.name}</h3>

        <div className="flex items-center justify-between mb-5 md:mb-6">
          <div className="flex items-center gap-2 mt-3 md:mt-4">
            <span className="font-bold text-black text-[11px] truncate max-w-[120px] leading-tight">{p.vendorName}</span>
          </div>
          {p.distanceKm !== undefined && (
            <div className="flex items-center gap-1 text-black bg-slate-50 px-2 py-1 rounded-lg">
              <span className="material-symbols-outlined text-[12px]">distance</span>
              <span className="text-[10px] font-bold">{p.distanceKm}km</span>
            </div>
          )}
        </div>

        <div className="pt-5 mt-auto border-t border-gold/5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-black uppercase tracking-widest mb-0.5">Giá từ</p>
            <p className="text-lg md:text-2xl font-black text-primary tracking-tight">{p.price.toLocaleString()}đ</p>
          </div>
          <button
            className="w-10 h-10 md:w-12 md:h-12 bg-black text-white rounded-2xl hover:bg-primary transition-all duration-300 z-10 flex items-center justify-center group/btn shadow-lg shadow-black/5 hover:shadow-primary/20"
            onClick={(e) => handleQuickAddToCart(p, e)}
          >
            <span className="material-symbols-outlined text-xl group-hover/btn:scale-110 transition-transform">add_shopping_cart</span>
          </button>
        </div>
      </div>
    </div>
  );

  const handleQuickAddToCart = async (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();

    const user = getCurrentUser();
    if (!user) {
      toast.warning('Vui lòng đăng nhập để thêm vào giỏ hàng');
      onNavigate('/auth');
      return;
    }

    if (!product.variants || product.variants.length === 0) {
      handleNavigateToProductDetail(product.id);
      return;
    }

    // Default to the first variant
    const variantId = product.variants[0].variantId;

    try {
      const success = await cartService.addToCart({
        variantId: variantId,
        quantity: 1
      });

      if (success) {
        toast.success('Đã thêm vào giỏ hàng!');
        window.dispatchEvent(new Event('cartUpdated'));
      } else {
        toast.error('Không thể thêm vào giỏ hàng. Vui lòng thử lại.');
      }
    } catch (error) {
      console.error('Error quick add to cart:', error);
      toast.error('Đã xảy ra lỗi. Vui lòng thử lại.');
    }
  };

  const handleResetFilters = () => {
    setActiveFilter('All');
    setPriceRanges({ p1: false, p2: false, p3: false, p4: false });
    setRatingFilters({ r5: false, r4: false, r3: false });
    setSearchQuery('');
    setSortBy('popular');
  };

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-16 flex flex-col lg:flex-row gap-12 relative">
      {/* Mobile Filter Toggle */}
      <div className="lg:hidden flex items-center justify-between mb-2">
        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className="flex items-center gap-2 px-5 py-3 bg-white border border-primary/20 text-primary rounded-2xl text-sm font-bold shadow-sm hover:bg-primary/5 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-lg">filter_alt</span>
          Bộ lọc & Sắp xếp
        </button>
      </div>

      <aside className={`w-full lg:w-72 shrink-0 space-y-10 ${isFilterOpen ? 'block' : 'hidden lg:block'} lg:sticky lg:top-24 h-fit`}>
        <div className="bg-white p-8 rounded-3xl border border-gold/10 shadow-sm space-y-8">
          <div>
            <h3 className="text-lg font-bold text-primary mb-6">
              Bộ lọc
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => setActiveFilter('All')}
                className={`w-full text-left px-5 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98] ${activeFilter === 'All'
                  ? 'border-2 border-primary bg-primary/5 text-primary shadow-md'
                  : 'text-black hover:bg-gold/10 hover:pl-7'
                  }`}
              >
                Tất cả dịp lễ
              </button>
              {categories.filter(c => c.isActive).slice(0, showAllCategories ? undefined : 6).map((cat) => (
                <button
                  key={cat.categoryId}
                  onClick={() => {
                    setActiveFilter(cat.name);
                  }}
                  className={`w-full text-left px-5 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98] ${activeFilter === cat.name
                    ? 'border-2 border-primary bg-primary/5 text-primary shadow-md'
                    : 'text-black hover:bg-gold/10 hover:pl-7'
                    }`}
                >
                  {cat.name}
                </button>
              ))}
              {categories.filter(c => c.isActive).length > 6 && (
                <button
                  onClick={() => setShowAllCategories(!showAllCategories)}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-black hover:text-primary hover:bg-gold/10 transition-all duration-300"
                >
                  <span className="material-symbols-outlined text-sm">
                    {showAllCategories ? 'remove' : 'add'}
                  </span>
                  {showAllCategories ? 'Thu gọn' : 'Xem thêm'}
                </button>
              )}
            </div>
          </div>

          <div className="pt-8 border-t border-gold/10">
            <h4 className="text-sm font-bold text-slate-900 mb-4">Khoảng giá</h4>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="rounded text-primary focus:ring-primary"
                  id="p1"
                  checked={priceRanges.p1}
                  onChange={() => setPriceRanges({ ...priceRanges, p1: !priceRanges.p1 })}
                />
                <label htmlFor="p1" className="text-sm text-black">Dưới 1.000.000đ</label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="rounded text-primary focus:ring-primary"
                  id="p2"
                  checked={priceRanges.p2}
                  onChange={() => setPriceRanges({ ...priceRanges, p2: !priceRanges.p2 })}
                />
                <label htmlFor="p2" className="text-sm text-black">1.000.000đ - 3.000.000đ</label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="rounded text-primary focus:ring-primary"
                  id="p3"
                  checked={priceRanges.p3}
                  onChange={() => setPriceRanges({ ...priceRanges, p3: !priceRanges.p3 })}
                />
                <label htmlFor="p3" className="text-sm text-black">3.000.000đ - 5.000.000đ</label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="rounded text-primary focus:ring-primary"
                  id="p4"
                  checked={priceRanges.p4}
                  onChange={() => setPriceRanges({ ...priceRanges, p4: !priceRanges.p4 })}
                />
                <label htmlFor="p4" className="text-sm text-black">Trên 5.000.000đ</label>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-gold/10">
            <h4 className="text-sm font-bold text-slate-900 mb-4">Đánh giá</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-gold"
                  checked={ratingFilters.r5}
                  onChange={() => setRatingFilters({ ...ratingFilters, r5: !ratingFilters.r5 })}
                />
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-xs" style={{ color: '#FFD700' }}>★</span>
                  ))}
                </div>
                <span className="text-xs text-black">(5 sao)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-gold"
                  checked={ratingFilters.r4}
                  onChange={() => setRatingFilters({ ...ratingFilters, r4: !ratingFilters.r4 })}
                />
                <div className="flex">
                  {[...Array(4)].map((_, i) => (
                    <span key={i} className="text-xs" style={{ color: '#FFD700' }}>★</span>
                  ))}
                </div>
                <span className="text-xs text-black">(4 sao)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-gold"
                  checked={ratingFilters.r3}
                  onChange={() => setRatingFilters({ ...ratingFilters, r3: !ratingFilters.r3 })}
                />
                <div className="flex">
                  {[...Array(3)].map((_, i) => (
                    <span key={i} className="text-xs" style={{ color: '#FFD700' }}>★</span>
                  ))}
                </div>
                <span className="text-xs text-black">(3 sao)</span>
              </label>
            </div>
          </div>

          <div className="pt-8 border-t border-gold/10">
            <h4 className="text-sm font-bold text-slate-900 mb-4">Tình trạng</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded text-primary" />
                <span className="text-sm text-black">Còn hàng</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded text-primary" />
                <span className="text-sm text-black">Sắp có hàng</span>
              </label>
            </div>
          </div>

          <button
            onClick={handleResetFilters}
            className="w-full border-2 border-primary text-primary py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider hover:bg-primary/5 transition-all"
          >
            Xóa bộ lọc
          </button>
        </div>
      </aside>

      <section className="flex-1 space-y-12">
        {loading ? (
          <LoadingScreen message="Đang tìm mâm cúng tinh hoa..." subMessage="Kết nối với hàng ngàn nghệ nhân tâm huyết" />
        ) : (
          <>
            {/* Near Products Banner/Session */}
            {nearProducts.length > 0 && activeFilter === 'All' && currentPage === 1 && !searchQuery && (
              <div className="space-y-6">
                <div className="flex items-end justify-between px-2">
                  <div>
                    <div className="flex items-center gap-2 text-green-600 font-black text-[10px] uppercase tracking-[0.2em] mb-2">
                      <span className="w-8 h-[2px] bg-green-500"></span>
                      <span>Dành riêng cho bạn</span>
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Mâm cúng <span className="text-primary italic">gần bạn nhất</span></h2>
                  </div>
                  {allNearProducts.length > 3 && (
                    <button
                      onClick={() => setShowAllNearProducts(!showAllNearProducts)}
                      className="group flex items-center gap-2 px-5 py-2.5 bg-white border border-gold/10 text-black rounded-2xl text-xs font-black uppercase tracking-widest shadow-sm hover:bg-primary hover:text-white hover:border-primary transition-all duration-300"
                    >
                      <span>{showAllNearProducts ? 'Thu gọn' : `Xem thêm (${allNearProducts.length - 3})`}</span>
                      <span className="material-symbols-outlined text-sm group-hover:rotate-180 transition-transform duration-500">
                        {showAllNearProducts ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {nearProducts.map(p => (
                    <ProductCard key={`near-${p.id}`} product={p} />
                  ))}
                </div>

                <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-gold/10 to-transparent my-12" />
              </div>
            )}

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8 bg-white p-6 md:p-8 rounded-[2.5rem] border border-gold/10 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6 w-full">
                <div className="shrink-0 hidden sm:block">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Tất cả</h2>
                  <p className="text-black text-[11px] font-black uppercase tracking-widest">{filteredProducts.length} sản phẩm</p>
                </div>
                <div className="relative flex-1 group">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo mâm cúng, dịp lễ, cửa hàng..."
                    className="w-full rounded-[2rem] border-2 border-slate-100 bg-gray-50/50 py-4 pl-14 pr-6 text-sm text-slate-700 placeholder:text-black focus:border-primary focus:bg-white focus:outline-none focus:ring-8 focus:ring-primary/5 transition-all duration-300"
                  />
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-black group-focus-within:text-primary transition-colors">
                    <span className="material-symbols-outlined text-2xl">search</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-6 w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-black uppercase tracking-widest">Sắp xếp</span>
                  <select
                    className="bg-gray-50 hover:bg-white border-2 border-slate-100 rounded-2xl text-[12px] font-black focus:ring-8 focus:ring-primary/5 focus:border-primary py-2.5 px-4 pr-10 transition-all cursor-pointer"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="popular">Phổ biến nhất</option>
                    <option value="price-asc">Giá: Thấp đến Cao</option>
                    <option value="price-desc">Giá: Cao đến Thấp</option>
                  </select>
                </div>
              </div>
            </div>

            {filteredProducts.length === 0 && (
              <div className="bg-white border-2 border-dashed border-gold/20 rounded-[3rem] p-20 text-center">
                <div className="w-20 h-20 bg-gold/5 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-4xl text-gold/40">sentiment_dissatisfied</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Không tìm thấy sản phẩm</h3>
                <p className="text-black max-w-xs mx-auto text-sm leading-relaxed">Chúng tôi chưa có sản phẩm nào phùers hợp với tiêu chí của bạn. Hãy thử thay đổi bộ lọc.</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
              {paginatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12 pb-10">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border border-gold/20 transition-all ${currentPage === 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-primary hover:text-white active:scale-95'}`}
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-10 h-10 rounded-xl font-bold transition-all ${currentPage === i + 1
                      ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-110'
                      : 'hover:bg-primary/5 text-black active:scale-95'}`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border border-gold/20 transition-all ${currentPage === totalPages ? 'opacity-30 cursor-not-allowed' : 'hover:bg-primary hover:text-white active:scale-95'}`}
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default ProductListPage;
