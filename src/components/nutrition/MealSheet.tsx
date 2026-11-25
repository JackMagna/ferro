import { useState } from 'react';
import type { FoodEntry, MealType, SavedMeal } from '../../types';
import { MEAL_LABEL, MEAL_TYPES, eatenAtFrom, entriesFromSaved, timeOfDay, totalsOf } from '../../lib/nutrition';
import { Bookmark } from '../ui/icons';
import { parseNumber } from '../../lib/measuresSheet';
import { newId } from '../../lib/ids';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { entryFromProduct, type OffProduct } from '../../lib/offMap';
import { ProductLookup } from './ProductLookup';
import { t } from '../../lib/i18n';

export interface MealDraft {
  mealType: MealType;
  name?: string;
  kcal?: number;
  planMealId?: string;
  source?: FoodEntry['source'];
  barcode?: string;
  nutriScore?: FoodEntry['nutriScore'];
  nova?: FoodEntry['nova'];
}

interface Props {
  open: boolean;
  onClose: () => void;
  date: string;
  /** se presente si modifica un pasto già salvato */
  editing: FoodEntry | null;
  defaults: MealDraft;
  recent: FoodEntry[];
  savedMeals: SavedMeal[];
  onSave: (e: FoodEntry) => void;
  /** aggiunge tutti i cibi di un pasto salvato */
  onAddMany: (entries: FoodEntry[]) => void;
  onDelete: (id: string) => void;
}

const txt = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','));
/** Come parseNumber, ma accetta lo zero (petto di pollo: 0 g di carboidrati). */
const amount = (v: string) => (/^0+([.,]0*)?$/.test(v.trim()) ? 0 : parseNumber(v));
/** Valore da salvare: lo zero resta vuoto, come prima. */
const stored = (v: string) => amount(v) || undefined;

/** Modulo per aggiungere o modificare un cibo/pasto. */
export function MealSheet({ open, ...rest }: Props) {
  return (
    <Sheet open={open} onClose={rest.onClose} title={rest.editing ? t('Modifica pasto') : t('Aggiungi cibo')}>
      <MealForm {...rest} />
    </Sheet>
  );
}

