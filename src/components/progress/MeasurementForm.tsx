import { useState } from 'react';
import type { Measurement } from '../../types';
import { ALL_FIELDS, FIELD_UNIT, parseNumber, weekDate, type MeasureField } from '../../lib/measuresSheet';
import { newId, todayISO } from '../../lib/ids';
import { Button } from '../ui/Button';
import { locale, t } from '../../lib/i18n';

/** Nomi delle misure da mostrare (FIELD_LABEL resta in italiano: serve per il foglio del coach). */
export const fieldLabel = (f: MeasureField): string => ({
  weightKg: t('Peso'), waistCm: t('Vita'), abdomenCm: t('Addome'), hipsCm: t('Fianchi'), armsCm: t('Braccio'), thighsCm: t('Coscia'), chestCm: t('Petto'), bodyFat: t('Grasso')
})[f];

interface Props {
  latest?: Measurement;
  totalWeeks: number;
  /** settimana del programma in cui siamo oggi */
  currentWeek: number;
  startDate: string;
  onSave: (m: Measurement) => void;
  onCancel: () => void;
}

// stesso ordine delle righe nel foglio del coach
const ORDER: MeasureField[] = ['weightKg', 'waistCm', 'abdomenCm', 'hipsCm', 'armsCm', 'thighsCm', 'chestCm', 'bodyFat'];

export function MeasurementForm({ latest, totalWeeks, currentWeek, startDate, onSave, onCancel }: Props) {
  const [week, setWeek] = useState(currentWeek);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(ALL_FIELDS.map((f) => [f, latest?.[f] !== undefined ? String(latest[f]).replace('.', ',') : ''])));
  const [notes, setNotes] = useState('');
  const parsed = Object.fromEntries(ALL_FIELDS.map((f) => [f, parseNumber(values[f])])) as Record<MeasureField, number | undefined>;
  const anyValue = ALL_FIELDS.some((f) => parsed[f] !== undefined);
  const bad = ALL_FIELDS.filter((f) => values[f].trim() !== '' && parsed[f] === undefined);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!anyValue || bad.length) return;
        const date = todayISO();
        onSave({ id: newId('m'), date, week, notes: notes.trim() || undefined, ...Object.fromEntries(ALL_FIELDS.filter((f) => parsed[f] !== undefined).map((f) => [f, parsed[f]])) });
      }}
    >
      <p className="text-sm text-faint">
        {t("Nel foglio del coach ogni misura va nella colonna della settimana. I campi partono dall'ultima misurazione: cambia solo quello che serve.")}
      </p>
      <div>
        <label className="label" htmlFor="m-week">{t('Settimana')}</label>
        <select id="m-week" className="field" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
          {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => (
            <option key={w} value={w}>{t('Settimana {n} (dal {d})', { n: w, d: new Date(`${weekDate(startDate, w)}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) })}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ORDER.map((f) => (
          <div key={f}>
            <label className="label" htmlFor={`m-${f}`}>{f === 'armsCm' ? t('Braccio contratto') : fieldLabel(f)} ({FIELD_UNIT[f]})</label>
            <input
              id={`m-${f}`} className="field" inputMode="decimal" aria-invalid={bad.includes(f)}
              value={values[f]} onChange={(e) => setValues({ ...values, [f]: e.target.value })}
            />
          </div>
        ))}
      </div>
      {bad.length > 0 && <p role="alert" className="text-sm text-stop">{t('Scrivi solo numeri: {campi}.', { campi: bad.map(fieldLabel).join(', ') })}</p>}
      <div>
        <label className="label" htmlFor="m-notes">{t('Note')}</label>
        <input id="m-notes" className="field" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('Es. pesata a digiuno')} />
      </div>
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>{t('Annulla')}</Button>
        <Button type="submit" variant="primary" disabled={!anyValue || bad.length > 0}>{t('Salva misura')}</Button>
      </div>
    </form>
  );
}
