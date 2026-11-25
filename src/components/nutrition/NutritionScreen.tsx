import { useEffect, useMemo, useState } from 'react';
import { Bookmark, Check, ChevronLeft, ChevronRight, Copy, Download, Droplet, Minus, Pencil, Plus, Trash2 } from '../ui/icons';
import type { DietPlan, FoodEntry, MealType, SavedMeal, WaterLog, WorkoutSession } from '../../types';
import {
  MEAL_LABEL, MEAL_TYPES, WATER_STEPS, addDays, entriesFor, formatLiters, lastDays, mealKcal, mealKcalComputed, mealNameFrom, planDayFor, planHasTrainingDays,
  planKcal, recentFoods, reportDays, savedMealFrom, targetsFor, totalsOf, waterTarget, weekdayIndex, weeklyReportText, WEEKDAY_SHORT
} from '../../lib/nutrition';
import { formatDate, newId, todayISO } from '../../lib/ids';
import { downloadText } from '../../lib/download';
import { Button, IconButton } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Segmented } from '../ui/Segmented';
import { MealSheet, type MealDraft } from './MealSheet';
import { DietPlanEditor } from './DietPlanEditor';

interface Props {
  meals: FoodEntry[];
  plan: DietPlan | null;
  sessions: WorkoutSession[];
  water: WaterLog;
  savedMeals: SavedMeal[];
  /** nome di chi si allena, per il riepilogo */
  athlete?: string;
  onAddMeal: (m: FoodEntry) => void;
  onAddMeals: (list: FoodEntry[]) => void;
  onUpdateMeal: (id: string, patch: Partial<FoodEntry>) => void;
  onDeleteMeal: (id: string) => void;
  onSavePlan: (p: DietPlan | null) => void;
  onSaveSavedMeals: (list: SavedMeal[]) => void;
  /** aggiunge (o toglie, se negativo) acqua al giorno */
  onAddWater: (date: string, deltaMl: number) => void;
  /** calorie bruciate con l'attività (Health Connect); assente se la fonte non c'è */
  readActiveCalories?: (date: string) => Promise<number | null>;
  notify: (message: string, kind?: 'success' | 'error') => void;
}

const fmt = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 1 });

