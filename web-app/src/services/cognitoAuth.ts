import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

const pool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID as string,
  ClientId:   import.meta.env.VITE_COGNITO_CLIENT_ID as string,
});

export interface CognitoAuthResult {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; role: string };
}

function sessionToResult(session: CognitoUserSession): CognitoAuthResult {
  const idPayload = session.getIdToken().decodePayload();
  return {
    idToken:      session.getIdToken().getJwtToken(),
    accessToken:  session.getAccessToken().getJwtToken(),
    refreshToken: session.getRefreshToken().getToken(),
    user: {
      id:    idPayload.sub as string,
      email: idPayload.email as string,
      name:  (idPayload.name || idPayload.email) as string,
      role:  (idPayload['custom:role'] || 'analyst') as string,
    },
  };
}

export function cognitoSignIn(email: string, password: string): Promise<CognitoAuthResult> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: email, Pool: pool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => resolve(sessionToResult(session)),
      onFailure: (err) => reject(err),
      newPasswordRequired: () => reject(new Error('NEW_PASSWORD_REQUIRED')),
      totpRequired: () => reject(new Error('MFA_REQUIRED')),
    });
  });
}

export function cognitoSignUp(name: string, email: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const attributes = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
      new CognitoUserAttribute({ Name: 'name',  Value: name }),
      new CognitoUserAttribute({ Name: 'custom:role', Value: 'analyst' }),
    ];
    pool.signUp(email, password, attributes, [], (err) => {
      if (err) { reject(err); return; }
      resolve();
    });
  });
}

export function cognitoConfirm(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: email, Pool: pool });
    cognitoUser.confirmRegistration(code, true, (err) => {
      if (err) { reject(err); return; }
      resolve();
    });
  });
}

export function cognitoResendCode(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: email, Pool: pool });
    cognitoUser.resendConfirmationCode((err) => {
      if (err) { reject(err); return; }
      resolve();
    });
  });
}

export function cognitoForgotPassword(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: email, Pool: pool });
    cognitoUser.forgotPassword({
      onSuccess: () => resolve(),
      onFailure: reject,
    });
  });
}

export function cognitoConfirmPassword(email: string, code: string, newPassword: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: email, Pool: pool });
    cognitoUser.confirmPassword(code, newPassword, {
      onSuccess: () => resolve(),
      onFailure: reject,
    });
  });
}

export function cognitoRefreshSession(): Promise<CognitoAuthResult | null> {
  return new Promise((resolve) => {
    const currentUser = pool.getCurrentUser();
    if (!currentUser) { resolve(null); return; }
    currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) { resolve(null); return; }
      resolve(sessionToResult(session));
    });
  });
}

export function cognitoSignOut(): void {
  pool.getCurrentUser()?.signOut();
}
