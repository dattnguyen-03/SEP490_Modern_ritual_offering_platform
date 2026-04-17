import React, { useEffect } from 'react';
import TeamImage from '../../assets/Gemini_Generated_Image_ygg4taygg4taygg4.png';

interface AboutUsPageProps {
  onNavigate: (path: string) => void;
}

const AboutUsPage: React.FC<AboutUsPageProps> = ({ onNavigate }) => {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative h-[60vh] min-h-[400px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="https://cdn.tienphong.vn/images/a6bf4f60924201126af6849ca45a3980edf238dc5fe842100151164d2dd56f9fa92bc3bc0d0793bf46080d68a58f1376f55f4d4cf291e10c38303c5c973ba32b/123-771.jpg"
            alt="Traditional Ritual"
            className="w-full h-full object-cover transform scale-105 hover:scale-100 transition-transform duration-700 brightness-[0.4]"
          />
        </div>

        <div className="container mx-auto px-6 relative z-10 text-center space-y-6">
          <div className="inline-block animate-bounce-slow">
            <span className="px-6 py-2 bg-gold/20 backdrop-blur-md text-gold text-xs font-black uppercase tracking-[0.3em] rounded-full border border-gold/30">
              Gìn giữ nét đẹp Việt
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-black text-white italic leading-tight drop-shadow-2xl">
            Về Modern <span className="text-amber-400 drop-shadow-[0_2px_10px_rgba(234,179,8,0.5)]">Ritual Offering</span>
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto font-medium leading-relaxed drop-shadow-lg">
            Sứ mệnh số hóa nghi lễ truyền thống, mang đến sự tiện lợi mà vẫn giữ trọn lòng thành tâm trong từng lễ vật.
          </p>
        </div>

        {/* Decorative Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40">
          <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">Cuộn để xem thêm</span>
          <div className="w-[1px] h-12 bg-gradient-to-b from-gold/50 to-transparent"></div>
        </div>
      </section>

      {/* Our Mission Section */}
      <section className="py-24 md:py-32 container mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-5 space-y-8">
            <div className="space-y-4">
              <h2 className="text-[10px] font-black text-gold uppercase tracking-[0.3em] border-l-4 border-gold pl-4">Câu chuyện của chúng tôi</h2>
              <h3 className="text-4xl md:text-5xl font-black text-primary leading-tight font-display italic">
                Kết nối giá trị cũ <br />trong nhịp sống mới
              </h3>
            </div>

            <p className="text-black leading-relaxed text-lg">
              Trong guồng quay hối hả của cuộc sống hiện đại, việc chuẩn bị một mâm cúng đúng nghi thức thường trở thành một gánh nặng thời gian cho nhiều gia đình. Chúng tôi ra đời với khao khát giúp mọi người dễ dàng thực hiện các nghi lễ tâm linh mà không mất đi sự tỉ mỉ, trân trọng vốn có.
            </p>

            <div className="grid grid-cols-2 gap-8 pt-4">
              <div className="space-y-2">
                <p className="text-4xl font-black text-primary italic">10k+</p>
                <p className="text-xs font-bold text-black uppercase tracking-widest leading-none">Mâm cúng đã giao</p>
              </div>
              <div className="space-y-2">
                <p className="text-4xl font-black text-primary italic">500+</p>
                <p className="text-xs font-bold text-black uppercase tracking-widest leading-none">Nghệ nhân hợp tác</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 relative">
            <div className="aspect-[4/5] rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10">
              <img
                src="https://cdn.tienphong.vn/images/a6bf4f60924201126af6849ca45a3980edf238dc5fe842100151164d2dd56f9fa92bc3bc0d0793bf46080d68a58f1376f55f4d4cf291e10c38303c5c973ba32b/123-771.jpg"
                alt="Traditional Ritual Practice"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
            <div className="absolute -top-10 -left-10 w-64 h-64 bg-gold/10 rounded-full blur-3xl -z-10"></div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-24 bg-slate-50 relative overflow-hidden">
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-[10px] font-black text-gold uppercase tracking-[0.3em]">Giá trị cốt lõi</h2>
            <h3 className="text-4xl font-black text-primary font-display italic">Tại sao chọn Modern Ritual?</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Thành tâm là trên hết",
                desc: "Mọi sản phẩm đều được chọn lọc kỹ lưỡng, tươi ngon và trang trọng nhất.",
                icon: "favorite",
                color: "bg-rose-50 text-rose-500"
              },
              {
                title: "Đúng chuẩn nghi lễ",
                desc: "Được cố vấn bởi các chuyên gia văn hóa để đảm bảo mâm cúng đúng phong tục.",
                icon: "auto_awesome",
                color: "bg-gold/10 text-gold"
              },
              {
                title: "Tiện lợi & Nhanh chóng",
                desc: "Đặt hàng chỉ với vài cú click, giao tận nơi đúng giờ hoàng đạo.",
                icon: "bolt",
                color: "bg-primary/5 text-primary"
              }
            ].map((value, i) => (
              <div key={i} className="bg-white p-10 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 hover:-translate-y-2 transition-transform duration-300">
                <div className={`${value.color} w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-sm`}>
                  <span className="material-symbols-outlined text-3xl">{value.icon}</span>
                </div>
                <h4 className="text-xl font-black text-slate-900 mb-4 tracking-tight">{value.title}</h4>
                <p className="text-black leading-relaxed italic">"{value.desc}"</p>
              </div>
            ))}
          </div>
        </div>

        {/* Background Patterns */}
        <div className="absolute top-0 right-0 w-full h-full opacity-[0.03] pointer-events-none">
          <svg width="100%" height="100%"><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" /></pattern><rect width="100%" height="100%" fill="url(#grid)" /></svg>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-24 md:py-32 container mx-auto px-6 text-center">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="relative inline-block">
            <span className="material-symbols-outlined text-8xl text-gold/10 absolute -top-10 -left-10 select-none">format_quote</span>
            <h3 className="text-3xl md:text-5xl font-black text-primary leading-tight font-display italic relative z-10">
              "Chúng tôi không chỉ bán lễ vật, chúng tôi bán sự <span className="text-gold underline decoration-primary/20 underline-offset-8">an yên</span> trong tâm hồn mỗi gia chủ khi hướng về cội nguồn."
            </h3>
          </div>

          <div className="flex flex-col items-center gap-4 pt-8">
            <div className="w-16 h-1 bg-gradient-to-r from-transparent via-gold to-transparent"></div>
            <p className="text-xs font-black uppercase tracking-[0.4em] text-black italic">Đội ngũ sáng lập Modern Ritual</p>
          </div>
        </div>
      </section>

      {/* Development Team Section */}
      <section className="py-24 bg-primary/5">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 relative">
              <div className="max-w-md mx-auto aspect-square rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white relative z-10">
                <img
                  src={TeamImage}
                  alt="Development Team"
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Decorative elements */}
              <div className="absolute -z-10 -bottom-4 -left-4 w-full h-full max-w-md inset-0 mx-auto border-2 border-gold/30 rounded-[2rem]"></div>
            </div>

            <div className="order-1 lg:order-2 space-y-8">
              <div className="space-y-4">
                <h2 className="text-[10px] font-black text-gold uppercase tracking-[0.3em]">Con người phía sau</h2>
                <h3 className="text-4xl md:text-5xl font-black text-primary font-display italic">Đội ngũ phát triển</h3>
              </div>
              <p className="text-black leading-relaxed text-lg italic">
                Sự kết hợp giữa những lập trình viên trẻ đầy nhiệt huyết và các nghệ nhân văn hóa dày dặn kinh nghiệm. Chúng tôi làm việc không ngừng để xây dựng một nền tảng không chỉ hiện đại về công nghệ mà còn sâu sắc về giá trị tinh thần.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-gold/10 text-gold flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">self_improvement</span>
                  </div>
                  <p className="text-sm font-black text-primary uppercase tracking-widest">Trẻ trung</p>
                  <p className="text-xs text-black font-medium">Đầy nhiệt huyết và sáng tạo trong từng giải pháp.</p>
                </div>

                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">devices</span>
                  </div>
                  <p className="text-sm font-black text-primary uppercase tracking-widest">Hiện đại</p>
                  <p className="text-xs text-black font-medium">Áp dụng công nghệ tiên tiến nhất cho trải nghiệm người dùng.</p>
                </div>

                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">history_edu</span>
                  </div>
                  <p className="text-sm font-black text-primary uppercase tracking-widest">Đậm chất văn hóa</p>
                  <p className="text-xs text-black font-medium">Gìn giữ linh hồn của nghi lễ truyền thống Việt.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="pb-24 container mx-auto px-6">
        <div className="bg-primary rounded-[3rem] p-10 md:p-24 text-center text-white relative overflow-hidden shadow-2xl shadow-primary/30">
          {/* Decor */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-gold/20 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl"></div>

          <div className="relative z-10 space-y-10">
            <h2 className="text-4xl md:text-6xl font-black font-display italic tracking-tight">
              Bắt đầu hành trình <br />hướng về nguồn cội ngay hôm nay
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={() => onNavigate('/shop')}
                className="px-10 py-5 bg-gold text-white font-black rounded-2xl uppercase tracking-widest hover:bg-white hover:text-primary transition-all shadow-xl shadow-gold/20 active:scale-95"
              >
                Khám phá sản phẩm
              </button>
              <button
                onClick={() => onNavigate('/')}
                className="px-10 py-5 bg-white/10 backdrop-blur-md border border-white/20 text-white font-black rounded-2xl uppercase tracking-widest hover:bg-white/20 transition-all active:scale-95"
              >
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Branding */}
      <footer className="py-12 border-t border-slate-100 text-center">
        <div className="flex flex-col items-center gap-4 opacity-30">
          <h2 className="text-2xl font-display font-black text-primary italic">MODERN RITUAL</h2>
          <p className="text-[10px] font-bold uppercase tracking-[0.5em]">Nghi lễ hiện đại - Lòng thành truyền thống</p>
        </div>
      </footer>
    </div>
  );
};

export default AboutUsPage;
