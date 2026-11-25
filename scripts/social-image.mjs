// Immagine di anteprima per i link condivisi (WhatsApp, social): site/sito/img/ferro-social.png, 1200×630.
// Uso: node scripts/social-image.mjs   (serve Playwright con Chromium: npx playwright install chromium)
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const site = pathToFileURL(resolve('site')).href;
const html = `<!doctype html><html><head><style>
@font-face { font-family: B; font-weight: 700; src: url(${site}/sito/fonts/barlow-condensed-latin-700-normal.woff2); }
@font-face { font-family: R; src: url(${site}/sito/fonts/barlow-latin-500-normal.woff2); }
@font-face { font-family: M; src: url(${site}/sito/fonts/space-mono-latin-400-normal.woff2); }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #141517; color: #eeebe4; display: flex; align-items: center; padding: 0 80px; gap: 60px; overflow: hidden; position: relative; }
.disc { position: absolute; right: -120px; top: 50%; transform: translateY(-50%); width: 760px; height: 760px; border-radius: 50%; background: rgba(240,195,60,.10); border: 2px solid rgba(240,195,60,.35); }
.txt { flex: 1; position: relative; }
.brand { display: flex; align-items: center; gap: 16px; font: 700 52px B; }
.brand i { width: 64px; height: 64px; border-radius: 16px; background: #f0c33c; display: grid; place-items: center; }
h1 { font: 700 84px/0.92 B; text-transform: uppercase; margin-top: 36px; }
h1 span { color: #8d8b84; display: block; }
p { font: 26px R; color: #b3b0a8; margin-top: 28px; }
.mono { font: 18px M; letter-spacing: .1em; text-transform: uppercase; color: #8d8b84; margin-top: 30px; }
.phone { position: relative; width: 270px; border-radius: 30px; padding: 9px; background: #0b0c0d; border: 1px solid #2c2f33; box-shadow: 0 40px 80px -30px #000; }
.phone img { width: 100%; border-radius: 22px; display: block; }
</style></head><body><div class="disc"></div>
<div class="txt">
  <div class="brand"><i><svg width="40" height="40" viewBox="0 0 64 64"><rect x="12.5" y="30.6" width="39" height="2.8" fill="#2a2104"/><rect x="18.25" y="18.25" width="6.5" height="27.5" fill="#2a2104"/><rect x="39.25" y="18.25" width="6.5" height="27.5" fill="#2a2104"/></svg></i>Ferro</div>
  <h1>La scheda del coach.<span>Sul telefono.</span></h1>
  <p>Serie, carichi, recuperi, pasti e progressi. Dal Google Sheet del coach.</p>
  <p class="mono">Gratis · senza pubblicità · Android e browser</p>
</div>
<div class="phone"><img src="${site}/sito/img/allenamento-classico-dark.webp"></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
// pagina scritta accanto al sito: da about:blank Chromium non carica font e immagini locali
const tmp = resolve('site/_social.html');
writeFileSync(tmp, html);
await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
rmSync(tmp);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'site/sito/img/ferro-social.png' });
await browser.close();
console.log('site/sito/img/ferro-social.png');
