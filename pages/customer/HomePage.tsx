import React, { useState, useEffect } from 'react';
import { MOCK_PRODUCTS } from '../../constants';
import MOCK_DATA from '../../mockData';
import Carousel from '../../components/Carousel';
import { packageService } from '../../services/packageService';
import { bannerService, BannerResponse } from '../../services/bannerService';
import { getCurrentUser } from '../../services/auth';
import { Product, CeremonyCategory } from '../../types';
import toast from '../../services/toast';
import LoadingScreen from '../../components/LoadingScreen';

const HomePage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const [showAllServices, setShowAllServices] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [dynamicServices, setDynamicServices] = useState<{title: string, img: string}[]>([]);
  const [banners, setBanners] = useState<BannerResponse[]>([]);
  const [loadingBanners, setLoadingBanners] = useState(true);
  const { heroSlides: mockSlides, services, trustStats } = MOCK_DATA;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  const getProductDetailPath = (rawId: string): string => {
    const numericId = Number(String(rawId).trim());
    if (Number.isInteger(numericId) && numericId > 0) {
      return `/product/${numericId}`;
    }
    return `/product/${encodeURIComponent(String(rawId).trim())}`;
  };

  const pickRandomProducts = <T,>(items: T[], count: number): T[] => {
    if (items.length <= count) return items;
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  };

  const handleNavigateToProductDetail = (rawId: string) => {
    onNavigate(getProductDetailPath(rawId));
  };

  // Fetch products from API
  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        const apiPackages = await packageService.getAllPackages();
        if (apiPackages.length > 0) {
          const mappedProducts = await packageService.mapToProductsWithVendors(apiPackages);
          setProducts(pickRandomProducts(mappedProducts, 3));
        } else {
          setProducts([]);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
        setProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProducts();
  }, []);

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const categories = await packageService.getCeremonyCategories();
        const activeCategories = categories.filter(c => c.isActive);
        
        // Map categories to images (using existing services as reference or dynamic fallbacks)
        const ritualImages = [
          'https://docungcattuong.com/wp-content/uploads/2023/03/mam-cung-day-thang-be-gai-7.jpg', // Đầy tháng
          'https://docungcattuong.com/wp-content/uploads/2023/03/mam-cung-nha-moi.jpg',           // Tân gia
          'https://docungcattuong.com/wp-content/uploads/2023/03/mam-cung-khai-truong-4-2.jpg',   // Khai trương
          'https://store.longphuong.vn/wp-content/uploads/2023/01/mam-com-cung-gio-7.jpg',       // Cúng giỗ
          'https://images2.thanhnien.vn/528068263637045248/2025/1/10/42586013067177933649921942352479888060916544n-17364781178141635611315.jpg', // Cúng tết
          'https://file.hstatic.net/200000862061/article/cungramthang7a-1358_4fd0c5cc580d490da057583a4d245db0_1024x1024.jpg', // Cúng rằm
          'https://cdn11.dienmaycholon.vn/filewebdmclnew/public/userupload/files/blog/van-hoa/cung-ruoc-ong-ba-ve-an-tet.jpg' // Cúng gia tiên
        ];

        const mapped = activeCategories.map((cat, idx) => {
          // Try to find a matching image from mock services
          const match = services.find(s => 
            s.title.toLowerCase().includes(cat.name.toLowerCase()) || 
            cat.name.toLowerCase().includes(s.title.toLowerCase())
          );
          
          return {
            title: cat.name,
            // Luân phiên ảnh nếu không có match từ mock để tránh trùng lặp
            img: match ? match.img : ritualImages[(cat.categoryId || idx) % ritualImages.length]
          };
        });
        
        setDynamicServices(mapped);
      } catch (error) {
        console.error('Error fetching categories:', error);
        // Fallback to mock services if API fails
        setDynamicServices(services);
      }
    };

    fetchCategories();
  }, [services]);

  // Fetch banners from API
  useEffect(() => {
    // Preload fallback image
    const fallbackImg = new Image();
    fallbackImg.src = 'https://images.unsplash.com/photo-1528459801416-a7e992795770?auto=format&fit=crop&q=80&w=2000';

    const fetchBanners = async () => {
      setLoadingBanners(true);
      try {
        const response = await bannerService.getActiveBanners();
        if (response.isSuccess && response.result) {
          setBanners(response.result);
          // Preload the first active banner image
          if (response.result.length > 0) {
            const firstBannerImg = new Image();
            firstBannerImg.src = response.result[0].imageUrl;
          }
        }
      } catch (error) {
        console.error('Error fetching banners:', error);
      } finally {
        setLoadingBanners(false);
      }
    };

    fetchBanners();
  }, []);

  const handleBannerClick = (slide: any) => {
    if (slide.rawBanner) {
      const url = bannerService.getNavigationUrl(slide.rawBanner);
      onNavigate(url);
    } else {
      onNavigate('/shop');
    }
  };

  // Map banners to slides
  const currentSlides = banners.length > 0 
    ? banners.map(b => ({
        image: b.imageUrl,
        title: b.title,
        subtitle: b.linkType === 'Ritual' ? 'Dịch vụ nổi bật' : 'Chương trình đặc biệt',
        description: `Khám phá ngay ${b.title} tại VietRitual với nhiều ưu đãi hấp dẫn.`,
        rawBanner: b
      }))
    : [
        {
          image: 'https://images.unsplash.com/photo-1528459801416-a7e992795770?auto=format&fit=crop&q=80&w=2000',
          title: 'VietRitual\nTâm Linh Việt – Chuẩn Hiện Đại',
          subtitle: 'Kính Chào Quý Khách',
          description: 'Hệ thống cung cấp dịch vụ mâm cúng trọn gói, chuẩn nghi lễ truyền thống. Đồng hành cùng gia chủ trong mọi khoảnh khắc tâm linh quan trọng.'
        }
      ];
  
  return (
    <div className="space-y-12 md:space-y-24 pb-24">
      {/* Hero Carousel Section */}
      <Carousel slides={currentSlides} onCtaClick={handleBannerClick} />

      {/* Services Showcase */}
      <section className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="text-center mb-8 md:mb-16">
            <h2 className="text-primary font-display text-3xl md:text-5xl font-black mb-4 italic">Dịch Vụ Cúng Lễ</h2>
            <div className="w-24 h-1 bg-gold mx-auto mb-6"></div>
            <p className="text-gray-500 max-w-2xl mx-auto text-lg italic">Gìn giữ truyền thống - Kết nối tương lai</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {(dynamicServices.length > 0 ? dynamicServices : services).slice(0, showAllServices ? undefined : 4).map((svc, i) => (
                <div key={i} className="group cursor-pointer" onClick={() => onNavigate('/shop')}>
                    <div className="relative aspect-[3/4] rounded-3xl overflow-hidden shadow-lg border-2 border-transparent group-hover:border-gold transition-all duration-500">
                        <img alt={svc.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" src={svc.img} />
                        <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/20 to-transparent flex flex-col justify-end p-8">
                            <h3 className="text-white text-2xl font-bold mb-2 leading-tight">{svc.title}</h3>
                            <div className="mt-4 flex items-center text-primary font-bold text-xs gap-2">
                                <span>Khám phá ngay</span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
        <div className="text-center mt-12">
          <button 
            onClick={() => setShowAllServices(!showAllServices)}
            className="border-2 border-primary text-primary px-12 py-3 rounded-lg font-bold text-lg hover:bg-primary/5 transition-all"
          >
            {showAllServices ? 'Thu Gọn' : `Xem Thêm (${dynamicServices.length || services.length} loại cúng)`}
          </button>
        </div>
      </section>

      {/* Trust Stats */}
      <section className="bg-primary py-12 md:py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-10 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
                {trustStats.map((item, i) => (
                    <div key={i} className="bg-white/5 backdrop-blur-md p-6 md:p-10 rounded-[1.5rem] md:rounded-[2rem] border border-white/10 text-center hover:bg-white/10 transition-colors">
                        <h3 className="text-white text-2xl font-bold mb-4">{item.title}</h3>
                        <p className="text-white/80 leading-relaxed text-sm">{item.desc}</p>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Premium Products Highlights */}
      <section className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 md:mb-16">
            <div>
                <h2 className="text-primary font-display text-3xl md:text-4xl font-black italic">Mâm Cúng Cao Cấp</h2>
                <p className="text-gray-500 mt-2 text-sm md:text-base">Sản phẩm được hàng ngàn gia chủ tin dùng</p>
            </div>
            <button onClick={() => onNavigate('/shop')} className="text-primary font-bold flex items-center gap-2 hover:gap-4 transition-all uppercase text-xs tracking-widest">
                -- Tất cả sản phẩm --
            </button>
        </div>
        {loadingProducts ? (
          <LoadingScreen message="Đang tìm kiếm lễ vật tinh xảo..." subMessage="Chuẩn bị cho ngày trọng đại của bạn" />
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all border border-gray-200 group cursor-pointer flex flex-col h-full"
              onClick={() => handleNavigateToProductDetail(product.id)}
            >
                    <div className="relative h-72 overflow-hidden shrink-0">
                        <img alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src={product.image} />
                    </div>
                    <div className="p-8 flex-1 flex flex-col">
                        <h3 className="text-xl font-black mb-2 group-hover:text-primary transition-colors leading-tight">{product.name}</h3>
                        {product.vendorName && (
                            <p className="text-xs text-slate-600 mb-2 flex items-center gap-1">
                                <span className="text-slate-400">bởi</span>
                                <span className="font-semibold text-primary">{product.vendorName}</span>
                            </p>
                        )}
                        <p className="text-gray-500 text-sm mb-6 line-clamp-2">{product.description}</p>
                        <div className="flex items-center justify-between mt-auto">
                            <div className="flex flex-col">
                                <span className="text-primary text-2xl font-black tracking-tight">{product.price.toLocaleString()}đ</span>
                                {product.totalSold !== undefined && product.totalSold > 0 && (
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Đã bán {product.totalSold}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-1 text-gold">
                                <span className="text-sm">★</span>
                                <span className="text-xs font-bold">{product.rating}</span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
        )}
      </section>
    </div>
  );
};

export default HomePage;
