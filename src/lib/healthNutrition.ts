import type { FoodEntry, MealType } from '../types';
import { mealInterval } from './nutrition';

/**
 * Pasti verso Google Health (tipo di dato `nutrition-log`, alimento anonimo).
 * Valori di `mealType` verificati nella documentazione: solo LUNCH e DINNER. Gli altri (BREAKFAST, SNACK) sono i più probabili
 * ma non confermati: `writeMeal` riprova senza `mealType` se Google li rifiuta.
 */
const MEAL_TYPE: Partial<Record<MealType, string>> = {
  colazione: 'BREAKFAST',
  'spuntino-mattina': 'SNACK',
  pranzo: 'LUNCH',
  'spuntino-pomeriggio': 'SNACK',
  cena: 'DINNER'
};

const offsetSeconds = (ms: number) => `${-new Date(ms).getTimezoneOffset() * 60}s`;
const g3 = (n: number) => Math.round(n * 1000) / 1000;
/** 1 g di sale = 0,4 g di sodio. */
const sodiumFromSalt = (saltG: number) => g3(saltG * 0.4);

export interface NutritionLogBody {
  nutritionLog: {
    interval: { startTime: string; startUtcOffset: string; endTime: string; endUtcOffset: string };
    foodDisplayName: string;
    mealType?: string;
    energy: { kcal: number };
    totalCarbohydrate?: { grams: number };
    totalFat?: { grams: number };
    nutrients?: { nutrient: string; quantity: { grams: number } }[];
    serving: { amount: number };
  };
}

/**
 * Corpo della richiesta per un pasto. Fibre e zuccheri restano nell'app: i nomi esatti dei nutrienti
 * (oltre a PROTEIN e SODIUM, presenti negli esempi ufficiali) non sono stati verificati.
 */
export function nutritionDataPoint(entry: FoodEntry, withMealType = true): NutritionLogBody {
  const { startMs, endMs } = mealInterval(entry);
  const nutrients: NonNullable<NutritionLogBody['nutritionLog']['nutrients']> = [];
  if (entry.proteinG !== undefined) nutrients.push({ nutrient: 'PROTEIN', quantity: { grams: entry.proteinG } });
  if (entry.saltG !== undefined) nutrients.push({ nutrient: 'SODIUM', quantity: { grams: sodiumFromSalt(entry.saltG) } });
  const mealType = withMealType ? MEAL_TYPE[entry.mealType] : undefined;
  return {
    nutritionLog: {
      interval: {
        startTime: new Date(startMs).toISOString(),
        startUtcOffset: offsetSeconds(startMs),
        endTime: new Date(endMs).toISOString(),
        endUtcOffset: offsetSeconds(endMs)
      },
      foodDisplayName: entry.name.slice(0, 100),
      ...(mealType ? { mealType } : {}),
      energy: { kcal: entry.kcal },
      ...(entry.carbsG !== undefined ? { totalCarbohydrate: { grams: entry.carbsG } } : {}),
      ...(entry.fatG !== undefined ? { totalFat: { grams: entry.fatG } } : {}),
      ...(nutrients.length ? { nutrients } : {}),
      serving: { amount: 1 }
    }
  };
}
