import type { FoodEntry } from '../types';
import { t } from './i18n';

/** Prodotto Open Food Facts ridotto ai valori per 100 g che servono all'app. */
export interface OffProduct {
  code: string;
  name: string;
  brand?: string;
  kcal100?: number;
  protein100?: number;
  carbs100?: number;
  fat100?: number;
  fiber100?: number;
  sugar100?: number;
  salt100?: number;
  /** porzione indicata sulla confezione, in grammi */
  servingG?: number;
  nutriScore?: FoodEntry['nutriScore'];
  nova?: FoodEntry['nova'];
}

type Loose = Record<string, unknown>;
const KJ_PER_KCAL = 4.184;

const nonNeg = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Legge un prodotto dalla risposta di Open Food Facts (formato `product` dell'API v2 o di una ricerca). Null se non è utilizzabile. */
export function parseOffProduct(raw: unknown): OffProduct | null {
  const p = raw as Loose | null;
  if (!p || typeof p !== 'object') return null;
  const code = String(p.code ?? '').trim();
  if (!/^\d{6,14}$/.test(code)) return null;
  const name = String(p.product_name_it ?? p.product_name ?? '').trim();
  const n = (p.nutriments ?? {}) as Loose;
  // le calorie mancanti si ricavano dai kJ
  const kcal = nonNeg(n['energy-kcal_100g']) ?? (nonNeg(n['energy_100g']) !== undefined ? Math.round(nonNeg(n['energy_100g'])! / KJ_PER_KCAL) : undefined);
  const grade = String(p.nutriscore_grade ?? '').toLowerCase();
  const nova = Number(p.nova_group);
  const brand = String(p.brands ?? '').split(',')[0].trim();
  const out: OffProduct = {
    code,
    name: name || t('Prodotto senza nome'),
    brand: brand || undefined,
    kcal100: kcal,
    protein100: nonNeg(n.proteins_100g),
    carbs100: nonNeg(n.carbohydrates_100g),
    fat100: nonNeg(n.fat_100g),
    fiber100: nonNeg(n.fiber_100g),
    sugar100: nonNeg(n.sugars_100g),
    salt100: nonNeg(n.salt_100g),
    servingG: nonNeg(p.serving_quantity),
    nutriScore: ['a', 'b', 'c', 'd', 'e'].includes(grade) ? (grade as FoodEntry['nutriScore']) : undefined,
    nova: [1, 2, 3, 4].includes(nova) ? (nova as FoodEntry['nova']) : undefined
  };
  // senza nessun dato nutrizionale il prodotto non serve
  return out.kcal100 === undefined && out.protein100 === undefined && out.carbs100 === undefined && out.fat100 === undefined ? null : out;
}

/** Valori del pasto per `grams` grammi di prodotto. I dati mancanti restano mancanti. */
export function entryFromProduct(product: OffProduct, grams: number): Pick<FoodEntry, 'name' | 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG' | 'sugarG' | 'saltG' | 'barcode' | 'nutriScore' | 'nova' | 'source'> {
  const k = Math.max(0, grams) / 100;
  const scale = (v?: number) => (v === undefined ? undefined : round1(v * k));
  const label = [product.brand, product.name].filter(Boolean).join(' ');
  // alimenti della tabella interna (codice "fdc-…"): niente codice a barre
  const fromTable = product.code.startsWith('fdc-');
  return {
    name: `${label} ${Math.round(grams)} g`.slice(0, 80),
    kcal: Math.round((product.kcal100 ?? 0) * k),
    proteinG: scale(product.protein100),
    carbsG: scale(product.carbs100),
    fatG: scale(product.fat100),
    fiberG: scale(product.fiber100),
    sugarG: scale(product.sugar100),
    saltG: scale(product.salt100),
    barcode: fromTable ? undefined : product.code,
    nutriScore: product.nutriScore,
    nova: product.nova,
    source: fromTable ? 'tabella' : 'openfoodfacts'
  };
}
