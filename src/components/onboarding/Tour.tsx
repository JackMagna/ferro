import { useCallback, useEffect, useRef, useState } from 'react';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import type { Tab } from '../layout/AppShell';
import { autoTour, TOUR_KEY, TOUR_VERSION, tourSteps, type TourMemory, type TourTarget } from '../../lib/tour';
import { readJSON, writeJSON } from '../../lib/storage';
import { isAndroidApp } from '../../services/healthConnect';
import { t } from '../../lib/i18n';
import { X } from '../ui/icons';

/** Sezione da aprire sotto ogni tappa, così dietro al fumetto si vede di cosa si parla. */
const TAB_OF: Partial<Record<TourTarget, Tab>> = {
  'tab-workout': 'workout',
  'tab-program': 'program',
  'tab-library': 'library',
  'tab-nutrition': 'nutrition',
  'tab-progress': 'progress'
};

/** Il pulsante visibile con quel data-tour: c'è sia nella barra in basso (telefono) sia in quella laterale (computer). */
function visible(target: TourTarget): Element {
  const all = [...document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)];
  return all.find((el) => el.getClientRects().length > 0) ?? all[0] ?? document.body;
}

/** Nei test con gli emulatori la guida non parte da sola (coprirebbe i pulsanti), salvo chi la prova apposta. */
const autoAllowed = () => import.meta.env.VITE_FIREBASE_EMULATOR !== '1' || readJSON<boolean>('irontrack:tour-test', false);

interface Options {
  ready: boolean;
  sessionsCount: number;
  guest: boolean;
  onTab: (tab: Tab) => void;
  notify: (message: string) => void;
}

/**
 * Guida al primo accesso con Driver.js (MIT). Parte da sola una volta per dispositivo, solo per chi è nuovo;
 * chi ha già allenamenti vede l'avviso «Novità». Si rivede da Account e dati (start).
 */
export function useTour({ ready, sessionsCount, guest, onTab, notify }: Options) {
  const [memory, setMemory] = useState(() => readJSON<TourMemory | null>(TOUR_KEY, null));
  const active = useRef<Driver | null>(null);
  const tabRef = useRef(onTab);
  tabRef.current = onTab;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const remember = (status: TourMemory['status']) => {
    const next = { v: TOUR_VERSION, status };
    writeJSON(TOUR_KEY, next);
    setMemory(next);
  };

  const start = useCallback(() => {
    active.current?.destroy();
    active.current = null;
    const steps = tourSteps({ android: isAndroidApp(), ios: /iphone|ipad|ipod/i.test(navigator.userAgent), guest });
    const last = steps.length - 1;
    let closed = false;
    // fine della guida, da qualsiasi strada (pulsanti, X, Esc, tocco fuori): onDestroyed di Driver.js
    // non arriva se si chiude prima che finisca l'animazione della tappa, quindi si chiude da qui
    const finish = (done: boolean, goTo: Tab = 'workout') => {
      if (closed) return;
      closed = true;
      d.destroy();
      if (active.current === d) active.current = null;
      remember(done ? 'done' : 'skipped');
      tabRef.current(goTo);
      if (!done) notifyRef.current(t('La guida resta in Account e dati.'));
    };
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const d = driver({
      animate: !reduced,
      smoothScroll: false,
      allowClose: true,
      overlayClickBehavior: 'close',
      disableActiveInteraction: true,
      stagePadding: 4,
      stageRadius: 12,
      overlayOpacity: 0.65,
      popoverClass: 'ferro-tour',
      showProgress: true,
      progressText: t('{{current}} di {{total}}'),
      nextBtnText: t('Avanti'),
      prevBtnText: t('Indietro'),
      doneBtnText: t('Inizia ad allenarti'),
      closeBtnLabel: t('Chiudi la guida'),
      steps: steps.map((s, i) => ({
        element: s.target ? () => visible(s.target!) : undefined,
        popover: {
          title: s.title,
          description: s.text,
          side: s.target === 'account' ? 'bottom' : 'top',
          align: 'center',
          showButtons: i === 0 ? ['next', 'close'] : ['next', 'previous', 'close'],
          ...(i === 0 ? { nextBtnText: t('Iniziamo') } : {}),
          ...(i === last ? { nextBtnText: t('Inizia ad allenarti'), doneBtnText: t('Inizia ad allenarti') } : {})
        },
        onHighlightStarted: () => {
          const tab = s.target && TAB_OF[s.target];
          if (tab) tabRef.current(tab);
        }
      })),
      onPopoverRender: (pop, { state }) => {
        pop.closeButton.innerHTML = '';
        pop.closeButton.append(iconX());
        const index = state.activeIndex ?? 0;
        // «Salta» scritto per esteso, non solo la X
        if (index < last) {
          const skip = button(t('Salta'), 'ferro-tour-skip', () => finish(false));
          pop.footer.prepend(skip);
        } else {
          // ultima tappa: seconda strada, collegare il foglio del coach
          const coach = button(t('Collega la scheda del coach'), 'ferro-tour-alt', () => finish(true, 'program'));
          pop.footerButtons.prepend(coach);
          pop.footer.classList.add('ferro-tour-last');
        }
      },
      onDoneClick: () => finish(true),
      // X, Esc e tocco fuori
      onDestroyStarted: () => finish(false)
    });
    active.current = d;
    d.drive();
  }, [guest]);

  const auto = autoTour(memory, sessionsCount);
  // all'avvio: la guida per chi è nuovo, dopo il caricamento dei dati e senza un allenamento in corso
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!ready || autoStarted.current || auto !== 'tour' || !autoAllowed()) return;
    if (readJSON<unknown>('irontrack:workout-draft', null) !== null) return;
    autoStarted.current = true;
    const timer = setTimeout(start, 400);
    return () => clearTimeout(timer);
  }, [ready, auto, start]);

  useEffect(() => {
    return () => { active.current?.destroy(); };
  }, []);

  return {
    start,
    /** avviso «Novità: guarda la guida» per chi usa già Ferro */
    showNews: ready && auto === 'news' && autoAllowed(),
    dismissNews: () => remember('news-dismissed')
  };
}

function button(label: string, className: string, onClick: () => void) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.className = className;
  b.addEventListener('click', onClick);
  return b;
}

function iconX() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'ferro-tour-x');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', 'M5 5l14 14M19 5L5 19');
  svg.append(p);
  return svg;
}

/** Riga in cima ad Allenamento per chi usa già Ferro: la guida c'è, se la vuole. */
export function TourNews({ onOpen, onDismiss }: { onOpen: () => void; onDismiss: () => void }) {
  return (
    <div role="status" className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-raised py-2 pl-4 pr-1 text-[15px]">
      <p className="flex-1">
        {t('Novità: una guida di un minuto su tutto quello che fa Ferro.')}{' '}
        <button type="button" onClick={onOpen} className="font-semibold underline">{t('Guardala')}</button>
      </p>
      <button type="button" onClick={onDismiss} aria-label={t('Chiudi')} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:text-chalk">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
