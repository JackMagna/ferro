import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MISURE, SHEET } from '../../lib/__tests__/fixtures';
import { parseCoachSheet } from '../../lib/coachSheet';
import type { Measurement, WorkoutSession } from '../../types';
import type { GridRange } from '../../lib/sheetMerges';

vi.mock('../firebase', () => ({ GoogleTokenExpiredError: class extends Error {} }));
const { annotateGrid, appendMeasurements, appendSessions, findMeasuresTab, listTabs, readMeasures, readTab, writeMeasureCells } = await import('../googleSheets');

/** Un Google Sheets finto in memoria, con solo le chiamate che usa l'app. */
function fakeSheets(initial: Record<string, string[][]>, merges: Record<string, GridRange[]> = {}) {
  const tabs = new Map<string, string[][]>(Object.entries(initial).map(([k, v]) => [k, v.map((r) => [...r])]));
  const calls: string[] = [];
  const key = (name: string) => [...tabs.keys()].find((k) => k.toLowerCase() === name.toLowerCase()) ?? name;
  const cellOf = (range: string) => {
    const [tab, a1] = range.split('!');
    const m = a1.match(/^([A-Z]+)(\d+)$/)!;
    const col = [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
    return { tab: key(tab.replace(/^'|'$/g, '').replace(/''/g, "'")), row: Number(m[2]) - 1, col };
  };
  vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const path = decodeURIComponent(url.pathname.replace('/v4/spreadsheets/', ''));
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : {};
    calls.push(`${method} ${path.split('/').slice(1).join('/')}`);
    const ok = (json: unknown) => ({ ok: true, status: 200, json: async () => json });

    if (method === 'GET' && path.endsWith('values:batchGet')) {
      const ranges = url.searchParams.getAll('ranges');
      return ok({ valueRanges: ranges.map((r) => { const c = cellOf(r); const v = tabs.get(c.tab)?.[c.row]?.[c.col]; return { values: v === undefined || v === '' ? undefined : [[v]] }; }) });
    }
    if (method === 'POST' && path.endsWith('values:batchUpdate')) {
      for (const d of body.data) {
        const c = cellOf(d.range);
        const grid = tabs.get(c.tab)!;
        while (grid.length <= c.row) grid.push([]);
        while (grid[c.row].length <= c.col) grid[c.row].push('');
        grid[c.row][c.col] = d.values[0][0];
      }
      return ok({});
    }
    if (method === 'POST' && path.endsWith(':batchUpdate')) {
      for (const r of body.requests) {
        const title = r.addSheet.properties.title;
        if (key(title) !== title || tabs.has(title)) return { ok: false, status: 400, statusText: 'x', json: async () => ({ error: { message: `A sheet with the name "${title}" already exists.` } }) };
        tabs.set(title, []);
      }
      return ok({});
    }
    if (method === 'PUT') { const c = cellOf(path.split('/values/')[1]); tabs.set(c.tab, [...body.values]); return ok({}); }
    if (method === 'POST' && path.includes(':append')) {
      const tab = key(path.split('/values/')[1].replace(':append', '').split('!')[0].replace(/^'|'$/g, '').replace(/''/g, "'"));
      tabs.get(tab)!.push(...body.values);
      return ok({});
    }
    if (method === 'GET' && path.includes('/values/')) return ok({ values: tabs.get(key(path.split('/values/')[1].replace(/^'|'$/g, ''))) });
    if (method === 'GET' && url.searchParams.get('fields') === 'sheets(merges)') {
      const tab = key(url.searchParams.get('ranges')!.replace(/^'|'$/g, '').replace(/''/g, "'"));
      return ok({ sheets: [{ merges: merges[tab] }] });
    }
    if (method === 'GET') return ok({ sheets: [...tabs.keys()].map((title) => ({ properties: { title } })) });
    return { ok: false, status: 404, statusText: 'x', json: async () => ({}) };
  }));
  return { tabs, calls };
}

