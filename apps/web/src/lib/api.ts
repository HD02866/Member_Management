export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  message?: string;
  statusCode?: number;
}

export class ApiError extends Error {
  statusCode: number;
  data?: any;

  constructor(message: string, statusCode: number = 500, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api/v1';

// Secure in-memory token holder (never persisted in localStorage/sessionStorage)
let inMemoryAccessToken: string | null = null;

export class ApiClient {
  public static getAccessToken(): string | null {
    return inMemoryAccessToken;
  }

  public static setAccessToken(token: string | null) {
    inMemoryAccessToken = token;
    if (typeof document !== 'undefined') {
      if (token) {
        document.cookie = `access_token=${token}; path=/; SameSite=Lax`;
      } else {
        document.cookie = `access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      }
    }
  }

  public static getActiveTenantId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('active_tenant_id');
  }

  public static setActiveTenantId(tenantId: string | null) {
    if (typeof window === 'undefined') return;
    if (tenantId) {
      localStorage.setItem('active_tenant_id', tenantId);
    } else {
      localStorage.removeItem('active_tenant_id');
    }
  }

  public static async request<T = any>(
    endpoint: string,
    options: RequestInit & { tenantId?: string; tenantSlug?: string } = {},
  ): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = this.getAccessToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Tenant Context Headers
    const activeTenantId = options.tenantId || this.getActiveTenantId();
    if (activeTenantId && !headers['x-tenant-id'] && !headers['x-organization-id']) {
      headers['x-tenant-id'] = activeTenantId;
      headers['x-organization-id'] = activeTenantId;
    }

    const tenantSlug = options.tenantSlug || (!activeTenantId ? '4b' : undefined);
    if (tenantSlug && !headers['x-tenant-id']) {
      headers['x-tenant-slug'] = tenantSlug;
      headers['x-organization-slug'] = tenantSlug;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Includes HTTP-only cookies
      });
    } catch (err: any) {
      const isNetworkError =
        err?.name === 'TypeError' ||
        err?.message?.includes('fetch failed') ||
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('NetworkError');
      if (isNetworkError) {
        throw new ApiError(
          'Unable to reach the server. Please check your internet connection and verify the server is running.',
          0,
          err,
        );
      }
      throw err;
    }

    let json: any = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        json = await response.json();
      } catch {
        json = null;
      }
    }

    if (!response.ok) {
      let message = 'An error occurred';
      if (json) {
        if (typeof json.message === 'string') {
          message = json.message;
        } else if (Array.isArray(json.message)) {
          message = json.message.join(', ');
        } else if (json.error) {
          message = json.error;
        }
      } else {
        message = response.statusText || `Request failed with status ${response.status}`;
      }

      throw new ApiError(message, response.status, json);
    }

    // Unwrap standard envelope if present: { success: true, data: ... }
    if (json && typeof json === 'object' && 'data' in json && 'success' in json) {
      return json.data as T;
    }

    return (json ?? {}) as T;
  }

  public static get<T = any>(
    endpoint: string,
    options?: RequestInit & { tenantId?: string; tenantSlug?: string },
  ) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public static post<T = any>(
    endpoint: string,
    body?: any,
    options?: RequestInit & { tenantId?: string; tenantSlug?: string },
  ) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public static patch<T = any>(
    endpoint: string,
    body?: any,
    options?: RequestInit & { tenantId?: string; tenantSlug?: string },
  ) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public static delete<T = any>(
    endpoint: string,
    arg2?: any,
    arg3?: RequestInit & { tenantId?: string; tenantSlug?: string },
  ) {
    // Check if arg2 is RequestInit options object (has tenantId, tenantSlug, headers, etc. but not typical request payload)
    const isOptions =
      arg2 &&
      typeof arg2 === 'object' &&
      !arg3 &&
      ('tenantId' in arg2 || 'tenantSlug' in arg2 || 'headers' in arg2 || 'signal' in arg2);

    const options = isOptions ? arg2 : arg3;
    const body = isOptions ? undefined : arg2;

    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public static async uploadFile<T = any>(
    file: File,
    options?: { tenantId?: string; tenantSlug?: string; purpose?: string },
  ): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.purpose) {
      formData.append('purpose', options.purpose);
    }

    const token = this.getAccessToken();
    const activeTenantId = options?.tenantId || this.getActiveTenantId();
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (activeTenantId) {
      headers['x-tenant-id'] = activeTenantId;
      headers['x-organization-id'] = activeTenantId;
    }

    const response = await fetch(`${API_BASE_URL}/uploads`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      let message = 'Upload failed';
      try {
        const json = await response.json();
        message = json.message || json.error || message;
      } catch {}
      throw new ApiError(message, response.status);
    }

    const json = await response.json();
    if (json && typeof json === 'object' && 'data' in json && 'success' in json) {
      return json.data as T;
    }
    return json as T;
  }
}
