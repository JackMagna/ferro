import FOODS from '../data/foods.json';
import type { OffProduct } from './offMap';

/** Alimento della tabella interna: valori per 100 g da USDA FoodData Central (pubblico dominio). */
export interface CommonFood {
  id: string;
  name: string;
  cat: string;
  kcal: number;
  p?: number;
  c?: number;
  f?: number;
  fib?: number;
  sug?: number;
  salt?: number;
  /** grammi di un pezzo (uovo, frutto, vasetto): stima indicativa */
  unitG?: number;
}

export const COMMON_FOODS = FOODS as CommonFood[];
export const FOODS_SOURCE = 'USDA FoodData Central (SR Legacy, pubblico dominio)';

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ');

/** Alimenti il cui nome contiene tutte le parole cercate (anche come inizio di parola), prima quelli che iniziano col testo. */
export function searchFoods(text: string, limit = 8, list: CommonFood[] = COMMON_FOODS): CommonFood[] {
  const words = fold(text).split(' ').filter((w) => w.length >= 2);
  if (!words.length) return [];
  const query = words.join(' ');
  return list
    .map((food) => {
      const name = fold(food.name);
      const tokens = name.split(' ').filter(Boolean);
      if (!words.every((w) => tokens.some((t) => t.startsWith(w)))) return null;
      return { food, score: name.startsWith(query) ? 0 : tokens[0].startsWith(words[0]) ? 1 : 2 };
    })
    .filter((x): x is { food: CommonFood; score: number } => x !== null)
    .sort((a, b) => a.score - b.score || a.food.name.length - b.food.name.length)
    .slice(0, limit)
    .map((x) => x.food);
}

/** Lo stesso formato dei prodotti di Open Food Facts, per usare un solo modulo di scelta della quantità. */
export function foodAsProduct(food: CommonFood): OffProduct {
  return {
    code: food.id, name: food.name, kcal100: food.kcal, protein100: food.p, carbs100: food.c, fat100: food.f,
    fiber100: food.fib, sugar100: food.sug, salt100: food.salt, servingG: food.unitG
  };
}

export const isCommonFoodCode = (code: string) => code.startsWith('fdc-');