const program = parseCoachSheet(SHEET, 'Scheda').program;
const CHEST = 8; // riga 9 del foglio (indice 8): carichi nelle celle vuote della settimana
const session = (weight: number, over: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: 's1', date: '2026-10-19', startedAt: 1, endedAt: 2, dayId: 'giorno-1', dayTitle: 'Giorno 1', weekNumber: 3,
  durationMinutes: 50, totalVolumeKg: 0,
  sets: [
    { exerciseId: 'ex-1-1', exerciseName: 'Chest press presa sopra', setIndex: 0, weightKg: weight, reps: 8 },
    { exerciseId: 'ex-1-1', exerciseName: 'Chest press presa sopra', setIndex: 1, weightKg: weight + 2.5, reps: 8 }
  ],
  ...over
});

let fake: ReturnType<typeof fakeSheets>;
beforeEach(() => { fake = fakeSheets({ Scheda: SHEET, MISURE: MISURE, Altro: [['x']] }); });

describe('lettura', () => {
  it('elenca le schede e legge le celle', async () => {
    expect(await listTabs('t', 'ID')).toEqual(['Scheda', 'MISURE', 'Altro']);
    expect((await readTab('t', 'ID', 'Scheda'))[6][0]).toBe('GIORNO 1');
  });
});

describe('scrittura', () => {
  it('scrive i carichi accanto alla prescrizione del coach', async () => {
    const res = await annotateGrid('t', 'ID', program, [session(40)]);
    expect(res).toEqual({ written: 1, skipped: 0 });
    expect(fake.tabs.get('Scheda')![CHEST][4]).toBe('40/42,5 kg');
    expect(fake.tabs.get('Scheda')![CHEST][0]).toBe('CHEST PRESS PRESA SOPRA'); // il resto non si tocca
  });
  it('aggiorna la propria nota alla seduta successiva', async () => {
    await annotateGrid('t', 'ID', program, [session(40)]);
    await annotateGrid('t', 'ID', program, [session(42.5, { id: 's2', startedAt: 5 })]);
    expect(fake.tabs.get('Scheda')![CHEST][4]).toBe('42,5/45 kg');
  });
  it('lascia stare le celle cambiate dal coach', async () => {
    fake.tabs.get('Scheda')![CHEST][4] = 'ora fai 5x5 a 60 kg';
    const res = await annotateGrid('t', 'ID', program, [session(40)]);
    expect(res).toEqual({ written: 0, skipped: 1 });
    expect(fake.tabs.get('Scheda')![CHEST][4]).toBe('ora fai 5x5 a 60 kg');
  });
  it('non fa niente se la scheda non arriva da un foglio', async () => {
    expect(await annotateGrid('t', 'ID', { ...program, source: undefined }, [session(40)])).toEqual({ written: 0, skipped: 0 });
    expect(fake.calls).toEqual([]);
  });
  it('crea "Log carichi" con l\'intestazione e righe numeriche', async () => {
    await appendSessions('t', 'ID', [session(40)]);
    const log = fake.tabs.get('Log carichi')!;
    expect(log[0][0]).toBe('Data');
    expect(log[1]).toEqual(['2026-10-19', 'Giorno 1', 3, 'Chest press presa sopra', 1, 40, 8, 320]);
    await appendSessions('t', 'ID', [session(50, { id: 's2' })]);
    expect(fake.tabs.get('Log carichi')!).toHaveLength(5); // intestazione + 2 + 2, senza rifare l'intestazione
  });
  it('aggiunge le misure nella scheda "Misure" dello stesso foglio', async () => {
    const m: Measurement = { id: 'm1', date: '2026-10-19', weightKg: 80.4, waistCm: 84 };
    await appendMeasurements('t', 'ID', [m]);
    const t = fake.tabs.get('Misure app')!;
    expect(t[0]).toContain('Peso (kg)');
    expect(t[1]).toEqual(['2026-10-19', '', 80.4, '', '', 84, '', '', '', '', '']);
    expect(fake.tabs.get('Scheda')).toEqual(SHEET); // la scheda del coach resta identica
  });
});

