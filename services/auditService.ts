import { getAuthToken, fetchWithAuth } from './auth';

export interface AuditLogFilter {
  action?: string;
  entityType?: string;
  performedBy?: string;
  from?: string;
  to?: string;
}

export interface AuditLog {
  auditId: string;
  action: string;
  entityType: string;
  entityId: string;
  performedBy: string;
  performedRole: string;
  performedByName?: string;
  description: string;
  timestamp: string;
  oldValue: string | null;
  newValue: string | null;
  ipAddress?: string;
}

function unwrapResultArray(payload: any): any[] {
  if (payload && typeof payload === 'object') {
    const result = payload.result !== undefined ? payload.result : payload;
    
    if (Array.isArray(result)) return result;
    
    if (result && typeof result === 'object') {
      const items = result.items || result.data || result.records || result.results;
      if (Array.isArray(items)) return items;
    }
  }
  return [];
}

function normalizeAuditLog(item: any, index: number): AuditLog {
  const source = item && typeof item === 'object' ? item : {};
  
  const idValue = source.auditId || source.id || source.Id || `LOG-${index}`;
  const timestampValue = source.timestamp || source.createdAt || source.CreatedDate || source.time || new Date().toISOString();
  
  return {
    auditId: String(idValue),
    action: String(source.action || source.Action || ''),
    entityType: String(source.entityType || source.EntityType || ''),
    entityId: String(source.entityId || source.EntityId || ''),
    performedBy: String(source.performedBy || source.PerformedBy || source.userId || source.UserId || 'system'),
    performedRole: String(source.performedRole || source.PerformedRole || 'system'),
    performedByName: source.performedByName || source.PerformedByName || undefined,
    description: String(source.description || source.Description || ''),
    timestamp: timestampValue,
    oldValue: source.oldValue !== undefined ? source.oldValue : (source.OldValue !== undefined ? source.OldValue : null),
    newValue: source.newValue !== undefined ? source.newValue : (source.NewValue !== undefined ? source.NewValue : null),
    ipAddress: source.ipAddress || source.IpAddress || undefined
  };
}

export const auditService = {
  getAuditLogs: async (filter: AuditLogFilter = {}): Promise<AuditLog[]> => {
    const token = getAuthToken();
    const params = new URLSearchParams();
    
    // Default pagination to ensure data is returned
    params.append('PageNumber', '1');
    params.append('PageSize', '100');

    // PascalCase and camelCase for maximum compatibility
    if (filter.action) {
      params.append('Action', filter.action);
      params.append('action', filter.action);
    }
    if (filter.entityType) {
      params.append('EntityType', filter.entityType);
      params.append('entityType', filter.entityType);
    }
    if (filter.performedBy) {
      params.append('PerformedBy', filter.performedBy);
      params.append('performedBy', filter.performedBy);
    }
    if (filter.from) {
      params.append('From', filter.from);
      params.append('from', filter.from);
    }
    if (filter.to) {
      params.append('To', filter.to);
      params.append('to', filter.to);
    }

    const response = await fetchWithAuth(`/api/audit-logs?${params.toString()}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Không thể tải nhật ký hệ thống');
    const payload = await response.json();
    const items = unwrapResultArray(payload);
    return items.map((item, index) => normalizeAuditLog(item, index));
  },

  getAuditLogById: async (id: string): Promise<AuditLog> => {
    const token = getAuthToken();
    const response = await fetchWithAuth(`/api/audit-logs/${id}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Không thể tải chi tiết nhật ký');
    const payload = await response.json();
    const result = payload.result !== undefined ? payload.result : payload;
    return normalizeAuditLog(result, 0);
  }
};
