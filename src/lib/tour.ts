import { t } from './i18n';

/**
 * Guida al primo accesso: tappe, testi e regola «quando parte da sola».
 * La parte visibile è in components/onboarding/Tour.tsx (Driver.js); qui solo logica pura, testata.
 */

/** Alzarla quando una funzione nuova merita la guida: chi ha visto la vecchia riceve solo l'avviso «Novità». */
export const TOUR_VERSION = 1;
export const TOUR_KEY = 'irontrack:tour';

export interface TourMemory {
  /** versione della guida a cui si riferisce */
  v: number;
  /** done: arrivato in fondo · skipped: chiusa prima · news-dismissed: avviso «Novità» chiuso senza guardarla */
  status: 'done' | 'skipped' | 'news-dismissed';
}

/** Cosa mostrare all'apertura: la guida, l'avviso «Novità» (chi usa già Ferro) o niente. */
export function autoTour(memory: TourMemory | null, sessionsCount: number): 'tour' | 'news' | 'none' {
  if (memory && memory.v >= TOUR_VERSION) return 'none';
  // chi ha già allenamenti (o ha visto una guida vecchia) conosce l'app: niente guida a tutto schermo
  return sessionsCount > 0 || memory ? 'news' : 'tour';
}

/** Elementi dell'app che la guida illumina: attributo data-tour, presente sia nella barra in basso sia in quella laterale. */
export type TourTarget = 'tab-workout' | 'tab-program' | 'tab-library' | 'tab-nutrition' | 'tab-progress' | 'account';

export interface TourStep {
  /** niente: finestra al centro dello schermo */
  target?: TourTarget;
  title: string;
  text: string;
}

export interface TourContext {
  /** app Android: Health Connect e aggiornamento dall'app */
  android: boolean;
  /** iPhone o iPad: Apple Salute al posto di Health Connect */
  ios: boolean;
  /** senza account: i dati restano solo sul dispositivo */
  guest: boolean;
}

export function tourSteps(ctx: TourContext): TourStep[] {
  const account = ctx.android
    ? t('Qui colleghi Health Connect, per scambiare allenamenti e pesate con l’orologio e le altre app, fai il backup e scegli tema e lingua. Quando esce una versione nuova, te lo dice Ferro.')
    : ctx.ios
      ? t('Qui colleghi Apple Salute o Google Health, fai il backup e scegli tema e lingua.')
      : t('Qui colleghi Google Health, fai il backup e scegli tema e lingua.');
  return [
    { title: t('Benvenuto in Ferro'), text: t('Ti mostro l’app in un minuto. Puoi saltare e rivedere la guida quando vuoi da Account e dati.') },
    { target: 'tab-workout', title: t('Ti alleni qui'), text: t('Scegli il giorno, segna serie e carichi: il recupero parte da solo e ti avvisa a fine pausa. Funziona anche senza rete.') },
    { target: 'tab-program', title: t('La tua scheda'), text: t('C’è una scheda di esempio. Modificala, creala da zero o collega il foglio Google del coach: quando la cambia, Ferro te lo dice.') },
    { target: 'tab-nutrition', title: t('Pasti e dieta'), text: t('Segna cosa mangi, anche con il codice a barre, l’acqua e la dieta della nutrizionista. È facoltativo.') },
    { target: 'tab-library', title: t('Come si esegue'), text: t('Oltre 800 esercizi con foto e muscoli. Molti hanno la scheda in italiano con gli errori comuni, alcuni l’animazione 3D.') },
    { target: 'tab-progress', title: t('I tuoi progressi'), text: t('Storico, record, peso e misure. Gli allenamenti si possono portare su Strava e Garmin.') },
    {
      target: 'account',
      title: t('Collega e personalizza'),
      text: [account, t('E qui ritrovi questa guida.'), ctx.guest ? t('Senza account i dati restano su questo dispositivo: accedi con Google per non perderli.') : '']
        .filter(Boolean)
        .join(' ')
    }
  ];
}
