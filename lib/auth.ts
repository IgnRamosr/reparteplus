// lib/auth.ts
import {
  confirmResetPassword,
  confirmSignUp,
  fetchAuthSession,
  getCurrentUser,
  resendSignUpCode,
  resetPassword,
  signIn,
  signOut,
  signUp,
} from 'aws-amplify/auth';

// ───────────────────────────────────────────────────────────────────────────────


// ───────────────────────────────────────────────────────────────────────────────
// Helpers
const normEmail = (e: string) => e.trim().toLowerCase();
const normPwd   = (p: string) => p.trim();

async function waitSession(force = false) {
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

async function getSignedInUsernameLower(): Promise<string | null> {
  try {
    const s = await fetchAuthSession();
    const has = !!s?.tokens?.accessToken;
    if (!has) return null;
    const u = await getCurrentUser().catch(() => null as any);
    return u?.username ? String(u.username).toLowerCase() : null;
  } catch {
    return null;
  }
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
// Login (idempotente y forzando USER_PASSWORD_AUTH)
export async function authSignIn(email: string, password: string) {
  email = normEmail(email);
  password = normPwd(password);

  // ✅ Si ya hay sesión del mismo usuario, tratamos como éxito y no reintentamos
  try {
    const current = await getSignedInUsernameLower();
    if (current && current === email) {
      return { nextStep: { signInStep: 'DONE' } } as any;
    }
    // Si hay sesión de otro usuario, cerramos para evitar choque
    if (current && current !== email) {
      await signOut();
    }
  } catch {
    // no-op
  }

  try {
    console.log('[signIn attempt]', email);

    const res = await signIn({
      username: email,
      password,
      options: { authFlowType: 'USER_PASSWORD_AUTH' }, // ← forzar PASSWORD
      // options: { authFlowType: 'USER_SRP_AUTH' },   // (alternativa si quieres probar SRP)
    });

    await waitSession(); // asegura tokens disponibles
    console.log('[signIn success]', res?.nextStep);
    return res;
  } catch (e: any) {
    // Si Amplify devolvió que ya hay sesión, lo tratamos como éxito
    if (e?.name === 'UserAlreadyAuthenticatedException') {
      return { nextStep: { signInStep: 'DONE' } } as any;
    }

    console.error('[signIn error]', {
      name: e?.name,
      message: e?.message,
      code: e?.code,
      causeName: e?.cause?.name,
      causeMsg: e?.cause?.message,
      http: e?.$metadata?.httpStatusCode,
    });

    const name = e?.name || '';
    const msg  = e?.message || '';

    if (name === 'UserNotConfirmedException') throw e;
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
      throw new Error(msg || 'No se pudo iniciar sesión (política del servidor).');
    }

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
  try {
    await signOut();
  } catch {}
}

// ───────────────────────────────────────────────────────────────────────────────
// Sesión / Usuario actual
export async function authSession() {
  return await waitSession();
}

export async function currentUser() {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}
