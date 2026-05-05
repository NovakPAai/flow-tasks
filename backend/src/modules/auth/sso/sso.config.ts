import { discovery } from 'openid-client';
import { config } from '../../../config.js';
import { logger } from '../../../shared/utils/logger.js';

// Promise singleton — concurrent first requests share one discovery call.
let clientPromise: ReturnType<typeof discovery> | null = null;

export function getOidcClient(): ReturnType<typeof discovery> {
  if (!clientPromise) {
    if (!config.SSO_ENABLED || !config.OIDC_ISSUER_URL || !config.OIDC_CLIENT_ID) {
      return Promise.reject(new Error('SSO is not configured')) as ReturnType<typeof discovery>;
    }

    clientPromise = discovery(
      new URL(config.OIDC_ISSUER_URL),
      config.OIDC_CLIENT_ID,
      config.OIDC_CLIENT_SECRET,
    ).then((client) => {
      logger.info('OIDC discovery completed', { provider: config.OIDC_PROVIDER, issuer: config.OIDC_ISSUER_URL });
      return client;
    }).catch((err) => {
      clientPromise = null; // reset so next call retries
      logger.error('OIDC discovery failed', { provider: config.OIDC_PROVIDER, error: String(err) });
      throw err;
    });
  }

  return clientPromise;
}

export function resetOidcClient() {
  clientPromise = null;
}
