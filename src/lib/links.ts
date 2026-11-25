import { Capacitor } from '@capacitor/core';

/** Indirizzo pubblico del sito: serve all'app Android, che non ha le pagine del sito al suo interno. */
export const SITE_ORIGIN = 'https://palestra-kohl.vercel.app';

const native = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};
const page = (path: string) => (native() ? `${SITE_ORIGIN}${path}` : path);

export const PRIVACY_URL = page('/privacypolicy.html');
export const LICENSES_URL = page('/licenze.html');
export const NEWS_URL = page('/novita.html');
export const GOOGLE_USER_DATA_POLICY = 'https://developers.google.com/terms/api-services-user-data-policy';
