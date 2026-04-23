import { getAuthToken, fetchWithAuth } from './auth';

const API_BASE_URL = '/api';

export interface NotificationItem {
  notificationId: string | number;
  title: string;
  message: string;
  type: string;
  target: string;
  redirectUrl?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResult {
  items: NotificationItem[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

interface NotificationApiItem {
  notificationId?: string | number;
  title?: string;
  message?: string;
  type?: string;
  target?: string;
  redirectUrl?: string;
  isRead?: boolean;
  createdAt?: string;
  // Backend hiện đang dùng createAt (thiếu d)
  createAt?: string;
}

interface NotificationListApiResponse {
  items?: NotificationApiItem[];
  totalCount?: number;
  currentPage?: number;
  pageSize?: number;
}

interface ApiEnvelope<T> {
  statusCode?: string;
  isSuccess?: boolean;
  isSucceeded?: boolean;
  result?: T;
  errorMessages?: string[];
}

function normalizeNotificationItem(raw: NotificationApiItem): NotificationItem {
  return {
    notificationId: raw.notificationId ?? '',
    title: raw.title ?? 'Thông báo',
    message: raw.message ?? '',
    type: raw.type ?? 'system',
    target: raw.target ?? '',
    redirectUrl: raw.redirectUrl ?? null,
    isRead: Boolean(raw.isRead),
    createdAt: raw.createdAt ?? (raw as any).createAt ?? '',
  };
}

function normalizeNotificationList(raw: NotificationListApiResponse | undefined): NotificationListResult {
  const items = (raw?.items ?? []).map(normalizeNotificationItem);
  return {
    items,
    totalCount: raw?.totalCount ?? items.length,
    currentPage: raw?.currentPage ?? 1,
    pageSize: raw?.pageSize ?? (items.length || 20),
  };
}

export async function fetchNotifications(pageNumber = 1, pageSize = 20): Promise<NotificationListResult> {
  const token = getAuthToken();
  if (!token) {
    return { items: [], totalCount: 0, currentPage: pageNumber, pageSize };
  }

  const url = `${API_BASE_URL}/notifications?pageNumber=${pageNumber}&pageSize=${pageSize}`;

  const response = await fetchWithAuth(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });

  const text = await response.text();

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const errorData = JSON.parse(text) as ApiEnvelope<unknown>;
      if (errorData.errorMessages && errorData.errorMessages.length > 0) {
        message = errorData.errorMessages.join(', ');
      }
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }

  let data: ApiEnvelope<NotificationListApiResponse>;
  try {
    data = JSON.parse(text) as ApiEnvelope<NotificationListApiResponse>;
  } catch {
    // If backend returns list directly without envelope
    const rawList = JSON.parse(text) as NotificationListApiResponse;
    return normalizeNotificationList(rawList);
  }

  const isSuccess = data.isSuccess ?? data.isSucceeded ?? false;
  if (!isSuccess) {
    const message = data.errorMessages && data.errorMessages.length > 0
      ? data.errorMessages.join(', ')
      : 'Không thể tải danh sách thông báo';
    throw new Error(message);
  }

  return normalizeNotificationList(data.result);
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const token = getAuthToken();
  if (!token) return 0;

  const url = `${API_BASE_URL}/notifications/unread-count`;

  const response = await fetchWithAuth(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  const text = await response.text();

  if (!response.ok) {
    // Nếu server 500 hoặc lỗi, chỉ log và trả về 0 để không làm hỏng UI
    console.error('Failed to fetch unread notification count:', response.status, text);
    return 0;
  }

  try {
    const raw = JSON.parse(text) as
      | ApiEnvelope<number | { unreadCount?: number }>
      | { unreadCount?: number }
      | number;

    // Trường hợp backend trả trực tiếp số
    if (typeof raw === 'number') {
      return raw;
    }

    // Trường hợp có field unreadCount ở root
    if (typeof (raw as { unreadCount?: number }).unreadCount === 'number') {
      return (raw as { unreadCount: number }).unreadCount;
    }

    // Trường hợp bọc trong envelope
    const envelope = raw as ApiEnvelope<number | { unreadCount?: number }>;
    const result = envelope.result;

    if (typeof result === 'number') {
      return result;
    }

    if (result && typeof result === 'object' && typeof (result as { unreadCount?: number }).unreadCount === 'number') {
      return (result as { unreadCount: number }).unreadCount;
    }

    return 0;
  } catch (error) {
    console.error('Error parsing unread notification count response:', error, text);
    return 0;
  }
}

export async function markNotificationAsRead(notificationId: string | number): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;

  const url = `${API_BASE_URL}/notifications/${notificationId}/read`;

  try {
    const response = await fetchWithAuth(url, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Failed to mark notification as read:', response.status, text);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error calling markNotificationAsRead:', error);
    return false;
  }
}

export async function markAllNotificationsAsReadApi(): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;

  const url = `${API_BASE_URL}/notifications/read-all`;

  try {
    const response = await fetchWithAuth(url, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Failed to mark all notifications as read:', response.status, text);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error calling markAllNotificationsAsReadApi:', error);
    return false;
  }
}
