import React, { useState, useEffect } from 'react';
import StatisticsView from '../../components/StatisticsView';
import { getVendorProfile, VendorCurrentProfile } from '../../services/auth';

interface VendorAnalyticsProps {
  onNavigate: (path: string) => void;
}

const VendorAnalytics: React.FC<VendorAnalyticsProps> = ({ onNavigate }) => {
  const [profile, setProfile] = useState<VendorCurrentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await getVendorProfile();
        setProfile(data);
      } catch (error) {
        console.error('Error fetching vendor profile for analytics:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Đang tải dữ liệu cửa hàng...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg- ritual-bg/5 p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl font-black text-primary uppercase tracking-tight mb-2">Thống Kê Cửa Hàng</h1>
          <p className="text-black font-bold uppercase tracking-widest text-[10px]">Hiệu suất kinh doanh của {profile?.shopName || 'cửa hàng'}</p>
        </div>

        <StatisticsView
          isStaff={false}
          vendorId={undefined} // Backend associates stats with the user's token when calling /api/statistics/...
          hideHeader={false}
          title="Tổng quan kinh doanh"
          subtitle="Phân tích chi tiết doanh thu và đơn hàng"
        />
      </div>
    </div>
  );
};

export default VendorAnalytics;
