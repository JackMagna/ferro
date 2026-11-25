import { readJSON, writeJSON } from './storage';

/**
 * Traduzioni dell'app. Il testo italiano è la chiave: t('Salva') cerca 'Salva' nel dizionario della lingua scelta
 * e, se manca, mostra l'italiano. Le variabili si scrivono {nome}: t('{n} serie', { n: 3 }).
 */
export type Lang = 'it' | 'en' | 'es' | 'fr' | 'de';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'it', label: 'Italiano' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Deutsch' }
];
// Ogni area ha i suoi file: src/i18n/en.ts (generale) e src/i18n/<area>/en.ts ecc. Si uniscono da soli.
const parts = import.meta.glob<{ default: Record<string, string> }>("../i18n/**/*.ts", { eager: true });
const merged = (code: string) =>
  Object.entries(parts).filter(([p]) => p.endsWith("/" + code + ".ts")).reduce<Record<string, string>>((all, [, m]) => ({ ...all, ...m.default }), {});
export const DICTIONARIES: Record<Exclude<Lang, "it">, Record<string, string>> = { en: merged("en"), es: merged("es"), fr: merged("fr"), de: merged("de") };

const KEY = 'irontrack:lang';
const isLang = (v: unknown): v is Lang => LANGS.some((l) => l.id === v);

/** Lingua salvata, altrimenti quella del telefono; fuori dalle 5 lingue si usa l'inglese. */
export function detectLang(saved: unknown, browser: readonly string[]): Lang {
  if (isLang(saved)) return saved;
  for (const b of browser) {
    const code = b.slice(0, 2).toLowerCase();
    if (isLang(code)) return code;
  }
  return 'en';
}

export const lang: Lang = detectLang(
  readJSON<unknown>(KEY, null),
  typeof navigator === 'undefined' ? ['it'] : navigator.languages?.length ? navigator.languages : [navigator.language ?? 'it']
);
if (typeof document !== 'undefined') document.documentElement.lang = lang;
const dict: Record<string, string> = lang === 'it' ? {} : DICTIONARIES[lang];

export function t(it: string, vars?: Record<string, string | number>): string {
  const s = dict[it] ?? it;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

/** Cambia lingua: la pagina si ricarica, così tutti i testi (anche quelli calcolati all'avvio) cambiano insieme. */
export function setLang(l: Lang) {
  writeJSON(KEY, l);
  window.location.reload();
}

/** Formato di numeri e date della lingua scelta (Intl). */
export const locale = { it: 'it-IT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR', de: 'de-DE' }[lang];
