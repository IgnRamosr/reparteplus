// lib/auth.ts
import {
  signUp,
  confirmSignUp,
  resendSignUpCode,
  signIn,
  signOut,
  resetPassword,
  confirmResetPassword,
  fetchAuthSession,
  getCurrentUser,
} from 'aws-amplify/auth';

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
const normEmail = (e: string) => e.trim().toLowerCase();
const normPwd   = (p: string) => p.trim();

async function waitSession(force = false) {
  // algunos entornos tardan un tick en exponer tokens tras signIn
  // hacemos una lectura y, si no hay token, reintentamos brevemente
  const read = async () => (await fetchAuthSession({ forceRefresh: force })) as any;
  let s = await read();
  if (!s?.tokens?.accessToken) {
    await new Promise(r => setTimeout(r, 150));
    s = await read();
  }
  return {
    idToken:      s?.tokens?.idToken?.toString?.() ?? null,
    accessToken:  s?.tokens?.accessToken?.toString?.() ?? null,
    refreshToken: s?.tokens?.refreshToken?.toString?.() ?? null,
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Registro / Confirmación
export async function authSignUp(email: string, password: string) {
  email = normEmail(email);
  password = normPwd(password);
  await signUp({
    username: email,
    password,
    options: { userAttributes: { email } },
  });
}

export async function authConfirm(email: string, code: string) {
  await confirmSignUp({ username: normEmail(email), confirmationCode: code.trim() });
}

export async function authResend(email: string) {
  await resendSignUpCode({ username: normEmail(email) });
}

// ───────────────────────────────────────────────────────────────────────────────
// Login
export async function authSignIn(email: string, password: string) {
  email = normEmail(email);
  password = normPwd(password);

  try {
    console.log('[signIn attempt]', email);
    const res = await signIn({ username: email, password });
    // Espera/obtiene tokens para que el interceptor tenga el Bearer
    await waitSession();
    console.log('[signIn success]');
    return res;
  } catch (e: any) {
    const name = e?.name || '';
    const msg  = e?.message || '';

    console.error('[signIn error raw]', name, msg);

    // Ya confirmado en UI
    if (name === 'UserNotConfirmedException') throw e;

    // Password incorrecto / política / throttle
    if (name === 'NotAuthorizedException' || name === 'Unknown') {
      throw new Error('Correo o contraseña incorrectos.');
    }
    if (name === 'PasswordResetRequiredException') {
      throw new Error('Debes restablecer tu contraseña para continuar.');
    }
    if (name === 'TooManyFailedAttemptsException' || name === 'TooManyRequestsException') {
      throw new Error('Demasiados intentos. Intenta nuevamente en unos minutos.');
    }
    if (name === 'UserNotFoundException') {
      throw new Error('Usuario no encontrado.');
    }
    if (name === 'UserLambdaValidationException') {
      // por si tienes triggers de pre/post login que rechazan
      throw new Error(msg || 'No se pudo iniciar sesión (política del servidor).');
    }

    // fallback genérico
    throw new Error(msg || 'No se pudo iniciar sesión.');
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Recuperación de contraseña
export async function authForgot(email: string) {
  await resetPassword({ username: normEmail(email) });
}

export async function authReset(email: string, code: string, newPwd: string) {
  await confirmResetPassword({
    username: normEmail(email),
    confirmationCode: code.trim(),
    newPassword: normPwd(newPwd),
  });
}

// ───────────────────────────────────────────────────────────────────────────────
// Cierre de sesión
export async function authSignOut() {
  await signOut();
}

// ───────────────────────────────────────────────────────────────────────────────
// Sesión / Usuario actual
export async function authSession() {
  return await waitSession(); // reutilizamos el helper
}

export async function currentUser() {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}
