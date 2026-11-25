import { describe, expect, it } from 'vitest';
import { BODY_PROMPT, parseBodyJson } from '../bodyImport';

const ctx = { startDate: '2026-10-05', totalWeeks: 6, today: '2026-10-28' };
const doc = (measurements: unknown[], extra: object = {}) => JSON.stringify({ format: 'irontrack-body-v1', source: 'Bioimpedenza', measurements, ...extra });

describe('misure da referto', () => {
  it('il prompt contiene il formato', () => {
    expect(BODY_PROMPT).toContain('"format": "irontrack-body-v1"');
    expect(BODY_PROMPT).toContain('Rispondi SOLO con il JSON');
  });
  it('legge una misura con testo attorno, calcola la settimana e la fonte', () => {
    const r = parseBodyJson('Ecco:\n```json\n' + doc([{ date: '2026-10-20', weightKg: 104.5, bodyFat: 24.26, waistCm: 96, notes: 'Massa magra 79 kg' }]) + '\n```', ctx);
    expect(r.error).toBeUndefined();
    expect(r.measurements).toEqual([{ date: '2026-10-20', week: 3, weightKg: 104.5, bodyFat: 24.3, waistCm: 96, notes: 'Massa magra 79 kg', source: 'Referto · Bioimpedenza' }]);
  });
  it('più date, in ordine; numeri come testo con la virgola', () => {
    const r = parseBodyJson(doc([{ date: '2026-10-20', weightKg: '104,5' }, { date: '2026-10-06', weightKg: 106 }]), ctx);
    expect(r.measurements.map((m) => [m.date, m.weightKg, m.week])).toEqual([['2026-10-06', 106, 1], ['2026-10-20', 104.5, 3]]);
  });
  it('massa grassa solo in kg resta nelle note', () => {
    const r = parseBodyJson(doc([{ date: '2026-10-20', bodyFat: null, notes: 'Massa grassa 25,4 kg' }]), ctx);
    expect(r.measurements[0].bodyFat).toBeUndefined();
    expect(r.measurements[0].notes).toContain('25,4 kg');
  });
  it('scarta valori fuori scala e date non valide, con avvisi', () => {
    const r = parseBodyJson(doc([{ date: '2026-10-20', weightKg: 1045, bodyFat: 24 }, { date: '20/10/2026', weightKg: 100 }]), ctx);
    expect(r.measurements).toHaveLength(1);
    expect(r.measurements[0].weightKg).toBeUndefined();
    expect(r.measurements[0].bodyFat).toBe(24);
    expect(r.warnings.join(' ')).toMatch(/fuori scala/);
    expect(r.warnings.join(' ')).toMatch(/senza una data valida/);
  });
  it('avvisa per DA CONTROLLARE e date future', () => {
    const r = parseBodyJson(doc([{ date: '2026-11-20', weightKg: 100, notes: 'DA CONTROLLARE: vita illeggibile' }]), ctx);
    expect(r.warnings.join(' ')).toMatch(/futuro/);
    expect(r.warnings.join(' ')).toMatch(/da controllare/);
  });
  it('errori: niente JSON, JSON rotto, formato sbagliato, nessuna misura utile', () => {
    expect(parseBodyJson('niente', ctx).error).toMatch(/Non trovo/);
    expect(parseBodyJson('{"format": "irontrack-body-v1", "measurements": [', ctx).error).toBeTruthy();
    expect(parseBodyJson(JSON.stringify({ format: 'irontrack-diet-v1', measurements: [] }), ctx).error).toMatch(/Formato/);
    expect(parseBodyJson(doc([{ date: '2026-10-20' }]), ctx).error).toMatch(/non ci sono misure/);
  });
});
