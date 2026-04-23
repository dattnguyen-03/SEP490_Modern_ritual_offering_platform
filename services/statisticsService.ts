import { fetchWithAuth } from './auth';

export interface RevenueByTime {
  label: string;
  value: number;
  date: string;
  category: string | null;
}

export interface RevenueByCategory {
  categoryId: number;
  categoryName: string;
  revenue: number;
  percentage: number;
  orderCount: number;
}

export interface RevenueByVendor {
  vendorId: string;
  shopName: string;
  revenue: number;
  percentage: number;
  orderCount: number;
}

export interface RevenueResult {
  totalRevenue: number;
  previousPeriodRevenue?: number;
  growthRate?: number;
  revenueByTime: RevenueByTime[];
  revenueByCategory?: RevenueByCategory[];
  revenueByVendor?: RevenueByVendor[];
  startDate?: string;
  endDate?: string;
  groupBy?: string;
}

export interface ProductStat {
  productId: string | number;
  productName: string;
  imageUrl?: string | null;
  quantitySold: number;
  revenue: number;
  orderCount: number;
}

export interface CategoryStat {
  categoryId: number;
  categoryName: string;
  productCount: number;
  percentage: number;
}

export interface ProductStatResult {
  totalProducts: number;
  soldProducts: number;
  topSellingProducts: ProductStat[];
  topRevenueProducts: ProductStat[];
  productsByCategory: CategoryStat[];
  startDate?: string;
  endDate?: string;
  sortBy?: string;
}

export interface UserRoleDist {
  role: string;
  count: number;
  percentage: number;
}

export interface UserByTime {
  label: string;
  value: number;
  date: string;
}

export interface UserStatusDist {
  status: string;
  count: number;
  percentage: number;
}

export interface UserResult {
  totalUsers: number;
  usersByRole: UserRoleDist[];
  usersByStatus: UserStatusDist[];
  userRegistrationsByTime: UserByTime[];
  startDate?: string;
  endDate?: string;
  groupBy?: string;
}

export interface DeliveryByTime {
  label: string;
  value: number;
  date: string;
}

export interface DeliveryStatusDist {
  status: string;
  count: number;
  percentage: number;
}

export interface DeliveryResult {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  deliveriesByStatus: DeliveryStatusDist[];
  deliveriesByTime: DeliveryByTime[];
  startDate?: string;
  endDate?: string;
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
  totalUsers?: number;
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
  groupBy?: 'day' | 'month' | 'year';
  startDate?: string;
  endDate?: string;
  vendorId?: string;
  categoryId?: number;
  status?: string;
  limit?: number;
  sortBy?: string;
}