function MealForm({ date, editing, defaults, recent, savedMeals, onSave, onAddMany, onDelete, onClose }: Omit<Props, 'open'>) {
  const [mealType, setMealType] = useState<MealType>(editing?.mealType ?? defaults.mealType);
  const [name, setName] = useState(editing?.name ?? defaults.name ?? '');
  const [kcal, setKcal] = useState(txt(editing?.kcal ?? defaults.kcal));
  const [protein, setProtein] = useState(txt(editing?.proteinG));
  const [carbs, setCarbs] = useState(txt(editing?.carbsG));
  const [fat, setFat] = useState(txt(editing?.fatG));
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [macros, setMacros] = useState(!!(editing?.proteinG || editing?.carbsG || editing?.fatG));
  const [time, setTime] = useState(editing?.eatenAt ? timeOfDay(editing.eatenAt) : '');
  const [details, setDetails] = useState(!!(editing?.fiberG || editing?.sugarG || editing?.saltG));
  const [fiber, setFiber] = useState(txt(editing?.fiberG));
  const [sugar, setSugar] = useState(txt(editing?.sugarG));
  const [salt, setSalt] = useState(txt(editing?.saltG));
  const [product, setProduct] = useState<Pick<FoodEntry, 'barcode' | 'nutriScore' | 'nova' | 'source'>>({});

  const applyProduct = (p: OffProduct, grams: number) => {
    const e = entryFromProduct(p, grams);
    setName(e.name);
    setKcal(txt(e.kcal));
    setProtein(txt(e.proteinG));
    setCarbs(txt(e.carbsG));
    setFat(txt(e.fatG));
    setMacros(e.proteinG !== undefined || e.carbsG !== undefined || e.fatG !== undefined);
    setFiber(txt(e.fiberG));
    setSugar(txt(e.sugarG));
    setSalt(txt(e.saltG));
    setDetails(e.fiberG !== undefined || e.sugarG !== undefined || e.saltG !== undefined);
    setProduct({ barcode: e.barcode, nutriScore: e.nutriScore, nova: e.nova, source: e.source });
  };

  const kcalN = amount(kcal);
  const bad = [protein, carbs, fat, fiber, sugar, salt].some((v) => v.trim() !== '' && amount(v) === undefined);
  const valid = name.trim() !== '' && kcalN !== undefined && !bad;

  const save = () => {
    if (!valid) return;
    const day = editing?.date ?? date;
    onSave({
      ...editing,
      id: editing?.id ?? newId('meal'),
      date: day,
      mealType,
      name: name.trim(),
      kcal: Math.round(kcalN!),
      proteinG: stored(protein),
      carbsG: stored(carbs),
      fatG: stored(fat),
      fiberG: stored(fiber),
      sugarG: stored(sugar),
      saltG: stored(salt),
      notes: notes.trim() || undefined,
      planMealId: editing?.planMealId ?? defaults.planMealId,
      eatenAt: time ? eatenAtFrom(day, time) : undefined,
      source: product.source ?? editing?.source ?? defaults.source ?? 'manuale',
      barcode: product.barcode ?? editing?.barcode ?? defaults.barcode,
      nutriScore: product.nutriScore ?? editing?.nutriScore ?? defaults.nutriScore,
      nova: product.nova ?? editing?.nova ?? defaults.nova,
      // ogni salvataggio da inviare di nuovo a Google Health; l'invio lo decide useHealthSync
      healthSynced: editing?.healthSynced === undefined ? undefined : false
    });
    onClose();
  };

  return (
    <div className="space-y-4">
      {!editing && savedMeals.length > 0 && (
        <div>
          <p className="label">{t('Pasti salvati')}</p>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {savedMeals.map((s) => (
              <button
                key={s.id} type="button"
                onClick={() => { onAddMany(entriesFromSaved(s, date, mealType, () => newId('meal'))); onClose(); }}
                className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-plate/60 px-3 text-sm hover:border-plate"
              >
                <Bookmark className="h-3.5 w-3.5 text-plate" />
                {s.name} · {totalsOf(s.items).kcal}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-faint">{t('Un tocco aggiunge tutti i cibi del pasto a “{meal}”.', { meal: MEAL_LABEL[mealType] })}</p>
        </div>
      )}

      {!editing && <ProductLookup onPick={applyProduct} />}

      {!editing && recent.length > 0 && (
        <div>
          <p className="label">{t('Usati di recente')}</p>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {recent.map((r) => (
              <button
                key={r.id} type="button"
                onClick={() => { setName(r.name); setKcal(txt(r.kcal)); setProtein(txt(r.proteinG)); setCarbs(txt(r.carbsG)); setFat(txt(r.fatG)); setMacros(!!(r.proteinG || r.carbsG || r.fatG)); }}
                className="min-h-10 shrink-0 rounded-full border border-line px-3 text-sm hover:border-faint"
              >
                {r.name} · {r.kcal}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="label" htmlFor="f-type">{t('Pasto')}</label>
        <select id="f-type" className="field" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
          {MEAL_TYPES.map((mt) => <option key={mt} value={mt}>{MEAL_LABEL[mt]}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-name">{t('Cosa hai mangiato')}</label>
        <input id="f-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Es. Pasta al pomodoro 80 g')} />
      </div>
      <div>
        <label className="label" htmlFor="f-kcal">{t('Calorie (kcal)')}</label>
        <input id="f-kcal" className="field" inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder={t('Es. 350')} />
      </div>

      {macros ? (
        <div className="grid grid-cols-3 gap-3">
          {([['p', t('Proteine (g)'), protein, setProtein], ['c', t('Carboidrati (g)'), carbs, setCarbs], ['f', t('Grassi (g)'), fat, setFat]] as const).map(([id, label, value, set]) => (
            <div key={id}>
              <label className="label" htmlFor={`f-${id}`}>{label}</label>
              <input id={`f-${id}`} className="field" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} />
            </div>
          ))}
        </div>
      ) : (
        <button type="button" className="text-[15px] font-medium text-plate hover:underline" onClick={() => setMacros(true)}>{t('Aggiungi proteine, carboidrati, grassi')}</button>
      )}
      {bad && <p role="alert" className="text-sm text-stop">{t('Scrivi solo numeri nei campi dei macronutrienti.')}</p>}

      <div>
        <label className="label" htmlFor="f-time">{t('Ora (facoltativa)')}</label>
        <input id="f-time" type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
        <p className="mt-1 text-xs text-faint">{t('Se la lasci vuota uso un orario tipico per questo pasto.')}</p>
      </div>

      {details ? (
        <div className="grid grid-cols-3 gap-3">
          {([['fib', t('Fibre (g)'), fiber, setFiber], ['sug', t('Zuccheri (g)'), sugar, setSugar], ['salt', t('Sale (g)'), salt, setSalt]] as const).map(([id, label, value, set]) => (
            <div key={id}>
              <label className="label" htmlFor={`f-${id}`}>{label}</label>
              <input id={`f-${id}`} className="field" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} />
            </div>
          ))}
        </div>
      ) : (
        <button type="button" className="text-[15px] font-medium text-plate hover:underline" onClick={() => setDetails(true)}>{t('Aggiungi fibre, zuccheri, sale')}</button>
      )}

      <div>
        <label className="label" htmlFor="f-notes">{t('Note')}</label>
        <input id="f-notes" className="field" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {editing && <Button variant="danger" className="mr-auto" onClick={() => { onDelete(editing.id); onClose(); }}>{t('Elimina')}</Button>}
        <Button onClick={onClose}>{t('Annulla')}</Button>
        <Button variant="primary" disabled={!valid} onClick={save}>{t('Salva')}</Button>
      </div>
    </div>
  );
}
