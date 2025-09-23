// Simulador de API para pruebas sin backend
export type ApiError = { status: number; message: string };

type UserRec = { email: string; password: string; phone?: string };
const memory = new Map<string, UserRec>();

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const mockApi = {
  /** Registro */
  async register(u: { email: string; password: string; phone?: string; inviteToken?: string }) {
    await wait(400);
    if (memory.has(u.email)) {
      throw { status: 409, message: 'El correo ya está registrado' } as ApiError;
    }
    memory.set(u.email, { email: u.email, password: u.password, phone: u.phone });
    return { ok: true, userId: 'mock_user_123' };
  },

  /** Login */
  async login({ email, password }: { email: string; password: string }) {
    await wait(300);
    const rec = memory.get(email);
    if (!rec || rec.password !== password) {
      throw { status: 401, message: 'Credenciales inválidas' } as ApiError;
    }
    return { token: 'mock-token', email };
  },


  // ...register, login ya existentes,
  async requestPasswordReset(email: string) {
    // Simula latencia
    await new Promise((r) => setTimeout(r, 500));
    // NUNCA indicamos si el correo existe o no.
    return { ok: true, message: 'Si el correo existe, enviaremos instrucciones.' };
  },
  async resetPassword(_token: string, _newPwd: string) {
    await new Promise((r) => setTimeout(r, 500));
    return { ok: true };
  },

};
