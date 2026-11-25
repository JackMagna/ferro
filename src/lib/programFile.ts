import type { WorkoutProgram } from '../types';
import { newId } from './ids';

/** File di una sola scheda, da condividere (corso, scheda scritta a mano). Diverso dal backup completo. */
export const PROGRAM_FILE = 'ferro-scheda';

export function blankProgram(): WorkoutProgram {
  return {
    title: '',
    athlete: '',
    trainer: '',
    totalWeeks: 4,
    days: [{ id: newId('giorno'), title: 'Giorno 1', exercises: [] }],
    guidelines: { modalitaEsecuzione: [], progressione: '', cedimento: '' }
  };
}

/** Il collegamento al foglio del coach e le date restano fuori: valgono solo per chi ha creato la scheda. */
export function programFile(p: WorkoutProgram): string {
  const { source: _source, updatedAt: _updated, startDate: _start, ...program } = p;
  return JSON.stringify({ app: PROGRAM_FILE, version: 1, program }, null, 2);
}

/** Scheda da un file di Ferro (scheda singola o backup completo); null se il file non è una scheda valida. */
export function parseProgramFile(raw: unknown): WorkoutProgram | null {
  const f = raw as { app?: string; program?: Partial<WorkoutProgram> } | null;
  if (!f || (f.app !== PROGRAM_FILE && f.app !== 'irontrack')) return null;
  const p = f.program;
  if (!p || !Array.isArray(p.days) || !p.days.every((d) => d && typeof d.id === 'string' && Array.isArray(d.exercises))) return null;
  const weeks = Number(p.totalWeeks);
  return {
    title: String(p.title ?? ''),
    athlete: String(p.athlete ?? ''),
    trainer: String(p.trainer ?? ''),
    totalWeeks: Number.isFinite(weeks) && weeks >= 1 && weeks <= 52 ? Math.round(weeks) : 4,
    days: p.days,
    guidelines: {
      modalitaEsecuzione: Array.isArray(p.guidelines?.modalitaEsecuzione) ? p.guidelines.modalitaEsecuzione.map(String) : [],
      progressione: String(p.guidelines?.progressione ?? ''),
      cedimento: String(p.guidelines?.cedimento ?? '')
    }
  };
}
