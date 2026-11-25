import { describe, expect, it } from 'vitest';
import { DIET_PROMPT, addDays, eatenAtFrom, kcalFromMacros, mealKcal, parseDietJson, entriesFor, lastDays, mealInterval, mealNameFrom, timeOfDay, parseDietText, planDayFor, planKcal, recentFoods, targetsFor, totalsOf, weekdayIndex } from '../nutrition';
import { normalizeDietPlan, normalizeMeal } from '../../services/normalize';
import type { DietPlan, FoodEntry } from '../../types';

const e = (id: string, date: string, kcal: number, extra: Partial<FoodEntry> = {}): FoodEntry => ({ id, date, mealType: 'pranzo', name: `cibo ${id}`, kcal, ...extra });

describe('calorie e macro', () => {
  it('somma calorie e macro del giorno', () => {
    expect(totalsOf([e('a', '2026-10-19', 350.4, { proteinG: 20.5, carbsG: 40 }), e('b', '2026-10-19', 500, { proteinG: 30, fatG: 12.25 })]))
      .toEqual({ kcal: 850, proteinG: 50.5, carbsG: 40, fatG: 12.3 });
    expect(totalsOf([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
  it('filtra per data', () => {
    expect(entriesFor([e('a', '2026-10-19', 1), e('b', '2026-10-20', 2)], '2026-10-20').map((x) => x.id)).toEqual(['b']);
  });
  it('calcola giorni e giorno della settimana (0 = lunedì)', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-10-19', -7)).toBe('2026-10-12');
    expect(weekdayIndex('2026-10-19')).toBe(0); // lunedì
    expect(weekdayIndex('2026-10-25')).toBe(6); // domenica
  });
  it('dà le calorie degli ultimi 7 giorni, anche quelli vuoti', () => {
    const d = lastDays([e('a', '2026-10-19', 1800), e('b', '2026-10-21', 2100), e('c', '2026-10-21', 100)], '2026-10-21', 7);
    expect(d).toHaveLength(7);
    expect(d[0].date).toBe('2026-10-15');
    expect(d.at(-1)).toEqual({ date: '2026-10-21', kcal: 2200 });
    expect(d.find((x) => x.date === '2026-10-20')?.kcal).toBe(0);
  });
  it('ricorda i cibi recenti senza doppioni', () => {
    const r = recentFoods([e('1', '2026-10-01', 100, { name: 'Yogurt' }), e('2', '2026-10-03', 120, { name: 'yogurt ' }), e('3', '2026-10-02', 300, { name: 'Pasta' })]);
    expect(r.map((x) => [x.name, x.kcal])).toEqual([['yogurt ', 120], ['Pasta', 300]]);
  });
});

describe('piano alimentare', () => {
  const plan: DietPlan = {
    title: 'Piano', kcalTarget: 2000, startDate: '2026-10-05', endDate: '2026-11-01',
    days: [
      { id: 'lun', title: 'Lunedì', weekdays: [0], meals: [{ id: 'm1', type: 'pranzo', description: 'riso', kcal: 600 }, { id: 'm2', type: 'cena', description: 'pesce', kcal: 450.4 }] },
      { id: 'tutti', title: 'Altri giorni', weekdays: [], meals: [{ id: 'm3', type: 'cena', description: 'pollo', kcal: 500 }] }
    ]
  };
  it('sceglie il giorno giusto del piano', () => {
    expect(planDayFor(plan, '2026-10-19')?.id).toBe('lun');
    expect(planDayFor(plan, '2026-10-20')?.id).toBe('tutti');
  });
  it('fuori dal periodo non c\'è piano', () => {
    expect(planDayFor(plan, '2026-10-01')).toBeNull();
    expect(planDayFor(plan, '2026-11-02')).toBeNull();
    expect(planDayFor(null, '2026-10-19')).toBeNull();
  });
  it('obiettivo: quello scritto, altrimenti la somma dei pasti', () => {
    const day = planDayFor(plan, '2026-10-19');
    expect(planKcal(day)).toBe(1050);
    expect(targetsFor(plan, day).kcal).toBe(2000);
    expect(targetsFor({ ...plan, kcalTarget: undefined }, day).kcal).toBe(1050);
    expect(targetsFor(null, null)).toEqual({});
  });
});

describe('lettura del testo della dieta', () => {
  const text = `Lunedì
Colazione: latte parzialmente scremato 200 ml, fette biscottate 30 g (150 kcal)
Spuntino: 1 frutto (80 kcal)
Pranzo
Pasta integrale 80 g con verdure
Olio extravergine 10 g
Totale 520 kcal
Merenda: yogurt greco 150 g - 90 kcal
Cena: petto di pollo 150 g, insalata, pane 40 g (480 kcal)

Martedì
Colazione: caffè e 3 biscotti 40 kcal`;
  const days = parseDietText(text);

  it('trova i giorni e i pasti', () => {
    expect(days.map((d) => [d.title, d.weekdays, d.meals.length])).toEqual([['Lunedì', [0], 5], ['Martedì', [1], 1]]);
    expect(days[0].meals.map((m) => m.type)).toEqual(['colazione', 'spuntino-mattina', 'pranzo', 'spuntino-pomeriggio', 'cena']);
  });
  it('legge le calorie: per riga, oppure "Totale" quando c\'è', () => {
    expect(days[0].meals.map((m) => m.kcal)).toEqual([150, 80, 520, 90, 480]);
    expect(days[1].meals[0].kcal).toBe(40);
  });
  it('tiene la descrizione degli alimenti, anche su più righe', () => {
    expect(days[0].meals[2].description).toContain('Pasta integrale 80 g con verdure');
    expect(days[0].meals[2].description).toContain('Olio extravergine 10 g');
    expect(days[0].meals[0].description).toContain('latte parzialmente scremato');
  });
  it('senza giorni usa "Ogni giorno" e ignora il testo prima del primo pasto', () => {
    const d = parseDietText('Piano della dott.ssa Rossi\nColazione: te e fette biscottate\nCena: minestrone 200 kcal');
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ title: 'Ogni giorno', weekdays: [] });
    expect(d[0].meals.map((m) => m.type)).toEqual(['colazione', 'cena']);
    expect(parseDietText('niente di utile qui')).toEqual([]);
  });
  it('lo spuntino dopo pranzo è la merenda', () => {
    const d = parseDietText('Pranzo: riso\nSpuntino: frutta');
    expect(d[0].meals[1].type).toBe('spuntino-pomeriggio');
  });
});

describe('normalizzazione', () => {
  it('pasto: tipo sconosciuto -> altro, calorie mai negative', () => {
    expect(normalizeMeal({ id: 'x', date: '2026-10-19', mealType: 'brunch', name: 'Toast', kcal: -5 })).toMatchObject({ mealType: 'altro', kcal: 0, name: 'Toast' });
    expect(normalizeMeal({ date: '2026-10-19', kcal: '320,5'.replace(',', '.') }, 'fb').kcal).toBe(320.5);
  });
  it('piano non valido -> nessuna dieta; piano valido viene ripulito', () => {
    expect(normalizeDietPlan(null)).toBeNull();
    expect(normalizeDietPlan({ days: 'no' })).toBeNull();
    const p = normalizeDietPlan({ title: 'P', kcalTarget: '1900', days: [{ title: 'L', weekdays: [0, 9, 'x'], meals: [{ type: 'cena', description: 'zuppa', kcal: 300 }] }] })!;
    expect(p.kcalTarget).toBe(1900);
    expect(p.days[0].weekdays).toEqual([0]);
    expect(p.days[0].meals[0]).toMatchObject({ type: 'cena', kcal: 300 });
  });
});

describe('nome del pasto dal piano', () => {
  it('toglie le calorie già mostrate a parte', () => {
    expect(mealNameFrom('latte 200 ml, fette biscottate (150 kcal)', 'Colazione')).toBe('latte 200 ml, fette biscottate');
    expect(mealNameFrom('yogurt greco 150 g - 90 kcal', 'Merenda')).toBe('yogurt greco 150 g');
    expect(mealNameFrom('pasta 80 g\nolio 10 g', 'Pranzo')).toBe('pasta 80 g');
    expect(mealNameFrom('', 'Cena')).toBe('Cena');
    expect(mealNameFrom('350 kcal', 'Cena')).toBe('Cena');
    expect(mealNameFrom('x'.repeat(200), 'Cena')).toHaveLength(80);
  });
});

describe('ora del pasto', () => {
  it('usa l\'ora scelta e dura 15 minuti', () => {
    const at = eatenAtFrom('2026-10-28', '13:45')!;
    expect(timeOfDay(at)).toBe('13:45');
    const { startMs, endMs } = mealInterval({ date: '2026-10-28', mealType: 'pranzo', eatenAt: at });
    expect(startMs).toBe(at);
    expect(endMs - startMs).toBe(15 * 60_000);
  });
  it('senza ora usa l\'orario predefinito del tipo', () => {
    const { startMs } = mealInterval({ date: '2026-10-28', mealType: 'colazione' });
    expect(timeOfDay(startMs)).toBe('08:00');
    expect(timeOfDay(mealInterval({ date: '2026-10-28', mealType: 'cena' }).startMs)).toBe('20:00');
  });
  it('rifiuta ore non valide', () => {
    expect(eatenAtFrom('2026-10-28', '25:00')).toBeUndefined();
    expect(eatenAtFrom('2026-10-28', 'ciao')).toBeUndefined();
  });
});

describe('pasti: campi aggiuntivi', () => {
  it('un pasto vecchio resta valido', () => {
    const m = normalizeMeal({ id: 'a', date: '2026-10-01', mealType: 'pranzo', name: 'Pasta', kcal: 400 });
    expect(m.eatenAt).toBeUndefined();
    expect(m.healthSynced).toBeUndefined();
    expect(m.barcode).toBeUndefined();
  });
  it('legge e valida i campi nuovi', () => {
    const m = normalizeMeal({ id: 'a', name: 'Yogurt', kcal: 90, eatenAt: 1_700_000_000_000, fiberG: '2,5'.replace(',', '.'), barcode: '8001234567890', nutriScore: 'B', nova: 3, source: 'openfoodfacts', healthSynced: false, healthLogId: 'users/me/x' });
    expect(m).toMatchObject({ eatenAt: 1_700_000_000_000, fiberG: 2.5, barcode: '8001234567890', nutriScore: 'b', nova: 3, source: 'openfoodfacts', healthSynced: false, healthLogId: 'users/me/x' });
  });
  it('scarta valori non validi', () => {
    const m = normalizeMeal({ id: 'a', name: 'X', kcal: 1, eatenAt: -5, barcode: 'abc', nutriScore: 'z', nova: 9, source: 'altro' });
    expect(m).toMatchObject({ eatenAt: undefined, barcode: undefined, nutriScore: undefined, nova: undefined, source: undefined });
  });
});

const SAMPLE = {
  format: 'irontrack-diet-v1', title: 'Piano ottobre', nutritionist: 'Rossi', startDate: null, endDate: null,
  kcalTarget: 2000, proteinG: null, carbsG: null, fatG: null, notes: null,
  days: [{ title: 'Lunedì', weekdays: [0], meals: [
    { type: 'colazione', description: 'Latte 200 ml\nFette biscottate 30 g', kcal: 250, proteinG: null, carbsG: null, fatG: null },
    { type: 'pranzo', description: 'Pasta 80 g', kcal: null, proteinG: null, carbsG: null, fatG: null }
  ] }]
};

describe('dieta da JSON incollato', () => {
  it('il prompt contiene il formato e le regole', () => {
    expect(DIET_PROMPT).toContain('"format": "irontrack-diet-v1"');
    expect(DIET_PROMPT).toContain('separa le righe con \\n');
    expect(DIET_PROMPT).toContain('Rispondi SOLO con il JSON');
  });
  it('legge soli pasti con testo attorno e recinti di codice', () => {
    const r = parseDietJson('Ecco il piano:\n```json\n' + JSON.stringify(SAMPLE) + '\n```\nSpero vada bene {grazie}');
    expect(r.error).toBeUndefined();
    expect(r.plan?.title).toBe('Piano ottobre');
    expect(r.plan?.days[0].meals).toHaveLength(2);
    expect(r.plan?.days[0].meals[0].description).toContain('\n');
    expect(r.plan?.days[0].weekdays).toEqual([0]);
  });
  it('soli macro: kcal calcolate 4P+4C+9G', () => {
    expect(kcalFromMacros(30, 50, 10)).toBe(410);
    const r = parseDietJson(JSON.stringify({ ...SAMPLE, kcalTarget: null, proteinG: 120, carbsG: 200, fatG: 60, days: [{ title: 'Ogni giorno', weekdays: [], meals: [{ type: 'pranzo', description: 'Libero, secondo i macro', kcal: null, proteinG: 40, carbsG: 60, fatG: 20 }] }] }));
    expect(r.plan?.days[0].meals[0].kcal).toBeUndefined();
    expect(mealKcal(r.plan!.days[0].meals[0])).toBe(580);
    expect(targetsFor(r.plan, r.plan!.days[0]).kcal).toBe(580);
    expect(r.warnings.join(' ')).toContain('calcolate dai macro');
  });
  it('giorni a rotazione', () => {
    const r = parseDietJson(JSON.stringify({ ...SAMPLE, days: [0, 1, 2].map((i) => ({ title: `Giorno ${i + 1}`, weekdays: [i], meals: [{ type: 'cena', description: 'x', kcal: 500 }] })) }));
    expect(r.plan?.days.map((d) => d.weekdays[0])).toEqual([0, 1, 2]);
  });
  it('tipo di pasto sconosciuto: avviso e "altro"', () => {
    const r = parseDietJson(JSON.stringify({ ...SAMPLE, days: [{ title: 'x', weekdays: [], meals: [{ type: 'brunch', description: 'x', kcal: 1 }] }] }));
    expect(r.plan?.days[0].meals[0].type).toBe('altro');
    expect(r.warnings.join(' ')).toContain('brunch');
  });
  it('JSON rotto, formato sbagliato e testo senza JSON', () => {
    expect(parseDietJson('{"format": "irontrack-diet-v1", "days": [').error).toBeTruthy();
    expect(parseDietJson('{"format": "altro", "days": []}').error).toContain('Formato');
    expect(parseDietJson('nessun json qui').error).toContain('Non trovo');
    expect(parseDietJson(JSON.stringify({ ...SAMPLE, days: [] })).error).toBeTruthy();
  });
  it('segnala le note DA CONTROLLARE e scarta giorni non validi', () => {
    const r = parseDietJson(JSON.stringify({ ...SAMPLE, notes: 'DA CONTROLLARE: quantità illeggibile', days: [...SAMPLE.days, { title: 'vuoto' }] }));
    expect(r.plan?.days).toHaveLength(1);
    expect(r.warnings.join(' ')).toContain('da controllare');
    expect(r.warnings.join(' ')).toContain('scartato');
  });
});
