import React, { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { orderService, VendorOrder } from '../../services/orderService';
import { statisticsService, VendorDashboardResult } from '../../services/statisticsService';
import StatisticsView from '../../components/StatisticsView';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
);

interface VendorDashboardProps {
  onNavigate: (path: string) => void;
}

const VendorDashboard: React.FC<VendorDashboardProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'shippings' | 'settings'>('overview');
  const [allVendorOrders, setAllVendorOrders] = useState<VendorOrder[]>([]);
  const [paidPendingOrders, setPaidPendingOrders] = useState<VendorOrder[]>([]);
  const [isLoadingPaidPendingOrders, setIsLoadingPaidPendingOrders] = useState(false);
  const [paidPendingOrdersError, setPaidPendingOrdersError] = useState<string | null>(null);
  const [dashboardStats, setDashboardStats] = useState<VendorDashboardResult | null>(null);
  const [isLoadingDashboardStats, setIsLoadingDashboardStats] = useState(false);
  const [dashboardStatsError, setDashboardStatsError] = useState<string | null>(null);

  const normalizeStatus = (status: string): string => String(status || '').trim().toLowerCase();

  const formatRelativeTime = (value: string): string => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'Vừa xong';
    }

    const diffMs = Date.now() - parsed.getTime();
    if (diffMs < 60_000) return 'Vừa xong';
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} phút trước`;
    if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)} giờ trước`;
    return `${Math.floor(diffMs / 86_400_000)} ngày trước`;
  };

  const getOrderTitle = (order: VendorOrder): string => {
    if (!order.items || order.items.length === 0) return 'Đơn hàng không có sản phẩm';
    if (order.items.length === 1) {
      return order.items[0].packageName || order.items[0].variantName || 'Sản phẩm';
    }

    const firstItemName = order.items[0].packageName || order.items[0].variantName || 'Sản phẩm';
    return `${firstItemName} (+${order.items.length - 1} sản phẩm)`;
  };

  const getDisplayCustomerName = (order: VendorOrder): string => {
    const name = String(order.customerName || '').trim();
    const normalizedName = name.toLowerCase();
    const isPlaceholderName = !name || normalizedName === 'khách hàng' || normalizedName === 'customer' || normalizedName === 'n/a';
    if (!isPlaceholderName) return name;

    const profileId = String(order.customerProfileId || '').trim();
    if (profileId) return `Mã KH: ${profileId.slice(0, 8).toUpperCase()}`;

    return 'Khách hàng';
  };

  const formatRevenue = (value: number): string => `${Math.max(0, value).toLocaleString('vi-VN')}đ`;

  const revenueChartData = useMemo(() => {
    const items = dashboardStats?.revenueChart || [];
    return {
      labels: items.map((item) => item.label),
      datasets: [
        {
          label: 'Doanh thu',
          data: items.map((item) => item.value),
          borderColor: '#C98C1A',
          backgroundColor: 'rgba(201, 140, 26, 0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#C98C1A',
        },
      ],
    };
  }, [dashboardStats]);

  const orderStatusChartData = useMemo(() => {
    const items = dashboardStats?.orderStatusChart || [];
    return {
      labels: items.map((item) => item.status),
      datasets: [
        {
          data: items.map((item) => item.count),
          backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#6b7280'],
          borderWidth: 0,
        },
      ],
    };
  }, [dashboardStats]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { font: { family: 'Inter', size: 11, weight: 'bold' as any }, padding: 18, usePointStyle: true },
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

  const loadDashboardStats = async () => {
    setIsLoadingDashboardStats(true);
    setDashboardStatsError(null);

    try {
      const data = await statisticsService.getVendorDashboard({ period: 'month' });
      setDashboardStats(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải thống kê cửa hàng.';
      setDashboardStatsError(message);
      setDashboardStats(null);
    } finally {
      setIsLoadingDashboardStats(false);
    }
  };

  const loadPaidPendingOrders = async () => {
    setIsLoadingPaidPendingOrders(true);
    setPaidPendingOrdersError(null);

    try {
      const orders = await orderService.getVendorOrders();
      setAllVendorOrders(orders);

      const filtered = orders
        .filter((order) => normalizeStatus(order.orderStatus) === 'paid')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const enriched = await Promise.all(
        filtered.map(async (order) => {
          const rawName = String(order.customerName || '').trim();
          const normalizedName = rawName.toLowerCase();
          const hasName = rawName.length > 0 && normalizedName !== 'khách hàng' && normalizedName !== 'customer' && normalizedName !== 'n/a';
          if (hasName) {
            return order;
          }

          try {
            const detail = await orderService.getOrderDetails(order.orderId);
            const detailedName = String(detail?.customer?.fullName || '').trim();
            if (!detailedName) {
              return order;
            }

            return {
              ...order,
              customerName: detailedName,
            };
          } catch {
            return order;
          }
        }),
      );

      setPaidPendingOrders(enriched);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải đơn hàng đã thanh toán.';
      setPaidPendingOrdersError(message);
      setAllVendorOrders([]);
      setPaidPendingOrders([]);
    } finally {
      setIsLoadingPaidPendingOrders(false);
    }
  };

  useEffect(() => {
    loadDashboardStats();
    loadPaidPendingOrders();
  }, []);

  const vendorStats = [
    {
      label: 'Tổng đơn hàng',
      value: isLoadingDashboardStats ? '...' : String(dashboardStats?.totalOrders ?? allVendorOrders.length),
      growth: dashboardStats?.orderGrowthRate,
      icon: 'shopping_bag',
    },
    { label: 'Đơn chờ xử lý', value: String(paidPendingOrders.length) },
    {
      label: 'Doanh thu tháng',
      value: isLoadingDashboardStats ? '...' : formatRevenue(dashboardStats?.totalRevenue ?? 0),
      growth: dashboardStats?.revenueGrowthRate,
      icon: 'payments',
    },
    {
      label: 'Giá trị đơn TB',
      value: isLoadingDashboardStats ? '...' : formatRevenue(dashboardStats?.averageOrderValue ?? 0),
      icon: 'trending_up',
    }
  ];

  const products = [
    { id: 1, name: 'Mâm Cúng Đầy Tháng Đặc Biệt', price: 2500000, stock: 15, orders: 127, rating: 4.9 },
    { id: 2, name: 'Gói Đại Phát - Khai Trương', price: 4950000, stock: 8, orders: 86, rating: 5.0 },
    { id: 3, name: 'Gói Bình An - Tân Gia', price: 1850000, stock: 25, orders: 92, rating: 4.8 }
  ];

  return (
    <div className="space-y-12">
      {/* Dashboard Alerts */}
      {dashboardStatsError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-medium">
          {dashboardStatsError}
        </div>
      )}
      {/* Integrated Statistics View */}
      <StatisticsView 
        isStaff={false} 
        hideHeader={false} 
        title="Phân tích kinh doanh" 
        subtitle="Theo dõi doanh thu và hiệu suất sản phẩm" 
      />

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pending Orders */}
        <div className="lg:col-span-2 bg-white rounded-[2rem] border border-gold/10 shadow-sm p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined">pending_actions</span>
              Đơn hàng chờ xử lý
            </h2>
            <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-lg">{paidPendingOrders.length}</span>
          </div>
          <div className="space-y-4">
            {isLoadingPaidPendingOrders && (
              <div className="p-8 text-center text-black">Đang tải đơn hàng...</div>
            )}

            {!isLoadingPaidPendingOrders && paidPendingOrdersError && (
              <div className="p-8 text-center">
                <p className="text-sm text-red-600 font-semibold mb-3">{paidPendingOrdersError}</p>
                <button
                  onClick={loadPaidPendingOrders}
                  className="px-6 py-2 border-2 border-primary text-primary rounded-lg text-xs font-bold uppercase hover:bg-primary/5 transition-all"
                >
                  Thử lại
                </button>
              </div>
            )}

            {!isLoadingPaidPendingOrders && !paidPendingOrdersError && paidPendingOrders.length === 0 && (
              <div className="p-8 text-center text-black bg-white rounded-2xl border-2 border-dashed border-gray-100">
                Chưa có đơn hàng đã thanh toán đang chờ xử lý.
              </div>
            )}

            {!isLoadingPaidPendingOrders && !paidPendingOrdersError && paidPendingOrders.map((order) => (
              <div
                key={order.orderId}
                onClick={() => onNavigate('/vendor/orders')}
                className="flex items-center justify-between p-5 bg-ritual-bg/30 rounded-2xl border border-gold/10 hover:border-primary transition-all cursor-pointer group"
              >
                <div>
                  <p className="text-[10px] font-bold uppercase text-gold tracking-[0.2em] mb-1">#{order.orderId}</p>
                  <p className="font-bold text-primary group-hover:text-gold transition-colors">{getOrderTitle(order)}</p>
                  <p className="text-xs text-black mt-1">Khách: {getDisplayCustomerName(order)}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-primary tracking-tight mb-1">{Number(order.totalAmount || 0).toLocaleString('vi-VN')}₫</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">(Đã gồm ship)</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatRelativeTime(order.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Products Summary */}
        <div className="bg-white rounded-[2rem] border border-gold/10 shadow-sm p-8">
          <h3 className="text-xl font-bold text-primary mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined">inventory</span>
            Sản phẩm nổi bật
          </h3>
          <div className="space-y-4">
            {products.map((product) => (
              <div key={product.id} className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <p className="font-bold text-sm text-primary mb-1">{product.name}</p>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-gold">{product.price.toLocaleString()}₫</span>
                  <span className="text-slate-400">{product.orders} đơn</span>
                </div>
              </div>
            ))}
            <button
              onClick={() => onNavigate('/vendor/products')}
              className="w-full mt-4 py-3 border-2 border-primary text-primary rounded-xl font-bold text-xs uppercase hover:bg-primary/5 transition-all"
            >
              Tất cả sản phẩm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorDashboard;
