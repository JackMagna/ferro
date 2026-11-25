// Video di presentazione per Google Play (circa 30 s, 4K 3840 × 2160, senza audio): l'app vera con dati di esempio,
// dentro la cornice di un telefono, con le didascalie accanto. Risultato: store/video/ferro-play.mp4
// Google Play accetta solo un link YouTube (pubblico o non in elenco, senza pubblicità): il file va caricato lì.
//
// Uso: node scripts/store-video.mjs        (servono ffmpeg nel PATH e i browser di Playwright)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { PHONE, openDemo, startPreview } from './store-demo.mjs';

const NAME = process.env.STORE_NAME ?? 'Ferro';
const OUT = 'store/video';
const TMP = resolve(OUT, 'tmp');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(join(TMP, 'frames'), { recursive: true });

// Didascalie: titolo e riga sotto, una per parte del video
const SCENES = [
  { id: 'allenamento', title: 'Il tuo allenamento, serie per serie', sub: 'Carichi, recuperi e record. Funziona anche senza rete.' },
  { id: 'scheda', title: 'La scheda arriva dal foglio del coach', sub: 'Importata da Google Sheets. I carichi tornano nel foglio.' },
  { id: 'pasti', title: 'Pasti, acqua e dieta', sub: 'Codice a barre e piano della nutrizionista.' },
  { id: 'progressi', title: 'Progressi che si vedono', sub: 'Volume, carichi, peso e misure.' }
];
const OUTRO_SEC = 3.5;

const server = await startPreview();
const browser = await chromium.launch();

/* ---------- 1. registrazione dell'app (fotogrammi dello screencast di Chrome) ---------- */
// telefono alto e moderno (390 × 844 × 3 = 1170 × 2532): nel video lo schermo è quasi a tutta altezza
const context = await browser.newContext({ ...PHONE, viewport: { width: 390, height: 844 } });
const page = await openDemo(context);
const nav = (name) => page.getByRole('navigation', { name: 'Sezioni' }).getByRole('button', { name }).click();
const wait = (ms) => page.waitForTimeout(ms);
const scroll = (top) => page.evaluate((y) => window.scrollBy({ top: y, behavior: 'smooth' }), top);

const frames = [];
const cdp = await context.newCDPSession(page);
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const file = join(TMP, 'frames', `${String(frames.length).padStart(5, '0')}.jpg`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  frames.push({ file, t: metadata.timestamp });
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => undefined);
});
await nav('Allenamento');
await page.evaluate(() => window.scrollTo(0, 0));
await wait(500);
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1170, maxHeight: 2532, everyNthFrame: 1 });
const marks = {};
const mark = (id) => { marks[id] = Date.now() / 1000; };

mark('allenamento');
await wait(1500);
await page.getByRole('button', { name: 'Completa serie 1' }).click();
await wait(2500);
await page.getByRole('button', { name: 'Completa serie 2' }).click();
await wait(2500);

mark('scheda');
await nav('Scheda');
await wait(1500);
await scroll(520);
await wait(2600);

mark('pasti');
await nav('Pasti');
await wait(1400);
await page.getByRole('button', { name: /Bicchiere/ }).first().click();
await wait(1200);
await scroll(700);
await wait(2400);

mark('progressi');
await nav('Progressi');
await wait(2000);
await page.getByRole('radiogroup', { name: 'Sezione' }).getByRole('radio', { name: 'Misure' }).click();
await wait(2800);
mark('fine');
await cdp.send('Page.stopScreencast');
await wait(300);
await context.close();

if (frames.length < 10) throw new Error(`Pochi fotogrammi registrati (${frames.length})`);
const t0 = marks.allenamento;
const end = marks.fine;
// elenco per ffmpeg (concat): ogni fotogramma dura fino al successivo
const kept = frames.filter((f, i) => f.t <= end && (frames[i + 1]?.t ?? end) >= t0);
let list = '';
kept.forEach((f, i) => {
  const from = Math.max(f.t, t0);
  const to = Math.min(kept[i + 1]?.t ?? end, end);
  list += `file '${f.file.replace(/\\/g, '/')}'\nduration ${Math.max(0.001, to - from).toFixed(3)}\n`;
});
list += `file '${kept[kept.length - 1].file.replace(/\\/g, '/')}'\n`;
writeFileSync(join(TMP, 'frames.txt'), list);
const appSec = end - t0;
const at = (id) => marks[id] - t0;

/* ---------- 2. sfondo, cornice, didascalie e chiusura (immagini fatte con HTML) ---------- */
const W = 3840, H = 2160;
const font = (pkg, file) => `data:font/woff2;base64,${readFileSync(`node_modules/@fontsource/${pkg}/files/${file}`).toString('base64')}`;
const css = `
  @font-face { font-family: 'Barlow Condensed'; font-weight: 700; src: url('${font('barlow-condensed', 'barlow-condensed-latin-700-normal.woff2')}') format('woff2'); }
  @font-face { font-family: 'Barlow'; font-weight: 500; src: url('${font('barlow', 'barlow-latin-500-normal.woff2')}') format('woff2'); }
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: transparent; }
  h1 { font: 700 200px/0.92 'Barlow Condensed', sans-serif; text-transform: uppercase; color: #f3efe6; margin: 0; }
  p { font: 500 84px/1.25 'Barlow', sans-serif; color: #c9c3b6; margin: 56px 0 0; }`;