describe('misure nel foglio del coach', () => {
  it('trova la scheda MISURE e non confonde quella di ripiego', () => {
    expect(findMeasuresTab(['ALLENAMENTO', 'MISURE'])).toBe('MISURE');
    expect(findMeasuresTab(['ALLENAMENTO', 'Misure app'])).toBeUndefined();
    expect(findMeasuresTab(['ALLENAMENTO'])).toBeUndefined();
  });
  it('legge il layout e scrive le celle come numeri', async () => {
    const { layout, values } = await readMeasures('t', 'ID', 'MISURE');
    expect(values[1]?.weightKg).toBe(106);
    await writeMeasureCells('t', 'ID', 'MISURE', [{ a1: 'C9', value: 104.5 }, { a1: 'C14', value: 72 }]);
    const grid = fake.tabs.get('MISURE')!;
    expect(grid[8][2]).toBe(104.5);
    expect(grid[13][2]).toBe(72);
    expect(grid[8][1]).toBe('106'); // la colonna della settimana 1 non si tocca
    expect(layout.weekCols[3]).toBe(3);
  });
  it('non prova a creare "Misure" quando esiste già "MISURE" (stesso nome per Google)', async () => {
    fake.tabs.set('LOG CARICHI', [['Data']]);
    await appendSessions('t', 'ID', [session(40)]);
    expect(fake.calls.some((c) => c.includes(':batchUpdate') && !c.includes('values'))).toBe(false); // nessun addSheet
    expect(fake.tabs.get('LOG CARICHI')!.length).toBeGreaterThan(1);
    expect(fake.tabs.size).toBe(4); // Scheda, MISURE, Altro, LOG CARICHI: nessuna scheda duplicata
  });
  it('il ripiego usa una scheda con un altro nome', async () => {
    const m: Measurement = { id: 'm1', date: '2026-10-19', week: 3, weightKg: 80.4, abdomenCm: 100, hipsCm: 112 };
    await appendMeasurements('t', 'ID', [m]);
    expect(fake.tabs.get('Misure app')![1]).toEqual(['2026-10-19', 3, 80.4, '', '', '', 100, 112, '', '', '']);
    expect(fake.tabs.get('MISURE')).toEqual(MISURE); // quella del coach resta intatta
  });
});

describe('celle unite', () => {
  // dati inventati: la prescrizione della settimana 1 è unita su tre esercizi (C3:C5)
  const UNITE = [
    ['', 'SCHEDA DI PROVA'],
    ['GIORNO 1', 'NOTE', '1 SETT.', '2 SETT.'],
    ['PANCA PIANA', '', '3x10', '4x8'],
    ['CROCI AI CAVI', '', '', '4x8'],
    ['DIP', '', '', '4x10']
  ];
  const merges = { Unite: [{ sheetId: 0, startRowIndex: 2, endRowIndex: 5, startColumnIndex: 2, endColumnIndex: 3 }] };

  it('copia la prescrizione unita in tutte le righe', async () => {
    fakeSheets({ Unite: UNITE }, merges);
    const rows = await readTab('t', 'ID', 'Unite');
    expect(rows.map((r) => r[2])).toEqual([undefined, '1 SETT.', '3x10', '3x10', '3x10']);
    const days = parseCoachSheet(rows, 'Unite').program.days;
    expect(days[0].exercises.map((e) => e.weeks)).toEqual([{ 1: '3x10', 2: '4x8' }, { 1: '3x10', 2: '4x8' }, { 1: '3x10', 2: '4x10' }]);
  });
  it('senza unioni legge come prima', async () => {
    fakeSheets({ Unite: UNITE });
    expect((await readTab('t', 'ID', 'Unite'))[3][2]).toBe('');
  });
  it('non scrive i carichi nelle celle unite', async () => {
    const f = fakeSheets({ Unite: UNITE }, merges);
    const prog = parseCoachSheet(await readTab('t', 'ID', 'Unite'), 'Unite').program;
    const s = session(40, {
      dayId: prog.days[0].id, weekNumber: 1,
      sets: prog.days[0].exercises.map((e) => ({ exerciseId: e.id, exerciseName: e.name, setIndex: 0, weightKg: 40, reps: 10 }))
    });
    const w1 = await annotateGrid('t', 'ID', prog, [s]);
    expect(w1).toEqual({ written: 0, skipped: 3 });
    expect(f.tabs.get('Unite')!.map((r) => r[2])).toEqual(UNITE.map((r) => r[2]));
    const w2 = await annotateGrid('t', 'ID', prog, [{ ...s, weekNumber: 2 }]);
    expect(w2.written).toBe(3); // la settimana 2 non è unita: si scrive come sempre
    expect(f.tabs.get('Unite')![2][3]).toBe('4x8 · 40 kg');
  });
});
