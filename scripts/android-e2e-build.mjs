// APK di prova per i test automatici su Android (e2e-android/): stessa app, ma
// - accesso Google e Firestore sugli emulatori Firebase del PC (VITE_FIREBASE_EMULATOR=1, raggiunti con `adb reverse`);
// - pacchetto it.irontrack.app.test, così si installa accanto all'app vera senza toccarne i dati;
// - HTTP in chiaro permesso (gli emulatori Firebase sono su http://127.0.0.1).
// Uso: node scripts/android-e2e-build.mjs   (serve Java 21: FERRO_JAVA_HOME o ~/tools/jdk-21…)
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const tools = join(homedir(), 'tools');
const jdk = process.env.FERRO_JAVA_HOME
  ?? (existsSync(tools) ? readdirSync(tools).filter((d) => /^jdk-2\d/.test(d)).sort().map((d) => join(tools, d)).pop() : undefined)
  ?? process.env.JAVA_HOME;
const sep = process.platform === 'win32' ? ';' : ':';
const env = { ...process.env, ...(jdk ? { JAVA_HOME: jdk, PATH: `${join(jdk, 'bin')}${sep}${process.env.PATH}` } : {}) };
const run = (cmd, extra = {}, cwd = '.') => execSync(cmd, { stdio: 'inherit', cwd, env: { ...env, ...extra } });

run('node node_modules/vite/bin/vite.js build', { APP_BASE: '/', VITE_FIREBASE_EMULATOR: '1' });
if (!existsSync('android')) run('node node_modules/@capacitor/cli/bin/capacitor add android');
run('node scripts/patch-android.mjs');
run('node node_modules/@capacitor/cli/bin/capacitor sync android');

const manifest = 'android/app/src/main/AndroidManifest.xml';
let m = readFileSync(manifest, 'utf8');
if (!m.includes('usesCleartextTraffic')) m = m.replace('<application', '<application android:usesCleartextTraffic="true"');
writeFileSync(manifest, m);

const gradle = 'android/app/build.gradle';
let g = readFileSync(gradle, 'utf8');
g = g.replace(/applicationId "it\.irontrack\.app"/, 'applicationId "it.irontrack.app.test"');
writeFileSync(gradle, g);

run(process.platform === 'win32' ? '.\\gradlew.bat --no-daemon assembleDebug' : './gradlew --no-daemon assembleDebug', {}, 'android');
console.log('\nAPK di prova: android/app/build/outputs/apk/debug/app-debug.apk (pacchetto it.irontrack.app.test)');
