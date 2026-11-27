// Prepara il progetto Android generato da "npx cap add android":
// permessi di Health Connect, schermata dei motivi dei permessi, versione minima di Android.
// Si lancia nel workflow GitHub (vedi .github/workflows/android.yml).
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const manifestPath = 'android/app/src/main/AndroidManifest.xml';
let m = readFileSync(manifestPath, 'utf8');

// «--play»: si lancia dopo assembleRelease e prima di bundleRelease. Google Play vieta che un'app si aggiorni da sola,
// quindi il file per Play non dichiara REQUEST_INSTALL_PACKAGES: senza, update/AppUpdate.java resta spento.
if (process.argv.includes('--play')) {
  writeFileSync(manifestPath, m.replace(/\s*<uses-permission android:name="android\.permission\.REQUEST_INSTALL_PACKAGES" \/>/, ''));
  console.log('Manifest per Google Play: niente aggiornamento dall\'app.');
  process.exit(0);
}

const perms = [
  'READ_WEIGHT', 'WRITE_WEIGHT', 'READ_BODY_FAT', 'WRITE_BODY_FAT', 'READ_HEART_RATE', 'READ_HEALTH_DATA_HISTORY',
  // pasti (calorie), acqua, calorie bruciate con l'attività
  'WRITE_NUTRITION', 'WRITE_HYDRATION', 'READ_ACTIVE_CALORIES_BURNED',
  // allenamenti e distanza (scritti da native/android/.../workout/HealthWorkout.java)
  'WRITE_EXERCISE', 'WRITE_DISTANCE',
  // import dall'orologio: allenamenti registrati da altre app e la loro distanza
  'READ_EXERCISE', 'READ_DISTANCE'
];
const lines = perms
  .filter((p) => !m.includes(`android.permission.health.${p}`))
  .map((p) => `    <uses-permission android:name="android.permission.health.${p}" />`)
  .join('\n');
if (lines) m = m.replace(/<application/, `${lines}\n\n    <application`);

// Il plugin @capgo/capacitor-health dichiara quasi tutti i permessi di Health Connect (sonno, glicemia, pressione…).
// Google Play chiede di giustificarli uno per uno: si tolgono dal manifest finale quelli che Ferro non usa.
if (!m.includes('xmlns:tools=')) m = m.replace(/<manifest\b/, '<manifest xmlns:tools="http://schemas.android.com/tools"');
const pluginManifest = readFileSync('node_modules/@capgo/capacitor-health/android/src/main/AndroidManifest.xml', 'utf8');
const unused = [...pluginManifest.matchAll(/android\.permission\.health\.([A-Z0-9_]+)/g)]
  .map((x) => x[1])
  .filter((p, i, all) => all.indexOf(p) === i && !perms.includes(p) && !m.includes(`health.${p}" tools:node="remove"`));
