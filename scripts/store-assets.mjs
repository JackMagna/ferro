// Grafica per la scheda di Google Play: screenshot del telefono (1080 × 1920), grafica in evidenza (1024 × 500),
// icona (512 × 512) e anteprima dell'icona adattiva di Android. Tutto finisce in store/grafica/.
// I dati mostrati sono finti (seminati nell'app senza account), nessun dato vero.
//
// Uso: node scripts/store-assets.mjs            (compila l'app, la serve con vite preview e fotografa)
//      STORE_NAME="Ferro" node scripts/store-assets.mjs   per cambiare il nome nella grafica in evidenza
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { PHONE, PORT, openDemo, startPreview } from './store-demo.mjs';

const NAME = process.env.STORE_NAME ?? 'Ferro';
const OUT = 'store/grafica';
mkdirSync(OUT, { recursive: true });
const server = await startPreview();

const browser = await chromium.launch();
const context = await browser.newContext(PHONE);
const page = await openDemo(context);

const nav = (name) => page.getByRole('navigation', { name: 'Sezioni' }).getByRole('button', { name }).click();
const shot = async (file) => { await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}/${file}` }); console.log(`${OUT}/${file}`); };

// 1. Allenamento: una serie fatta, recupero in corso
await nav('Allenamento');
await page.getByRole('button', { name: 'Completa serie 1' }).click();
await page.waitForTimeout(2500);
await page.evaluate(() => window.scrollTo(0, 0));
await shot('01-allenamento.png');
// 2. Scheda del coach
await nav('Scheda');
await shot('02-scheda.png');
// 3. Pasti
await nav('Pasti');
await shot('03-pasti.png');
// 4. Progressi
await nav('Progressi');
await shot('04-progressi.png');
// 5. Libreria esercizi
await nav('Esercizi');
await page.getByPlaceholder(/Cerca/).first().fill('bench press');
await page.waitForTimeout(2500);
await shot('05-esercizi.png');
// 6. Tema chiaro: allenamento
await page.emulateMedia({ colorScheme: 'light' });
await nav('Allenamento');
await page.evaluate(() => window.scrollTo(0, 0));
await shot('06-allenamento-chiaro.png');

// Grafica in evidenza 1024 × 500 (senza trasparenza) e anteprime dell'icona
const icon = readFileSync('public/icons/ferro-classico.svg', 'utf8');
const font = (pkg, file) => `data:font/woff2;base64,${readFileSync(`node_modules/@fontsource/${pkg}/files/${file}`).toString('base64')}`;
const art = await browser.newPage({ viewport: { width: 1024, height: 500 } });
await art.setContent(`<!doctype html><html><head><style>
  @font-face { font-family: 'Barlow Condensed'; font-weight: 700; src: url('${font('barlow-condensed', 'barlow-condensed-latin-700-normal.woff2')}') format('woff2'); }
  @font-face { font-family: 'Barlow'; font-weight: 500; src: url('${font('barlow', 'barlow-latin-500-normal.woff2')}') format('woff2'); }
  html, body { margin: 0; width: 1024px; height: 500px; background: #1a1c1f; color: #f3efe6; overflow: hidden; }
  .wrap { display: flex; align-items: center; gap: 56px; height: 100%; padding: 0 84px; box-sizing: border-box; }
  .icon { width: 220px; height: 220px; border-radius: 48px; overflow: hidden; flex: none; box-shadow: 0 18px 50px rgba(0,0,0,.45); }
  .icon svg { width: 100%; height: 100%; display: block; }
  h1 { font: 700 132px/0.9 'Barlow Condensed', sans-serif; margin: 0; text-transform: uppercase; letter-spacing: .01em; }
  p { font: 500 34px/1.25 'Barlow', sans-serif; margin: 18px 0 0; color: #c9c3b6; max-width: 15em; }
  .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 14px; background: #f0c33c; }
</style></head><body><div class="wrap"><div class="icon">${icon}</div><div><h1>${NAME}</h1>
<p>La scheda del coach in palestra: serie, carichi, recuperi e progressi.</p></div></div><div class="bar"></div></body></html>`);
await art.evaluate(() => document.fonts.ready);
await art.screenshot({ path: `${OUT}/grafica-in-evidenza-1024x500.png`, omitBackground: false });
console.log(`${OUT}/grafica-in-evidenza-1024x500.png`);

// Anteprima dell'icona adattiva (come il drawable native/android/.../ferro_launcher_foreground.xml, maschera rotonda)
const s = 0.1795, t = (54 - 256 * s);
await art.setViewportSize({ width: 432, height: 432 });
await art.setContent(`<!doctype html><body style="margin:0;background:#888;display:grid;place-items:center;height:432px">
<svg width="432" height="432" viewBox="0 0 108 108"><defs><clipPath id="c"><circle cx="54" cy="54" r="54"/></clipPath></defs>
<g clip-path="url(#c)"><rect width="108" height="108" fill="#F0C33C"/><g transform="translate(${t} ${t}) scale(${s})">
<rect x="100" y="245" width="312" height="22" rx="4" fill="#2A2104"/><rect x="146" y="146" width="52" height="220" rx="10" fill="#2A2104"/>
<rect x="314" y="146" width="52" height="220" rx="10" fill="#2A2104"/></g></g>
<circle cx="54" cy="54" r="33" fill="none" stroke="#e0302f" stroke-width=".4" stroke-dasharray="1 1"/></svg></body>`);
await art.screenshot({ path: `${OUT}/anteprima-icona-android.png` });

copyFileSync('public/icon-512.png', `${OUT}/icona-512.png`);
console.log(`${OUT}/icona-512.png`);

await browser.close();
server.kill();
