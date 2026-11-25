import { describe, expect, it } from 'vitest';
import { entriesFromSaved, parseDietJson, planDayFor, planHasTrainingDays, reportDays, savedMealFrom, waterTarget, weeklyReportText, DIET_FORMAT } from '../nutrition';
import { COMMON_FOODS, foodAsProduct, searchFoods } from '../foods';
import { entryFromProduct } from '../offMap';
import { normalizeDietPlan, normalizeMeal, normalizeSavedMeals, normalizeWater } from '../../services/normalize';
import type { DietPlan, FoodEntry } from '../../types';

const e = (id: string, date: string, kcal: number, extra: Partial<FoodEntry> = {}): FoodEntry => ({ id, date, mealType: 'pranzo', name: `cibo ${id}`, kcal, ...extra });

const onOff: DietPlan = {
  title: 'ON/OFF', waterMl: 2500,
  days: [
    { id: 'on', title: 'Allenamento', weekdays: [], training: true, meals: [{ id: 'on-1', type: 'pranzo', description: 'riso 100 g', kcal: 700 }] },
    { id: 'off', title: 'Riposo', weekdays: [], training: false, meals: [{ id: 'off-1', type: 'pranzo', description: 'riso 60 g', kcal: 500 }] }
  ]
};

describe('giorni di allenamento e di riposo', () => {
  it('sceglie il giorno del piano in base all\'allenamento', () => {
    expect(planHasTrainingDays(onOff)).toBe(true);
    expect(planDayFor(onOff, '2026-10-29', true)?.id).toBe('on');
    expect(planDayFor(onOff, '2026-10-29', false)?.id).toBe('off');
    // senza informazione vale il primo che corrisponde
    expect(planDayFor(onOff, '2026-10-29')?.id).toBe('on');
  });
  it('i piani senza distinzione non cambiano', () => {
    const plan: DietPlan = { title: 'P', days: [{ id: 'lun', title: 'Lunedì', weekdays: [0], meals: [] }, { id: 'tutti', title: 'Ogni giorno', weekdays: [], meals: [] }] };
    expect(planHasTrainingDays(plan)).toBe(false);
    expect(planDayFor(plan, '2026-10-26', true)?.id).toBe('lun');
    expect(planDayFor(plan, '2026-10-27', false)?.id).toBe('tutti');
  });
  it('se manca il giorno del tipo giusto usa comunque quello della data', () => {
    const plan: DietPlan = { title: 'P', days: [{ id: 'on', title: 'ON', weekdays: [], training: true, meals: [] }] };
    expect(planDayFor(plan, '2026-10-29', false)?.id).toBe('on');
  });
  it('legge training e acqua dal JSON del prompt', () => {
    const r = parseDietJson(JSON.stringify({ format: DIET_FORMAT, title: 'X', waterMl: 2000, days: [{ title: 'ON', weekdays: [], training: true, meals: [{ type: 'pranzo', description: 'a', kcal: 100 }] }, { title: 'OFF', weekdays: [], training: null, meals: [{ type: 'cena', description: 'b' }] }] }));
    expect(r.plan?.waterMl).toBe(2000);
    expect(r.plan?.days.map((d) => d.training)).toEqual([true, undefined]);
  });
});

describe('acqua', () => {
  it('obiettivo dal piano o 2 litri', () => {
    expect(waterTarget(onOff)).toBe(2500);
    expect(waterTarget(null)).toBe(2000);
  });
  it('tiene solo date valide e quantità positive', () => {
    expect(normalizeWater({ '2026-10-29': 750.4, '2026-10-30': 0, ieri: 300, '2026-10-31': '500', '2026-11-01': 99999 }))
      .toEqual({ '2026-10-29': 750, '2026-10-31': 500, '2026-11-01': 20000 });
    expect(normalizeWater(null)).toEqual({});
  });
});

describe('pasti salvati', () => {
  it('salva i cibi senza campi del diario e li ricrea nel giorno scelto', () => {
    const entries = [e('a', '2026-10-28', 300, { proteinG: 20, mealType: 'colazione', notes: 'x', healthSynced: true }), e('b', '2026-10-28', 120)];
    const saved = savedMealFrom('  Colazione solita ', 'colazione', entries, 's1');
    expect(saved).toEqual({ id: 's1', name: 'Colazione solita', mealType: 'colazione', items: [{ name: 'cibo a', kcal: 300, proteinG: 20 }, { name: 'cibo b', kcal: 120 }] });
    let n = 0;
    const back = entriesFromSaved(saved, '2026-10-29', 'spuntino-mattina', () => `id${++n}`);
    expect(back).toEqual([
      { name: 'cibo a', kcal: 300, proteinG: 20, id: 'id1', date: '2026-10-29', mealType: 'spuntino-mattina', source: 'manuale' },
      { name: 'cibo b', kcal: 120, id: 'id2', date: '2026-10-29', mealType: 'spuntino-mattina', source: 'manuale' }
    ]);
  });
  it('scarta pasti salvati non validi', () => {
    expect(normalizeSavedMeals([{ id: 'x', name: 'Ok', mealType: 'boh', items: [{ name: 'pane', kcal: '80' }] }, { name: 'vuoto', items: [] }, null, 'testo']))
      .toEqual([{ id: 'x', name: 'Ok', mealType: 'altro', items: [{ name: 'pane', kcal: 80, proteinG: undefined, carbsG: undefined, fatG: undefined, fiberG: undefined, sugarG: undefined, saltG: undefined }] }]);
    expect(normalizeSavedMeals(undefined)).toEqual([]);
  });
});

