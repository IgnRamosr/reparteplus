import axios, {
  AxiosError,
  AxiosHeaders,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { authSession } from "./auth";

export type ApiError = { status: number; message: string };

const REGISTER_URL = (process.env.EXPO_PUBLIC_REGISTER_URL || "").trim();
const LOGIN_URL = (process.env.EXPO_PUBLIC_LOGIN_URL || "").trim();
const FORGOT_URL = (process.env.EXPO_PUBLIC_FORGOT_URL || "").trim();
const API_KEY = (process.env.EXPO_PUBLIC_API_KEY || "").trim();

export const http = axios.create({
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
  validateStatus: () => true,
});

// Agrega API key si existe
if (API_KEY) http.defaults.headers.common["x-api-key"] = API_KEY;

// Rutas públicas donde NO queremos adjuntar el Bearer de Cognito
const PUBLIC_URLS = [REGISTER_URL, LOGIN_URL, FORGOT_URL].filter(Boolean) as string[];

// Adjunta Bearer de Cognito solo si NO es una ruta pública
http.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const isPublic = PUBLIC_URLS.some(
        (u) => u && config.url?.startsWith(u)
      );
      if (!isPublic) {
        const { accessToken } = await authSession();
        if (accessToken) {
          if (!config.headers) config.headers = {} as any;

          if (
            config.headers instanceof AxiosHeaders ||
            typeof (config.headers as any).set === "function"
          ) {
            (config.headers as any).set(
              "Authorization",
              `Bearer ${accessToken}`
            );
          } else {
            config.headers = {
              ...(config.headers as any ?? {}),
              Authorization: `Bearer ${accessToken}`,
            } as any;
          }
        }
      }
    } catch {
      // ignorar errores en el interceptor
    }
    return config;
  }
);

// Helpers
const ok = (s: number) => s >= 200 && s < 300;

function toApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err) && !err.response) {
    if ((err as any).code === "ECONNABORTED")
      return { status: 0, message: "Tiempo de espera agotado" };
    return { status: 0, message: "Error de red" };
  }
  const e = err as AxiosError<{ message?: string; error?: string }>;
  return {
    status: e.response?.status ?? 0,
    message:
      e.response?.data?.message ||
      e.response?.data?.error ||
      e.message ||
      "Error de red",
  };
}

const unwrap = <T = any>(res: AxiosResponse<T>): T => {
  if (ok(res.status)) return (res.data as T) ?? ({} as T);
  const msg =
    (typeof res.data === "string" && res.data) ||
    (res.data as any)?.message ||
    "Error de servidor";
  throw { status: res.status, message: msg } as ApiError;
};

// --- Payloads en español ---
function makeRegisterPayload(b: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  inviteToken?: string;
}) {
  return {
    nombre: b.name,
    email: b.email,
    telefono: b.phone ?? null,
    invitacion: b.inviteToken ?? null,
  };
}

function makeLoginPayload(b: { email: string; password: string }) {
  return {
    email: b.email,
  };
}

function makeForgotPayload(b: { email: string }) {
  return { email: b.email };
}

// --- API ---
export const api = {
  async register(body: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    inviteToken?: string;
  }) {
    try {
      if (!REGISTER_URL)
        throw { status: 0, message: "Falta EXPO_PUBLIC_REGISTER_URL" };
      const res = await http.post(REGISTER_URL, makeRegisterPayload(body));
      return unwrap(res);
    } catch (err) {
      throw toApiError(err);
    }
  },

  async login(body: { email: string; password: string }) {
    try {
      if (!LOGIN_URL)
        throw { status: 0, message: "Falta EXPO_PUBLIC_LOGIN_URL" };
      const res = await http.post(LOGIN_URL, makeLoginPayload(body));
      return unwrap(res);
    } catch (err) {
      throw toApiError(err);
    }
  },

  async forgot(body: { email: string }) {
    try {
      if (!FORGOT_URL)
        throw { status: 0, message: "Falta EXPO_PUBLIC_FORGOT_URL" };
      const res = await http.post(FORGOT_URL, makeForgotPayload(body));
      return unwrap(res);
    } catch (err) {
      throw toApiError(err);
    }
  },
};

export default http;
