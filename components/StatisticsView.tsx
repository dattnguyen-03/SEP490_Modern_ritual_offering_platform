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
  RadialLinearScale,
} from 'chart.js';
import { Line, Bar, Doughnut, PolarArea } from 'react-chartjs-2';
import {
  statisticsService,
  RevenueResult,
  OrderStatResult,
  ProductStatResult,
  VendorStatResult,
  UserResult,
  DeliveryResult,
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
  RadialLinearScale,
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
  const [userData, setUserData] = useState<UserResult | null>(null);
  const [deliveryData, setDeliveryData] = useState<DeliveryResult | null>(null);
  const [overviewData, setOverviewData] = useState<StatisticsOverviewResult | null>(null);

  // Filters for revenue specifically
  const [groupBy, setGroupBy] = useState<'day' | 'month' | 'year'>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Filters for products specifically
  const [productSortBy, setProductSortBy] = useState<string>('Revenue');
  const [productLimit, setProductLimit] = useState<number>(5);

  const mapOverviewProducts = (items: NonNullable<StatisticsOverviewResult['topProducts']>): ProductStatResult => ({
    totalProducts: items.length,
    soldProducts: items.reduce((sum, item) => sum + item.quantitySold, 0),
    topSellingProducts: items,
    topRevenueProducts: [...items].sort((a, b) => b.revenue - a.revenue),
    productsByCategory: [],
    startDate: '',
    endDate: '',
    sortBy: 'Revenue'
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
      const params = { vendorId, groupBy, startDate, endDate };

      if (isStaff && !vendorId) {
        const [rev, ord, prod, vend, users, delivery, overview] = await Promise.all([
          statisticsService.getRevenue(params).catch(() => null),
          statisticsService.getOrders(params).catch(() => null),
          statisticsService.getProducts({ ...params, limit: productLimit, sortBy: productSortBy }).catch(() => null),
          statisticsService.getVendors(params).catch(() => null),
          statisticsService.getUsers(params).catch(() => null),
          statisticsService.getDelivery(params).catch(() => null),
          statisticsService.getOverview({ vendorId, startDate, endDate }).catch(() => null),
        ]);
        const resRev = rev || mapOverviewRevenue(overview?.revenueChart || []);
        const resOrd = (ord && ord.ordersByStatus && ord.ordersByStatus.length > 0)
          ? ord
          : mapOverviewOrders(overview?.orderStatusChart || [], overview!);
        const resProd = (prod && ((prod.topSellingProducts?.length || 0) > 0 || (prod.topRevenueProducts?.length || 0) > 0))
          ? prod
          : mapOverviewProducts(overview?.topProducts || []);

        setRevenueData(resRev);
        setOrderData(resOrd);
        setProductData(resProd);
        setVendorStatData(vend);
        setUserData(users);
        setDeliveryData(delivery);
        setOverviewData(overview);
        return;
      }

      const [rev, ord, prod, delivery] = await Promise.all([
        statisticsService.getRevenue(params).catch(() => null),
        statisticsService.getOrders(params).catch(() => null),
        statisticsService.getProducts({ ...params, limit: productLimit }).catch(() => null),
        statisticsService.getDelivery(params).catch(() => null),
      ]);

      setOverviewData(null);
      setRevenueData(rev);
      setOrderData(ord);
      setProductData(prod);
      setDeliveryData(delivery);
    } catch (error) {
      console.error('Error fetching statistics:', error);
      toast.error('Không thể tải dữ liệu thống kê');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (groupBy === 'month') {
      const start = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const end = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(end);
    } else if (groupBy === 'year') {
      setStartDate(`${selectedYear}-01-01`);
      setEndDate(`${selectedYear}-12-31`);
    }
  }, [groupBy, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchData();
  }, [vendorId, groupBy, startDate, endDate, productSortBy, productLimit]);

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

  const chartPalettes = [
    '#FFD700', '#FF4D4D', '#2ECC71', '#3498DB', '#9B59B6',
    '#E67E22', '#FF69B4', '#00BCD4', '#8BC34A', '#1ABC9C',
    '#3F51B5', '#FF5722', '#FFC107', '#E91E63', '#009688',
    '#673AB7', '#CDDC39', '#FF9800', '#03A9F4', '#4CAF50'
  ];

  const categoryChartData = useMemo(() => {
    if (revenueData?.revenueByCategory && revenueData.revenueByCategory.length > 0) {
      return {
        labels: revenueData.revenueByCategory.map(item => item.categoryName),
        datasets: [
          {
            data: revenueData.revenueByCategory.map(item => item.revenue),
            backgroundColor: revenueData.revenueByCategory.map((_, i) => chartPalettes[i % chartPalettes.length]),
            borderWidth: 0,
          },
        ],
      };
    }

    const items = productData?.productsByCategory || [];
    return {
      labels: items.map(item => item.categoryName),
      datasets: [
        {
          data: items.map(item => item.productCount),
          backgroundColor: items.map((_, i) => chartPalettes[i % chartPalettes.length]),
          borderWidth: 0,
        },
      ],
    };
  }, [productData, revenueData]);

  const productChartData = useMemo(() => {
    const items = (productSortBy === 'Revenue' ? productData?.topRevenueProducts : productData?.topSellingProducts) || [];
    return {
      labels: items.map(item => item.productName),
      datasets: [
        {
          label: productSortBy === 'Revenue' ? 'Doanh thu (VNĐ)' : 'Số lượng bán',
          data: items.map(item => productSortBy === 'Revenue' ? item.revenue : item.quantitySold),
          backgroundColor: items.map((_, i) => chartPalettes[i % chartPalettes.length]),
          borderRadius: 8,
        },
      ],
    };
  }, [productData, productSortBy, chartPalettes]);

  const userChartData = useMemo(() => {
    const items = userData?.userRegistrationsByTime || [];
    return {
      labels: items.map(item => item.label),
      datasets: [
        {
          label: 'Người dùng mới',
          data: items.map(item => item.value),
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: '#3b82f6',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
        },
      ],
    };
  }, [userData]);

  const translateStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      'Completed': 'Hoàn thành',
      'Pending': 'Đang chờ',
      'Processing': 'Đang xử lý',
      'Confirmed': 'Đã xác nhận',
      'Shipping': 'Đang giao hàng',
      'Delivering': 'Đang giao hàng',
      'Delivered': 'Đã giao hàng',
      'Cancelled': 'Đã hủy',
      'Refunded': 'Đã hoàn tiền',
      'Paid': 'Đã thanh toán',
      'Unpaid': 'Chưa thanh toán'
    };
    return statusMap[status] || status;
  };

  const orderStatusChartData = useMemo(() => {
    const items = orderData?.ordersByStatus || [];
    return {
      labels: items.map((item: any) => translateStatus(item.label || item.status || 'Không xác định')),
      datasets: [
        {
          label: 'Số lượng đơn hàng',
          data: items.map((item: any) => item.value ?? item.count ?? 0),
          backgroundColor: chartPalettes.map(c => c.replace('0.8', '0.6')),
          borderWidth: 2,
          borderColor: '#ffffff',
        },
      ],
    };
  }, [orderData]);

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
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-[2rem] border border-gold/10 shadow-sm gap-4">
          <div>
            <h2 className="text-2xl font-black text-primary uppercase tracking-tight">{title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{subtitle}</p>
              {(revenueData || overviewData) && (
                <div className="flex items-center gap-1 bg-gold/5 px-2 py-0.5 rounded-full border border-gold/10">
                  <span className="material-symbols-outlined text-[10px] text-gold">calendar_today</span>
                  <span className="text-[9px] font-black text-gold uppercase">
                    {new Date(revenueData?.revenueByTime?.[0]?.date || overviewData?.startDate || startDate).toLocaleDateString('vi-VN')}
                    {' - '}
                    {new Date(revenueData?.revenueByTime?.slice(-1)[0]?.date || overviewData?.endDate || endDate).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
            <div className="flex bg-ritual-bg/50 p-1.5 rounded-2xl border border-gold/10">
              {(['day', 'month', 'year'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGroupBy(g)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${groupBy === g ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:text-primary'
                    }`}
                >
                  {g === 'day' ? 'Ngày' : g === 'month' ? 'Tháng' : 'Năm'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 bg-ritual-bg/50 p-1.5 rounded-2xl border border-gold/10 transition-all">
              {groupBy === 'day' ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase ml-2">Từ</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-transparent border-none focus:ring-0 text-xs font-bold text-primary outline-none"
                    />
                  </div>
                  <div className="w-[1px] h-4 bg-gold/20"></div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Đến</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-transparent border-none focus:ring-0 text-xs font-bold text-primary outline-none"
                    />
                  </div>
                  {(startDate || endDate) && (
                    <button
                      onClick={() => { setStartDate(''); setEndDate(''); }}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">close_small</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-1 px-2">
                  {groupBy === 'month' && (
                    <>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="bg-transparent border-none focus:ring-0 text-xs font-black text-primary uppercase outline-none cursor-pointer p-0 pr-6"
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
                        ))}
                      </select>
                      <div className="w-[1px] h-4 bg-gold/20 mx-1"></div>
                    </>
                  )}
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="bg-transparent border-none focus:ring-0 text-xs font-black text-primary outline-none cursor-pointer p-0 pr-6"
                  >
                    {[currentYear, currentYear - 1, currentYear - 2].map(year => (
                      <option key={year} value={year}>Năm {year}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
            label: (isStaff && !vendorId) ? 'Người dùng' : 'Sản phẩm kinh doanh',
            value: (isStaff && !vendorId)
              ? (userData?.totalUsers?.toString() || overviewData?.totalUsers?.toString() || '0')
              : (productData?.totalProducts?.toString() || overviewData?.totalProducts?.toString() || '0'),
            icon: (isStaff && !vendorId) ? 'group' : 'inventory_2',
            color: 'text-blue-600'
          },
          {
            label: (isStaff && !vendorId) ? 'Nhà cung cấp' : 'Giá trị trung bình',
            value: (isStaff && !vendorId)
              ? (vendorStatData?.totalVendors?.toString() || overviewData?.totalVendors?.toString() || '0')
              : formatCurrency(orderData?.averageOrderValue || overviewData?.averageOrderValue || 0),
            icon: (isStaff && !vendorId) ? 'store' : 'trending_up',
            color: (isStaff && !vendorId) ? 'text-orange-600' : 'text-purple-600'
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
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-gold">donut_small</span>
              {isStaff && !vendorId ? 'Top sản phẩm' : 'Danh mục bán chạy'}
            </h3>
          </div>
          <div className="h-[320px] w-full">
            {categoryChartData.labels.length > 0 ? (
              <Doughnut data={categoryChartData} options={{ ...chartOptions, cutout: '58%' }} />
            ) : <EmptyState message={isStaff && !vendorId ? 'Sản phẩm mới cập nhật' : 'Chưa có phân loại bán chạy'} icon="pie_chart" />}
          </div>
        </div>
      </div>

      {/* Product Performance Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 border border-gold/10 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-gold">bar_chart</span>
              Biểu đồ hiệu suất sản phẩm
            </h3>
            <div className="flex bg-ritual-bg/50 p-1 rounded-xl">
              <button
                onClick={() => setProductSortBy('Revenue')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${productSortBy === 'Revenue' ? 'bg-primary text-white shadow-md' : 'text-slate-500'}`}
              >
                Doanh thu
              </button>
              <button
                onClick={() => setProductSortBy('QuantitySold')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${productSortBy === 'QuantitySold' ? 'bg-primary text-white shadow-md' : 'text-slate-500'}`}
              >
                Số lượng
              </button>
            </div>
          </div>
          <div className="h-[350px] w-full">
            {productChartData.labels.length > 0 ? (
              <Bar
                data={productChartData}
                options={{
                  ...chartOptions,
                  indexAxis: 'y' as const,
                  plugins: {
                    ...chartOptions.plugins,
                    legend: { display: false }
                  }
                }}
              />
            ) : <EmptyState message="Chưa có dữ liệu sản phẩm" icon="leaderboard" />}
          </div>
        </div>
        <div className="bg-white rounded-[2.5rem] p-8 border border-gold/10 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center mb-6 border-b border-gold/5 pb-4">
            <h4 className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-gold text-sm">stars</span>
              Xếp hạng chi tiết
            </h4>
          </div>
          <div className="space-y-5 overflow-y-auto max-h-[290px] pr-2 custom-scrollbar">
            {(productSortBy === 'Revenue' ? productData?.topRevenueProducts : productData?.topSellingProducts) &&
              (productSortBy === 'Revenue' ? productData?.topRevenueProducts : productData?.topSellingProducts)!.length > 0 ? (
              (productSortBy === 'Revenue' ? productData?.topRevenueProducts : productData?.topSellingProducts)!.map((prod, i) => (
                <div key={prod.productId} className="flex items-center justify-between group pb-4 border-b border-gold/5 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-ritual-bg flex items-center justify-center text-[10px] font-black text-gold shrink-0 border border-gold/5">
                      {i + 1}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-black text-primary truncate max-w-[130px]" title={prod.productName}>{prod.productName}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{prod.orderCount} đơn hàng</p>
                    </div>
                  </div>
                  <div className="text-right ml-2 shrink-0">
                    <p className="text-xs font-black text-primary">
                      {productSortBy === 'Revenue' ? formatCurrency(prod.revenue) : `${prod.quantitySold} SP`}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState message="Chưa có dữ liệu" icon="inventory" />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        <div className="bg-white rounded-[2.5rem] p-8 border border-gold/10 shadow-sm">
          <h3 className="text-lg font-black text-primary mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-gold">analytics</span>
            Trạng thái đơn hàng
          </h3>
          <div className="h-[300px] w-full">
            {orderStatusChartData.labels.length > 0 ? (
              <Bar 
                data={orderStatusChartData} 
                options={{ 
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    legend: { display: false }
                  }
                }} 
              />
            ) : <EmptyState message="Chưa có dữ liệu đơn hàng" icon="analytics" />}
          </div>
        </div>
        <div className="bg-white rounded-[2.5rem] p-8 border border-gold/10 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-gold">stars</span>
              {isStaff && !vendorId ? 'Top nhà cung cấp' : 'Chi tiết sản phẩm'}
            </h3>
          </div>
          {isStaff && !vendorId ? (
            <div className="space-y-4">
              {(revenueData?.revenueByVendor || overviewData?.topVendors || overviewData?.topPerformingVendors || vendorStatData?.topPerformingVendors || []).slice(0, 5).length > 0 ? (
                (revenueData?.revenueByVendor || overviewData?.topVendors || overviewData?.topPerformingVendors || vendorStatData?.topPerformingVendors || []).slice(0, 5).map((vendor: any, i) => (
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
                      {vendor.averageOrderValue && <p className="text-[10px] font-bold text-slate-400 uppercase">TB: {formatCurrency(vendor.averageOrderValue)}/đơn</p>}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="Chưa có nhà cung cấp nổi bật" icon="store" />
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {(productSortBy === 'Revenue' ? productData?.topRevenueProducts : productData?.topSellingProducts) &&
                (productSortBy === 'Revenue' ? productData?.topRevenueProducts : productData?.topSellingProducts)!.length > 0 ? (
                (productSortBy === 'Revenue' ? productData?.topRevenueProducts : productData?.topSellingProducts)!.map((prod, i) => (
                  <div key={prod.productId}>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-gold">#{i + 1}</span>
                        <span className="text-slate-600 truncate max-w-[200px]" title={prod.productName}>{prod.productName}</span>
                      </div>
                      <span className="text-primary font-black">
                        {productSortBy === 'Revenue' ? formatCurrency(prod.revenue) : `${prod.quantitySold} SP`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-ritual-bg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-gold to-primary rounded-full transition-all duration-1000"
                        style={{
                          width: `${(
                            (productSortBy === 'Revenue' ? prod.revenue : prod.quantitySold) /
                            ((productSortBy === 'Revenue' ? productData?.topRevenueProducts?.[0]?.revenue : productData?.topSellingProducts?.[0]?.quantitySold) || 1)
                          ) * 100}%`
                        }}
                      ></div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{prod.orderCount} đơn hàng</p>
                  </div>
                ))
              ) : (
                <EmptyState message="Chưa có dữ liệu bán chạy" icon="inventory" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 border border-gold/10 shadow-sm">
          <h3 className="text-lg font-black text-primary mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-gold">local_shipping</span>
            Hiệu suất giao hàng
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-6 bg-green-50 rounded-[2rem] border border-green-100">
              <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Thành công</p>
              <p className="text-2xl font-black text-green-700">{deliveryData?.successfulDeliveries || 0}</p>
            </div>
            <div className="p-6 bg-red-50 rounded-[2rem] border border-red-100">
              <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Thất bại</p>
              <p className="text-2xl font-black text-red-700">{deliveryData?.failedDeliveries || 0}</p>
            </div>
            <div className="p-6 bg-ritual-bg/50 rounded-[2rem] border border-gold/5">
              <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Đang chờ</p>
              <p className="text-2xl font-black text-primary">{deliveryData?.pendingDeliveries || 0}</p>
            </div>
          </div>
          <div className="mt-8 p-6 bg-white rounded-[2rem] border border-gold/10 shadow-inner">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-slate-500 uppercase">Tỷ lệ thành công</span>
              <span className="text-lg font-black text-primary">
                {deliveryData?.totalDeliveries ? Math.round((deliveryData.successfulDeliveries / deliveryData.totalDeliveries) * 100) : 0}%
              </span>
            </div>
            <div className="h-4 w-full bg-ritual-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(34,197,94,0.4)]"
                style={{ width: `${deliveryData?.totalDeliveries ? (deliveryData.successfulDeliveries / deliveryData.totalDeliveries) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-gold/10 shadow-sm">
          <h3 className="text-lg font-black text-primary mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-gold">pending_actions</span>
            Trạng thái giao hàng
          </h3>
          <div className="h-[280px] w-full">
            {deliveryData?.deliveriesByStatus && deliveryData.deliveriesByStatus.length > 0 ? (
              <Doughnut
                data={{
                  labels: deliveryData.deliveriesByStatus.map(d => d.status),
                  datasets: [{
                    data: deliveryData.deliveriesByStatus.map(d => d.count),
                    backgroundColor: chartPalettes,
                    borderWidth: 0,
                  }]
                }}
                options={{ ...chartOptions, cutout: '70%' }}
              />
            ) : <EmptyState message="Chưa có dữ liệu giao hàng" icon="local_shipping" />}
          </div>
        </div>
      </div> */}

      {/* User Statistics Row (Admin Only) */}
      {isStaff && !vendorId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          <div className="bg-white rounded-[2.5rem] p-8 border border-gold/10 shadow-sm">
            <h3 className="text-lg font-black text-primary mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-gold">person_add</span>
              Tăng trưởng người dùng
            </h3>
            <div className="h-[300px] w-full">
              {userChartData.labels.length > 0 ? (
                <Line data={userChartData} options={chartOptions} />
              ) : <EmptyState message="Chưa có dữ liệu người dùng" icon="group" />}
            </div>
          </div>
          <div className="bg-white rounded-[2.5rem] p-8 border border-gold/10 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-gold">group_work</span>
                Phân bổ vai trò
              </h3>
            </div>
            <div className="space-y-6 mt-4">
              {userData?.usersByRole && userData.usersByRole.length > 0 ? (
                userData.usersByRole.map((role, i) => (
                  <div key={role.role} className="mb-6 last:mb-0">
                    <div className="flex justify-between items-end mb-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{role.role}</span>
                        <span className="text-sm font-black text-primary leading-none">{role.count} <span className="text-[10px] font-bold text-slate-400">người</span></span>
                      </div>
                      <span className="text-xs font-black text-gold bg-gold/10 px-2 py-1 rounded-lg">
                        {Math.round(role.percentage)}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-ritual-bg rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${role.percentage}%`,
                          backgroundColor: chartPalettes[i % chartPalettes.length]
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="Chưa có dữ liệu vai trò" icon="badge" />
              )}

              <div className="pt-8 border-t border-gold/10">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Trạng thái tài khoản</h4>
                
                {/* Unified Percentage Distribution Bar */}
                <div className="h-3.5 w-full bg-ritual-bg/50 rounded-full overflow-hidden flex mb-6 shadow-inner border border-gold/5 p-0.5">
                  {userData?.usersByStatus && userData.usersByStatus.length > 0 ? (
                    userData.usersByStatus.map((status, i) => (
                      <div 
                        key={status.status}
                        className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-1000 group relative cursor-help"
                        style={{ 
                          width: `${status.percentage}%`,
                          backgroundColor: status.status.toUpperCase() === 'ACTIVE' ? '#22C55E' : 
                                           status.status.toUpperCase() === 'BANNED' ? '#EF4444' : 
                                           chartPalettes[(i + 4) % chartPalettes.length]
                        }}
                      >
                         <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 font-bold">
                           {status.status}: {Math.round(status.percentage)}%
                         </div>
                      </div>
                    ))
                  ) : (
                    <div className="w-full h-full bg-slate-100 rounded-full animate-pulse"></div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {userData?.usersByStatus && userData.usersByStatus.length > 0 ? (
                    userData.usersByStatus.map((status, i) => (
                      <div 
                        key={status.status} 
                        className="p-5 bg-white rounded-3xl border border-gold/10 hover:border-gold/30 hover:shadow-lg hover:shadow-gold/5 transition-all group relative overflow-hidden"
                      >
                        {/* Status specific background accent */}
                        <div 
                          className="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-[0.03] group-hover:opacity-[0.06] transition-opacity"
                          style={{ 
                            backgroundColor: status.status.toUpperCase() === 'ACTIVE' ? '#22C55E' : 
                                             status.status.toUpperCase() === 'BANNED' ? '#EF4444' : 
                                             chartPalettes[(i + 4) % chartPalettes.length]
                          }}
                        />
                        
                        <div className="flex justify-between items-start relative z-10">
                          <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{status.status}</span>
                          <span className="text-[10px] font-black text-slate-400 group-hover:text-primary transition-colors">
                            {Math.round(status.percentage)}%
                          </span>
                        </div>
                        <div className="mt-3 flex items-baseline gap-1 relative z-10">
                          <p className="text-2xl font-black text-primary">{status.count}</p>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">tài khoản</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 py-4">
                      <p className="text-xs text-slate-400 italic font-bold uppercase tracking-widest text-center opacity-50">Chưa có dữ liệu trạng thái</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StatisticsView;