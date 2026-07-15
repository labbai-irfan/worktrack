import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth';
import type { ApiEnvelope } from '@/types';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api/v1';

/** Single centralized API client. Attaches the access token and transparently
 *  refreshes it once on 401 before retrying the original request. */
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // refresh token travels in an httpOnly cookie
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await axios.post<ApiEnvelope<{ accessToken: string; user: unknown; organization: unknown; permissions: string[]; roleKey: string }>>(
      `${API_BASE_URL}/auth/refresh`,
      {},
      { withCredentials: true }
    );
    const { accessToken, user, organization, permissions, roleKey } = res.data.data;
    useAuthStore.getState().setSession({
      accessToken,
      user: user as never,
      organization: organization as never,
      permissions,
      roleKey,
    });
    return accessToken;
  } catch {
    useAuthStore.getState().clearSession();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;
    const isAuthRoute = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh') || original?.url?.includes('/auth/register');
    if (status === 401 && original && !original._retried && !isAuthRoute && useAuthStore.getState().accessToken) {
      original._retried = true;
      refreshPromise = refreshPromise ?? refreshAccessToken();
      const token = await refreshPromise;
      refreshPromise = null;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

export interface ApiErrorBody {
  success: false;
  message: string;
  code: string;
  errors: { field: string; message: string }[];
}

export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as ApiErrorBody | undefined;
    if (body?.errors?.length) return body.errors.map((e) => e.message).join(' ');
    if (body?.message) return body.message;
    if (err.code === 'ERR_NETWORK') return 'Cannot reach the server. Check that the backend is running.';
  }
  return 'Something went wrong. Please try again.';
}

/** Unwraps the standard { success, data, meta } envelope. */
export async function get<T>(url: string, params?: Record<string, unknown>): Promise<ApiEnvelope<T>> {
  const res = await api.get<ApiEnvelope<T>>(url, { params });
  return res.data;
}
export async function post<T>(url: string, body?: unknown): Promise<ApiEnvelope<T>> {
  const res = await api.post<ApiEnvelope<T>>(url, body);
  return res.data;
}
export async function patch<T>(url: string, body?: unknown): Promise<ApiEnvelope<T>> {
  const res = await api.patch<ApiEnvelope<T>>(url, body);
  return res.data;
}
export async function put<T>(url: string, body?: unknown): Promise<ApiEnvelope<T>> {
  const res = await api.put<ApiEnvelope<T>>(url, body);
  return res.data;
}
export async function del<T>(url: string): Promise<ApiEnvelope<T>> {
  const res = await api.delete<ApiEnvelope<T>>(url);
  return res.data;
}
