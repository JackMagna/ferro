import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkoutSession } from '../../types';

class Expired extends Error {}
vi.mock('../firebase', () => ({ GoogleTokenExpiredError: Expired }));
const gh = await import('../googleHealth');

type Handler = (url: URL, init: RequestInit) => { status?: number; json: unknown };
let calls: { method: string; url: URL; body: unknown }[] = [];

function fakeHealth(handler: Handler) {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    calls.push({ method: init.method ?? 'GET', url, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const r = handler(url, init);
    const status = r.status ?? 200;
    return { ok: status < 400, status, statusText: 'x', json: async () => r.json };
  }));
}
beforeEach(() => { calls = []; });
afterEach(() => vi.unstubAllGlobals());

const civil = (y: number, m: number, d: number) => ({ civilTime: { date: { year: y, month: m, day: d } } });

describe('lettura', () => {
  it('legge peso e grasso con il filtro giusto e converte i grammi in kg', async () => {
    fakeHealth((url) => {
      if (url.pathname.endsWith('/dataTypes/weight/dataPoints')) {
        return { json: { dataPoints: [
          { weight: { sampleTime: { physicalTime: '2026-10-12T07:00:00Z', ...civil(2026, 10, 12) }, weightGrams: 104500 } },
          { weight: { sampleTime: { physicalTime: '2026-10-05T07:00:00Z', ...civil(2026, 10, 5) }, weightGrams: 106000 } }
        ] } };
      }
      return { json: { dataPoints: [{ bodyFat: { sampleTime: { physicalTime: '2026-10-12T07:00:00Z', ...civil(2026, 10, 12) }, percentage: 24.26 } }] } };
    });
    const out = await gh.fetchBody('tok', 30);
    expect(out).toEqual([{ date: '2026-10-05', weightKg: 106, bodyFat: undefined }, { date: '2026-10-12', weightKg: 104.5, bodyFat: 24.3 }]);
    const weightCall = calls.find((c) => c.url.pathname.endsWith('/weight/dataPoints'))!;
    expect(weightCall.url.origin + weightCall.url.pathname).toBe('https://health.googleapis.com/v4/users/me/dataTypes/weight/dataPoints');
    expect(weightCall.url.searchParams.get('filter')).toMatch(/^weight\.sample_time\.physical_time >= "\d{4}-.+Z" AND weight\.sample_time\.physical_time < "\d{4}-.+Z"$/);
    expect(calls.some((c) => c.url.pathname.includes('/dataTypes/body-fat/dataPoints') && /bodyFat\.sample_time/.test(c.url.searchParams.get('filter')!))).toBe(true);
  });

  it('calcola il giorno anche senza ora civile (ora fisica + offset)', () => {
    expect(gh.civilDay({ physicalTime: '2026-10-19T22:30:00Z', utcOffset: '7200s' })).toBe('2026-10-20');
    expect(gh.civilDay({ physicalTime: '2026-10-19T22:30:00Z', utcOffset: '-3600s' })).toBe('2026-10-19');
    expect(gh.civilDay(civil(2026, 3, 5))).toBe('2026-03-05');
    expect(gh.civilDay(undefined)).toBeNull();
  });

  it('calcola media e massima della frequenza cardiaca, seguendo le pagine', async () => {
    let page = 0;
    fakeHealth(() => {
      page += 1;
      const pts = (vals: number[]) => vals.map((v) => ({ heartRate: { sampleTime: { physicalTime: '2026-10-19T10:00:00Z' }, beatsPerMinute: String(v) } }));
      return { json: page === 1 ? { dataPoints: pts([90, 100]), nextPageToken: 'p2' } : { dataPoints: pts([110, 120, 130]) } };
    });
    const hr = await gh.fetchHeartRate('tok', { startedAt: Date.UTC(2026, 9, 19, 9), endedAt: Date.UTC(2026, 9, 19, 10) });
    expect(hr).toEqual({ avg: 110, max: 130 });
    expect(calls[0].url.searchParams.get('pageSize')).toBe('10000');
    expect(calls[1].url.searchParams.get('pageToken')).toBe('p2');
    expect(calls[0].url.pathname).toContain('/dataTypes/heart-rate/dataPoints');
  });
});

