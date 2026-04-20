import { ApiResponse, PackageAddOn } from '../types';
import { getAuthToken } from './auth';

const API_BASE_URL = '/api';

class AddOnService {
  async getAllAddOns(): Promise<PackageAddOn[]> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/add-ons`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<PackageAddOn[]> = await response.json();
      if (data.isSuccess && data.result) {
        return data.result;
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch add-ons:', error);
      return [];
    }
  }

  async getAddOnById(id: number): Promise<PackageAddOn | null> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/add-ons/${id}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<PackageAddOn> = await response.json();
      if (data.isSuccess && data.result) {
        return data.result;
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch add-on ${id}:`, error);
      return null;
    }
  }

  async createAddOn(addOn: Omit<PackageAddOn, 'addOnId'>): Promise<PackageAddOn | null> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/add-ons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(addOn),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<PackageAddOn> = await response.json();
      if (data.isSuccess && data.result) {
        return data.result;
      }
      return null;
    } catch (error) {
      console.error('Failed to create add-on:', error);
      return null;
    }
  }

  async updateAddOn(id: number, addOn: Partial<PackageAddOn>): Promise<boolean> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/add-ons/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(addOn),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<any> = await response.json();
      return data.isSuccess;
    } catch (error) {
      console.error(`Failed to update add-on ${id}:`, error);
      return false;
    }
  }

  async deleteAddOn(id: number): Promise<boolean> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/add-ons/${id}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<any> = await response.json();
      return data.isSuccess;
    } catch (error) {
      console.error(`Failed to delete add-on ${id}:`, error);
      return false;
    }
  }
}

export const addOnService = new AddOnService();
