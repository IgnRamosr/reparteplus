// lib/amplify.ts
import { Amplify } from 'aws-amplify';
import '@aws-amplify/react-native'; // shims para React Native
import AsyncStorage from '@react-native-async-storage/async-storage';

const domain  = process.env.EXPO_PUBLIC_COGNITO_DOMAIN;
const signIn  = process.env.EXPO_PUBLIC_REDIRECT_SIGNIN;
const signOut = process.env.EXPO_PUBLIC_REDIRECT_SIGNOUT;

Amplify.configure({
  Auth: {
    // ⚠️ en v6, region va a nivel Auth (no dentro de Cognito)
    region: process.env.EXPO_PUBLIC_COGNITO_REGION!,
    storage: AsyncStorage,

    Cognito: {
      userPoolId:       process.env.EXPO_PUBLIC_USER_POOL_ID!,
      userPoolClientId: process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID!, // 👈 nombre correcto en v6
      loginWith: {
        email: true,
        username: false,
        phone: false, // usa "phone", NO "phoneNumber"
      },
    },

    // (Opcional) Hosted UI / OAuth, solo si tienes dominio
    ...(domain && signIn && signOut
      ? {
          oauth: {
            domain,
            scope: ['openid', 'email', 'profile'],
            redirectSignIn:  signIn,
            redirectSignOut: signOut,
            responseType: 'code',
          },
        }
      : {}),
  } as any, // <-- forzamos tipo para evitar la queja de TS
});

// Log útil mientras pruebas
console.log('[Amplify config]', {
  region:   process.env.EXPO_PUBLIC_COGNITO_REGION,
  poolId:   process.env.EXPO_PUBLIC_USER_POOL_ID,
  clientId: process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID,
});
