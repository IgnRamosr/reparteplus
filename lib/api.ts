// lib/api.ts
export type ApiError = {
  status: number;
  message: string;
};

const BASE_URL =
  (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '') || 'http://localhost:3333';

function toApiError(status: number, message?: string): ApiError {
  return { status, message: message || 'Error de red' };
}

async function request<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = 15000, ...init } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
      signal: controller.signal,
      ...init,
    });

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json().catch(() => ({})) : null;

    if (!res.ok) {
      const msg = (data && (data.message || data.error)) || res.statusText;
      throw toApiError(res.status, msg);
    }

    return (data as T) ?? ({} as T);
  } catch (err: any) {
    if (err.name === 'AbortError') throw toApiError(408, 'Tiempo de espera agotado');
    if (err.status && err.message) throw err as ApiError;
    throw toApiError(0, err?.message || 'Fallo de red');
  } finally {
    clearTimeout(id);
  }
}

export const api = {
  async register(body: {
    email: string;
    password: string;
    phone?: string;
    inviteToken?: string;
  }): Promise<{ userId?: string }> {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};
