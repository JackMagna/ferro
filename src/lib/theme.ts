import { readJSON, writeJSON } from './storage';

/**
 * Aspetto dell'app: tre temi, ognuno scuro o chiaro.
 * I colori, gli angoli e i font stanno in `src/index.css`; qui si sceglie solo quale set usare,
 * mettendo `data-theme` e `data-mode` su <html>. Lo script in `index.html` fa lo stesso prima del primo disegno.
 */
export type ThemeName = 'classico' | 'grafite' | 'brace';
export type ThemeMode = 'dark' | 'light' | 'system';
export interface ThemePrefs { theme: ThemeName; mode: ThemeMode }

export const THEME_KEY = 'irontrack:theme';
export const THEMES: { id: ThemeName; label: string; hint: string }[] = [
  { id: 'classico', label: 'Classico', hint: 'Gomma, gesso e il giallo dei dischi' },
  { id: 'grafite', label: 'Grafite', hint: 'Bianco e nero, numeri a puntini' },
  { id: 'brace', label: 'Brace', hint: 'Superfici piene, angoli morbidi, accento arancione' }
];
export const MODES: { id: ThemeMode; label: string }[] = [
  { id: 'system', label: 'Sistema' },
  { id: 'dark', label: 'Scuro' },
  { id: 'light', label: 'Chiaro' }
];
export const DEFAULT_THEME: ThemePrefs = { theme: 'classico', mode: 'system' };

/** Colore della barra del browser per ogni combinazione (deve coincidere con --color-ink in index.css). */
export const BAR_COLOR: Record<ThemeName, Record<'dark' | 'light', string>> = {
  classico: { dark: '#1a1c1f', light: '#f3f0e8' },
  grafite: { dark: '#000000', light: '#ffffff' },
  brace: { dark: '#0e0e10', light: '#f1f0ec' }
};

/** Variante dell'icona dell'app per tema e modalità (file in public/icons/, creati da scripts/make-icons.mjs). */
export const iconVariant = (theme: ThemeName, mode: 'dark' | 'light') => (theme === 'grafite' ? `grafite-${mode}` : theme);

function setLink(rel: string, href: string) {
  const el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (el && el.getAttribute('href') !== href) el.setAttribute('href', href);
}

const isTheme = (v: unknown): v is ThemeName => v === 'classico' || v === 'grafite' || v === 'brace';
/** Nomi usati nella prima versione dei temi: la scelta già salvata viene convertita. */
const LEGACY: Record<string, ThemeName> = { attuale: 'classico', nothing: 'grafite', ibrido: 'brace' };
const isMode = (v: unknown): v is ThemeMode => v === 'dark' || v === 'light' || v === 'system';

/** Legge una preferenza salvata, scartando valori non validi. */
export function normalizeTheme(raw: unknown): ThemePrefs {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<ThemePrefs>;
  const theme = LEGACY[p.theme as string] ?? p.theme;
  return { theme: isTheme(theme) ? theme : DEFAULT_THEME.theme, mode: isMode(p.mode) ? p.mode : DEFAULT_THEME.mode };
}

/** Modalità effettiva: "system" segue il telefono. */
export const resolveMode = (mode: ThemeMode, systemDark: boolean): 'dark' | 'light' => (mode === 'system' ? (systemDark ? 'dark' : 'light') : mode);

const systemDark = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;

const listeners = new Set<() => void>();
let current: ThemePrefs = normalizeTheme(readJSON<unknown>(THEME_KEY, null));

export const getTheme = () => current;
export const subscribeTheme = (cb: () => void) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};

/** Applica il tema a <html> e al colore della barra del browser. */
export function applyTheme(prefs: ThemePrefs = current) {
  if (typeof document === 'undefined') return;
  const mode = resolveMode(prefs.mode, systemDark());
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  root.dataset.mode = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[prefs.theme][mode]);
  // icona della scheda del browser, di "Aggiungi a Home" e dell'installazione: seguono il tema
  // (un'app già installata tiene l'icona che aveva al momento dell'installazione: dipende dal sistema)
  const v = iconVariant(prefs.theme, mode);
  const icons = `${import.meta.env.BASE_URL}icons/`;
  setLink('icon', `${icons}ferro-${v}.svg`);
  setLink('apple-touch-icon', `${icons}ferro-${v}-180.png`);
  setLink('manifest', `${icons}manifest-${v}.webmanifest`);
}

export function setTheme(patch: Partial<ThemePrefs>) {
  current = normalizeTheme({ ...current, ...patch });
  writeJSON(THEME_KEY, current);
  applyTheme(current);
  listeners.forEach((l) => l());
}

/** Da chiamare una volta all'avvio: applica il tema e segue i cambi del telefono quando la modalità è "Sistema". */
export function initTheme() {
  applyTheme(current);
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (current.mode === 'system') applyTheme(current);
  });
}
