import React, { useEffect, useState } from 'react';
import { guidelineService, CulturalGuideline } from '../../services/guidelineService';
import LoadingScreen from '../../components/LoadingScreen';

const CulturalGuidelinePage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const [guidelines, setGuidelines] = useState<CulturalGuideline[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'ALL'>('ALL');

  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Read categoryId from URL if present
    const params = new URLSearchParams(window.location.search);
    const catId = params.get('categoryId');
    if (catId) {
      setSelectedCategoryId(Number(catId));
    } else {
      setSelectedCategoryId('ALL');
    }

    const fetchGuidelines = async () => {
      try {
        const data = await guidelineService.getGuidelines();
        setGuidelines(data.filter(g => g.isActive));
      } catch (error) {
        console.error('❌ Failed to fetch guidelines:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchGuidelines();
  }, [window.location.search]);

  // Extract unique categories from guidelines
  const categories = Array.from(
    new Map(guidelines.map((g) => [g.categoryId, g.categoryName])).entries()
  ).map(([id, name]) => ({ id, name }));

  const filteredGuidelines = selectedCategoryId === 'ALL'
    ? guidelines
    : guidelines.filter(g => g.categoryId === selectedCategoryId);

  const getCategoryImage = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('thôi nôi')) return 'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?q=80&w=1000&auto=format&fit=crop';
    if (n.includes('đầy tháng')) return 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=1000&auto=format&fit=crop';
    if (n.includes('động thổ')) return 'https://images.unsplash.com/photo-1541888941259-79273ceb3c32?q=80&w=1000&auto=format&fit=crop';
    if (n.includes('khai trương')) return 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1000&auto=format&fit=crop';
    if (n.includes('tết') || n.includes('giao thừa')) return 'https://images.unsplash.com/photo-1596462502278-27bf3da32771?q=80&w=1000&auto=format&fit=crop';
    return 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1000&auto=format&fit=crop';
  };

  const getCategorySubtitle = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('thôi nôi')) return 'Kỷ niệm thiên thần nhỏ tròn 1 tuổi';
    if (n.includes('đầy tháng')) return 'Tạ ơn các Bà Mụ đã bao bọc bé';
    if (n.includes('động thổ')) return 'Xin phép Thổ Thần khởi công xây dựng';
    if (n.includes('khai trương')) return 'Hanh thông tài lộc, vạn sự như ý';
    if (n.includes('tết') || n.includes('giao thừa')) return 'Tạm biệt năm cũ, đón chào xuân sang';
    return 'Gìn giữ nét đẹp truyền thống';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="relative h-[50vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2000&auto=format&fit=crop" 
            alt="Cultural Background" 
            className="w-full h-full object-cover brightness-[0.4]"
          />
        </div>
        <div className="relative z-10 text-center px-6 max-w-4xl animate-fade-in">
          <h1 className="text-5xl md:text-7xl font-black text-white italic mb-6 tracking-tighter drop-shadow-2xl">
            Cẩm Nang Văn Hóa <span className="text-primary italic">Tâm Linh</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-200 font-medium max-w-2xl mx-auto drop-shadow-lg leading-relaxed">
            Gìn giữ nét đẹp truyền thống Việt trong từng nghi lễ hiện đại. Hướng dẫn chi tiết cách chuẩn bị và thực hiện các lễ cúng chuẩn phong tục.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-50 to-transparent"></div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-6 py-12 md:py-20">
        
        {/* Category Dropdown */}
        {!loading && guidelines.length > 0 && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-16 bg-white p-6 md:p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 animate-slide-up">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1">Lọc nội dung</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-none">Theo chủ đề nghi lễ</p>
              </div>
            </div>
            
            <div className="relative w-full md:w-80 group">
              <select
                value={selectedCategoryId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedCategoryId(val === 'ALL' ? 'ALL' : Number(val));
                }}
                className="w-full appearance-none px-6 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-700 font-black text-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer pr-12 group-hover:bg-white"
              >
                <option value="ALL">Tất cả bài viết</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 transition-transform group-hover:translate-y-[-40%]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <LoadingScreen message="Đang tải kiến thức tâm linh..." subMessage="Gìn giữ nét đẹp truyền thống" />
        ) : filteredGuidelines.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-[3rem] border border-dashed border-slate-200 animate-fade-in">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="text-slate-400 font-bold text-lg">Hiện tại chưa có hướng dẫn nào cho chủ đề này.</p>
            <button 
              onClick={() => setSelectedCategoryId('ALL')}
              className="mt-6 text-primary font-black uppercase tracking-widest text-xs border-b-2 border-primary/20 hover:border-primary transition-all"
            >
              Xem tất cả chủ đề
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
            {filteredGuidelines.map((item, index) => (
              <div 
                key={item.guidelineId} 
                onClick={() => onNavigate(`/cultural-guideline/${item.guidelineId}`)}
                className={`group flex flex-col bg-white rounded-[2.5rem] md:rounded-[3rem] overflow-hidden shadow-2xl shadow-slate-200/50 hover:shadow-primary/10 transition-all duration-500 border border-slate-100 animate-slide-up cursor-pointer`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="relative h-64 md:h-80 overflow-hidden">
                  <img 
                    src={getCategoryImage(item.categoryName)} 
                    alt={item.title} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                  <div className="absolute top-6 right-6">
                    <span className="px-4 py-2 bg-white/20 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/20">
                      {item.categoryName}
                    </span>
                  </div>
                  <div className="absolute bottom-8 left-8 right-8">
                    <span className="inline-block px-4 py-1.5 bg-primary/95 text-white text-[9px] md:text-[10px] uppercase font-black tracking-widest rounded-full mb-3 backdrop-blur-sm shadow-lg shadow-primary/20">
                      {getCategorySubtitle(item.categoryName)}
                    </span>
                    <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-lg">{item.title}</h2>
                  </div>
                </div>
                
                <div className="p-8 md:p-10 flex-1 flex flex-col">
                  <p className="text-slate-600 leading-relaxed mb-6 md:mb-8 text-base md:text-lg italic line-clamp-3">
                    {item.description}
                  </p>
                  
                  <div className="space-y-4 mb-8 md:mb-10">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                      <span className="w-8 md:w-10 h-0.5 bg-primary rounded-full"></span>
                      Hướng dẫn chi tiết
                    </h3>
                    <div className="p-5 md:p-6 bg-slate-50 rounded-2xl md:rounded-[2rem] border border-slate-100 italic text-slate-500 text-sm leading-relaxed">
                      Nhấn để xem hướng dẫn bày biện mâm lễ và văn khấn thành tâm...
                    </div>
                  </div>

                  <div className="mt-auto pt-6 border-t border-slate-50">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate(`/shop?category=${encodeURIComponent(item.categoryName)}`);
                      }}
                      className="w-full py-4 rounded-xl md:rounded-2xl bg-slate-900 text-white font-black text-[10px] md:text-[11px] uppercase tracking-[0.2em] hover:bg-primary transition-all shadow-xl shadow-slate-200 hover:shadow-primary/20 active:scale-95"
                    >
                      Khám phá mâm cúng {item.categoryName}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Philosophy Section */}
      <section className="bg-slate-900 py-24 md:py-32 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[120px] -mr-48 -mt-48"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-[120px] -ml-48 -mb-48"></div>
        
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <span className="text-primary font-black uppercase tracking-[0.3em] text-[10px] md:text-xs mb-6 inline-block">Triết lý tâm linh</span>
          <h2 className="text-3xl md:text-5xl font-black text-white italic mb-10 tracking-tight leading-tight">
            "Không cần lễ vật mâm cao cỗ đầy, quan trọng nhất là tấm lòng thành kính."
          </h2>
          <p className="text-slate-400 text-base md:text-lg leading-relaxed max-w-2xl mx-auto mb-12">
            Modern Ritual Offering ra đời với sứ mệnh giúp các gia đình hiện đại gánh vác phần nào sự lo toan trong khâu chuẩn bị lễ vật, để gia chủ có thể hoàn toàn tập trung vào sự thành tâm và niềm vui trong những ngày trọng đại.
          </p>
          <div className="flex flex-wrap justify-center gap-4 md:gap-6">
            <div className="px-5 md:px-6 py-2.5 md:py-3 rounded-full border border-white/10 text-white font-bold text-xs md:text-sm backdrop-blur-sm">Thành Tâm</div>
            <div className="px-5 md:px-6 py-2.5 md:py-3 rounded-full border border-white/10 text-white font-bold text-xs md:text-sm backdrop-blur-sm">Chỉn Chu</div>
            <div className="px-5 md:px-6 py-2.5 md:py-3 rounded-full border border-white/10 text-white font-bold text-xs md:text-sm backdrop-blur-sm">Tiết Kiệm</div>
            <div className="px-5 md:px-6 py-2.5 md:py-3 rounded-full border border-white/10 text-white font-bold text-xs md:text-sm backdrop-blur-sm">Hiện Đại</div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-20 md:py-24 px-6 text-center">
        <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-6 md:mb-8 tracking-tight">Bạn cần tư vấn thêm về nghi lễ?</h2>
        <p className="text-slate-500 mb-8 md:mb-10 max-w-lg mx-auto text-sm md:text-base">Đội ngũ chuyên gia của chúng tôi luôn sẵn sàng hỗ trợ bạn chuẩn bị một buổi lễ trọn vẹn nhất.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="px-8 md:px-10 py-4 md:py-5 bg-primary text-white rounded-xl md:rounded-2xl font-black text-xs md:text-[13px] uppercase tracking-widest shadow-2xl shadow-primary/20 hover:scale-105 transition-all">Gọi tư vấn: 1900 8888</button>
          <button 
            onClick={() => onNavigate('/about')}
            className="px-8 md:px-10 py-4 md:py-5 bg-white text-slate-900 border-2 border-slate-100 rounded-xl md:rounded-2xl font-black text-xs md:text-[13px] uppercase tracking-widest hover:bg-slate-50 transition-all"
          >
            Về chúng tôi
          </button>
        </div>
      </section>
    </div>
  );
};

export default CulturalGuidelinePage;
