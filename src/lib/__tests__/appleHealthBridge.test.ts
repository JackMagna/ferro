import { describe, expect, it } from 'vitest';
import { localStamp, mealKey, measurementKey, parseAppleImport, pendingForApple, shortcutUrl } from '../appleHealthBridge';
import type { FoodEntry, Measurement } from '../../types';

const m = (id: string, date: string, over: Partial<Measurement> = {}): Measurement => ({ id, date, weightKg: 104.5, bodyFat: 24.26, ...over });
const f = (id: string, over: Partial<FoodEntry> = {}): FoodEntry => ({ id, date: '2026-10-28', mealType: 'pranzo', name: 'Pasta', kcal: 360, proteinG: 12, carbsG: 68.04, fatG: 4, ...over });

describe('verso Apple Salute', () => {
  it('raggruppa i valori per tipo, con data e ora', () => {
    const { payload, keys, total } = pendingForApple([m('a', '2026-10-27')], [f('p', { eatenAt: new Date(2026, 9, 28, 13, 15).getTime() })], new Set());
    expect(payload.peso).toEqual([{ v: 104.5, d: '2026-10-27 12:00' }]);
    expect(payload.grasso).toEqual([{ v: 24.3, d: '2026-10-27 12:00' }]);
    expect(payload.kcal).toEqual([{ v: 360, d: '2026-10-28 13:15' }]);
    expect(payload.carboidrati).toEqual([{ v: 68, d: '2026-10-28 13:15' }]);
    expect(keys).toEqual(['m:a', 'f:p']);
    expect(total).toBe(2);
  });
  it('salta i dati già inviati, quelli arrivati da Salute e quelli vuoti', () => {
    const r = pendingForApple(
      [m('a', '2026-10-20'), m('b', '2026-10-21', { source: 'Apple Salute' }), m('c', '2026-10-22', { weightKg: undefined, bodyFat: undefined, waistCm: 90 })],
      [f('p'), f('q', { kcal: 0 })],
      new Set([measurementKey({ id: 'a' }), mealKey({ id: 'p' })])
    );
    expect(r.keys).toEqual([]);
    expect(r.total).toBe(0);
  });
  it('si ferma al limite di valori per invio', () => {
    const many = Array.from({ length: 40 }, (_, i) => m(`x${i}`, `2026-09-${String((i % 28) + 1).padStart(2, '0')}`));
    const r = pendingForApple(many, [], new Set(), 10);
    expect(r.keys.length).toBe(5); // 2 valori per misura
    expect(r.total).toBe(40);
  });
  it('senza ora usa l\'orario tipico del pasto', () => {
    const { payload } = pendingForApple([], [f('p', { mealType: 'cena' })], new Set());
    expect(payload.kcal?.[0].d).toBe('2026-10-28 20:00');
  });
  it('indirizzo del Comando rapido', () => {
    expect(shortcutUrl('Ferro Salute', '{"v":1}')).toBe('shortcuts://run-shortcut?name=Ferro%20Salute&input=text&text=%7B%22v%22%3A1%7D');
    expect(shortcutUrl('Salute Ferro')).toBe('shortcuts://run-shortcut?name=Salute%20Ferro');
    expect(localStamp(new Date(2026, 0, 5, 7, 3).getTime())).toBe('2026-01-05 07:03');
  });
});

describe('da Apple Salute', () => {
  it('legge pesate e grasso per giorno, l\'ultimo valore vince', () => {
    const r = parseAppleImport(JSON.stringify({ peso: [{ v: 105, d: '2026-10-20 07:00' }, { v: '104,6', d: '2026-10-20 21:00' }], grasso: [{ v: 24.4, d: '2026-10-20 07:00' }, { v: 24, d: '2026-10-21' }] }));
    expect(r).toEqual([{ date: '2026-10-20', weightKg: 104.6, bodyFat: 24.4 }, { date: '2026-10-21', bodyFat: 24 }]);
  });
  it('scarta valori fuori scala, date non valide e testo non JSON', () => {
    expect(parseAppleImport(JSON.stringify({ peso: [{ v: 1045, d: '2026-10-20' }, { v: 100, d: 'ieri' }] }))).toEqual([]);
    expect(parseAppleImport('niente')).toEqual([]);
  });
});
