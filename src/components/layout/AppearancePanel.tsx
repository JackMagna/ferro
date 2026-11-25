import { useSyncExternalStore } from 'react';
import { MODES, THEMES, getTheme, resolveMode, setTheme, subscribeTheme, type ThemeName } from '../../lib/theme';
import { Segmented } from '../ui/Segmented';
import { canVibrate, getFeedback, setFeedback, subscribeFeedback } from '../../lib/sound';
import { LANGS, lang, setLang, t, type Lang } from '../../lib/i18n';

/** Colori delle anteprime: fondo, testo e accento di ogni tema in modalità scura e chiara. */
const PREVIEW: Record<ThemeName, Record<'dark' | 'light', { bg: string; ink: string; accent: string; line: string }>> = {
  classico: { dark: { bg: '#1a1c1f', ink: '#eeebe4', accent: '#f0c33c', line: '#3a3f45' }, light: { bg: '#f3f0e8', ink: '#1d1f22', accent: '#f0c33c', line: '#d3cdbf' } },
  grafite: { dark: { bg: '#000000', ink: '#ffffff', accent: '#ff4b44', line: '#2e2e2e' }, light: { bg: '#ffffff', ink: '#000000', accent: '#d71921', line: '#dcdcdc' } },
  brace: { dark: { bg: '#0e0e10', ink: '#f4f3f0', accent: '#ff5a1f', line: '#2f2f35' }, light: { bg: '#f1f0ec', ink: '#111111', accent: '#ff5a1f', line: '#d9d6ce' } }
};

/** Scelta del tema (Classico, Grafite, Brace) e della modalità (Sistema, Scuro, Chiaro). */
export function AppearancePanel() {
  const prefs = useSyncExternalStore(subscribeTheme, getTheme);
  const feedback = useSyncExternalStore(subscribeFeedback, getFeedback);
  const systemDark = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const mode = resolveMode(prefs.mode, systemDark);

  return (
    <section className="space-y-3 border-t border-line pt-5">
      <h3 className="font-display text-lg font-semibold">{t('Aspetto')}</h3>
      <div role="radiogroup" aria-label={t('Tema')} className="grid grid-cols-3 gap-2">
        {THEMES.map((th) => {
          const c = PREVIEW[th.id][mode];
          const on = prefs.theme === th.id;
          return (
            <button
              key={th.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setTheme({ theme: th.id })}
              className={`rounded-xl border p-2 text-left transition ${on ? 'border-plate-text ring-1 ring-plate-text' : 'border-line hover:border-faint'}`}
            >
              <span className="block h-16 rounded-md p-2" style={{ background: c.bg, border: `1px solid ${c.line}` }} aria-hidden="true">
                <span className="block h-1.5 w-8 rounded-full" style={{ background: c.accent }} />
                <span className="mt-2 block h-1.5 w-12 rounded-full" style={{ background: c.ink, opacity: 0.8 }} />
                <span className="mt-1.5 block h-1.5 w-9 rounded-full" style={{ background: c.ink, opacity: 0.35 }} />
              </span>
              <span className="mt-1.5 block text-sm font-semibold">{t(th.label)}</span>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted">{t(THEMES.find((th) => th.id === prefs.theme)?.hint ?? '')}</p>
      <Segmented label={t('Modalità')} value={prefs.mode} onChange={(m) => setTheme({ mode: m })} options={MODES.map((m) => ({ value: m.id, label: t(m.label) }))} />
      <label className="block pt-1">
        <span className="label">{t('Lingua')}</span>
        <select className="field" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
          {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </label>
      <div className="space-y-2 pt-1">
        <label className="flex min-h-11 items-center justify-between gap-3">
          <span>{t('Suoni')}<span className="block text-sm text-muted">{t('Fine recupero e ultimi secondi')}</span></span>
          <input type="checkbox" className="h-5 w-5 accent-plate" checked={feedback.sound} onChange={(e) => setFeedback({ sound: e.target.checked })} />
        </label>
        {canVibrate() && (
          <label className="flex min-h-11 items-center justify-between gap-3">
            <span>{t('Vibrazione')}<span className="block text-sm text-muted">{t('Serie registrata, record, fine recupero')}</span></span>
            <input type="checkbox" className="h-5 w-5 accent-plate" checked={feedback.vibration} onChange={(e) => setFeedback({ vibration: e.target.checked })} />
          </label>
        )}
      </div>
    </section>
  );
}
