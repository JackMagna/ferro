import type { Measurement } from '../types';
import { extractJsonObject } from './nutrition';
import { weekOfDate } from './measuresSheet';

/**
 * Misure da un referto (bioimpedenza, plicometria, DEXA, visita), con lo stesso schema della dieta:
 * l'app dà un prompt, l'utente lo usa con il servizio che preferisce allegando il referto,
 * e incolla qui la risposta nel formato fisso irontrack-body-v1. L'app non chiama nessuna IA.
 */
export const BODY_FORMAT = 'irontrack-body-v1';

export const BODY_PROMPT = `Ti allego un referto con misure corporee (bioimpedenza, plicometria, DEXA o visita). Devi TRASCRIVERE le misure nel formato JSON qui sotto, senza interpretarle né calcolare nulla.

REGOLE
1. Solo valori scritti nel documento; se un dato manca usa null. Non ricavare valori da altri (per esempio la massa grassa in % dai kg).
2. Un elemento in "measurements" per ogni data di misura presente nel documento.
3. Unità: peso in kg, massa grassa in %, circonferenze in cm. Converti solo se è diretto (g→kg, mm→cm) e scrivilo in "notes".
4. Se la massa grassa è indicata solo in kg, lascia bodyFat a null e riporta il valore in "notes".
5. Altri valori (massa magra, acqua, metabolismo basale, angolo di fase…) vanno in "notes" della misura.
6. Valori dubbi o illeggibili: in "notes" iniziando con "DA CONTROLLARE:".
7. Numeri con il punto decimale e senza unità; date nel formato AAAA-MM-GG.
8. Rispondi SOLO con il JSON, in un unico blocco di codice.

FORMATO
{
  "format": "${BODY_FORMAT}",
  "source": "Bioimpedenza",
  "measurements": [
    {
      "date": "2026-10-20",
      "weightKg": null,
      "bodyFat": null,
      "chestCm": null,
      "waistCm": null,
      "abdomenCm": null,
      "hipsCm": null,
      "armsCm": null,
      "thighsCm": null,
      "notes": null
    }
  ]
}`;

type Field = 'weightKg' | 'bodyFat' | 'chestCm' | 'waistCm' | 'abdomenCm' | 'hipsCm' | 'armsCm' | 'thighsCm';
/** Valori plausibili: fuori da questi limiti il dato viene scartato con un avviso. */
const RANGE: Record<Field, [number, number, string]> = {
  weightKg: [25, 350, 'peso'],
  bodyFat: [2, 75, 'massa grassa'],
  chestCm: [40, 220, 'petto'],
  waistCm: [40, 250, 'vita'],
  abdomenCm: [40, 250, 'addome'],
  hipsCm: [40, 250, 'fianchi'],
  armsCm: [10, 80, 'braccio'],
  thighsCm: [20, 120, 'coscia']
};
const FIELDS = Object.keys(RANGE) as Field[];

export type ImportedMeasurement = Omit<Measurement, 'id'>;
export interface BodyParseResult { measurements: ImportedMeasurement[]; warnings: string[]; error?: string }

const toNum = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};
const validDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));

/** Legge la risposta incollata; `startDate` e `totalWeeks` servono per la settimana (colonna del foglio del coach). */
export function parseBodyJson(text: string, ctx: { startDate: string; totalWeeks: number; today?: string }): BodyParseResult {
  const raw = extractJsonObject(text.replace(/[“”]/g, '"'));
  if (!raw) return { measurements: [], warnings: [], error: 'Non trovo nessun JSON nel testo incollato. Incolla la risposta intera del servizio.' };
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { measurements: [], warnings: [], error: 'Il JSON è incompleto o ha errori (virgole, parentesi). Chiedi al servizio di rispondere di nuovo, solo con il JSON.' };
  }
  if (data.format !== BODY_FORMAT) return { measurements: [], warnings: [], error: `Formato non riconosciuto: mi aspetto "format": "${BODY_FORMAT}". Usa il prompt dell'app.` };
  if (!Array.isArray(data.measurements)) return { measurements: [], warnings: [], error: 'Nel JSON manca l\'elenco "measurements".' };

  const today = ctx.today ?? new Date().toISOString().slice(0, 10);
  const source = typeof data.source === 'string' && data.source.trim() ? `Referto · ${data.source.trim().slice(0, 40)}` : 'Referto';
  const warnings: string[] = [];
  const out: ImportedMeasurement[] = [];
  let noDate = 0;

  for (const item of data.measurements as unknown[]) {
    if (!item || typeof item !== 'object') continue;
    const m = item as Record<string, unknown>;
    if (!validDate(m.date)) { noDate++; continue; }
    if (m.date > today) warnings.push(`La data ${m.date} è nel futuro: controllala.`);
    const values: Partial<Record<Field, number>> = {};
    for (const f of FIELDS) {
      const n = toNum(m[f]);
      if (n === undefined) continue;
      const [min, max, label] = RANGE[f];
      if (n < min || n > max) { warnings.push(`${m.date}: ${label} ${n} fuori scala, non importato.`); continue; }
      values[f] = Math.round(n * 10) / 10;
    }
    const notes = typeof m.notes === 'string' && m.notes.trim() ? m.notes.trim() : undefined;
    if (!Object.keys(values).length && !notes) continue;
    if (notes && /DA CONTROLLARE/i.test(notes)) warnings.push(`${m.date}: il servizio ha segnalato dati da controllare (vedi note).`);
    out.push({ date: m.date, week: weekOfDate(ctx.startDate, m.date, ctx.totalWeeks), ...values, notes, source });
  }
  if (noDate) warnings.push(`${noDate} ${noDate === 1 ? 'misura scartata' : 'misure scartate'} perché senza una data valida.`);
  if (!out.length) return { measurements: [], warnings, error: 'Nel JSON non ci sono misure con una data e almeno un valore.' };
  out.sort((a, b) => a.date.localeCompare(b.date));
  return { measurements: out, warnings };
}
