const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002/api/v1';

export class ApiError extends Error {
  public status: number;
  public code?: string;
  public details?: any;

  constructor(message: string, status: number, code?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let token: string | null = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('medicore_access_token');
  }

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 && typeof window !== 'undefined') {
    // Attempt automatic refresh if refresh token is present
    const refreshToken = localStorage.getItem('medicore_refresh_token');
    if (refreshToken && !endpoint.includes('/auth/refresh') && !endpoint.includes('/auth/login')) {
      try {
        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          localStorage.setItem('medicore_access_token', refreshData.data.accessToken);
          localStorage.setItem('medicore_refresh_token', refreshData.data.refreshToken);

          // Retry the original request with new token
          headers.set('Authorization', `Bearer ${refreshData.data.accessToken}`);
          const retryRes = await fetch(url, { ...options, headers });
          if (retryRes.ok) {
            return (await retryRes.json()) as T;
          }
        }
      } catch (e) {
        // Fall through to error
      }
    }
  }

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = json?.error?.message || json?.message || `HTTP ${response.status} Error`;
    const errorCode = json?.error?.code;
    const errorDetails = json?.error?.details;
    throw new ApiError(errorMsg, response.status, errorCode, errorDetails);
  }

  return json as T;
}
