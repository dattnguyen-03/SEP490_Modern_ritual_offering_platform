import React, { useEffect, useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  statisticsService,
  RevenueResult,
  OrderStatResult,
  ProductStatResult,
  VendorStatResult,
  StatisticsOverviewResult,
} from '../services/statisticsService';
import toast from '../services/toast';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface StatisticsViewProps {
  isStaff?: boolean;
  vendorId?: string;
  title?: string;
  subtitle?: string;
  hideHeader?: boolean;
}

const EmptyState: React.FC<{ message?: string; icon?: string }> = ({ message = "Dữ liệu đang được cập nhật...", icon = "leaderboard" }) => (
  <div className="flex flex-col items-center justify-center h-full min-h-[220px] bg-ritual-bg/20 rounded-[1.5rem] border border-dashed border-gold/20 p-8 text-center animate-pulse-slow">
    <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-4 shadow-sm">
      <span className="material-symbols-outlined text-4xl text-gold/40">{icon}</span>
    </div>
    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/40 max-w-[150px] leading-relaxed">
      {message}
    </p>
  </div>
);

const StatisticsView: React.FC<StatisticsViewProps> = ({
  isStaff = true,
  vendorId,
  title = "Thống kê hệ thống",
  subtitle = "Dữ liệu kinh doanh chi tiết",
  hideHeader = false
}) => {
  const [loading, setLoading] = useState(true);

  const [revenueData, setRevenueData] = useState<RevenueResult | null>(null);
  const [orderData, setOrderData] = useState<OrderStatResult | null>(null);
  const [productData, setProductData] = useState<ProductStatResult | null>(null);
  const [vendorStatData, setVendorStatData] = useState<VendorStatResult | null>(null);
  const [overviewData, setOverviewData] = useState<StatisticsOverviewResult | null>(null);

  const mapOverviewProducts = (items: NonNullable<StatisticsOverviewResult['topProducts']>): ProductStatResult => ({
    totalProducts: items.length,
    products: items.map((item) => ({
      packageId: String(item.productId),
      packageName: item.productName,
      vendorName: overviewData?.shopName || 'Cửa hàng',
      totalQuantity: item.quantitySold,
      totalRevenue: item.revenue,
    })),
  });

  const mapOverviewOrders = (items: NonNullable<StatisticsOverviewResult['orderStatusChart']>, overview: StatisticsOverviewResult): OrderStatResult => ({
    totalOrders: overview.totalOrders ?? items.reduce((sum, item) => sum + item.count, 0),
    previousPeriodOrders: 0,
    growthRate: overview.orderGrowthRate || 0,
    averageOrderValue: overview.averageOrderValue || 0,
    ordersByStatus: items.map((item) => ({ label: item.status, value: item.count })),
    ordersByTime: [],
    ordersByCategory: [],
  });

  const mapOverviewRevenue = (items: NonNullable<StatisticsOverviewResult['revenueChart']>): RevenueResult => ({
    totalRevenue: overviewData?.totalRevenue || 0,
    previousPeriodRevenue: 0,
    growthRate: overviewData?.revenueGrowthRate || 0,
    revenueByTime: items,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { vendorId };

      if (isStaff && !vendorId) {
        const overview = await statisticsService.getOverview(params);
        setOverviewData(overview);

        const overviewRevenue = overview.revenueChart || [];
        const overviewOrders = overview.orderStatusChart || [];
        const overviewProducts = overview.topProducts || [];

        setRevenueData(mapOverviewRevenue(overviewRevenue));
        setOrderData(mapOverviewOrders(overviewOrders, overview));
        setProductData(mapOverviewProducts(overviewProducts));

        // Build vendorStatData from overview fields (API trả topVendors + totalVendors)
        const topVendors = overview.topVendors || overview.topPerformingVendors || [];
        setVendorStatData(
          overview.vendorStats || (
            (overview.totalVendors !== undefined || topVendors.length > 0)
              ? {
                totalVendors: overview.totalVendors ?? topVendors.length,
                activeVendors: 0,
                inactiveVendors: 0,
                suspendedVendors: 0,
                bannedVendors: 0,
                vendorsByTier: [],
                vendorsByStatus: [],
                vendorRegistrationsByTime: [],
                topPerformingVendors: topVendors,
              }
              : null
          )
        );
        return;
      }

      const [rev, ord, prod, vend] = await Promise.all([
        statisticsService.getRevenue(params).catch(() => null),
        statisticsService.getOrders(params).catch(() => null),
        statisticsService.getProducts({ ...params, limit: 5 }).catch(() => null),
        (isStaff && !vendorId) ? statisticsService.getVendors(params).catch(() => null) : Promise.resolve(null)
      ]);

      setOverviewData(null);
      setRevenueData(rev);
      setOrderData(ord);
      setProductData(prod);
      if (vend) setVendorStatData(vend);
    } catch (error) {
      console.error('Error fetching statistics:', error);
      toast.error('Không thể tải dữ liệu thống kê');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [vendorId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  // Chart Data Mapping
  const revenueChartData = useMemo(() => {
    const items = revenueData?.revenueByTime || [];
    return {
      labels: items.map(item => item.label),
      datasets: [
        {
          label: 'Doanh thu',
          data: items.map(item => item.value),
          borderColor: '#B8860B',
          backgroundColor: 'rgba(184, 134, 11, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#B8860B',
        },
      ],
    };
  }, [revenueData]);

  const categoryChartData = useMemo(() => {
    const items = productData?.products || [];
    return {
      labels: items.map(item => item.packageName),
      datasets: [
        {
          data: items.map(item => item.totalRevenue),
          backgroundColor: ['#1C1C1C', '#B8860B', '#E6D5B8', '#6B6B6B', '#D1D1D1', '#94a3b8'],
          borderWidth: 0,
        },
      ],
    };
  }, [productData]);

  const orderStatusChartData = useMemo(() => {
    const items = orderData?.ordersByStatus || [];
    return {
      labels: items.map(item => item.label),
      datasets: [
        {
          label: 'Số lượng đơn hàng',
          data: items.map(item => item.value),
          backgroundColor: [
            'rgba(34, 197, 94, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(107, 114, 128, 0.8)',
            'rgba(239, 68, 68, 0.8)',
          ],
          borderRadius: 8,
        },
      ],
    };
  }, [orderData]);

  const vendorStatusChartData = useMemo(() => {
    if (!vendorStatData) return { labels: [], datasets: [] };
    const labels = ['Hoạt động', 'Ngoại tuyến', 'Tạm ngưng', 'Bị khóa'];
    const data = [
      vendorStatData.activeVendors || 0,
      vendorStatData.inactiveVendors || 0,
      vendorStatData.suspendedVendors || 0,
      vendorStatData.bannedVendors || 0
    ];

    // Filter out zeros to keep chart clean
    const filteredLabels = labels.filter((_, i) => data[i] > 0);
    const filteredData = data.filter(v => v > 0);

    return {
      labels: filteredLabels,
      datasets: [
        {
          data: filteredData,
          backgroundColor: ['#22c55e', '#64748b', '#f59e0b', '#ef4444'],
          borderWidth: 0,
        },
      ],
    };
  }, [vendorStatData]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { font: { family: 'Inter', size: 11, weight: 'bold' as any }, padding: 20, usePointStyle: true },
      },
      tooltip: {
        backgroundColor: '#1C1C1C',
        titleFont: { size: 14, weight: 'bold' as any },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 12,
      },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0, 0, 0, 0.05)' }, ticks: { font: { weight: 'bold' as any, size: 10 }, color: '#64748b' } },
      x: { grid: { display: false }, ticks: { font: { weight: 'bold' as any, size: 10 }, color: '#64748b' } },
    },
  };

  if (loading && !revenueData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Đang tổng hợp dữ liệu...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header with filters */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-[2rem] border border-gold/10 shadow-sm gap-4">
          <div>
            <h2 className="text-2xl font-black text-primary uppercase tracking-tight">{title}</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{subtitle}</p>
          </div>
        </div>
      )}

      {/* Top Highlight Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            label: 'Doanh thu',
            value: formatCurrency(revenueData?.totalRevenue || overviewData?.totalRevenue || 0),
            icon: 'payments',
            color: 'text-gold',
            growth: revenueData?.growthRate ?? overviewData?.revenueGrowthRate
          },
          {
            label: 'Đơn hàng',
            value: orderData?.totalOrders?.toString() || overviewData?.totalOrders?.toString() || '0',
            icon: 'shopping_cart',
            color: 'text-green-600',
            growth: orderData?.growthRate ?? overviewData?.orderGrowthRate
          },
          {
            label: (isStaff && !vendorId) ? 'Nhà cung cấp' : 'Sản phẩm kinh doanh',
            value: (isStaff && !vendorId)
              ? (vendorStatData?.totalVendors?.toString() || overviewData?.totalVendors?.toString() || '0')
              : (productData?.totalProducts?.toString() || overviewData?.totalProducts?.toString() || '0'),
            icon: (isStaff && !vendorId) ? 'store' : 'inventory_2',
            color: 'text-blue-600'
          },
          {
            label: 'Giá trị trung bình',
            value: formatCurrency(orderData?.averageOrderValue || overviewData?.averageOrderValue || 0),
            icon: 'trending_up',
            color: 'text-purple-600'
          },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-[2rem] p-6 border border-gold/10 shadow-sm hover:shadow-lg transition-all">
            <div className="flex items-start justify-between mb-2">
              <div className={`w-12 h-12 rounded-2xl bg-ritual-bg flex items-center justify-center ${stat.color}`}>
                <span className="material-symbols-outlined text-2xl">{stat.icon}</span>
              </div>
              {stat.growth !== undefined && (
                <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${stat.growth >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  {stat.growth >= 0 ? '+' : ''}{stat.growth}%
                </span>
              )}
            </div>
            <div>
              <h3 className="text-xl font-black text-primary leading-none mb-1">{stat.value}</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 border border-gold/10 shadow-sm">
          <h3 className="text-lg font-black text-primary mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-gold">trending_up</span>
            Biểu đồ doanh thu
          </h3>
          <div className="h-[300px] w-full">
            {revenueChartData.labels.length > 0 ? (
              <Line data={revenueChartData} options={chartOptions} />
            ) : <EmptyState message="Chưa có dữ liệu doanh thu" icon="insights" />}
          </div>
        </div>
        <div className="bg-white rounded-[2.5rem] p-8 border border-gold/10 shadow-sm">
          <h3 className="text-lg font-black text-primary mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-gold">donut_small</span>
            {isStaff && !vendorId ? 'Top sản phẩm' : 'Danh mục bán chạy'}
          </h3>
          <div className="h-[320px] w-full">
            {categoryChartData.labels.length > 0 ? (
              <Doughnut data={categoryChartData} options={{ ...chartOptions, cutout: '58%' }} />
            ) : <EmptyState message={isStaff && !vendorId ? 'Chưa có dữ liệu sản phẩm' : 'Chưa có dữ liệu danh mục'} icon="pie_chart" />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[2.5rem] p-8 border border-gold/10 shadow-sm">
          <h3 className="text-lg font-black text-primary mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-gold">analytics</span>
            Trạng thái đơn hàng
          </h3>
          <div className="h-[300px] w-full">
            {orderStatusChartData.labels.length > 0 ? (
              <Bar data={orderStatusChartData} options={chartOptions} />
            ) : <EmptyState message="Chưa có dữ liệu trạng thái" icon="bar_chart" />}
          </div>
        </div>
        <div className="bg-white rounded-[2.5rem] p-8 border border-gold/10 shadow-sm">
          <h3 className="text-lg font-black text-primary mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-gold">stars</span>
            {isStaff && !vendorId ? 'Top nhà cung cấp' : 'Top sản phẩm bán chạy'}
          </h3>
          {isStaff && !vendorId ? (
            <div className="space-y-4">
              {(overviewData?.topVendors || overviewData?.topPerformingVendors || vendorStatData?.topPerformingVendors || []).slice(0, 5).length > 0 ? (
                (overviewData?.topVendors || overviewData?.topPerformingVendors || vendorStatData?.topPerformingVendors || []).slice(0, 5).map((vendor, i) => (
                  <div key={vendor.vendorId} className="flex items-center justify-between p-4 bg-ritual-bg/30 rounded-[1.25rem] border border-gold/5">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white border border-gold/10 flex items-center justify-center text-gold font-black text-sm shrink-0">
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-primary truncate">{vendor.shopName}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{vendor.orderCount} đơn hàng</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-sm font-black text-gold">{formatCurrency(vendor.revenue)}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">TB: {formatCurrency(vendor.averageOrderValue)}/đơn</p>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="Chưa có nhà cung cấp nổi bật" icon="store" />
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {productData?.products && productData.products.length > 0 ? (
                productData.products.map((prod, i) => (
                  <div key={prod.packageId}>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-gold">#{i + 1}</span>
                        <span className="text-slate-600 truncate max-w-[200px]" title={prod.packageName}>{prod.packageName}</span>
                      </div>
                      <span className="text-primary font-black">{prod.totalQuantity} SP</span>
                    </div>
                    <div className="h-1.5 w-full bg-ritual-bg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-gold to-primary rounded-full transition-all duration-1000"
                        style={{ width: `${(prod.totalQuantity / (productData?.products?.[0]?.totalQuantity || 1)) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{prod.vendorName}</p>
                  </div>
                ))
              ) : (
                <EmptyState message="Chưa có sản phẩm bán chạy" icon="inventory" />
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default StatisticsView;