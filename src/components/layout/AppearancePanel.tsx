import { useSyncExternalStore } from 'react';
import { MODES, THEMES, getTheme, resolveMode, setTheme, subscribeTheme, type ThemeName } from '../../lib/theme';
import { Segmented } from '../ui/Segmented';
import { canVibrate, getFeedback, setFeedback, subscribeFeedback } from '../../lib/sound';

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
      <h3 className="font-display text-lg font-semibold">Aspetto</h3>
      <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
        {THEMES.map((t) => {
          const c = PREVIEW[t.id][mode];
          const on = prefs.theme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setTheme({ theme: t.id })}
              className={`rounded-xl border p-2 text-left transition ${on ? 'border-plate-text ring-1 ring-plate-text' : 'border-line hover:border-faint'}`}
            >
              <span className="block h-16 rounded-md p-2" style={{ background: c.bg, border: `1px solid ${c.line}` }} aria-hidden="true">
                <span className="block h-1.5 w-8 rounded-full" style={{ background: c.accent }} />
                <span className="mt-2 block h-1.5 w-12 rounded-full" style={{ background: c.ink, opacity: 0.8 }} />
                <span className="mt-1.5 block h-1.5 w-9 rounded-full" style={{ background: c.ink, opacity: 0.35 }} />
              </span>
              <span className="mt-1.5 block text-sm font-semibold">{t.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted">{THEMES.find((t) => t.id === prefs.theme)?.hint}</p>
      <Segmented label="Modalità" value={prefs.mode} onChange={(m) => setTheme({ mode: m })} options={MODES.map((m) => ({ value: m.id, label: m.label }))} />
      <div className="space-y-2 pt-1">
        <label className="flex min-h-11 items-center justify-between gap-3">
          <span>Suoni<span className="block text-sm text-muted">Fine recupero e ultimi secondi</span></span>
          <input type="checkbox" className="h-5 w-5 accent-plate" checked={feedback.sound} onChange={(e) => setFeedback({ sound: e.target.checked })} />
        </label>
        {canVibrate() && (
          <label className="flex min-h-11 items-center justify-between gap-3">
            <span>Vibrazione<span className="block text-sm text-muted">Serie registrata, record, fine recupero</span></span>
            <input type="checkbox" className="h-5 w-5 accent-plate" checked={feedback.vibration} onChange={(e) => setFeedback({ vibration: e.target.checked })} />
          </label>
        )}
      </div>
    </section>
  );
}
