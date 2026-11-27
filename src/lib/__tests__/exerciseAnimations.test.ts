import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { animationForGuide, animationForLibrary, animationIds } from '../exerciseAnimations';

const guides = JSON.parse(readFileSync('src/data/guides/it.json', 'utf8')) as { guides: { id: string; libraryIds: string[] }[] };

describe('animazioni degli esercizi', () => {
  it('ogni animazione ha la sua scheda e tutti i file nel pacchetto', () => {
    expect(animationIds().length).toBeGreaterThan(0);
    for (const id of animationIds()) {
      expect(guides.guides.some((g) => g.id === id)).toBe(true);
      const a = animationForGuide(id)!;
      for (const url of [a.webm, a.mp4, a.poster, a.setup]) {
        expect(existsSync('public/animations/' + url.split('/animations/')[1])).toBe(true);
      }
    }
  });

  it('trova l’animazione dall’esercizio della libreria', () => {
    expect(animationForLibrary('Leg_Press')?.id).toBe('leg-press');
    expect(animationForLibrary('Wide-Grip_Lat_Pulldown')?.mp4).toMatch(/animations\/lat-machine\.mp4$/);
    expect(animationForLibrary('Non_Esiste')).toBeUndefined();
    expect(animationForLibrary(undefined)).toBeUndefined();
  });
});
