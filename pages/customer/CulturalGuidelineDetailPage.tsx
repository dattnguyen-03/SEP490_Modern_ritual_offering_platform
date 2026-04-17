import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { guidelineService, CulturalGuideline } from '../../services/guidelineService';

const CulturalGuidelineDetailPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { id } = useParams<{ id: string }>();
  const [guideline, setGuideline] = useState<CulturalGuideline | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    const fetchDetail = async () => {
      if (!id) return;
      try {
        const data = await guidelineService.getGuidelineById(parseInt(id));
        setGuideline(data);
      } catch (error) {
        console.error('❌ Failed to fetch guideline detail:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  const getCategoryImage = (name: string) => {
    const n = (name || '').toLowerCase();
    if (n.includes('thôi nôi')) return 'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?q=80&w=1000&auto=format&fit=crop';
    if (n.includes('đầy tháng')) return 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=1000&auto=format&fit=crop';
    if (n.includes('động thổ')) return 'https://images.unsplash.com/photo-1541888941259-79273ceb3c32?q=80&w=1000&auto=format&fit=crop';
    if (n.includes('khai trương')) return 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1000&auto=format&fit=crop';
    if (n.includes('tết') || n.includes('giao thừa')) return 'https://images.unsplash.com/photo-1596462502278-27bf3da32771?q=80&w=1000&auto=format&fit=crop';
    return 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1000&auto=format&fit=crop';
  };

  const getCategoryHighlights = (name: string) => {
    const n = (name || '').toLowerCase();
    if (n.includes('thôi nôi')) return ['Gà luộc & Xôi chè', 'Mâm 12 Bà Mụ', 'Bộ đồ bốc nghề', 'Hoa & Trái cây'];
    if (n.includes('khai trương')) return ['Heo quay nguyên con', 'Mâm cúng thần tài', 'Hoa đồng tiền', 'Kệ hoa khai trương'];
    return ['Mâm lễ vật chuẩn', 'Thành tâm khấn nguyện', 'Sắp xếp khoa học', 'Dịch vụ trọn gói'];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-black font-bold uppercase tracking-widest text-xs">Đang tải kiến thức truyền thống...</p>
        </div>
      </div>
    );
  }

  if (!guideline) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center bg-white p-12 rounded-[3rem] shadow-xl">
          <span className="material-symbols-outlined text-6xl text-slate-200 mb-4">error_outline</span>
          <h2 className="text-2xl font-black text-slate-800 mb-4">Không tìm thấy hướng dẫn</h2>
          <button
            onClick={() => onNavigate('/cultural-guideline')}
            className="px-8 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest"
          >
            Quay lại cẩm nang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Splash */}
      <div className="relative h-[400px] w-full overflow-hidden">
        <img
          src={getCategoryImage(guideline.categoryName)}
          alt={guideline.title}
          className="w-full h-full object-cover brightness-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-transparent"></div>
        <div className="absolute bottom-16 left-0 right-0 max-w-7xl mx-auto px-6">
          <nav className="flex items-center gap-2 text-white/70 text-xs font-black uppercase tracking-widest mb-6">
            <button onClick={() => onNavigate('/')} className="hover:text-white">Trang chủ</button>
            <span>/</span>
            <button onClick={() => onNavigate('/cultural-guideline')} className="hover:text-white">Cẩm nang</button>
            <span>/</span>
            <span className="text-white">{guideline.categoryName}</span>
          </nav>
          <h1 className="text-4xl md:text-6xl font-black text-white italic tracking-tight drop-shadow-2xl">
            {guideline.title}
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-[3rem] p-8 md:p-14 shadow-2xl shadow-slate-200/50 border border-slate-100">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-1 w-12 bg-primary rounded-full"></div>
                <span className="text-primary font-black uppercase tracking-[0.2em] text-sm">
                  Kiến thức chuẩn văn hóa
                </span>
              </div>

              <div className="prose prose-slate prose-lg max-w-none">
                <p className="text-black leading-[2.2] text-xl font-medium italic mb-10 border-l-4 border-gold/20 pl-8">
                  {guideline.description}
                </p>

                <h2 className="text-2xl font-black text-slate-800 mt-12 mb-6">Cần chuẩn bị những gì?</h2>
                <p className="text-black leading-relaxed mb-6">
                  Để một buổi lễ diễn ra thuận lợi, sự chuẩn bị kỹ lưỡng về mặt lễ vật là vô cùng quan trọng.
                  Gia chủ nên chú trọng vào sự tươi mới của thực phẩm và sự sắp xếp ngay ngắn của mâm lễ.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                  {getCategoryHighlights(guideline.categoryName).map((h, i) => (
                    <div key={i} className="flex items-center gap-4 p-5 bg-ritual-bg/50 rounded-2xl border border-gold/5">
                      <span className="material-symbols-outlined text-primary">verified</span>
                      <span className="font-bold text-slate-700">{h}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-16 p-8 bg-slate-900 rounded-[2.5rem] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                  <h3 className="text-white text-xl font-black mb-4 flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">lightbulb</span>
                    Lời khuyên từ cố vấn tâm linh
                  </h3>
                  <p className="text-black text-sm leading-relaxed italic">
                    "Trong mọi nghi lễ, lòng thành là lễ vật quý nhất. Hãy thực hiện nghi thức với tâm thế bình an và biết ơn,
                    mọi điều tốt lành sẽ tự nhiên tìm đến."
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-32 space-y-8">
              {/* Call to action */}
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/40 text-center">
                <h3 className="text-xl font-black text-slate-800 mb-4">Bạn muốn đặt mâm cúng trọn gói?</h3>
                <p className="text-black text-sm mb-8">Chúng tôi chuẩn bị đầy đủ mọi lễ vật, giao hàng và bài trí tận nơi cho bạn.</p>
                <button
                  onClick={() => onNavigate(`/shop?category=${encodeURIComponent(guideline.categoryName)}`)}
                  className="w-full py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-primary/20 hover:scale-[1.02] transition-all mb-4"
                >
                  Xem các gói {guideline.categoryName}
                </button>
                <button
                  onClick={() => onNavigate('/about')}
                  className="w-full py-4 text-black font-bold hover:text-primary transition-colors text-sm"
                >
                  Tìm hiểu quy trình phục vụ
                </button>
              </div>

              {/* Support info */}
              <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-dashed border-slate-200 flex items-center gap-4">
                <div className="size-12 rounded-full bg-white flex items-center justify-center text-primary shadow-sm">
                  <span className="material-symbols-outlined">support_agent</span>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-black">Hỗ trợ 24/7</p>
                  <p className="font-bold text-slate-800">1900 8888</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CulturalGuidelineDetailPage;
