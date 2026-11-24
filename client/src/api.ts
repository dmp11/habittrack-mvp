import type {
  AuthResponse,
  Habit,
  HabitInput,
  PublicConfig,
  RecordItem,
  Stats,
  User,
} from './types';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || '/api';

let accessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Array<{ path: string; message: string }>;

  constructor(status: number, code: string, message: string, details?: Array<{ path: string; message: string }>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler;
}

function buildHeaders(init: RequestInit, useAuth: boolean): Headers {
  const headers = new Headers(init.headers);
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (useAuth && accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return headers;
}

async function readError(response: Response): Promise<ApiError> {
  try {
    const payload = await response.json();
    const error = payload?.error || {};
    return new ApiError(response.status, error.code || 'ERROR', error.message || 'Ошибка запроса', error.details);
  } catch {
    return new ApiError(response.status, 'ERROR', `Ошибка запроса (${response.status})`);
  }
}

export async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  })
    .then(async (response) => {
      if (!response.ok) return false;
      const data = (await response.json()) as AuthResponse;
      setAccessToken(data.accessToken);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

async function request<T>(path: string, init: RequestInit = {}, options: { auth?: boolean; retry?: boolean } = {}): Promise<T> {
  const useAuth = options.auth !== false;
  const retry = options.retry !== false;
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: buildHeaders(init, useAuth),
  });

  if (response.status === 401 && retry && useAuth && !path.startsWith('/auth/')) {
    if (await refreshSession()) return request<T>(path, init, { ...options, retry: false });
    unauthorizedHandler?.();
  }

  if (!response.ok) throw await readError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const post = <T>(path: string, body?: unknown, options = {}) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }, options);

export const api = {
  register: (data: { email: string; password: string; name?: string; timezone?: string }) =>
    post<AuthResponse>('/auth/register', data, { auth: false }).then((result) => {
      setAccessToken(result.accessToken);
      return result;
    }),
  login: (data: { email: string; password: string }) =>
    post<AuthResponse>('/auth/login', data, { auth: false }).then((result) => {
      setAccessToken(result.accessToken);
      return result;
    }),
  logout: async () => {
    try {
      await post('/auth/logout', undefined, { auth: false });
    } finally {
      setAccessToken(null);
    }
  },
  forgotPassword: (email: string) => post<{ ok: boolean; message?: string; devToken?: string; devUrl?: string }>('/auth/forgot-password', { email }, { auth: false }),
  resetPassword: (token: string, password: string) => post<{ ok: boolean }>('/auth/reset-password', { token, password }, { auth: false }),
  getMe: () => request<{ user: User }>('/auth/me'),
  updateMe: (data: { name?: string; timezone?: string }) => request<{ user: User }>('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),

  listHabits: () => request<{ habits: Habit[] }>('/habits'),
  createHabit: (data: HabitInput) => post<{ habit: Habit }>('/habits', data),
  updateHabit: (id: string, data: Partial<HabitInput>) => request<{ habit: Habit }>(`/habits/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteHabit: (id: string) => request<{ ok: boolean }>(`/habits/${id}`, { method: 'DELETE' }),

  listRecords: (from?: string, to?: string) => {
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    const suffix = query.toString() ? `?${query}` : '';
    return request<{ records: RecordItem[]; today: string }>(`/records${suffix}`);
  },
  saveRecord: (data: { habitId: string; date: string; value: number }) => post<{ record: RecordItem }>('/records', data),

  getStats: (days: 7 | 30 = 30, period: 'week' | 'month' = 'week') =>
    request<Stats>(`/stats?days=${days}&period=${period}`),

  getConfig: () => request<PublicConfig>('/config', {}, { auth: false }),
  subscribePush: (subscription: PushSubscriptionJSON) => post<{ ok: boolean }>('/push/subscribe', subscription),
  unsubscribePush: (endpoint: string) => request<{ ok: boolean }>('/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
};

export async function downloadStatsCsv(): Promise<void> {
  const load = () =>
    fetch(`${API_BASE}/stats/export`, {
      credentials: 'include',
      headers: buildHeaders({}, true),
    });

  let response = await load();
  if (response.status === 401 && (await refreshSession())) response = await load();
  if (!response.ok) throw await readError(response);

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `habittrack-stats-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.details?.length) return error.details.map((item) => item.message).join('; ');
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Не удалось выполнить действие';
}
