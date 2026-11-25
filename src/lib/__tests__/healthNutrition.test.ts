import { describe, expect, it } from 'vitest';
import { nutritionDataPoint } from '../healthNutrition';
import type { FoodEntry } from '../../types';

const meal = (over: Partial<FoodEntry> = {}): FoodEntry => ({ id: 'm1', date: '2026-10-28', mealType: 'pranzo', name: 'Pasta al pomodoro 80 g', kcal: 290, proteinG: 10, carbsG: 58, fatG: 2, ...over });

describe('pasto -> nutrition-log', () => {
  it('mappa calorie, macro, pasto e porzione', () => {
    const { nutritionLog: n } = nutritionDataPoint(meal());
    expect(n.foodDisplayName).toBe('Pasta al pomodoro 80 g');
    expect(n.mealType).toBe('LUNCH');
    expect(n.energy).toEqual({ kcal: 290 });
    expect(n.totalCarbohydrate).toEqual({ grams: 58 });
    expect(n.totalFat).toEqual({ grams: 2 });
    expect(n.nutrients).toEqual([{ nutrient: 'PROTEIN', quantity: { grams: 10 } }]);
    expect(n.serving).toEqual({ amount: 1 });
  });
  it('intervallo di 15 minuti dall\'ora scelta, con offset', () => {
    const at = new Date(2026, 9, 28, 13, 30).getTime();
    const { interval } = nutritionDataPoint(meal({ eatenAt: at })).nutritionLog;
    expect(Date.parse(interval.endTime) - Date.parse(interval.startTime)).toBe(15 * 60_000);
    expect(Date.parse(interval.startTime)).toBe(at);
    expect(interval.startUtcOffset).toMatch(/^-?\d+s$/);
  });
  it('senza ora usa l\'orario predefinito del tipo di pasto', () => {
    const start = new Date(nutritionDataPoint(meal({ mealType: 'cena' })).nutritionLog.interval.startTime);
    expect([start.getHours(), start.getMinutes()]).toEqual([20, 0]);
  });
  it('il sale diventa sodio (0,4 g per ogni g di sale)', () => {
    const n = nutritionDataPoint(meal({ saltG: 1.5 })).nutritionLog.nutrients!;
    expect(n.find((x) => x.nutrient === 'SODIUM')?.quantity.grams).toBe(0.6);
  });
  it('omette i dati che non ci sono e non invia fibre e zuccheri', () => {
    const { nutritionLog: n } = nutritionDataPoint(meal({ proteinG: undefined, carbsG: undefined, fatG: undefined, fiberG: 3, sugarG: 5 }));
    expect(n.totalCarbohydrate).toBeUndefined();
    expect(n.totalFat).toBeUndefined();
    expect(n.nutrients).toBeUndefined();
  });
  it('mealType omesso per "altro" e quando richiesto', () => {
    expect(nutritionDataPoint(meal({ mealType: 'altro' })).nutritionLog.mealType).toBeUndefined();
    expect(nutritionDataPoint(meal(), false).nutritionLog.mealType).toBeUndefined();
    expect(nutritionDataPoint(meal({ mealType: 'colazione' })).nutritionLog.mealType).toBe('BREAKFAST');
  });
  it('accorcia i nomi molto lunghi', () => {
    expect(nutritionDataPoint(meal({ name: 'x'.repeat(300) })).nutritionLog.foodDisplayName).toHaveLength(100);
  });
});
