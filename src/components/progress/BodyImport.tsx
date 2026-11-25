import { useRef, useState } from 'react';
import { Copy, Upload } from '../ui/icons';
import type { Measurement } from '../../types';
import { BODY_PROMPT, parseBodyJson, type ImportedMeasurement } from '../../lib/bodyImport';
import { formatDate } from '../../lib/ids';
import { Button } from '../ui/Button';

interface Props {
  existing: Measurement[];
  startDate: string;
  totalWeeks: number;
  /** salva le misure; `replaceIds` sono le misure dello stesso giorno da sostituire */
  onImport: (items: ImportedMeasurement[], replaceIds: string[]) => void;
  onClose: () => void;
}

const fmt = (n?: number, unit = '') => (n === undefined ? null : `${n.toLocaleString('it-IT', { maximumFractionDigits: 1 })}${unit}`);

/** Misure e massa grassa da un referto: prompt da copiare, risposta da incollare, anteprima. */
export function BodyImport({ existing, startDate, totalWeeks, onImport, onClose }: Props) {
  const [text, setText] = useState('');
  const [items, setItems] = useState<ImportedMeasurement[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [replace, setReplace] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const read = (value = text) => {
    const r = parseBodyJson(value, { startDate, totalWeeks });
    setError(r.error ?? '');
    setWarnings(r.warnings);
    setItems(r.error ? null : r.measurements);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(BODY_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Non riesco a copiare in automatico: apri «Mostra il prompt» e copialo a mano.');
    }
  };

  const sameDay = (items ?? []).flatMap((i) => existing.filter((m) => m.date === i.date));

  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>Copia il prompt.</li>
        <li>Aprilo nel servizio che preferisci e allega il referto (bioimpedenza, plicometria, DEXA: PDF o foto).</li>
        <li>Incolla qui la risposta, oppure carica il file <code>.json</code> o <code>.txt</code>.</li>
      </ol>
      <p className="rounded-xl bg-plate-soft p-2 text-sm">Il referto contiene dati sulla tua salute e va al servizio che scegli, non a Ferro: se puoi, scegline uno in cui disattivare l'uso dei dati per l'addestramento.</p>
      <div className="flex flex-wrap gap-2">
        <Button icon={<Copy className="h-4 w-4" />} onClick={copy}>{copied ? 'Prompt copiato' : 'Copia il prompt'}</Button>
        <Button icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>Carica un file</Button>
        <input
          ref={fileRef} type="file" accept=".json,.txt,application/json,text/plain" className="sr-only" aria-label="File con la risposta"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const t = await f.text();
            setText(t);
            read(t);
          }}
        />
      </div>
      <details className="text-sm">
        <summary className="min-h-10 cursor-pointer py-2 text-muted">Mostra il prompt</summary>
        <textarea aria-label="Prompt" readOnly rows={6} className="field mt-1 font-mono text-xs" value={BODY_PROMPT} onFocus={(e) => e.currentTarget.select()} />
      </details>
      <textarea aria-label="Risposta del servizio" rows={5} className="field font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={'Incolla qui la risposta (il JSON con "format": "irontrack-body-v1")'} />
      <Button variant="primary" disabled={!text.trim()} onClick={() => read()}>Leggi la risposta</Button>
      {error && <p role="alert" className="text-sm text-stop">{error}</p>}
      {warnings.length > 0 && <ul className="list-disc pl-5 text-sm text-muted">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>}

      {items && items.length > 0 && (
        <section aria-label="Anteprima" className="space-y-3">
          <h3 className="font-display text-lg font-semibold">{items.length === 1 ? '1 misura da importare' : `${items.length} misure da importare`}</h3>
          <ul className="divide-y divide-line/60 rounded-xl border border-line">
            {items.map((m) => (
              <li key={m.date} className="space-y-1 p-3">
                <p className="font-semibold">{formatDate(m.date)} <span className="font-normal text-muted">· settimana {m.week}</span></p>
                <p className="text-[15px]">
                  {[fmt(m.weightKg, ' kg'), m.bodyFat !== undefined && `grasso ${fmt(m.bodyFat, '%')}`, m.waistCm !== undefined && `vita ${fmt(m.waistCm, ' cm')}`, m.abdomenCm !== undefined && `addome ${fmt(m.abdomenCm, ' cm')}`, m.hipsCm !== undefined && `fianchi ${fmt(m.hipsCm, ' cm')}`, m.armsCm !== undefined && `braccio ${fmt(m.armsCm, ' cm')}`, m.thighsCm !== undefined && `coscia ${fmt(m.thighsCm, ' cm')}`, m.chestCm !== undefined && `petto ${fmt(m.chestCm, ' cm')}`].filter(Boolean).join(' · ') || 'Solo note'}
                </p>
                {m.notes && <p className="whitespace-pre-line text-sm text-muted">{m.notes}</p>}
              </li>
            ))}
          </ul>
          {sameDay.length > 0 && (
            <label className="flex items-start gap-3 rounded-xl bg-ink p-3 text-[15px]">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-plate" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
              <span>Sostituisci {sameDay.length === 1 ? 'la misura già salvata' : `le ${sameDay.length} misure già salvate`} negli stessi giorni<span className="block text-sm text-muted">Se lo togli, le misure del referto si aggiungono a quelle esistenti.</span></span>
            </label>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={onClose}>Annulla</Button>
            <Button variant="primary" onClick={() => onImport(items, replace ? sameDay.map((m) => m.id) : [])}>Importa</Button>
          </div>
        </section>
      )}
    </div>
  );
}
