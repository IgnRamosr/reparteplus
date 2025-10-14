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


// Helpers
const normEmail = (e: string) => e.trim().toLowerCase();
const normPwd   = (p: string) => p.trim();

const mask = (t?: string | null) =>
  !t ? null : `${t.slice(0, 12)}… (${t.length} chars)`;

// ───────────────────────────────────────────────────────────────────────────────
// Sesión: lee tokens (con un pequeño retry) y retorna strings
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
//  obtener el sub de Cognito (userId en v6) con fallbacks
export async function getCognitoSub(): Promise<string | null> {
  // 1) Fuente principal: getCurrentUser().userId
  try {
    const u = await getCurrentUser() as any;
    if (u?.userId) {
      // console.log('[cognito currentUser]', {
      //   username: u.username,
      //   userId: u.userId, // == sub
      //   signInDetails: u.signInDetails ?? null,
      // });
      return String(u.userId);
    }
  } catch {}

  // 2) Fallback: fetchAuthSession().userSub (expuesto por Amplify v6)
  try {
    const s = await fetchAuthSession() as any;
    if (s?.userSub) {
      // console.log('[cognito session]',
      //   {
      //   userSub: s.userSub,
      //   hasTokens: !!s?.tokens,
      //   identityId: s.identityId ?? null,
      //   credentials: !!s.credentials,
      // });
      return String(s.userSub);
    }
  } catch {}

  // 3) Último recurso: decodificar ID token 
  try {
    const s = await fetchAuthSession() as any;
    const jwt: string | undefined = s?.tokens?.idToken?.toString?.();
    if (jwt) {
      const [, payloadB64] = jwt.split('.');
      const json = JSON.parse(globalThis.atob ? globalThis.atob(payloadB64) : Buffer.from(payloadB64, 'base64').toString('utf8'));
      if (json?.sub) {
        // console.log('[cognito idToken payload]', { sub: json.sub, aud: json.aud, iss: json.iss });
        return String(json.sub);
      }
    }
  } catch {}

  return null;
}

// NUEVO: imprime estado completo (sin exponer tokens completos)
// export async function debugCognitoState(): Promise<void> {
//   try {
//     const u = await getCurrentUser().catch(() => null as any);
//     const s = await fetchAuthSession().catch(() => null as any);

//     console.log('[cognito debug]', {
//       currentUser: u
//         ? { username: u.username, userId: (u as any).userId ?? null, signInDetails: u.signInDetails ?? null }
//         : null,
//       session: s
//         ? {
//             userSub: (s as any).userSub ?? null,
//             identityId: (s as any).identityId ?? null,
//             hasCredentials: !!(s as any).credentials,
//             tokens: {
//               idToken: mask(s?.tokens?.idToken?.toString?.()),
//               accessToken: mask(s?.tokens?.accessToken?.toString?.()),
//               refreshToken: mask(s?.tokens?.refreshToken?.toString?.()),
//             },
//           }
//         : null,
//     });
//   } catch (e) {
//     console.log('[cognito debug error]', e);
//   }
// }

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

  // Si ya hay sesión del mismo usuario, tratamos como éxito y no reintentamos
  try {
    const current = await getSignedInUsernameLower();
    if (current && current === email) {
      // Log de estado actual
      // await debugCognitoState();
      const sub = await getCognitoSub();
      // console.log('[signIn skip — already signed] sub:', sub);
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
      options: { authFlowType: 'USER_PASSWORD_AUTH' },
      // options: { authFlowType: 'USER_SRP_AUTH' },
    });

    // asegura tokens disponibles y muestra estado
    const tokens = await waitSession();
    // console.log('[tokens ready]', {
    //   idToken: mask(tokens.idToken),
    //   accessToken: mask(tokens.accessToken),
    //   refreshToken: mask(tokens.refreshToken),
    // });

    const sub = await getCognitoSub();
    // console.log('[signIn success] sub:', sub, 'nextStep:', res?.nextStep);

    return res;
  } catch (e: any) {
    if (e?.name === 'UserAlreadyAuthenticatedException') {
      const sub = await getCognitoSub();
      // console.log('[signIn already-authenticated] sub:', sub);
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
    if (name === 'UsernameExistsException') {
      throw new Error('El usuario ya existe. Intenta iniciar sesión o usa otro correo.');
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
