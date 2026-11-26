/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { cpSync, existsSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Dove sta l'app: sul sito in /app/ (alla radice c'è la pagina di presentazione, cartella site/);
 * nell'app Android (Capacitor) alla radice: APP_BASE=/ nel workflow.
 */
const base = process.env.APP_BASE ?? '/app/';
const atRoot = base === '/';

/** Copia la pagina di presentazione (site/) alla radice del sito, accanto alla cartella dell'app. */
const copySite = (): Plugin => ({
  name: 'ferro-copy-site',
  apply: 'build',
  closeBundle() {
    if (!atRoot && existsSync('site')) cpSync('site', 'dist', { recursive: true });
  }
});

/** Senza chiave Firebase l'app si apre ma non accede: meglio fermare la build (su Vercel resta online la versione precedente). */
const requireFirebaseKey = (): Plugin => ({
  name: 'ferro-require-firebase-key',
  apply: 'build',
  configResolved(config) {
    if (config.env.VITE_FIREBASE_EMULATOR === '1' || process.env.VITEST) return;
    if (!config.env.VITE_FIREBASE_API_KEY) {
      throw new Error('VITE_FIREBASE_API_KEY mancante: impostala su Vercel, nel secret FIREBASE_API_KEY di GitHub o in .env.local (vedi .env.example).');
    }
  }
});

const version = `${(process.env.VERCEL_GIT_COMMIT_SHA ?? 'locale').slice(0, 7)} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(version) },
  // i test nel browser (e2e/) li esegue Playwright con gli emulatori: `bun run test:e2e`
  test: { exclude: ['**/node_modules/**', 'e2e/**', 'e2e-android/**', 'android/**'] },
  plugins: [
    react(),
    tailwindcss(),
    copySite(),
    requireFirebaseKey(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/', // invariato: le app già installate restano la stessa app
        name: 'Ferro',
        short_name: 'Ferro',
        description: 'Scheda di allenamento in palestra: serie, carichi, recuperi, pasti e progressi.',
        lang: 'it',
        theme_color: '#1a1c1f',
        background_color: '#1a1c1f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${base}index.html`,
        runtimeCaching: [
          {
            // libreria esercizi: subito dalla cache, aggiornata in background
            urlPattern: ({ url }) => url.pathname.endsWith('/data/exercises.json'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'exercise-library' }
          },
          {
            // foto degli esercizi (fissate a un commit, quindi non cambiano)
            urlPattern: /^https:\/\/(cdn\.jsdelivr\.net\/gh\/yuhonas\/free-exercise-db@|raw\.githubusercontent\.com\/yuhonas\/free-exercise-db\/)/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-images',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  build: {
    outDir: atRoot ? 'dist' : 'dist/app',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase';
          if (id.includes('node_modules/react-body-highlighter')) return 'body-map';
        }
      }
    }
  }
});
