import { describe, expect, it } from 'vitest';
import { entryFromProduct, parseOffProduct } from '../offMap';

const YOGURT = {
  code: '8001234567890', product_name: 'Yogurt greco', brands: 'Marca, Altra', nutriscore_grade: 'B', nova_group: 3, serving_quantity: '150',
  nutriments: { 'energy-kcal_100g': 97, proteins_100g: 9, carbohydrates_100g: 4, fat_100g: 5, fiber_100g: 0, sugars_100g: 4, salt_100g: 0.1 }
};

describe('Open Food Facts: lettura prodotto', () => {
  it('legge i valori per 100 g', () => {
    expect(parseOffProduct(YOGURT)).toMatchObject({ code: '8001234567890', name: 'Yogurt greco', brand: 'Marca', kcal100: 97, protein100: 9, carbs100: 4, fat100: 5, servingG: 150, nutriScore: 'b', nova: 3 });
  });
  it('ricava le kcal dai kJ se mancano', () => {
    const p = parseOffProduct({ code: '1234567', product_name: 'X', nutriments: { energy_100g: 418.4, proteins_100g: 1 } });
    expect(p?.kcal100).toBe(100);
  });
  it('preferisce il nome italiano', () => {
    expect(parseOffProduct({ ...YOGURT, product_name_it: 'Yogurt greco bianco' })?.name).toBe('Yogurt greco bianco');
  });
  it('scarta codici non validi e prodotti senza dati nutrizionali', () => {
    expect(parseOffProduct({ ...YOGURT, code: 'abc' })).toBeNull();
    expect(parseOffProduct({ code: '1234567', product_name: 'X', nutriments: {} })).toBeNull();
    expect(parseOffProduct(null)).toBeNull();
  });
  it('ignora valori negativi o non numerici', () => {
    const p = parseOffProduct({ ...YOGURT, nutriments: { 'energy-kcal_100g': 'x', proteins_100g: -3, carbohydrates_100g: '12,5' } });
    expect(p?.kcal100).toBeUndefined();
    expect(p?.protein100).toBeUndefined();
    expect(p?.carbs100).toBe(12.5);
  });
});

describe('Open Food Facts: valori per quantità', () => {
  const p = parseOffProduct(YOGURT)!;
  it('scala i valori sui grammi mangiati', () => {
    const e = entryFromProduct(p, 150);
    expect(e).toMatchObject({ name: 'Marca Yogurt greco 150 g', kcal: 146, proteinG: 13.5, carbsG: 6, fatG: 7.5, saltG: 0.2, barcode: '8001234567890', source: 'openfoodfacts', nutriScore: 'b', nova: 3 });
  });
  it('i dati mancanti restano mancanti', () => {
    const e = entryFromProduct(parseOffProduct({ code: '1234567', product_name: 'Solo kcal', nutriments: { 'energy-kcal_100g': 200 } })!, 50);
    expect(e.kcal).toBe(100);
    expect(e.proteinG).toBeUndefined();
    expect(e.fiberG).toBeUndefined();
  });
  it('grammi negativi non danno valori negativi', () => {
    expect(entryFromProduct(p, -10).kcal).toBe(0);
  });
});
