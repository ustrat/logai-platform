import { userManager } from './oidcConfig';

// Runs inside the hidden silent-renew iframe.
// Processes the authorization response and notifies the parent window.
userManager.signinSilentCallback().catch(console.error);
