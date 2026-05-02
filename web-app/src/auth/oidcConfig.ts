import { UserManager, WebStorageStateStore, type UserManagerSettings } from 'oidc-client-ts';

const userPoolId  = import.meta.env.VITE_COGNITO_USER_POOL_ID as string;
const clientId    = import.meta.env.VITE_COGNITO_CLIENT_ID    as string;
const authDomain  = import.meta.env.VITE_COGNITO_DOMAIN       as string;
const region      = import.meta.env.VITE_AWS_REGION           || 'us-east-1';
const origin      = window.location.origin;

// Cognito's discovery document omits the hosted-UI endpoints, so we supply
// them explicitly. This keeps oidc-client-ts fully standards-compliant while
// targeting the Cognito hosted UI for the actual Authorization Code + PKCE
// redirect, and the standard JWKS endpoint for token validation.
const settings: UserManagerSettings = {
  authority:                `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
  client_id:                clientId,
  redirect_uri:             `${origin}/auth/callback`,
  post_logout_redirect_uri: `${origin}/login`,
  silent_redirect_uri:      `${origin}/auth/silent-renew`,
  response_type:            'code',
  scope:                    'openid email profile',

  // Token storage: sessionStorage (not persisted across tabs; safer than localStorage)
  userStore: new WebStorageStateStore({ store: sessionStorage }),

  // Automatic silent renewal — fires when token is within 60s of expiry
  automaticSilentRenew:   true,
  silentRequestTimeoutInSeconds: 10,

  // Cognito-specific OIDC metadata (discovery doesn't expose hosted-UI endpoints)
  metadata: {
    issuer:                `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
    authorization_endpoint: `https://${authDomain}/oauth2/authorize`,
    token_endpoint:         `https://${authDomain}/oauth2/token`,
    userinfo_endpoint:      `https://${authDomain}/oauth2/userInfo`,
    end_session_endpoint:   `https://${authDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(`${origin}/login`)}`,
    jwks_uri:               `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`,
  },
};

export const userManager = new UserManager(settings);

// Convenience: get the current access token (used by the API interceptor)
export async function getAccessToken(): Promise<string | null> {
  try {
    const user = await userManager.getUser();
    if (!user || user.expired) return null;
    return user.access_token;
  } catch {
    return null;
  }
}

// Convenience: get the current ID token (contains plan/entitlements claims)
export async function getIdToken(): Promise<string | null> {
  try {
    const user = await userManager.getUser();
    if (!user || user.expired) return null;
    return user.id_token ?? null;
  } catch {
    return null;
  }
}