describe('scrittura', () => {
  it('scrive peso (in grammi) e grasso con ora e offset', async () => {
    fakeHealth(() => ({ json: {} }));
    await gh.writeBody('tok', { date: '2026-10-19', weightKg: 104.5, bodyFat: 24.3 });
    expect(calls.map((c) => [c.method, c.url.pathname])).toEqual([
      ['POST', '/v4/users/me/dataTypes/weight/dataPoints'],
      ['POST', '/v4/users/me/dataTypes/body-fat/dataPoints']
    ]);
    const w = (calls[0].body as { weight: { sampleTime: { physicalTime: string; utcOffset: string }; weightGrams: number } }).weight;
    expect(w.weightGrams).toBe(104500);
    expect(w.sampleTime.utcOffset).toMatch(/^-?\d+s$/);
    expect(Number.isNaN(Date.parse(w.sampleTime.physicalTime))).toBe(false);
    expect((calls[1].body as { bodyFat: { percentage: number } }).bodyFat.percentage).toBe(24.3);
  });
  it('non scrive nulla se non ci sono valori', async () => {
    fakeHealth(() => ({ json: {} }));
    await gh.writeBody('tok', { date: '2026-10-19' });
    expect(calls).toEqual([]);
  });

  const session = (over: Partial<WorkoutSession> = {}): WorkoutSession => ({
    id: 's', date: '2026-10-19', startedAt: Date.UTC(2026, 9, 19, 16, 0), endedAt: Date.UTC(2026, 9, 19, 16, 50), dayId: 'g1', dayTitle: 'Giorno 1',
    weekNumber: 1, durationMinutes: 50, totalVolumeKg: 3210.4, sets: [{ exerciseId: 'a', exerciseName: 'A', setIndex: 0, weightKg: 40, reps: 10 }], ...over
  });
  it('registra l\'allenamento come allenamento di forza', () => {
    const { exercise } = gh.exerciseDataPoint(session({ avgBpm: 118.4 }), 80);
    expect(exercise.exerciseType).toBe('STRENGTH_TRAINING');
    expect(exercise.interval.startTime).toBe('2026-10-19T16:00:00.000Z');
    expect(exercise.interval.endTime).toBe('2026-10-19T16:50:00.000Z');
    expect(exercise.activeDuration).toBe('3000s');
    expect(exercise.notes).toContain('1 serie');
    expect(exercise.metricsSummary.averageHeartRateBeatsPerMinute).toBe('118');
    expect(exercise.metricsSummary.caloriesKcal).toBeGreaterThan(0);
  });
  it('senza frequenza non scrive la media, e garantisce almeno un minuto di durata', () => {
    const { exercise } = gh.exerciseDataPoint(session({ endedAt: Date.UTC(2026, 9, 19, 16, 0) }));
    expect('averageHeartRateBeatsPerMinute' in exercise.metricsSummary).toBe(false);
    expect(exercise.activeDuration).toBe('60s');
  });
  it('invia l\'allenamento all\'indirizzo giusto e restituisce l\'id', async () => {
    fakeHealth(() => ({ json: { name: 'users/x/dataTypes/exercise/dataPoints/abc' } }));
    expect(await gh.logWorkout('tok', session(), 80)).toBe('users/x/dataTypes/exercise/dataPoints/abc');
    expect(calls[0].url.pathname).toBe('/v4/users/me/dataTypes/exercise/dataPoints');
  });
});

describe('risposta della create (Operation)', () => {
  it('usa response.name e non il nome dell\'operazione', async () => {
    fakeHealth(() => ({ json: { name: 'operations/op-1', done: true, response: { name: 'users/x/dataTypes/exercise/dataPoints/abc' } } }));
    const id = await gh.logWorkout('tok', { id: 's', date: '2026-10-19', startedAt: 1, endedAt: 70_000, dayId: 'g', dayTitle: 'G', weekNumber: 1, durationMinutes: 1, totalVolumeKg: 0, sets: [] });
    expect(id).toBe('users/x/dataTypes/exercise/dataPoints/abc');
  });
  it('operazione non ancora conclusa: nessun id (non si scambia il nome dell\'operazione)', () => {
    expect(gh.dataPointName({ name: 'operations/op-1', done: false })).toBe('');
  });
  it('risposta diretta con il data point', () => {
    expect(gh.dataPointName({ name: 'users/x/dataTypes/weight/dataPoints/w1' })).toBe('users/x/dataTypes/weight/dataPoints/w1');
  });
  it('errore dentro l\'operazione', () => {
    expect(() => gh.dataPointName({ done: true, error: { message: 'valore non valido' } })).toThrow(/valore non valido/);
  });
});