if (unused.length) {
  const removed = unused.map((p) => `    <uses-permission android:name="android.permission.health.${p}" tools:node="remove" />`).join('\n');
  m = m.replace(/<application/, `${removed}\n\n    <application`);
}
// I motivi dei permessi (l'informativa) li mostra l'activity del plugin, PermissionsRationaleActivity, anche da Android 14:
// l'indirizzo è in native/android/app/src/main/res/values/ferro_health.xml.
// per vedere se Health Connect è installato (Android 11+)
if (!m.includes('com.google.android.apps.healthdata')) {
  m = m.replace(/<application/, `<queries>\n        <package android:name="com.google.android.apps.healthdata" />\n    </queries>\n\n    <application`);
}
// Widget della schermata Home (scheda, pasti, frasi) e MainActivity con il plugin dei widget
// e il passaggio dei permessi Google al plugin di accesso: i sorgenti stanno in native/android.
cpSync('native/android', 'android', { recursive: true, force: true });
// Icona e schermata di avvio di Ferro al posto di quelle di Capacitor: icona adattiva in native/android (mipmap-anydpi-v26),
// avvio con drawable/splash.xml; le immagini splash.png del modello avrebbero la precedenza, quindi si cancellano.
const res = 'android/app/src/main/res';
for (const dir of readdirSync(res)) {
  if (/^drawable(-(land|port)-.*)?$/.test(dir) && existsSync(`${res}/${dir}/splash.png`)) rmSync(`${res}/${dir}/splash.png`);
}
const stylesPath = `${res}/values/styles.xml`;
let st = readFileSync(stylesPath, 'utf8');
if (!st.includes('windowSplashScreenBackground')) {
  st = st.replace(
    /(<style name="AppTheme\.NoActionBarLaunch"[^>]*>)/,
    '$1\n        <item name="windowSplashScreenBackground">@color/ferro_splash_background</item>'
  );
  writeFileSync(stylesPath, st);
}
const widgets = [
  ['WorkoutWidget', 'ferro_widget_workout'],
  ['MealsWidget', 'ferro_widget_meals'],
  ['QuoteWidget', 'ferro_widget_quote']
];
for (const [cls, res] of widgets) {
  if (m.includes(`.widgets.${cls}"`)) continue;
  m = m.replace(
    /<\/application>/,
    `    <receiver android:name=".widgets.${cls}" android:exported="false" android:label="@string/${res}">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/${res}" />
        </receiver>
    </application>`
  );
}
// Notifica dell'allenamento in corso e avviso di fine recupero a schermo bloccato
// (POST_NOTIFICATIONS da Android 13; SCHEDULE_EXACT_ALARM lo concede l'utente in «Sveglie e promemoria»).
for (const p of ['POST_NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM']) {
  if (!m.includes(`android.permission.${p}"`)) m = m.replace(/<application/, `<uses-permission android:name="android.permission.${p}" />\n\n    <application`);
}
// Codice a barre dei pasti: la pagina usa la fotocamera (getUserMedia) e la WebView di Capacitor chiede il permesso
// solo se è nel manifest. La fotocamera è facoltativa: l'app si installa anche dove manca (il codice si scrive a mano).
if (!m.includes('android.permission.CAMERA"')) {
  m = m.replace(/<application/, '<uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n\n    <application');
}
// Fascia cardio (plugin @capacitor-community/bluetooth-le). Il plugin chiede la posizione su tutte le versioni:
// serve solo fino ad Android 11, dove la ricerca Bluetooth la richiede. Da Android 12 la ricerca dichiara
// neverForLocation (il Bluetooth non serve a localizzare l'utente) e la posizione non c'è più.
if (!m.includes('android.permission.BLUETOOTH_SCAN"')) {
  m = m.replace(
    /<application/,
    `<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" tools:node="replace" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" android:maxSdkVersion="30" tools:node="replace" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" tools:targetApi="s" tools:node="replace" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" tools:targetApi="s" />

    <application`
  );
}
if (!m.includes('.workout.RestAlarmReceiver"')) {
  m = m.replace(/<\/application>/, `    <receiver android:name=".workout.RestAlarmReceiver" android:exported="false" />
    </application>`);
}
// Aggiornamento dell'APK del sito dall'app (native/android/.../update/): installazione dell'APK scaricato.
// Il controllo giornaliero è un JobService (update/UpdateCheckJob.java) e usa il permesso delle notifiche già chiesto per l'allenamento.
if (!m.includes('android.permission.REQUEST_INSTALL_PACKAGES"')) {
  m = m.replace(/<application/, '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n\n    <application');
}
// Il controllo giornaliero chiede la rete (setRequiredNetworkType): senza ACCESS_NETWORK_STATE JobScheduler
// lancia una SecurityException e l'app si chiudeva all'apertura (v2.6.0 e v2.6.1). Permesso normale, concesso da sé.
if (!m.includes('android.permission.ACCESS_NETWORK_STATE"')) {
  m = m.replace(/<application/, '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />\n\n    <application');
}
if (!m.includes('.update.UpdateCheckJob"')) {
  m = m.replace(/<\/application>/, `    <service android:name=".update.UpdateCheckJob" android:permission="android.permission.BIND_JOB_SERVICE" android:exported="false" />
    </application>`);
}
writeFileSync(manifestPath, m);

// Health Connect richiede Android 8 (API 26) o più recente
const varsPath = 'android/variables.gradle';
let v = readFileSync(varsPath, 'utf8');
v = v.replace(/minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 26');
writeFileSync(varsPath, v);
// Versione e firma: valori passati dal workflow (nessun segreto nel repository).
const gradlePath = 'android/app/build.gradle';
let g = readFileSync(gradlePath, 'utf8');
const code = process.env.VERSION_CODE;
const name = process.env.VERSION_NAME;
// +1000: il repository pubblico riparte dal run 1, e Android non installa sopra un versionCode più alto (prova-N)
if (code) g = g.replace(/versionCode\s+\d+/, `versionCode ${Number(code) + 1000}`);
if (name) g = g.replace(/versionName\s+"[^"]*"/, `versionName "${name.replace(/"/g, '')}"`);
if (process.env.ANDROID_KEYSTORE_FILE && !g.includes('signingConfigs {')) {
  g = g.replace(
    /buildTypes\s*\{/,
    `signingConfigs {
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_FILE"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
    buildTypes {`
  );
  g = g.replace(/(release\s*\{[^}]*?)(minifyEnabled)/, '$1signingConfig signingConfigs.release\n            $2');
}
// HealthWorkout.java usa direttamente il client di Health Connect (stesse versioni del plugin @capgo/capacitor-health)
if (!g.includes('androidx.health.connect:connect-client')) {
  g = g.replace(
    /dependencies\s*\{/,
    `dependencies {
    implementation 'androidx.health.connect:connect-client:1.1.0'
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0'`
  );
}
writeFileSync(gradlePath, g);
console.log('Progetto Android preparato.');