const fetchWithAuthJson = async <T>(url: string): Promise<T> => {
  const response = await fetchWithAuth(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
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
    if (params.groupBy) {
      // Mapping to plural if backend needs it (based on user JSON showing "days")
      const mappedGroupBy = params.groupBy === 'day' ? 'days' : 
                          params.groupBy === 'month' ? 'months' : 
                          params.groupBy === 'year' ? 'years' : params.groupBy;
      searchParams.append('GroupBy', mappedGroupBy);
    }
    if (params.startDate) searchParams.append('StartDate', params.startDate);
    if (params.endDate) searchParams.append('EndDate', params.endDate);
    if (params.vendorId) searchParams.append('VendorId', params.vendorId);
    if (params.categoryId) searchParams.append('CategoryId', params.categoryId.toString());

    return fetchWithAuthJson<RevenueResult>(`/api/statistics/revenue?${searchParams.toString()}`);
  },

  getProducts: async (params: StatisticsParams = {}): Promise<ProductStatResult> => {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.append('Limit', params.limit.toString());
    if (params.vendorId) searchParams.append('VendorId', params.vendorId);
    if (params.categoryId) searchParams.append('CategoryId', params.categoryId.toString());
    if (params.startDate) searchParams.append('StartDate', params.startDate);
    if (params.endDate) searchParams.append('EndDate', params.endDate);
    if (params.sortBy) searchParams.append('SortBy', params.sortBy);
    if (params.vendorId) searchParams.append('VendorId', params.vendorId);

    return fetchWithAuthJson<ProductStatResult>(`/api/statistics/products?${searchParams.toString()}`);
  },

  getUsers: async (params: StatisticsParams & { role?: string; status?: string } = {}): Promise<UserResult> => {
    const searchParams = new URLSearchParams();
    if (params.role) searchParams.append('Role', params.role);
    if (params.status) searchParams.append('Status', params.status);
    if (params.groupBy) {
      const mappedGroupBy = params.groupBy === 'day' ? 'days' : 
                          params.groupBy === 'month' ? 'months' : 
                          params.groupBy === 'year' ? 'years' : params.groupBy;
      searchParams.append('GroupBy', mappedGroupBy);
    }
    if (params.startDate) searchParams.append('StartDate', params.startDate);
    if (params.endDate) searchParams.append('EndDate', params.endDate);
    if (params.period) searchParams.append('Period', params.period);

    return fetchWithAuthJson<UserResult>(`/api/statistics/users?${searchParams.toString()}`);
  },

  getDelivery: async (params: StatisticsParams & { deliveryStatus?: string } = {}): Promise<DeliveryResult> => {
    const searchParams = new URLSearchParams();
    if (params.deliveryStatus) searchParams.append('DeliveryStatus', params.deliveryStatus);
    if (params.vendorId) searchParams.append('VendorId', params.vendorId);
    if (params.groupBy) {
      const mappedGroupBy = params.groupBy === 'day' ? 'days' : 
                          params.groupBy === 'month' ? 'months' : 
                          params.groupBy === 'year' ? 'years' : params.groupBy;
      searchParams.append('GroupBy', mappedGroupBy);
    }
    if (params.startDate) searchParams.append('StartDate', params.startDate);
    if (params.endDate) searchParams.append('EndDate', params.endDate);
    if (params.period) searchParams.append('Period', params.period);

    return fetchWithAuthJson<DeliveryResult>(`/api/statistics/delivery?${searchParams.toString()}`);
  },

  getOrders: async (params: StatisticsParams = {}): Promise<OrderStatResult> => {
    const searchParams = new URLSearchParams();
    if (params.period) searchParams.append('Period', params.period);
    if (params.status) searchParams.append('Status', params.status);
    if (params.vendorId) searchParams.append('VendorId', params.vendorId);
    if (params.startDate) searchParams.append('StartDate', params.startDate);
    if (params.endDate) searchParams.append('EndDate', params.endDate);

    return fetchWithAuthJson<OrderStatResult>(`/api/statistics/orders?${searchParams.toString()}`);
  },

  getVendors: async (params: StatisticsParams = {}): Promise<VendorStatResult> => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.append('Status', params.status);
    if (params.period) searchParams.append('Period', params.period);
    if (params.startDate) searchParams.append('StartDate', params.startDate);
    if (params.endDate) searchParams.append('EndDate', params.endDate);

    return fetchWithAuthJson<VendorStatResult>(`/api/statistics/vendors?${searchParams.toString()}`);
  },

  getVendorDashboard: async (params: StatisticsParams = {}): Promise<VendorDashboardResult> => {
    const searchParams = new URLSearchParams();
    if (params.period) searchParams.append('Period', params.period);
    if (params.startDate) searchParams.append('StartDate', params.startDate);
    if (params.endDate) searchParams.append('EndDate', params.endDate);

    return fetchWithAuthJson<VendorDashboardResult>(`/api/statistics/vendor/dashboard?${searchParams.toString()}`);
  },

  getOverview: async (params: StatisticsParams = {}): Promise<StatisticsOverviewResult> => {
    const searchParams = new URLSearchParams();
    if (params.period) searchParams.append('Period', params.period);
    if (params.startDate) searchParams.append('StartDate', params.startDate);
    if (params.endDate) searchParams.append('EndDate', params.endDate);
    if (params.vendorId) searchParams.append('VendorId', params.vendorId);

    return fetchWithAuthJson<StatisticsOverviewResult>(`/api/statistics/overview?${searchParams.toString()}`);
  }
};
