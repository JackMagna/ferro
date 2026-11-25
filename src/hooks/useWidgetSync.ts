import { useEffect, useRef } from 'react';
import type { DietPlan, FoodEntry, WorkoutProgram, WorkoutSession } from '../types';
import { buildWidgetData, readPalette } from '../lib/widgetData';
import { pushWidgetData, takeLaunchTab, widgetsAvailable } from '../services/widgets';
import { loadDraft } from '../components/workout/draft';
import { subscribeTheme } from '../lib/theme';

const TABS = ['workout', 'program', 'nutrition', 'library', 'progress'] as const;
type LaunchTab = (typeof TABS)[number];

interface Args {
  ready: boolean;
  program: WorkoutProgram;
  sessions: WorkoutSession[];
  meals: FoodEntry[];
  dietPlan: DietPlan | null;
  consented: boolean;
  onLaunchTab: (tab: LaunchTab) => void;
}

/**
 * Tiene aggiornati i widget Android (scheda, pasti, frasi) e apre la sezione giusta
 * quando l'app viene aperta da un widget. Sul sito e su iPhone non fa niente.
 */
export function useWidgetSync({ ready, program, sessions, meals, dietPlan, consented, onLaunchTab }: Args) {
  const latest = useRef({ program, sessions, meals, dietPlan, consented });
  latest.current = { program, sessions, meals, dietPlan, consented };
  const launch = useRef(onLaunchTab);
  launch.current = onLaunchTab;
  const enabled = widgetsAvailable();

  const push = () => {
    const a = latest.current;
    void pushWidgetData(buildWidgetData({ ...a, draft: loadDraft(), palette: readPalette() }));
  };

  // dopo ogni cambiamento dei dati (con un attimo di attesa per raggruppare le modifiche)
  useEffect(() => {
    if (!enabled || !ready) return;
    const t = setTimeout(push, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ready, program, sessions, meals, dietPlan, consented]);

  // tema cambiato, uscita dall'app (allenamento in corso), ritorno dall'app (sezione richiesta dal widget)
  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = subscribeTheme(() => {
      // aspetta che le variabili CSS del nuovo tema siano applicate
      setTimeout(push, 50);
    });
    const checkLaunch = () => {
      void takeLaunchTab().then((tab) => {
        if (tab && (TABS as readonly string[]).includes(tab)) launch.current(tab as LaunchTab);
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') push();
      else checkLaunch();
    };
    checkLaunch();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
