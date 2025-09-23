import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    region: process.env.EXPO_PUBLIC_COGNITO_REGION!,      // us-east-1

    Cognito: {
      userPoolId:       process.env.EXPO_PUBLIC_USER_POOL_ID!,        // us-east-1_dOFVXN6rK
      userPoolClientId: process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID!, // 2ellkuj...
      loginWith: { email: true, username: false, phone: false }
    },

    // storage: AsyncStorage, // opcional; el adaptador RN ya provee uno
    ...(process.env.EXPO_PUBLIC_COGNITO_DOMAIN &&
      process.env.EXPO_PUBLIC_REDIRECT_SIGNIN &&
      process.env.EXPO_PUBLIC_REDIRECT_SIGNOUT
      // ? {
      //     oauth: {
      //       domain: process.env.EXPO_PUBLIC_COGNITO_DOMAIN!,
      //       scope: ['openid', 'email', 'profile'],
      //       redirectSignIn:  process.env.EXPO_PUBLIC_REDIRECT_SIGNIN!,
      //       redirectSignOut: process.env.EXPO_PUBLIC_REDIRECT_SIGNOUT!,
      //       responseType: 'code',
      //     },
      //   }
      // : {}
      ),
  } as any,
});

// Log útil mientras pruebas
console.log('[Amplify config]', {
  region:   process.env.EXPO_PUBLIC_COGNITO_REGION,
  poolId:   process.env.EXPO_PUBLIC_USER_POOL_ID,
  clientId: process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID,
});
