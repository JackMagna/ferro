import { describe, expect, it } from 'vitest';
import { autoTour, TOUR_VERSION, tourSteps } from '../tour';

describe('guida al primo accesso', () => {
  it('parte da sola solo per chi è nuovo', () => {
    expect(autoTour(null, 0)).toBe('tour');
    expect(autoTour(null, 3)).toBe('news');
  });

  it('non riparte dopo averla vista, saltata o chiusa la riga Novità', () => {
    for (const status of ['done', 'skipped', 'news-dismissed'] as const) {
      expect(autoTour({ v: TOUR_VERSION, status }, 0)).toBe('none');
    }
  });

  it('una guida nuova arriva a chi ha visto la vecchia solo come Novità', () => {
    expect(autoTour({ v: TOUR_VERSION - 1, status: 'done' }, 0)).toBe('news');
  });

  it('7 tappe nell’ordine della barra, la prima al centro e l’ultima sull’account', () => {
    const steps = tourSteps({ android: false, ios: false, guest: false });
    expect(steps).toHaveLength(7);
    expect(steps[0].target).toBeUndefined();
    expect(steps.map((s) => s.target).slice(1)).toEqual(['tab-workout', 'tab-program', 'tab-nutrition', 'tab-library', 'tab-progress', 'account']);
  });

  it('l’ultima tappa cambia con il dispositivo e l’account', () => {
    const last = (ctx: Parameters<typeof tourSteps>[0]) => tourSteps(ctx).at(-1)!.text;
    expect(last({ android: true, ios: false, guest: false })).toContain('Health Connect');
    expect(last({ android: false, ios: true, guest: false })).toContain('Apple Salute');
    expect(last({ android: false, ios: false, guest: false })).not.toContain('Health Connect');
    expect(last({ android: false, ios: false, guest: true })).toContain('Senza account');
    expect(last({ android: false, ios: false, guest: false })).not.toContain('Senza account');
  });
});
