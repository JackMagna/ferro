import { useRef, useState } from 'react';
import { Copy, Plus, Trash2, Upload } from '../ui/icons';
import type { DietDay, DietPlan, MealType, PlanMeal } from '../../types';
import { DIET_PROMPT, MEAL_LABEL, MEAL_TYPES, WEEKDAY_SHORT, mealKcalComputed, parseDietJson, parseDietText } from '../../lib/nutrition';
import { parseNumber } from '../../lib/measuresSheet';
import { newId } from '../../lib/ids';
import { Sheet } from '../ui/Sheet';
import { Button, IconButton } from '../ui/Button';

interface Props {
  open: boolean;
  plan: DietPlan | null;
  onClose: () => void;
  onSave: (p: DietPlan) => void;
}

const EMPTY: DietPlan = { title: 'Piano alimentare', days: [] };
const txt = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','));
const num = (v: string) => (v.trim() === '' ? undefined : parseNumber(v));

/** Inserimento e modifica della dieta data dalla nutrizionista. */
export function DietPlanEditor({ open, plan, onClose, onSave }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={plan ? 'Modifica la dieta' : 'Inserisci la dieta'} size="lg">
      <Editor plan={plan} onClose={onClose} onSave={onSave} />
    </Sheet>
  );
}

function Editor({ plan, onClose, onSave }: Omit<Props, 'open'>) {
  const [draft, setDraft] = useState<DietPlan>(() => (plan ? structuredClone(plan) : { ...EMPTY }));
  const [pasted, setPasted] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [json, setJson] = useState('');
  const [jsonMsg, setJsonMsg] = useState<{ ok: boolean; text: string; warnings: string[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof DietPlan>(k: K, v: DietPlan[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setDay = (i: number, patch: Partial<DietDay>) => set('days', draft.days.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const setMeal = (i: number, j: number, patch: Partial<PlanMeal>) => setDay(i, { meals: draft.days[i].meals.map((m, k) => (k === j ? { ...m, ...patch } : m)) });

  const importText = () => {
    const days = parseDietText(pasted);
    if (!days.length) {
      setImportMsg('Non ho trovato pasti nel testo. Servono righe come “Colazione: …”, “Pranzo”, “Cena”.');
      return;
    }
    if (draft.days.length && !window.confirm('Sostituire i giorni e i pasti già inseriti con quelli del testo?')) return;
    set('days', days);
    setPasted('');
    setImportMsg(`Letti ${days.length} ${days.length === 1 ? 'giorno' : 'giorni'} e ${days.reduce((n, d) => n + d.meals.length, 0)} pasti. Controlla e correggi qui sotto.`);
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(DIET_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setJsonMsg({ ok: false, text: 'Non riesco a copiare in automatico: seleziona il testo del prompt qui sotto e copialo a mano.', warnings: [] });
    }
  };

  const importJson = (text = json) => {
    const r = parseDietJson(text);
    if (!r.plan) {
      setJsonMsg({ ok: false, text: r.error ?? 'Non riesco a leggere la risposta.', warnings: r.warnings });
      return;
    }
    if (draft.days.length && !window.confirm('Sostituire i giorni, i pasti e gli obiettivi già inseriti con quelli della risposta?')) return;
    const p = r.plan;
    setDraft((d) => ({ ...d, title: p.title || d.title, nutritionist: p.nutritionist, startDate: p.startDate, endDate: p.endDate, kcalTarget: p.kcalTarget, proteinG: p.proteinG, carbsG: p.carbsG, fatG: p.fatG, waterMl: p.waterMl, notes: p.notes, days: p.days }));
    setJson('');
    const meals = p.days.reduce((n, d) => n + d.meals.length, 0);
    setJsonMsg({ ok: true, text: `Letti ${p.days.length} ${p.days.length === 1 ? 'giorno' : 'giorni'} e ${meals} pasti. Controlla e correggi qui sotto prima di salvare.`, warnings: r.warnings });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setJson(text);
    importJson(text);
    if (fileRef.current) fileRef.current.value = '';
  };

  const field = (id: string, label: string, value: string, onChange: (v: string) => void, props: { type?: string; placeholder?: string } = {}) => (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} inputMode={props.type === 'date' ? undefined : props.type === 'text' ? undefined : 'decimal'} type={props.type === 'date' ? 'date' : 'text'} placeholder={props.placeholder} />
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">{field('d-title', 'Nome del piano', draft.title, (v) => set('title', v), { type: 'text' })}</div>
        {field('d-nutri', 'Nutrizionista', draft.nutritionist ?? '', (v) => set('nutritionist', v || undefined), { type: 'text', placeholder: 'Es. dott.ssa Rossi' })}
        {field('d-kcal', 'Calorie al giorno (kcal)', txt(draft.kcalTarget), (v) => set('kcalTarget', num(v)), { placeholder: 'Es. 2000' })}
        {field('d-start', 'Dal', draft.startDate ?? '', (v) => set('startDate', v || undefined), { type: 'date' })}
        {field('d-end', 'Al', draft.endDate ?? '', (v) => set('endDate', v || undefined), { type: 'date' })}
        {field('d-p', 'Proteine (g)', txt(draft.proteinG), (v) => set('proteinG', num(v)))}
        {field('d-c', 'Carboidrati (g)', txt(draft.carbsG), (v) => set('carbsG', num(v)))}
        {field('d-f', 'Grassi (g)', txt(draft.fatG), (v) => set('fatG', num(v)))}
        {field('d-water', 'Acqua al giorno (ml)', txt(draft.waterMl), (v) => set('waterMl', num(v)), { placeholder: 'Es. 2000' })}
        <div className="sm:col-span-2">
          <label className="label" htmlFor="d-notes">Indicazioni della nutrizionista</label>
          <textarea id="d-notes" rows={2} className="field" value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value || undefined)} placeholder="Es. bere 2 litri d'acqua, pesare gli alimenti a crudo" />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-line p-3">
        <h3 className="font-display text-lg font-semibold">Dal file della nutrizionista</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Copia il prompt.</li>
          <li>Aprilo nel servizio che preferisci e allega il file della dieta (PDF, foto o testo).</li>
          <li>Incolla qui la risposta, oppure carica il file <code>.json</code> o <code>.txt</code>.</li>
        </ol>
        <p className="rounded-xl bg-plate/10 p-2 text-sm">Il file contiene dati sulla tua salute e va al servizio che scegli, non a Ferro: se puoi, scegline uno in cui disattivare l'uso dei dati per l'addestramento.</p>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Copy className="h-4 w-4" />} onClick={copyPrompt}>{copied ? 'Prompt copiato' : 'Copia il prompt'}</Button>
          <Button icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>Carica un file</Button>
          <input ref={fileRef} type="file" accept=".json,.txt,application/json,text/plain" className="sr-only" aria-label="File con la risposta" onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
        <details className="text-sm">
          <summary className="min-h-10 cursor-pointer py-2 text-muted">Mostra il prompt</summary>
          <textarea aria-label="Prompt" readOnly rows={6} className="field mt-1 font-mono text-xs" value={DIET_PROMPT} onFocus={(e) => e.currentTarget.select()} />
        </details>
        <textarea aria-label="Risposta del servizio" rows={5} className="field font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} placeholder={'Incolla qui la risposta (il JSON con "format": "irontrack-diet-v1")'} />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" disabled={!json.trim()} onClick={() => importJson()}>Leggi la risposta</Button>
          {jsonMsg && <p role={jsonMsg.ok ? 'status' : 'alert'} className={`text-sm ${jsonMsg.ok ? 'text-muted' : 'text-stop'}`}>{jsonMsg.text}</p>}
        </div>
        {jsonMsg?.warnings.length ? <ul className="list-disc pl-5 text-sm text-muted">{jsonMsg.warnings.map((w) => <li key={w}>{w}</li>)}</ul> : null}
      </section>

      <details className="rounded-2xl border border-line p-3">
        <summary className="min-h-10 cursor-pointer py-2 font-display text-lg font-semibold">Oppure incolla il testo della dieta</summary>
        <div className="space-y-2">
          <p className="text-sm text-muted">Copia il piano dal PDF o dal messaggio della nutrizionista. Riconosco giorni (“Lunedì”), pasti (“Colazione: …”) e calorie (“350 kcal”).</p>
          <textarea aria-label="Testo della dieta" rows={5} className="field" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={'Lunedì\nColazione: latte 200 ml, fette biscottate (150 kcal)\nPranzo: pasta 80 g, verdure (520 kcal)'} />
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={!pasted.trim()} onClick={importText}>Leggi il testo</Button>
            {importMsg && <p role="status" className="text-sm text-muted">{importMsg}</p>}
          </div>
        </div>
      </details>

      <section className="space-y-4">
        {draft.days.map((day, i) => (
          <div key={day.id} className="space-y-3 rounded-2xl border border-line p-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">{field(`day-${i}`, 'Giorno', day.title, (v) => setDay(i, { title: v }), { type: 'text' })}</div>
              <IconButton label={`Elimina ${day.title}`} onClick={() => set('days', draft.days.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></IconButton>
            </div>
            <div>
              <span className="label">Vale per</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Giorni in cui vale ${day.title}`}>
                {WEEKDAY_SHORT.map((w, idx) => {
                  const on = day.weekdays.includes(idx);
                  return (
                    <button key={w} type="button" aria-pressed={on} onClick={() => setDay(i, { weekdays: on ? day.weekdays.filter((x) => x !== idx) : [...day.weekdays, idx].sort() })}
                      className={`h-10 min-w-11 rounded-lg border px-2 text-sm font-semibold ${on ? 'border-plate bg-plate/15 text-chalk' : 'border-line text-muted'}`}>{w}</button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-faint">{day.weekdays.length ? '' : 'Nessun giorno scelto: vale per ogni giorno.'}</p>
            </div>
            <div>
              <label className="label" htmlFor={`day-training-${i}`}>Tipo di giorno</label>
              <select id={`day-training-${i}`} className="field" value={day.training === undefined ? 'any' : day.training ? 'on' : 'off'}
                onChange={(e) => setDay(i, { training: e.target.value === 'any' ? undefined : e.target.value === 'on' })}>
                <option value="any">Sempre</option>
                <option value="on">Giorno di allenamento</option>
                <option value="off">Giorno di riposo</option>
              </select>
            </div>
            {day.meals.map((m, j) => (
              <div key={m.id} className="space-y-2 rounded-xl bg-ink p-3">
                <div className="flex items-center gap-2">
                  <select aria-label="Tipo di pasto" className="field" value={m.type} onChange={(e) => setMeal(i, j, { type: e.target.value as MealType })}>
                    {MEAL_TYPES.map((t) => <option key={t} value={t}>{MEAL_LABEL[t]}</option>)}
                  </select>
                  <input aria-label="Calorie del pasto" className="field w-28 shrink-0" inputMode="decimal" placeholder={mealKcalComputed(m) ? '≈ calcolate' : 'kcal'} value={txt(m.kcal)} onChange={(e) => setMeal(i, j, { kcal: num(e.target.value) })} />
                  <IconButton label="Elimina pasto" onClick={() => setDay(i, { meals: day.meals.filter((_, k) => k !== j) })}><Trash2 className="h-4 w-4" /></IconButton>
                </div>
                <textarea aria-label="Alimenti" rows={2} className="field" value={m.description} onChange={(e) => setMeal(i, j, { description: e.target.value })} placeholder="Alimenti e quantità" />
              </div>
            ))}
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setDay(i, { meals: [...day.meals, { id: newId('p'), type: 'pranzo', description: '' }] })}>Aggiungi pasto</Button>
          </div>
        ))}
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => set('days', [...draft.days, { id: newId('giorno'), title: draft.days.length ? `Giorno ${draft.days.length + 1}` : 'Ogni giorno', weekdays: [], meals: [] }])}>Aggiungi giorno</Button>
      </section>

      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onClose}>Annulla</Button>
        <Button variant="primary" disabled={!draft.title.trim() || draft.days.length === 0} onClick={() => { onSave({ ...draft, title: draft.title.trim() }); onClose(); }}>Salva la dieta</Button>
      </div>
    </div>
  );
}
