# Ferro

**English** · [Italiano](README.it.md)

Web app (PWA) to follow your training program at the gym: sets, loads, rest times, records, body measurements and meals.
It works offline and installs on your phone. It used to be called **IronTrack**: the storage keys and the backup
format are still `irontrack`, so existing data keeps working.

Online: https://palestra-kohl.vercel.app (landing page, also in English, Spanish, French and German under `/en/`, `/es/`, `/fr/`, `/de/`) · app at https://palestra-kohl.vercel.app/app/

## What it does

- **Editable program** in the app: days, exercises, sets and reps per week, rest times and notes.
- **Public exercise library**: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain), 800+ exercises with photos and muscles.
- **Muscle map**: [react-body-highlighter](https://github.com/giavinh79/react-body-highlighter) (MIT).
- **Data**: Firestore with offline cache (with a Google account) or only on the device (without an account). Backup and restore from a file.
- **Google Sheets**: reads the coach's program from the shared sheet and writes the loads into it (next to "3X10" in that week's cell) along with the measurements. Cells the coach edits are never touched.
- **Measurements**: the coach's MISURE tab (columns = weeks, rows PESO, VITA, ADDOME, FIANCHI, BRACCIO, COSCIA) is read and written both ways. If a cell has a different value from the app, the app asks which one to keep.
- **Meals**: diary with calories, macros, fiber, sugars, salt and meal time; daily goal and trend over the last 7 days.
- **Barcode**: looks up a product on [Open Food Facts](https://world.openfoodfacts.org) with the camera (if the browser supports `BarcodeDetector`), by typing the code or by name; the per-100 g values become those of the portion eaten.
- **Nutritionist's diet plan, with no AI in the app**: the app provides a prompt; you use it with the service you prefer, attaching the diet file, and paste the answer into the app (format `irontrack-diet-v1`). It works for diets with exact meals, with macros only (kcal are calculated: 4·P + 4·C + 9·F) or with both. Reading pasted text is still supported.
- **Health data** (optional, one source at a time): **Google Health** (from the website too) or **Health Connect** (Android app only). They import weight, body fat and heart rate; weigh-ins entered in the app are sent to the chosen source. With Google Health, workouts and, if enabled, meals are recorded too.
- **Apple Health (iPhone)**: two Shortcuts («Ferro Salute» and «Salute Ferro») bring weigh-ins, body fat, calories and macros into Health and Health weigh-ins into Ferro (`src/lib/appleHealthBridge.ts`, guide on the landing page).
- **Heart rate** over Bluetooth (Chrome on Android and desktop) and TCX export for Strava/Garmin.
- **Look**: three themes (Classico, Grafite, Brace), each dark, light or following the system. Logo and icon follow the chosen theme.

## Development

```bash
bun install        # or npm install
bun run dev        # http://localhost:3000
bun run test       # tests (vitest)
bun run build      # type check + production build
node scripts/check-contrast.mjs   # color contrast of all themes (WCAG 4.5:1)
```

Deployment to Vercel is automatic on every push to `main`. The app lives in `/app/` (Vite `base`); the `site/` folder (landing page and its translations in `site/en`, `site/es`, `site/fr`, `site/de`, privacy policy, `sw.js` that disables the old root service worker) is copied to the root of `dist/`. The Android app is built with `APP_BASE=/`.

## Themes, logo and icons

Colors, corner radii and fonts of each theme are CSS variables in `src/index.css` (`html[data-theme][data-mode]`);
the choice is in `src/lib/theme.ts` and a script in `index.html` applies it before the first paint.
The app icons (SVG, PNG and one manifest per theme) are in `public/icons/` and are regenerated with:

```bash
node scripts/make-icons.mjs   # needs sharp (npm i -g sharp)
```

An already installed app keeps the icon it had when it was installed: this is an Android and iOS limitation.

## Updating the exercise library

```bash
bun run update-exercises
```

Then update `LIBRARY_COMMIT` in `src/lib/exerciseLibrary.ts` with the latest free-exercise-db commit,
so the photos match the data.

## Google Health (weight, body fat, heart rate, workouts, meals)

The old Fitbit APIs are shut down at the end of October 2026 (and new apps can no longer be registered): the connection uses the **Google Health API** (v4),
with the same Google sign-in as the app. No external app needs to be registered.

In the Google Cloud project (once):
1. enable the **Google Health API** (`health.googleapis.com`);
2. in *Google Auth Platform → Data access* add the scopes
   `googlehealth.health_metrics_and_measurements.readonly`, `googlehealth.health_metrics_and_measurements.writeonly`,
   `googlehealth.activity_and_fitness.writeonly` and `googlehealth.nutrition.writeonly` (meals);
3. add the accounts as *test users* (up to 100; beyond that Google verification is required).

In the app: account icon → *Health data* → *Google Health* → *Connect Google Health*. The Google account must have a
Google Health profile (Google Health app on the phone, "Sign in with Google", or migration of the Fitbit account).
The permission lasts about an hour: then "Reconnect Google Health" appears. Sending meals is enabled with «Send meals to Google Health»
(after enabling it you need to reconnect to accept the new permission). All the code is in `src/services/googleHealth.ts`
and `src/lib/healthNutrition.ts`.

## Google Sheets and the coach's program

The sheet must be shared with your account as **Editor**. In the app: *Program → Connect the coach's program*.
The app recognizes `GIORNO 1` rows, `1 SETT.`…`6 SETT.` columns, section headers (`PROGRESSIONE SERIE X REP RIP. 2'`) and the exercises.

## Firebase

The configuration is in `src/services/firebase.ts`; the API key comes from the `VITE_FIREBASE_API_KEY` variable
(on Vercel, in the `FIREBASE_API_KEY` GitHub Actions secret and in `.env.local` for development, see `.env.example`).
The key still ships inside the app: real protection comes from the key's restrictions in Google Cloud
(HTTP referrers and allowed APIs) and from the rules in `firestore.rules`.
After deploying to Vercel, add the domain under *Authentication → Settings → Authorized domains*.

The rules in `firestore.rules` (which include `users/{uid}/meals`) must be **republished by hand** after every change:
Firebase console → *Firestore → Rules* → paste the file → *Publish*. The repository has no `firebase.json`
or `.firebaserc`, so `firebase deploy` does not work without configuring them first.

## Android app

The same code as the website, packaged with Capacitor (`capacitor.config.json`, `scripts/patch-android.mjs`, native
code in `native/android`). It is not on Google Play: the APK is downloaded from the website, which always points to the latest Release
(`releases/latest/download/ferro-release.apk`).

- **New version**: update `version` in `package.json`, then `git tag v2.3.0 && git push origin v2.3.0`. The workflow
  `.github/workflows/android.yml` creates the Release with the signed APK.
- **In-app notice**: on startup the Android app asks GitHub for the latest Release and, if it is newer, shows «Update»
  (`src/lib/appUpdate.ts`, `src/components/layout/UpdateBanner.tsx`). Test builds (`android-build` branch) do not check.
- **Signing**: without the `ANDROID_KEYSTORE_*` secrets the APK is signed with a debug key and does not install over the
  official version. Anyone publishing their own version must change `appId` and the name.

## License

[GPL-3.0-or-later](LICENSE): you can use, modify and redistribute Ferro; anyone distributing a modified version
must publish its source code under the same license. Third-party libraries and data have their own licenses (`site/licenze.html`).

## Structure

```
src/
  components/   workout, program, nutrition, exercise, progress, layout, onboarding, ui
  hooks/        useAppData (data), useHealthSync, useSheetsSync, useLibrary, usePWA, useMediaQuery
  services/     firebase, googleSheets, googleHealth, healthConnect, openFoodFacts, normalize, localStore
  lib/          prescription, stats, csv, tcx, coachSheet, sheetWrite, measuresSheet, healthMath,
                nutrition, healthNutrition, offMap, theme (with tests in __tests__)
  data/         starter program
scripts/        update-exercises, patch-android, make-icons, check-contrast
site/           landing page (site root) and its translations, privacy policy, images and fonts
.github/        Android workflow (APK/AAB)
public/icons/   icons and manifest per theme
```
