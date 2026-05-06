import { ApiResponse } from '../types';

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
  /**
   * Lấy cấu hình phí vận chuyển của vendor hiện tại
   */
  async getShippingConfig(): Promise<ShippingConfig | null> {
    try {
      const token = localStorage.getItem('smart-child-token');
      const response = await fetch(`${API_BASE_URL}/shipping-config`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<ShippingConfig> = await response.json();
      
      if (data.isSuccess && data.result) {
        return data.result;
      } else {
        console.error('❌ API Error:', data.errorMessages);
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to fetch shipping config:', error);
      return null;
    }
  }

  /**
   * Cập nhật cấu hình phí vận chuyển
   */
  async updateShippingConfig(config: UpdateShippingConfigRequest): Promise<boolean> {
    try {
      const token = localStorage.getItem('smart-child-token');
      const response = await fetch(`${API_BASE_URL}/shipping-config`, {
        method: 'POST', // Assuming POST since it's a config that might be created or updated
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<unknown> = await response.json();
      return data.isSuccess;
    } catch (error) {
      console.error('❌ Failed to update shipping config:', error);
      return false;
    }
  }

  /**
   * Lấy cấu hình phí vận chuyển của vendor
   */
  async getVendorShippingConfig(vendorId: string): Promise<ShippingConfig | null> {
    try {
      const token = localStorage.getItem('smart-child-token');
      const response = await fetch(`${API_BASE_URL}/shipping-config/vendor?vendorId=${encodeURIComponent(vendorId)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<ShippingConfig> = await response.json();
      
      if (data.isSuccess && data.result) {
        return data.result;
      } else {
        console.error('❌ API Error:', data.errorMessages);
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to fetch vendor shipping config:', error);
      return null;
    }
  }
}

export const shippingService = new ShippingService();