describe('riepilogo per la nutrizionista', () => {
  const meals = [
    e('a', '2026-10-27', 1800, { proteinG: 120, carbsG: 200, fatG: 60 }),
    e('b', '2026-10-29', 600, { planMealId: 'on-1', proteinG: 40 }),
    e('c', '2026-10-29', 1400, { proteinG: 100 })
  ];
  const days = reportDays({ meals, plan: onOff, water: { '2026-10-29': 2000, '2026-10-27': 1000 }, trainedDates: new Set(['2026-10-29']), endDate: '2026-10-29' });

  it('calcola i giorni con piano, acqua e allenamento', () => {
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe('2026-10-23');
    const last = days.at(-1)!;
    expect(last).toMatchObject({ date: '2026-10-29', waterMl: 2000, trained: true, planDone: 1, planTotal: 1, target: 700 });
    expect(last.totals.kcal).toBe(2000);
    expect(days.find((d) => d.date === '2026-10-27')).toMatchObject({ trained: false, planDone: 0, planTotal: 1, target: 500 });
  });
  it('scrive un testo leggibile con le medie dei giorni registrati', () => {
    const text = weeklyReportText(days, onOff, 'Marco');
    expect(text).toContain('Riepilogo alimentazione di Marco');
    expect(text).toContain('Dal 23/10/2026 al 29/10/2026');
    expect(text).toContain('- gio 29/10 · 2000 kcal (obiettivo 700) · P 140 g · C 0 g · G 0 g · acqua 2 l · piano 1/1 pasti · allenamento');
    expect(text).toContain('- ven 23/10 · non registrato · piano 0/1 pasti');
    expect(text).toContain('Media dei 2 giorni registrati: 1900 kcal');
    expect(text).toContain('Acqua media: 1,5 l al giorno');
    expect(text).toContain('Pasti del piano segnati come mangiati: 1 su 7');
    expect(text).toContain('Allenamenti: 1');
  });
});

describe('tabella degli alimenti comuni', () => {
  it('ha valori plausibili per 100 g', () => {
    expect(COMMON_FOODS.length).toBeGreaterThan(140);
    for (const f of COMMON_FOODS) {
      expect(f.id).toMatch(/^fdc-\d+$/);
      expect(f.kcal).toBeGreaterThanOrEqual(0);
      expect(f.kcal).toBeLessThanOrEqual(900);
      expect((f.p ?? 0) + (f.c ?? 0) + (f.f ?? 0)).toBeLessThanOrEqual(101);
    }
    expect(new Set(COMMON_FOODS.map((f) => f.name)).size).toBe(COMMON_FOODS.length);
  });
  it('trova per inizio di parola, senza accenti, prima i nomi che iniziano col testo', () => {
    expect(searchFoods('pollo').map((f) => f.name)).toEqual(expect.arrayContaining(['Petto di pollo (crudo)', 'Petto di pollo (cotto)']));
    expect(searchFoods('caffe')[0].name).toBe('Caffè (tazzina)');
    expect(searchFoods('yogurt greco').map((f) => f.name)).toEqual(['Yogurt greco 0%', 'Yogurt greco intero']);
    expect(searchFoods('ban')[0].name).toBe('Banana');
    expect(searchFoods('x')).toEqual([]);
    expect(searchFoods('zzzz')).toEqual([]);
  });
  it('diventa una voce del diario senza codice a barre', () => {
    const banana = COMMON_FOODS.find((f) => f.name === 'Banana')!;
    const entry = entryFromProduct(foodAsProduct(banana), 120);
    expect(entry).toMatchObject({ name: 'Banana 120 g', kcal: Math.round(banana.kcal * 1.2), barcode: undefined, source: 'tabella' });
    expect(normalizeMeal({ ...entry, id: 'x', date: '2026-10-29', mealType: 'altro' }).source).toBe('tabella');
  });
});

describe('compatibilità', () => {
  it('i piani salvati prima restano validi', () => {
    const p = normalizeDietPlan({ title: 'Vecchio', days: [{ id: 'd', title: 'Ogni giorno', weekdays: [], meals: [] }] });
    expect(p?.waterMl).toBeUndefined();
    expect(p?.days[0].training).toBeUndefined();
  });
});
