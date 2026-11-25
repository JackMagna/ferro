// Video per la verifica Google dell'ambito «spreadsheets»: registra e2e/verification-video.spec.ts
// (emulatori Firebase, Google Sheets simulato) e lo monta con ffmpeg.
// Risultato in verifica-google/ (solo su questo PC):
//   ferro-demo-sheets.mp4  video intero, con il cartello dove va il consenso Google vero
//   parte-1.mp4, parte-2.mp4  prima e dopo il cartello, per inserire consent.mp4 (vedi verifica-google/README.md)
//
// Uso: node scripts/verification-video.mjs          (registra e monta)
//      node scripts/verification-video.mjs --solo-montaggio   (rimonta l'ultima registrazione)
import { execFileSync, execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIR = 'verifica-google';
const TMP = `${DIR}/tmp`;
const ENC = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '20', '-r', '30', '-an'];
const NORM = 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p';
const ff = (...args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });

if (!process.argv.includes('--solo-montaggio')) {
  // l'app si registra da una copia dell'ultimo commit compilata (non dal server di sviluppo):
  // così le modifiche in corso nella cartella non rompono la registrazione.
  const snap = resolve(TMP, 'snap');
  // prima il collegamento a node_modules, da solo: rmSync non deve mai entrare nella cartella vera
  try { unlinkSync(join(snap, 'node_modules')); } catch { /* non c'era */ }
  rmSync(snap, { recursive: true, force: true });
  mkdirSync(snap, { recursive: true });
  // percorsi relativi per tar: con "C:/…" GNU tar scambia «C:» per un computer remoto
  execFileSync('git', ['archive', '--format=tar', '-o', join(snap, 'snap.tar'), 'HEAD'], { stdio: 'inherit' });
  execFileSync('tar', ['-xf', 'snap.tar'], { cwd: snap, stdio: 'inherit' });
  rmSync(join(snap, 'snap.tar'));
  symlinkSync(resolve('node_modules'), join(snap, 'node_modules'), 'junction');
  execSync('npx vite build', { cwd: snap, stdio: 'inherit', env: { ...process.env, VITE_FIREBASE_EMULATOR: '1' } });
  // Playwright riusa il server già acceso sulla porta 5174 (reuseExistingServer)
  const server = spawn('npx', ['vite', 'preview', '--port', '5174', '--strictPort'], { cwd: snap, stdio: 'ignore', shell: true });
  try {
    for (let i = 0; ; i++) {
      if (await fetch('http://localhost:5174/app/').then((r) => r.ok, () => false)) break;
      if (i > 60) throw new Error('Il server di anteprima sulla porta 5174 non risponde');
      await new Promise((r) => setTimeout(r, 1000));
    }
    execSync('npx playwright test e2e/verification-video.spec.ts --reporter=line', { stdio: 'inherit', env: { ...process.env, FERRO_VIDEO: '1' } });
  } finally {
    // shell: true → il PID è quello della shell: si chiude tutto l'albero dei processi
    if (process.platform === 'win32') execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' });
    else server.kill();
    unlinkSync(join(snap, 'node_modules'));
    // la copia del repo non deve restare: vitest troverebbe i suoi test
    rmSync(snap, { recursive: true, force: true });
  }
}
if (!existsSync(`${TMP}/raw.webm`)) throw new Error(`Manca ${TMP}/raw.webm: la registrazione non è andata a buon fine`);
const { marks } = JSON.parse(readFileSync(`${TMP}/marks.json`, 'utf8'));
const start = Math.max(0, marks.start), cut = marks.consent, end = marks.end;
if (!(cut > start && end > cut)) throw new Error(`Segni non validi: ${JSON.stringify(marks)}`);

ff('-i', `${TMP}/raw.webm`, '-ss', String(start), '-to', String(cut), '-vf', NORM, ...ENC, `${DIR}/parte-1.mp4`);
ff('-i', `${TMP}/raw.webm`, '-ss', String(cut), '-to', String(end), '-vf', NORM, ...ENC, `${DIR}/parte-2.mp4`);

// cartello di 4 s dove va il consenso Google vero (font di Windows: i due punti vanno protetti nel filtro)
const font = 'C\\:/Windows/Fonts/arialbd.ttf';
const line = (text, y, size) => `drawtext=fontfile='${font}':text='${text}':fontcolor=white:fontsize=${size}:x=(w-text_w)/2:y=${y}`;
ff('-f', 'lavfi', '-i', 'color=c=0x8a1c1c:s=1280x720:d=4:r=30',
  '-vf', [line('REAL GOOGLE CONSENT SCREEN', 270, 58), line('recorded separately (consent.mp4)', 360, 40), line('splice it here', 430, 30)].join(','),
  ...ENC, `${TMP}/cartello.mp4`);

const list = `${TMP}/lista.txt`;
writeFileSync(list, ['parte-1.mp4', 'tmp/cartello.mp4', 'parte-2.mp4'].map((f) => `file '../${f}'`).join('\n'));
ff('-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', `${DIR}/ferro-demo-sheets.mp4`);
console.log(`Fatto: ${DIR}/ferro-demo-sheets.mp4 (taglio per il consenso a ${(cut - start).toFixed(1)} s)`);
