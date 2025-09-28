// lib/amplify.ts
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import { Amplify} from 'aws-amplify';

// lee envs una vez
const region          = process.env.EXPO_PUBLIC_COGNITO_REGION!;
const userPoolId      = process.env.EXPO_PUBLIC_USER_POOL_ID!;
const userPoolClientId= process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID!;
const domain          = process.env.EXPO_PUBLIC_COGNITO_DOMAIN;
const redirectSignIn  = process.env.EXPO_PUBLIC_REDIRECT_SIGNIN;
const redirectSignOut = process.env.EXPO_PUBLIC_REDIRECT_SIGNOUT;

Amplify.configure({
  Auth: {
    region,
    Cognito: {
      userPoolId,
      userPoolClientId,
      loginWith: { email: true, username: false, phone: false },
    },

    // agrega oauth SOLO si están las tres vars; siempre expandimos un objeto
    ...(domain && redirectSignIn && redirectSignOut
      ? {
          oauth: {
            domain,
            redirectSignIn,
            redirectSignOut,
            responseType: 'code',
          },
        }
      : {}),
  } as any,
});

// Log útil mientras pruebas
// console.log('[Amplify config]', {
//   region,
//   poolId: userPoolId,
//   clientId: userPoolClientId,
//   hasOauth: !!(domain && redirectSignIn && redirectSignOut),
// });