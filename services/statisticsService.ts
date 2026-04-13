import { getAuthToken } from './auth';

export interface RevenueByTime {
  label: string;
  value: number;
  date: string;
  category: string | null;
}

export interface RevenueResult {
  totalRevenue: number;
  previousPeriodRevenue: number;
  growthRate: number;
  revenueByTime: RevenueByTime[];
}

export interface ProductStat {
  packageId: string;
  packageName: string;
  vendorName: string;
  totalQuantity: number;
  totalRevenue: number;
}

export interface ProductStatResult {
  totalProducts: number;
  products: ProductStat[];
}

export interface StatItem {
  label: string;
  value: number;
}

export interface OrderStatResult {
  totalOrders: number;
  previousPeriodOrders: number;
  growthRate: number;
  averageOrderValue: number;
  ordersByStatus: StatItem[];
  ordersByTime: StatItem[];
  ordersByCategory: StatItem[];
}

export interface TopVendorItem {
  vendorId: string;
  shopName: string;
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
}

export interface VendorStatResult {
  totalVendors: number;
  activeVendors: number;
  inactiveVendors: number;
  suspendedVendors: number;
  bannedVendors: number;
  vendorsByTier: StatItem[];
  vendorsByStatus: StatItem[];
  vendorRegistrationsByTime: StatItem[];
  topPerformingVendors: TopVendorItem[];
}

export interface VendorDashboardRevenueByTime {
  label: string;
  value: number;
  date: string;
  category: string | null;
}

export interface VendorDashboardResult {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  averageOrderValue: number;
  revenueGrowthRate?: number;
  orderGrowthRate?: number;
  revenueChart?: VendorDashboardRevenueByTime[];
  orderStatusChart?: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  topProducts?: Array<{
    productId: number | string;
    productName: string;
    imageUrl?: string | null;
    quantitySold: number;
    revenue: number;
    orderCount: number;
  }>;
  vendorId?: string;
  shopName?: string;
  startDate?: string;
  endDate?: string;
}

export interface StatisticsOverviewResult {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers?: number;
  totalVendors?: number;
  averageOrderValue: number;
  totalProducts: number;
  revenueGrowthRate?: number;
  orderGrowthRate?: number;
  customerGrowthRate?: number;
  revenueChart?: VendorDashboardRevenueByTime[];
  orderStatusChart?: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  topProducts?: Array<{
    productId: number | string;
    productName: string;
    imageUrl?: string | null;
    quantitySold: number;
    revenue: number;
    orderCount: number;
  }>;
  /** API trả về field này */
  topVendors?: TopVendorItem[];
  /** alias cũ – giữ lại để tương thích */
  topPerformingVendors?: TopVendorItem[];
  vendorStats?: VendorStatResult;
  productStats?: ProductStatResult;
  orderStats?: OrderStatResult;
  revenueStats?: RevenueResult;
  vendorId?: string;
  shopName?: string;
  startDate?: string;
  endDate?: string;
}

export interface StatisticsParams {
  period?: 'day' | 'week' | 'month' | 'year';
  startDate?: string;
  endDate?: string;
  vendorId?: string;
  categoryId?: number;
  status?: string;
  limit?: number;
}

const fetchWithAuth = async <T>(url: string): Promise<T> => {
  const token = getAuthToken();
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.isSuccess === false || payload?.isSucceeded === false) {
    const errorMessages = payload?.errorMessages?.join?.(', ') || payload?.message || `API error (${response.status})`;
    throw new Error(errorMessages);
  }

  return payload.result as T;
};

export const statisticsService = {
  getRevenue: async (params: StatisticsParams = {}): Promise<RevenueResult> => {
    const searchParams = new URLSearchParams();
    if (params.period) searchParams.append('Period', params.period);
    if (params.startDate) searchParams.append('StartDate', params.startDate);
    if (params.endDate) searchParams.append('EndDate', params.endDate);
    if (params.vendorId) searchParams.append('VendorId', params.vendorId);
    if (params.categoryId) searchParams.append('CategoryId', params.categoryId.toString());

    return fetchWithAuth<RevenueResult>(`/api/statistics/revenue?${searchParams.toString()}`);
  },

  getProducts: async (params: StatisticsParams = {}): Promise<ProductStatResult> => {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.append('Limit', params.limit.toString());
    if (params.vendorId) searchParams.append('VendorId', params.vendorId);
    if (params.categoryId) searchParams.append('CategoryId', params.categoryId.toString());
    if (params.startDate) searchParams.append('StartDate', params.startDate);
    if (params.endDate) searchParams.append('EndDate', params.endDate);

    return fetchWithAuth<ProductStatResult>(`/api/statistics/products?${searchParams.toString()}`);
  },

  getOrders: async (params: StatisticsParams = {}): Promise<OrderStatResult> => {
    const searchParams = new URLSearchParams();
    if (params.period) searchParams.append('Period', params.period);
    if (params.status) searchParams.append('Status', params.status);
    if (params.vendorId) searchParams.append('VendorId', params.vendorId);
    if (params.startDate) searchParams.append('StartDate', params.startDate);
    if (params.endDate) searchParams.append('EndDate', params.endDate);

    return fetchWithAuth<OrderStatResult>(`/api/statistics/orders?${searchParams.toString()}`);
  },

  getVendors: async (params: StatisticsParams = {}): Promise<VendorStatResult> => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.append('Status', params.status);
    if (params.period) searchParams.append('Period', params.period);
    if (params.startDate) searchParams.append('StartDate', params.startDate);
    if (params.endDate) searchParams.append('EndDate', params.endDate);

    return fetchWithAuth<VendorStatResult>(`/api/statistics/vendors?${searchParams.toString()}`);
  },

  getVendorDashboard: async (params: StatisticsParams = {}): Promise<VendorDashboardResult> => {
    const searchParams = new URLSearchParams();
    if (params.period) searchParams.append('Period', params.period);
    if (params.startDate) searchParams.append('StartDate', params.startDate);
    if (params.endDate) searchParams.append('EndDate', params.endDate);

    return fetchWithAuth<VendorDashboardResult>(`/api/statistics/vendor/dashboard?${searchParams.toString()}`);
  },

  getOverview: async (params: StatisticsParams = {}): Promise<StatisticsOverviewResult> => {
    const searchParams = new URLSearchParams();
    if (params.period) searchParams.append('Period', params.period);
    if (params.startDate) searchParams.append('StartDate', params.startDate);
    if (params.endDate) searchParams.append('EndDate', params.endDate);
    if (params.vendorId) searchParams.append('VendorId', params.vendorId);

    return fetchWithAuth<StatisticsOverviewResult>(`/api/statistics/overview?${searchParams.toString()}`);
  }
};
