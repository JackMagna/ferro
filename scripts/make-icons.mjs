// Genera le icone di Ferro per ogni tema (SVG, PNG e un manifest per tema) in public/icons/.
// Uso: node scripts/make-icons.mjs  (serve sharp: npm i -g sharp, oppure NODE_PATH che lo contenga)
// L'icona è il "disco" del tema (colore d'accento) con il bilanciere nel colore del testo sopra l'accento,
// come il logo dentro l'app (src/components/layout/Logo.tsx).
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

export const VARIANTS = {
  classico: { tile: '#f0c33c', mark: '#2a2104', bg: '#1a1c1f' },
  brace: { tile: '#ff5a1f', mark: '#0e0e10', bg: '#0e0e10' },
  'grafite-dark': { tile: '#ffffff', mark: '#000000', bg: '#000000' },
  'grafite-light': { tile: '#000000', mark: '#ffffff', bg: '#ffffff' }
};

// Bilanciere: la sbarra che sporge oltre i due dischi (così non si legge come una «H»), centrati in 512×512 e dentro la zona sicura delle icone "maskable" (80%).
const svg = ({ tile, mark }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${tile}"/>
  <rect x="100" y="245" width="312" height="22" rx="4" fill="${mark}"/>
  <rect x="146" y="146" width="52" height="220" rx="10" fill="${mark}"/>
  <rect x="314" y="146" width="52" height="220" rx="10" fill="${mark}"/>
</svg>
`;

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const [name, v] of Object.entries(VARIANTS)) {
  const source = svg(v);
  writeFileSync(new URL(`ferro-${name}.svg`, out), source);
  for (const [file, size] of [[`ferro-${name}-180.png`, 180], [`ferro-${name}-192.png`, 192], [`ferro-${name}-512.png`, 512]]) {
    await sharp(Buffer.from(source)).resize(size, size).png({ compressionLevel: 9 }).toFile(new URL(file, out).pathname);
  }
  const manifest = {
    id: '/',
    name: 'Ferro',
    short_name: 'Ferro',
    description: 'Scheda di allenamento in palestra: serie, carichi, recuperi, pasti e progressi.',
    lang: 'it',
    theme_color: v.bg,
    background_color: v.bg,
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/app/',
    scope: '/app/',
    icons: [
      { src: `ferro-${name}-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `ferro-${name}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      { src: `ferro-${name}.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
    ]
  };
  writeFileSync(new URL(`manifest-${name}.webmanifest`, out), `${JSON.stringify(manifest, null, 2)}\n`);
}
console.log('Icone generate in public/icons/');
