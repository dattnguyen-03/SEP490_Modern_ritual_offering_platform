import { ApiResponse, fetchWithAuth } from './auth';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '' 
  : 'https://vietritual.click';

export interface CreateUserRequest {
  email: string;
  password?: string;
  fullName: string;
  phoneNumber: string;
  role: string;
}

export interface UserListItem {
  userId: string;
  email: string;
  fullName: string | null;
  phoneNumber: string | null;
  roles: string[];
  status: string;
  profileId?: string;
  avatarUrl?: string | null;
  createdAt?: string;
  emailConfirmed?: boolean;
  orderBlockedUntil?: string | null;
  canceledOrdersCount?: number;
}

export const userService = {
  /**
   * Create a new Admin or Staff user
   * POST /api/users
   */
  createUser: async (userData: CreateUserRequest): Promise<void> => {
    const token = localStorage.getItem('smart-child-token');
    if (!token) throw new Error('No authentication token found');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.errorMessages && errorData.errorMessages.length > 0) {
          errorMessage = errorData.errorMessages.join(', ');
        }
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data: ApiResponse<any> = await response.json();
    if (!data.isSuccess) {
      throw new Error(data.errorMessages?.join(', ') || 'Failed to create user');
    }
  },

  /**
   * Get all users (Admin view) with filtering
   * GET /api/users?role=...&status=...
   */
  getAllUsers: async (role?: string, status?: string): Promise<UserListItem[]> => {
    const token = localStorage.getItem('smart-child-token');
    if (!token) throw new Error('No authentication token found');

    const queryParams = new URLSearchParams();
    if (role) queryParams.append('role', role);
    if (status) queryParams.append('status', status);

    const queryString = queryParams.toString();
    const url = `${API_BASE_URL}/api/users${queryString ? `?${queryString}` : ''}`;

    const response = await fetchWithAuth(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.status}`);
    }

    const data: ApiResponse<UserListItem[]> = await response.json();
    if (!data.isSuccess) {
      throw new Error(data.errorMessages?.join(', ') || 'Failed to fetch users');
    }

    return data.result;
  },

  /**
   * Get user detail by ID
   * GET /api/users/{userId}
   */
  getUserById: async (userId: string): Promise<UserListItem> => {
    const token = localStorage.getItem('smart-child-token');
    if (!token) throw new Error('No authentication token found');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/users/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user details: ${response.status}`);
    }

    const data: ApiResponse<UserListItem> = await response.json();
    if (!data.isSuccess) {
      throw new Error(data.errorMessages?.join(', ') || 'Failed to fetch user details');
    }

    return data.result;
  },

  /**
   * Update user status
   * PUT /api/users/{userId}/status
   */
  updateUserStatus: async (userId: string, status: 'Active' | 'Banned', reason?: string): Promise<boolean> => {
    const token = localStorage.getItem('smart-child-token');
    if (!token) throw new Error('No authentication token found');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/users/${userId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
      },
      body: JSON.stringify({ status, reason }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update user status: ${response.status}`);
    }

    const data: ApiResponse<unknown> = await response.json();
    return data.isSuccess;
  }
};