describe('pasti', () => {
  const meal = { id: 'm1', date: '2026-10-28', mealType: 'pranzo' as const, name: 'Pasta', kcal: 300 };
  it('crea il pasto in nutrition-log e restituisce l\'id dalla Operation', async () => {
    fakeHealth(() => ({ json: { name: 'operations/o1', done: true, response: { name: 'users/x/dataTypes/nutrition-log/dataPoints/n1' } } }));
    expect(await gh.writeMeal('tok', meal)).toBe('users/x/dataTypes/nutrition-log/dataPoints/n1');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url.pathname).toBe('/v4/users/me/dataTypes/nutrition-log/dataPoints');
    expect((calls[0].body as { nutritionLog: { mealType: string; energy: { kcal: number } } }).nutritionLog).toMatchObject({ mealType: 'LUNCH', energy: { kcal: 300 } });
  });
  it('se Google rifiuta il tipo di pasto riprova senza', async () => {
    let n = 0;
    fakeHealth(() => (++n === 1 ? { status: 400, json: { error: { message: 'Invalid value at nutrition_log.meal_type' } } } : { json: { response: { name: 'users/x/dataTypes/nutrition-log/dataPoints/n2' }, done: true } }));
    expect(await gh.writeMeal('tok', { ...meal, mealType: 'colazione' })).toBe('users/x/dataTypes/nutrition-log/dataPoints/n2');
    expect(calls).toHaveLength(2);
    expect((calls[0].body as { nutritionLog: { mealType?: string } }).nutritionLog.mealType).toBe('BREAKFAST');
    expect((calls[1].body as { nutritionLog: { mealType?: string } }).nutritionLog.mealType).toBeUndefined();
  });
  it('un altro errore 400 non viene ripetuto', async () => {
    fakeHealth(() => ({ status: 400, json: { error: { message: 'energy fuori scala' } } }));
    await expect(gh.writeMeal('tok', meal)).rejects.toThrow(/400/);
    expect(calls).toHaveLength(1);
  });
  it('batchDelete con i nomi, senza doppioni né vuoti', async () => {
    fakeHealth(() => ({ json: {} }));
    await gh.deleteMeals('tok', ['a', 'b', 'a', '']);
    expect(calls).toHaveLength(1);
    expect(calls[0].url.pathname).toBe('/v4/users/me/dataTypes/nutrition-log/dataPoints:batchDelete');
    expect(calls[0].body).toEqual({ names: ['a', 'b'] });
  });
  it('nessuna richiesta senza nomi; 404 ignorato; altri errori no', async () => {
    fakeHealth(() => ({ json: {} }));
    await gh.deleteMeals('tok', []);
    expect(calls).toEqual([]);
    fakeHealth(() => ({ status: 404, json: { error: { message: 'not found' } } }));
    await expect(gh.deleteMeals('tok', ['a'])).resolves.toBeUndefined();
    fakeHealth(() => ({ status: 403, json: {} }));
    await expect(gh.deleteMeals('tok', ['a'])).rejects.toThrow(/negato/);
  });
  it('divide in gruppi da 50', async () => {
    fakeHealth(() => ({ json: {} }));
    await gh.deleteMeals('tok', Array.from({ length: 120 }, (_, i) => `n${i}`));
    expect(calls.map((c) => (c.body as { names: string[] }).names.length)).toEqual([50, 50, 20]);
  });
});

describe('errori', () => {
  it('permesso scaduto -> serve ricollegare', async () => {
    fakeHealth(() => ({ status: 401, json: { error: { status: 'UNAUTHENTICATED' } } }));
    await expect(gh.checkLinked('tok')).rejects.toBeInstanceOf(Expired);
  });
  it('account senza profilo Google Health -> messaggio chiaro', async () => {
    fakeHealth(() => ({ status: 400, json: { error: { status: 'FAILED_PRECONDITION', message: 'ACCOUNT_NOT_LINKED' } } }));
    await expect(gh.checkLinked('tok')).rejects.toBeInstanceOf(gh.HealthNotLinkedError);
    await expect(gh.checkLinked('tok')).rejects.toThrow(/app Google Health/);
  });
  it('permesso negato e troppe richieste', async () => {
    fakeHealth(() => ({ status: 403, json: { error: { message: 'no' } } }));
    await expect(gh.fetchBody('tok')).rejects.toThrow(/negato l'accesso/);
    fakeHealth(() => ({ status: 429, json: {} }));
    await expect(gh.checkLinked('tok')).rejects.toThrow(/limitato le richieste/);
  });
  it('usa il token nell\'intestazione', async () => {
    let auth = '';
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => { auth = String((init.headers as Record<string, string>).Authorization); return { ok: true, status: 200, json: async () => ({}) }; }));
    await gh.checkLinked('abc123');
    expect(auth).toBe('Bearer abc123');
  });
});