function dayLabel(date: string, today: string) {
  if (date === today) return 'Oggi';
  if (date === addDays(today, -1)) return 'Ieri';
  if (date === addDays(today, 1)) return 'Domani';
  return formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function NutritionScreen({
  meals, plan, sessions, water, savedMeals, athlete, onAddMeal, onAddMeals, onUpdateMeal, onDeleteMeal, onSavePlan, onSaveSavedMeals, onAddWater, readActiveCalories, notify
}: Props) {
  const today = todayISO();
  const [view, setView] = useState<'day' | 'plan'>('day');
  const [date, setDate] = useState(today);
  const [sheet, setSheet] = useState<{ editing: FoodEntry | null; defaults: MealDraft } | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  // scelta a mano di allenamento o riposo, per giorno; senza scelta vale "c'è una seduta salvata quel giorno"
  const [trainChoice, setTrainChoice] = useState<Record<string, boolean>>({});
  const [burned, setBurned] = useState<number | null>(null);
  const [report, setReport] = useState('');

  const trainedDates = useMemo(() => new Set(sessions.map((s) => s.date)), [sessions]);
  const splitDays = planHasTrainingDays(plan);
  const trained = trainChoice[date] ?? trainedDates.has(date);
  const dayEntries = useMemo(() => entriesFor(meals, date), [meals, date]);
  const totals = totalsOf(dayEntries);
  const planDay = planDayFor(plan, date, splitDays ? trained : undefined);
  const target = targetsFor(plan, planDay);
  const eatenPlanIds = new Set(dayEntries.map((e) => e.planMealId).filter(Boolean));
  const week = useMemo(() => lastDays(meals, date, 7), [meals, date]);
  const recent = useMemo(() => recentFoods(meals), [meals]);
  const weekMax = Math.max(target.kcal ?? 0, ...week.map((d) => d.kcal), 1);
  const waterMl = water[date] ?? 0;
  const waterGoal = waterTarget(plan);

  useEffect(() => {
    let alive = true;
    setBurned(null);
    if (readActiveCalories) void readActiveCalories(date).then((v) => { if (alive) setBurned(v); });
    return () => { alive = false; };
  }, [date, readActiveCalories]);

  const open = (mealType: MealType, extra: Partial<MealDraft> = {}) => setSheet({ editing: null, defaults: { mealType, ...extra } });
  const kcalLeft = target.kcal !== undefined ? target.kcal - totals.kcal : undefined;
  const pct = target.kcal ? Math.min(100, (totals.kcal / target.kcal) * 100) : 0;

  const saveAsMeal = (type: MealType, entries: FoodEntry[]) => {
    const name = window.prompt('Nome del pasto salvato (es. “Colazione solita”)', MEAL_LABEL[type]);
    if (name === null) return;
    onSaveSavedMeals([...savedMeals, savedMealFrom(name, type, entries, newId('pasto'))]);
    notify('Pasto salvato: lo trovi in “Aggiungi cibo”');
  };

  const makeReport = () => setReport(weeklyReportText(reportDays({ meals, plan, water, trainedDates, endDate: date }), plan, athlete));
  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report);
      notify('Riepilogo copiato');
    } catch {
      notify('Non riesco a copiare: seleziona il testo e copialo a mano.', 'error');
    }
  };
  const shareReport = async () => {
    try {
      await navigator.share({ title: 'Riepilogo alimentazione', text: report });
    } catch {
      /* condivisione annullata */
    }
  };

  const macro = (label: string, value: number, goal?: number) => (
    <div className="rounded-xl bg-ink px-3 py-2">
      <p className="text-xs text-faint">{label}</p>
      <p className="num font-display whitespace-nowrap text-xl font-semibold">{fmt(value)}<span className="font-sans text-sm font-normal text-muted">{' '}g</span></p>
      {goal ? <p className="text-xs text-muted">di {fmt(goal)}{' '}g</p> : null}
    </div>
  );

  const savedList = (
    <section aria-label="Pasti salvati" className="card space-y-2 p-4">
      <h2 className="font-display text-xl font-semibold">Pasti salvati</h2>
      {savedMeals.length === 0 ? (
        <p className="text-[15px] text-muted">Nella giornata tocca il segnalibro accanto a un pasto per salvarlo: poi lo aggiungi con un tocco da “Aggiungi cibo”.</p>
      ) : (
        <ul className="divide-y divide-line/60">
          {savedMeals.map((s) => (
            <li key={s.id} className="flex min-h-12 items-center gap-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.name}</span>
                <span className="block truncate text-sm text-muted">{s.items.map((i) => i.name).join(', ')}</span>
              </span>
              <span className="tabular-nums text-muted">{fmt(totalsOf(s.items).kcal)} kcal</span>
              <IconButton label={`Elimina ${s.name}`} onClick={() => window.confirm(`Eliminare il pasto salvato “${s.name}”?`) && onSaveSavedMeals(savedMeals.filter((x) => x.id !== s.id))}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Pasti</h1>
        <Segmented label="Vista" value={view} onChange={setView} options={[{ value: 'day', label: 'Giornata' }, { value: 'plan', label: 'Dieta' }]} />
      </header>

      {view === 'day' && (
        <>
          <div className="flex items-center justify-between gap-2">
            <Button aria-label="Giorno precedente" icon={<ChevronLeft className="h-5 w-5" />} onClick={() => { setDate(addDays(date, -1)); setReport(''); }} />
            <button type="button" onClick={() => { setDate(today); setReport(''); }} className="min-h-11 flex-1 rounded-xl px-3 text-center font-display text-xl font-semibold hover:bg-raised">
              {dayLabel(date, today)}
              {date !== today && <span className="block text-sm font-normal text-muted">tocca per tornare a oggi</span>}
            </button>
            <Button aria-label="Giorno successivo" icon={<ChevronRight className="h-5 w-5" />} onClick={() => { setDate(addDays(date, 1)); setReport(''); }} />
          </div>

          {splitDays && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Segmented
                label="Tipo di giorno" value={trained ? 'on' : 'off'}
                onChange={(v) => setTrainChoice((c) => ({ ...c, [date]: v === 'on' }))}
                options={[{ value: 'on', label: 'Allenamento' }, { value: 'off', label: 'Riposo' }]}
              />
              <p className="text-sm text-muted">{trainChoice[date] === undefined ? (trainedDates.has(date) ? 'Hai salvato un allenamento' : 'Nessun allenamento salvato') : 'Scelto da te'}{planDay ? ` · ${planDay.title}` : ''}</p>
            </div>
          )}

          <section aria-label="Totale del giorno" className="card space-y-3 p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Mangiate</p>
                <p className="whitespace-nowrap leading-none"><span className="num font-display text-5xl font-bold">{fmt(totals.kcal)}</span><span className="text-xl text-muted">{' '}kcal</span></p>
              </div>
              {target.kcal !== undefined && (
                <div className="text-right">
                  <p className="text-sm text-muted">Obiettivo {fmt(target.kcal)}</p>
                  <p className={`whitespace-nowrap ${kcalLeft! < 0 ? 'text-stop' : 'text-go'}`}>
                    <span className="num font-display text-2xl font-semibold">{fmt(Math.abs(kcalLeft!))}</span>
                    <span className="text-[15px]">{kcalLeft! >= 0 ? ' restanti' : ' in più'}</span>
                  </p>
                </div>
              )}
            </div>
            {target.kcal !== undefined ? (
              <div className="h-2.5 overflow-hidden rounded-full bg-ink" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Calorie rispetto all'obiettivo">
                <div className={`h-full transition-[width] ${kcalLeft! < 0 ? 'bg-stop' : 'bg-go'}`} style={{ width: `${pct}%` }} />
              </div>
            ) : (
              <p className="text-sm text-muted">Nessun obiettivo: inserisci la dieta nella sezione “Dieta” per vedere quante calorie ti restano.</p>
            )}
            {(totals.proteinG > 0 || totals.carbsG > 0 || totals.fatG > 0 || target.proteinG || target.carbsG || target.fatG) && (
              <div className="grid grid-cols-3 gap-2">
                {macro('Proteine', totals.proteinG, target.proteinG)}
                {macro('Carboidrati', totals.carbsG, target.carbsG)}
                {macro('Grassi', totals.fatG, target.fatG)}
              </div>
            )}
            {burned !== null && <p className="text-sm text-muted">Bruciate con l'attività (Health Connect): <span className="tabular-nums text-chalk">{fmt(burned)} kcal</span>, oltre al metabolismo di base.</p>}
          </section>

          <section aria-label="Acqua" className="card space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Droplet className="h-5 w-5 text-plate" />Acqua</h2>
              <p className="tabular-nums text-muted"><span className="font-semibold text-chalk">{formatLiters(waterMl)}</span> di {formatLiters(waterGoal)}</p>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-ink" role="progressbar" aria-valuenow={Math.round(Math.min(100, (waterMl / waterGoal) * 100))} aria-valuemin={0} aria-valuemax={100} aria-label="Acqua rispetto all'obiettivo">
              <div className="h-full bg-plate transition-[width]" style={{ width: `${Math.min(100, (waterMl / waterGoal) * 100)}%` }} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button aria-label="Togli un bicchiere" icon={<Minus className="h-4 w-4" />} disabled={waterMl <= 0} onClick={() => onAddWater(date, -Math.min(WATER_STEPS[0], waterMl))} />
              {WATER_STEPS.map((ml) => (
                <Button key={ml} icon={<Plus className="h-4 w-4" />} onClick={() => onAddWater(date, ml)}>{ml === 250 ? 'Bicchiere' : 'Bottiglietta'} {ml} ml</Button>
              ))}
            </div>
            {!plan?.waterMl && <p className="text-xs text-faint">Obiettivo predefinito di 2 litri: puoi cambiarlo nella dieta.</p>}
          </section>

          <Button variant="primary" size="lg" block icon={<Plus className="h-5 w-5" />} onClick={() => open(dayEntries.length === 0 ? 'colazione' : 'altro')}>Aggiungi cibo</Button>

          <div className="space-y-4">
            {MEAL_TYPES.map((type) => {
              const entries = dayEntries.filter((e) => e.mealType === type);
              const planned = (planDay?.meals ?? []).filter((m) => m.type === type && !eatenPlanIds.has(m.id));
              if (!entries.length && !planned.length && type === 'altro') return null;
              const sub = totalsOf(entries).kcal;
              return (
                <section key={type} aria-label={MEAL_LABEL[type]} className="card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-xl font-semibold">{MEAL_LABEL[type]}</h2>
                    <div className="flex items-center gap-2">
                      {sub > 0 && <span className="tabular-nums text-muted">{fmt(sub)} kcal</span>}
                      {entries.length > 0 && (
                        <IconButton label={`Salva ${MEAL_LABEL[type]} come pasto ricorrente`} onClick={() => saveAsMeal(type, entries)}><Bookmark className="h-4 w-4" /></IconButton>
                      )}
                      <Button size="sm" aria-label={`Aggiungi a ${MEAL_LABEL[type]}`} icon={<Plus className="h-4 w-4" />} onClick={() => open(type)}>Aggiungi</Button>
                    </div>
                  </div>

                  {planned.map((m) => (
                    <div key={m.id} className="mt-3 rounded-xl border border-dashed border-plate/50 bg-plate/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-plate">Da piano</p>
                      <p className="mt-0.5 whitespace-pre-line text-[15px]">{m.description || MEAL_LABEL[m.type]}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {mealKcal(m) !== undefined && <span className="tabular-nums text-muted">{mealKcalComputed(m) ? '≈ ' : ''}{fmt(mealKcal(m)!)} kcal</span>}
                        <span className="flex-1" />
                        <Button size="sm" onClick={() => open(type, { name: mealNameFrom(m.description, ''), kcal: mealKcal(m), planMealId: m.id, source: 'piano' })}>Cambia</Button>
                        <Button size="sm" variant="success" icon={<Check className="h-4 w-4" />} disabled={mealKcal(m) === undefined}
                          onClick={() => onAddMeal({ id: newId('meal'), date, mealType: type, name: mealNameFrom(m.description, MEAL_LABEL[type]), kcal: Math.round(mealKcal(m) ?? 0), proteinG: m.proteinG, carbsG: m.carbsG, fatG: m.fatG, planMealId: m.id, source: 'piano', eatenAt: date === today ? Date.now() : undefined })}>
                          Mangiato
                        </Button>
                      </div>
                      {mealKcal(m) === undefined && <p className="mt-1 text-xs text-faint">Il piano non indica le calorie: usa “Cambia” per inserirle.</p>}
                      {mealKcalComputed(m) && <p className="mt-1 text-xs text-faint">Calorie calcolate dai macro del pasto.</p>}
                    </div>
                  ))}

                  {entries.length > 0 && (
                    <ul className="mt-2 divide-y divide-line/60">
                      {entries.map((e) => (
                        <li key={e.id}>
                          <button type="button" onClick={() => setSheet({ editing: e, defaults: { mealType: e.mealType } })} className="flex min-h-12 w-full items-center gap-3 py-2 text-left">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{e.name}</span>
                              {(e.proteinG || e.carbsG || e.fatG) && <span className="block truncate text-sm text-muted">P {fmt(e.proteinG ?? 0)} · C {fmt(e.carbsG ?? 0)} · G {fmt(e.fatG ?? 0)}</span>}
                            </span>
                            <span className="tabular-nums text-muted">{fmt(e.kcal)} kcal</span>
                            <Pencil className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>

          <section aria-label="Ultimi 7 giorni" className="card p-4">
            <h2 className="font-display text-xl font-semibold">Ultimi 7 giorni</h2>
            <p className="mb-3 text-sm text-muted">{target.kcal !== undefined ? `Linea gialla: obiettivo di ${fmt(target.kcal)} kcal.` : 'Calorie mangiate ogni giorno.'}</p>
            <div className="relative flex h-32 items-end gap-2">
              {target.kcal !== undefined && <div aria-hidden="true" className="absolute inset-x-0 border-t border-dashed border-plate/70" style={{ bottom: `${(target.kcal / weekMax) * 100}%` }} />}
              {week.map((d) => (
                <button key={d.date} type="button" onClick={() => { setDate(d.date); setReport(''); }} aria-label={`${formatDate(d.date)}: ${d.kcal} kcal`} className="group flex h-full flex-1 flex-col justify-end gap-1">
                  <span className={`w-full rounded-t-md ${d.date === date ? 'bg-plate' : 'bg-raised group-hover:bg-line'}`} style={{ height: `${Math.max(2, (d.kcal / weekMax) * 100)}%` }} />
                </button>
              ))}
            </div>
            <div className="mt-1 flex gap-2 text-center text-xs text-faint">
              {week.map((d) => <span key={d.date} className="flex-1">{WEEKDAY_SHORT[weekdayIndex(d.date)].charAt(0)}</span>)}
            </div>
          </section>

          <section aria-label="Riepilogo per la nutrizionista" className="card space-y-3 p-4">
            <h2 className="font-display text-xl font-semibold">Riepilogo per la nutrizionista</h2>
            <p className="text-sm text-muted">Calorie, macro, acqua, pasti del piano e allenamenti dei 7 giorni fino a {dayLabel(date, today).toLowerCase()}, in un testo da mandare prima della visita.</p>
            {!report ? (
              <Button onClick={makeReport}>Prepara il riepilogo</Button>
            ) : (
              <>
                <textarea aria-label="Testo del riepilogo" readOnly rows={10} className="field font-mono text-xs" value={report} onFocus={(e) => e.currentTarget.select()} />
                <div className="flex flex-wrap gap-2">
                  {typeof navigator.share === 'function' && <Button variant="primary" onClick={() => void shareReport()}>Condividi</Button>}
                  <Button icon={<Copy className="h-4 w-4" />} onClick={() => void copyReport()}>Copia</Button>
                  <Button icon={<Download className="h-4 w-4" />} onClick={() => downloadText(`riepilogo-alimentazione-${date}.txt`, report)}>Scarica</Button>
                </div>
                <p className="text-xs text-faint">Contiene dati sulla tua salute: mandalo solo a chi ti segue.</p>
              </>
            )}
          </section>
        </>
      )}

      {view === 'plan' && (
        <>
          {plan ? (
            <div className="space-y-4">
              <section className="card space-y-1 p-4">
                <h2 className="font-display text-2xl font-semibold">{plan.title}</h2>
                <p className="text-[15px] text-muted">
                  {[plan.nutritionist && `Nutrizionista: ${plan.nutritionist}`, plan.startDate && `dal ${formatDate(plan.startDate, { day: 'numeric', month: 'long' })}`, plan.endDate && `al ${formatDate(plan.endDate, { day: 'numeric', month: 'long' })}`].filter(Boolean).join(' · ')}
                </p>
                <p className="text-[15px]">
                  {[plan.kcalTarget && `${fmt(plan.kcalTarget)} kcal al giorno`, plan.proteinG && `proteine ${fmt(plan.proteinG)} g`, plan.carbsG && `carboidrati ${fmt(plan.carbsG)} g`, plan.fatG && `grassi ${fmt(plan.fatG)} g`, plan.waterMl && `acqua ${formatLiters(plan.waterMl)}`].filter(Boolean).join(' · ') || 'Nessun obiettivo di calorie indicato'}
                </p>
                {plan.notes && <p className="whitespace-pre-line pt-1 text-[15px] text-chalk/85">{plan.notes}</p>}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setPlanOpen(true)}>Modifica</Button>
                  <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => window.confirm('Eliminare la dieta? I pasti che hai già segnato restano.') && onSavePlan(null)}>Elimina dieta</Button>
                </div>
              </section>
              {plan.days.map((d) => (
                <section key={d.id} className="card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-display text-xl font-semibold">{d.title}</h3>
                    <p className="text-sm text-muted">
                      {d.weekdays.length ? d.weekdays.map((i) => WEEKDAY_SHORT[i]).join(', ') : 'ogni giorno'}
                      {d.training !== undefined ? ` · ${d.training ? 'allenamento' : 'riposo'}` : ''}
                      {planKcal(d) ? ` · ${fmt(planKcal(d))} kcal` : ''}
                    </p>
                  </div>
                  <ul className="mt-2 divide-y divide-line/60">
                    {d.meals.map((m) => (
                      <li key={m.id} className="py-2">
                        <div className="flex justify-between gap-3">
                          <span className="font-semibold">{MEAL_LABEL[m.type]}</span>
                          {mealKcal(m) !== undefined && <span className="tabular-nums text-muted">{mealKcalComputed(m) ? '≈ ' : ''}{fmt(mealKcal(m)!)} kcal</span>}
                        </div>
                        <p className="whitespace-pre-line text-[15px] text-chalk/85">{m.description}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState title="Nessuna dieta inserita" action={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setPlanOpen(true)}>Inserisci la dieta</Button>}>
              Usa il prompt dell'app con il servizio che preferisci per trascrivere il piano della nutrizionista e incolla qui la risposta: nella giornata vedrai i pasti previsti, con un tocco li segni come mangiati e tieni sotto controllo le calorie.
            </EmptyState>
          )}
          {savedList}
        </>
      )}

      <MealSheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        date={date}
        editing={sheet?.editing ?? null}
        defaults={sheet?.defaults ?? { mealType: 'colazione' }}
        recent={recent}
        savedMeals={savedMeals}
        onSave={(e) => (sheet?.editing ? onUpdateMeal(e.id, e) : onAddMeal(e))}
        onAddMany={onAddMeals}
        onDelete={onDeleteMeal}
      />
      <DietPlanEditor open={planOpen} plan={plan} onClose={() => setPlanOpen(false)} onSave={(p) => { onSavePlan(p); setView('plan'); }} />
    </div>
  );
}
