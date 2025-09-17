// lib/api.ts
import axios, { AxiosError, AxiosResponse } from 'axios';

export type ApiError = { status: number; message: string };

// URLs absolutas desde .env (sin comillas ni espacios)
const REGISTER_URL = (process.env.EXPO_PUBLIC_REGISTER_URL || '').trim();
const LOGIN_URL    = (process.env.EXPO_PUBLIC_LOGIN_URL || '').trim();
const FORGOT_URL   = (process.env.EXPO_PUBLIC_FORGOT_URL || '').trim();
const API_KEY      = (process.env.EXPO_PUBLIC_API_KEY || '').trim();

export const http = axios.create({
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  validateStatus: () => true, // no lanzar error automático en 4xx/5xx
});

if (API_KEY) http.defaults.headers.common['x-api-key'] = API_KEY;

const ok = (s: number) => s >= 200 && s < 300;

function toApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err) && !err.response) {
    if ((err as any).code === 'ECONNABORTED') return { status: 0, message: 'Tiempo de espera agotado' };
    return { status: 0, message: 'Error de red' };
  }
  const e = err as AxiosError<{ message?: string; error?: string }>;
  return {
    status: e.response?.status ?? 0,
    message: e.response?.data?.message || e.response?.data?.error || e.message || 'Error de red',
  };
}

const unwrap = <T = any>(res: AxiosResponse<T>): T => {
  if (ok(res.status)) return (res.data as T) ?? ({} as T);
  const msg =
    (typeof res.data === 'string' && res.data) ||
    (res.data as any)?.message ||
    'Error de servidor';
  throw { status: res.status, message: msg } as ApiError;
};

// Tipos de respuesta (ajústalos si tu backend devuelve otra cosa)
export type RegisterResponse = { userId?: string; token?: string | null; message?: string };
export type LoginResponse    = { token?: string | null; user?: any; message?: string };
export type ForgotResponse   = { ok?: boolean; message?: string };

// ---------- Payloads EN ESPAÑOL (según tu DB) ----------
/** Registro: { nombre, email, telefono, contraseña } (+ opcional inviteToken si aplica en tu API) */
function makeRegisterPayload(b: {
  name: string; email: string; password: string; phone?: string; inviteToken?: string;
}) {
  return {
    nombre: b.name,
    email: b.email,
    telefono: b.phone ?? null,
    'contrasena': b.password,     
    // incluye si tu backend realmente lo usa:
    invitacion: b.inviteToken ?? null,
  };
}

/** Login: { email, contraseña } */
function makeLoginPayload(b: { email: string; password: string }) {
  return {
    email: b.email,
    'contrasena': b.password,     
  };
}

/** Forgot: { email } */
function makeForgotPayload(b: { email: string }) {
  return { email: b.email };
}

// ---------- API usando URLs absolutas ----------
export const api = {
  async register(body: {
    name: string; email: string; password: string; phone?: string; inviteToken?: string;
  }): Promise<RegisterResponse> {
    try {
      if (!REGISTER_URL) throw { status: 0, message: 'Falta EXPO_PUBLIC_REGISTER_URL' };
      const res = await http.post<RegisterResponse>(REGISTER_URL, makeRegisterPayload(body));
      return unwrap(res);
    } catch (err) { throw toApiError(err); }
  },

  async login(body: { email: string; password: string }): Promise<LoginResponse> {
    try {
      if (!LOGIN_URL) throw { status: 0, message: 'Falta EXPO_PUBLIC_LOGIN_URL' };
      const res = await http.post<LoginResponse>(LOGIN_URL, makeLoginPayload(body));
      return unwrap(res);
    } catch (err) { throw toApiError(err); }
  },

  async forgot(body: { email: string }): Promise<ForgotResponse> {
    try {
      if (!FORGOT_URL) throw { status: 0, message: 'Falta EXPO_PUBLIC_FORGOT_URL' };
      const res = await http.post<ForgotResponse>(FORGOT_URL, makeForgotPayload(body));
      return unwrap(res);
    } catch (err) { throw toApiError(err); }
  },
};

export default http;