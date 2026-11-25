/** Versione della build (commit e ora), iniettata da vite.config.ts */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** ID client OAuth «Applicazione web» del progetto Google: serve solo all'app Android per l'accesso Google nativo */
  readonly VITE_GOOGLE_WEB_CLIENT_ID?: string;
  /** '1' nei test automatici: accesso e database sugli emulatori Firebase locali */
  readonly VITE_FIREBASE_EMULATOR?: string;
  /** Versione dell'app Android (tag vX.Y.Z della Release), passata dal workflow: serve all'avviso di aggiornamento */
  readonly VITE_APP_VERSION?: string;
}