// schermo del telefono quasi a tutta altezza, didascalie subito accanto
const SCREEN = { w: 898, h: 1944, x: 541, y: 108 };
const BEZEL = 30;
const CAPTION = { x: SCREEN.x + SCREEN.w + BEZEL + 160, w: 1700 };
const icon = readFileSync('public/icons/ferro-classico.svg', 'utf8');
const logo = (size) => `<div style="width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.235)}px;overflow:hidden;flex:none">${icon.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div>`;
const art = await browser.newPage({ viewport: { width: W, height: H } });
const png = async (file, body, transparent = true) => {
  await art.setContent(`<!doctype html><html><head><style>${css}</style></head><body>${body}</body></html>`);
  await art.evaluate(() => document.fonts.ready);
  await art.screenshot({ path: join(TMP, file), omitBackground: transparent });
  return join(TMP, file);
};
const bar = `<div style="position:absolute;left:0;right:0;bottom:0;height:32px;background:#f0c33c"></div>`;
const bg = await png('sfondo.png', `<div style="position:absolute;inset:0;background:#1a1c1f"></div>${bar}
  <div style="position:absolute;left:${CAPTION.x}px;top:200px;display:flex;align-items:center;gap:40px">${logo(140)}
    <span style="font:700 120px/1 'Barlow Condensed',sans-serif;color:#f3efe6;text-transform:uppercase">${NAME}</span></div>`, false);
const bezel = await png('cornice.png', `<div style="position:absolute;left:${SCREEN.x - BEZEL}px;top:${SCREEN.y - BEZEL}px;width:${SCREEN.w}px;height:${SCREEN.h}px;
  border:${BEZEL}px solid #0b0c0e;border-radius:120px;box-shadow:0 60px 160px rgba(0,0,0,.55), inset 0 0 0 4px #2b2e33"></div>`);
const captions = [];
for (const s of SCENES) {
  captions.push(await png(`didascalia-${s.id}.png`, `<div style="position:absolute;left:${CAPTION.x}px;top:0;bottom:0;width:${CAPTION.w}px;display:flex;flex-direction:column;justify-content:center"><h1>${s.title}</h1><p>${s.sub}</p></div>`));
}
const outro = await png('chiusura.png', `<div style="position:absolute;inset:0;background:#1a1c1f;display:flex;flex-direction:column;align-items:center;justify-content:center">
  ${logo(440)}<h1 style="font-size:300px;margin-top:80px">${NAME}</h1>
  <p style="margin-top:40px">Gratis. Senza pubblicità. Senza abbonamento.</p></div>${bar}`, false);
await browser.close();
server.kill();

/* ---------- 3. montaggio con ffmpeg ---------- */
const fade = 0.35;
const inputs = ['-loop', '1', '-t', String(appSec), '-i', bg, '-f', 'concat', '-safe', '0', '-i', join(TMP, 'frames.txt'), '-loop', '1', '-t', String(appSec), '-i', bezel];
captions.forEach((c) => inputs.push('-loop', '1', '-t', String(appSec), '-i', c));
inputs.push('-loop', '1', '-t', String(OUTRO_SEC), '-i', outro);
let graph = `[1:v]fps=60,scale=${SCREEN.w}:${SCREEN.h}:flags=lanczos,setsar=1[app];[0:v][app]overlay=${SCREEN.x}:${SCREEN.y}:shortest=1[a0];[a0][2:v]overlay=0:0[b0]`;
let last = 'b0';
SCENES.forEach((s, i) => {
  const from = at(s.id);
  const to = i + 1 < SCENES.length ? at(SCENES[i + 1].id) : appSec;
  const idx = 3 + i;
  graph += `;[${idx}:v]format=rgba,fade=t=in:st=${(from + 0.15).toFixed(2)}:d=${fade}:alpha=1,fade=t=out:st=${(to - fade - 0.05).toFixed(2)}:d=${fade}:alpha=1[c${i}];[${last}][c${i}]overlay=0:0[v${i}]`;
  last = `v${i}`;
});
const outroIdx = 3 + SCENES.length;
graph += `;[${last}]fps=60,format=yuv420p,setsar=1[main];[${outroIdx}:v]fps=60,format=yuv420p,setsar=1,fade=t=in:st=0:d=0.5[end];[main][end]concat=n=2:v=1:a=0[out]`;
const file = join(OUT, 'ferro-play.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', graph, '-map', '[out]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', '60', file], { stdio: 'inherit' });
rmSync(TMP, { recursive: true, force: true });
console.log(`${file} (${(appSec + OUTRO_SEC).toFixed(1)} s)`);
