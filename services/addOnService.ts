import { ApiResponse, PackageAddOn } from '../types';
import { getAuthToken, fetchWithAuth } from './auth';
import { API_BASE_URL } from './api';

const isSuccessful = (data: any): boolean => {
  return Boolean(data?.isSuccess || data?.isSucceeded || data?.statusCode === 'OK');
};

class AddOnService {
  async getAllAddOns(): Promise<PackageAddOn[]> {
    try {
      const token = getAuthToken();
      const response = await fetchWithAuth(`${API_BASE_URL}/add-ons`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<PackageAddOn[]> = await response.json();
      if (isSuccessful(data) && Array.isArray(data.result)) {
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
      const response = await fetchWithAuth(`${API_BASE_URL}/add-ons/${id}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<PackageAddOn> = await response.json();
      if (isSuccessful(data) && data.result) {
        return data.result;
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch add-on ${id}:`, error);
      return null;
    }
  }

  async createAddOn(
    addOn: Omit<PackageAddOn, 'addOnId'>,
    imageFile: File | null = null
  ): Promise<PackageAddOn | null> {
    try {
      const token = getAuthToken();
      const queryParams = new URLSearchParams();
      if (addOn.addOnName) queryParams.append('AddOnName', addOn.addOnName);
      if (addOn.description) queryParams.append('Description', addOn.description);
      if (addOn.itemType) queryParams.append('ItemType', addOn.itemType);
      if (addOn.retailPrice !== undefined) queryParams.append('RetailPrice', addOn.retailPrice.toString());
      if (addOn.maxQtyPerOrder !== undefined) queryParams.append('MaxQtyPerOrder', addOn.maxQtyPerOrder.toString());

      const url = `${API_BASE_URL}/add-ons?${queryParams.toString()}`;
      const formData = new FormData();
      if (imageFile) {
        formData.append('ImageUrl', imageFile);
      }

      const response = await fetchWithAuth(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
        body: formData,
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

  async updateAddOn(
    id: number,
    addOn: Partial<PackageAddOn>,
    imageFile: File | null = null
  ): Promise<boolean> {
    try {
      const token = getAuthToken();
      const queryParams = new URLSearchParams();
      if (addOn.addOnName) queryParams.append('AddOnName', addOn.addOnName);
      if (addOn.description !== undefined) queryParams.append('Description', addOn.description || '');
      if (addOn.itemType) queryParams.append('ItemType', addOn.itemType);
      if (addOn.retailPrice !== undefined) queryParams.append('RetailPrice', addOn.retailPrice.toString());
      if (addOn.maxQtyPerOrder !== undefined) queryParams.append('MaxQtyPerOrder', addOn.maxQtyPerOrder.toString());
      if (addOn.isActive !== undefined) queryParams.append('IsActive', addOn.isActive.toString());

      const url = `${API_BASE_URL}/add-ons/${id}?${queryParams.toString()}`;
      const formData = new FormData();
      if (imageFile) {
        formData.append('ImageUrl', imageFile);
      }

      const response = await fetchWithAuth(url, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
        },
        body: formData,
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
      const response = await fetchWithAuth(`${API_BASE_URL}/add-ons/${id}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
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
