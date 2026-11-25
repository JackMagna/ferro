# Ferro

[English](README.md) · **Italiano**

App web (PWA) per seguire la scheda in palestra: serie, carichi, recuperi, record, misure e pasti.
Funziona offline e si installa sul telefono. Prima si chiamava **IronTrack**: le chiavi di salvataggio e il formato
del backup restano `irontrack`, così i dati esistenti continuano a funzionare.

Online: https://palestra-kohl.vercel.app (pagina di presentazione) · app in https://palestra-kohl.vercel.app/app/

## Cosa fa

- **Scheda modificabile** dall'app: giorni, esercizi, serie e ripetizioni per settimana, recuperi e note.
- **Libreria esercizi pubblica**: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (dominio pubblico), 800+ esercizi con foto e muscoli.
- **Mappa muscolare**: [react-body-highlighter](https://github.com/giavinh79/react-body-highlighter) (MIT).
- **Dati**: Firestore con cache offline (con account Google) oppure solo sul dispositivo (senza account). Backup e ripristino da file.
- **Google Sheets**: legge la scheda del coach dal foglio condiviso e ci scrive i carichi (accanto a "3X10" nella cella della settimana) e le misure. Le celle che il coach modifica non vengono toccate.
- **Misure**: la scheda MISURE del coach (colonne = settimane, righe PESO, VITA, ADDOME, FIANCHI, BRACCIO, COSCIA) si legge e si scrive nei due sensi. Se una cella ha un valore diverso dall'app, l'app chiede quale tenere.
- **Pasti**: diario con calorie, macro, fibre, zuccheri, sale e ora del pasto; obiettivo del giorno e andamento degli ultimi 7 giorni.
- **Codice a barre**: cerca un prodotto su [Open Food Facts](https://world.openfoodfacts.org) con la fotocamera (se il browser supporta `BarcodeDetector`), scrivendo il codice o per nome; i valori per 100 g diventano quelli della porzione mangiata.
- **Dieta della nutrizionista, senza IA nell'app**: l'app fornisce un prompt; lo usi con il servizio che preferisci allegando il file della dieta e incolli nell'app la risposta (formato `irontrack-diet-v1`). Vale per diete con pasti precisi, con soli macro (le kcal vengono calcolate: 4·P + 4·C + 9·G) o con entrambi. Resta anche la lettura del testo incollato.
- **Dati salute** (facoltativo, una fonte per volta): **Google Health** (anche dal sito) oppure **Health Connect** (solo app Android). Importano peso, massa grassa e frequenza cardiaca; le pesate inserite nell'app vengono inviate alla fonte scelta. Con Google Health si registrano anche gli allenamenti e, se attivato, i pasti.
- **Apple Salute (iPhone)**: due Comandi rapidi («Ferro Salute» e «Salute Ferro») portano pesate, massa grassa, calorie e macro in Salute e le pesate di Salute in Ferro (`src/lib/appleHealthBridge.ts`, guida nella pagina di presentazione).
- **Frequenza cardiaca** via Bluetooth (Chrome su Android e computer) ed esportazione TCX per Strava/Garmin.
- **Aspetto**: tre temi (Classico, Grafite, Brace), ognuno scuro, chiaro o come il sistema. Logo e icona seguono il tema scelto.

## Sviluppo

```bash
bun install        # oppure npm install
bun run dev        # http://localhost:3000
bun run test       # test (vitest)
bun run build      # controllo dei tipi + build di produzione
node scripts/check-contrast.mjs   # contrasto dei colori di tutti i temi (WCAG 4,5:1)
```

Il deploy è automatico su Vercel a ogni push su `main`. L'app è in `/app/` (Vite `base`); la cartella `site/` (pagina di presentazione, informativa, `sw.js` che disattiva il vecchio service worker della radice) viene copiata alla radice di `dist/`. Per l'app Android si compila con `APP_BASE=/`.

## Temi, logo e icone

Colori, angoli e font di ogni tema sono variabili CSS in `src/index.css` (`html[data-theme][data-mode]`);
la scelta è in `src/lib/theme.ts` e uno script in `index.html` la applica prima del primo disegno.
Le icone dell'app (SVG, PNG e un manifest per tema) sono in `public/icons/` e si rigenerano con:

```bash
node scripts/make-icons.mjs   # serve sharp (npm i -g sharp)
```

Un'app già installata tiene l'icona che aveva al momento dell'installazione: è un limite di Android e iOS.

## Aggiornare la libreria esercizi

```bash
bun run update-exercises
```

Poi aggiorna `LIBRARY_COMMIT` in `src/lib/exerciseLibrary.ts` con l'ultimo commit di free-exercise-db,
così le foto corrispondono ai dati.

## Google Health (peso, massa grassa, frequenza cardiaca, allenamenti, pasti)

Le vecchie API Fitbit vengono spente a fine ottobre 2026 (e non si possono più registrare nuove app): il collegamento usa la **Google Health API** (v4),
con lo stesso login Google dell'app. Non serve registrare nessuna app esterna.

Nel progetto Google Cloud (una volta sola):
1. abilitare **Google Health API** (`health.googleapis.com`);
2. in *Google Auth Platform → Accesso ai dati* aggiungere gli ambiti
   `googlehealth.health_metrics_and_measurements.readonly`, `googlehealth.health_metrics_and_measurements.writeonly`,
   `googlehealth.activity_and_fitness.writeonly` e `googlehealth.nutrition.writeonly` (pasti);
3. aggiungere gli account tra gli *utenti di prova* (fino a 100; oltre serve la verifica di Google).

Nell'app: icona account → *Dati salute* → *Google Health* → *Collega Google Health*. L'account Google deve avere un profilo
Google Health (app Google Health sul telefono, "Accedi con Google", oppure migrazione dell'account Fitbit).
Il permesso dura circa un'ora: poi compare "Ricollega Google Health". L'invio dei pasti si attiva con «Invia i pasti a Google Health»
(dopo averlo attivato serve ricollegare per accettare il nuovo permesso). Tutto il codice sta in `src/services/googleHealth.ts`
e `src/lib/healthNutrition.ts`.

## Google Sheets e scheda del coach

Il foglio deve essere condiviso con il tuo account come **Editor**. Nell'app: *Scheda → Collega la scheda del coach*.
L'app riconosce righe `GIORNO 1`, colonne `1 SETT.`…`6 SETT.`, intestazioni di sezione (`PROGRESSIONE SERIE X REP RIP. 2'`) e gli esercizi.

## Firebase

La configurazione è in `firebase-applet-config.json`. La chiave API di Firebase per il web non è un segreto
(identifica il progetto, non dà accessi): la protezione è nelle regole di `firestore.rules`.
Dopo il deploy su Vercel, aggiungi il dominio in *Authentication → Impostazioni → Domini autorizzati*.

Le regole di `firestore.rules` (che includono `users/{uid}/meals`) vanno **ripubblicate a mano** dopo ogni modifica:
console Firebase → *Firestore → Regole* → incolla il file → *Pubblica*. Nel repository non ci sono `firebase.json`
e `.firebaserc`, quindi `firebase deploy` non funziona senza prima configurarli.

## App Android

Lo stesso codice del sito, impacchettato con Capacitor (`capacitor.config.json`, `scripts/patch-android.mjs`, codice
nativo in `native/android`). Non è su Google Play: l'APK si scarica dal sito, che punta sempre all'ultima Release
(`releases/latest/download/ferro-release.apk`).

- **Nuova versione**: aggiorna `version` in `package.json`, poi `git tag v2.3.0 && git push origin v2.3.0`. Il workflow
  `.github/workflows/android.yml` crea la Release con l'APK firmato.
- **Avviso nell'app**: all'apertura l'app Android chiede a GitHub l'ultima Release e, se è più nuova, mostra «Aggiorna»
  (`src/lib/appUpdate.ts`, `src/components/layout/UpdateBanner.tsx`). Le build di prova (ramo `android-build`) non controllano.
- **Firma**: senza i segreti `ANDROID_KEYSTORE_*` l'APK è firmato con una chiave di debug e non si installa sopra la
  versione ufficiale. Chi pubblica una sua versione deve cambiare `appId` e nome.

## Licenza

[GPL-3.0-or-later](LICENSE): puoi usare, modificare e ridistribuire Ferro; chi distribuisce una versione modificata
deve pubblicarne il codice con la stessa licenza. Librerie e dati di terzi hanno le loro licenze (`site/licenze.html`).

## Struttura

```
src/
  components/   workout, program, nutrition, exercise, progress, layout, onboarding, ui
  hooks/        useAppData (dati), useHealthSync, useSheetsSync, useLibrary, usePWA, useMediaQuery
  services/     firebase, googleSheets, googleHealth, healthConnect, openFoodFacts, normalize, localStore
  lib/          prescription, stats, csv, tcx, coachSheet, sheetWrite, measuresSheet, healthMath,
                nutrition, healthNutrition, offMap, theme (con test in __tests__)
  data/         scheda di partenza
scripts/        update-exercises, patch-android, make-icons, check-contrast
site/           pagina di presentazione (radice del sito), informativa, immagini e font
.github/        workflow Android (APK/AAB)
public/icons/   icone e manifest per tema
```
