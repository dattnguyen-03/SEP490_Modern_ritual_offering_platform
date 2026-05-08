import { ApiResponse } from '../types';
import { fetchWithAuth } from './auth';

const API_BASE_URL = '/api';

export interface ShippingConfig {
  vendorId: string;
  baseDistance: number;
  basePrice: number;
  pricePerKm: number;
  maxDistance: number;
  earliestDeliveryTime: string;
  latestDeliveryTime: string;
  minPreparationHours: number;
  maxAdvanceBookingDays: number;
  freeShipThreshold: number;
  isActive: boolean;
}

export interface UpdateShippingConfigRequest {
  baseDistance?: number;
  basePrice?: number;
  pricePerKm?: number;
  maxDistance?: number;
  earliestDeliveryTime?: string;
  latestDeliveryTime?: string;
  minPreparationHours?: number;
  maxAdvanceBookingDays?: number;
  freeShipThreshold?: number;
  isActive?: boolean;
}

class ShippingService {
  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Lấy cấu hình vận chuyển của vendor hiện tại
   * GET /api/shipping-config
   */
  async getShippingConfig(): Promise<ShippingConfig | null> {
    try {
      console.log('Fetching shipping config for current vendor...');
      const response = await fetchWithAuth(`${API_BASE_URL}/shipping-config`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        console.log('Shipping config not found (404) - this is normal for first-time setup');
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<ShippingConfig | ShippingConfig[]> = await response.json();
      console.log('Shipping config response:', data);

      if (data.isSuccess && data.result) {
        if (Array.isArray(data.result)) {
          return data.result[0] || null;
        }
        return data.result;
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to fetch shipping config:', error);
      throw error;
    }
  }

  /**
   * Cập nhật hoặc tạo mới cấu hình vận chuyển
   * POST /api/shipping-config
   */
  async updateShippingConfig(config: UpdateShippingConfigRequest): Promise<boolean> {
    try {
      // Đảm bảo định dạng thời gian là HH:mm:ss
      const formatTime = (time?: string) => {
        if (!time) return time;
        if (time.length === 5) return `${time}:00`;
        return time;
      };

      const payload = {
        ...config,
        earliestDeliveryTime: formatTime(config.earliestDeliveryTime),
        latestDeliveryTime: formatTime(config.latestDeliveryTime),
      };

      console.log('Updating shipping config with payload:', payload);

      const response = await fetchWithAuth(`${API_BASE_URL}/shipping-config`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Update shipping config error:', response.status, errorText);
        return false;
      }

      const data: ApiResponse<any> = await response.json();
      return data.isSuccess;
    } catch (error) {
      console.error('❌ Failed to update shipping config:', error);
      return false;
    }
  }

  /**
   * Lấy cấu hình vận chuyển của một vendor cụ thể (dùng cho customer checkout)
   * GET /api/shipping-config/vendor?vendorId=...
   */
  async getVendorShippingConfig(vendorId: string): Promise<ShippingConfig | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/shipping-config/vendor?vendorId=${encodeURIComponent(vendorId)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.status === 404) return null;
      if (!response.ok) return null;

      const data: ApiResponse<ShippingConfig> = await response.json();
      return data.isSuccess ? data.result : null;
    } catch (error) {
      console.error('❌ Failed to fetch vendor shipping config:', error);
      return null;
    }
  }
}

export const shippingService = new ShippingService();
