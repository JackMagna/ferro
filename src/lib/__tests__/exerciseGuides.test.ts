import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { guideFor, type GuideBook } from '../exerciseGuides';
import type { LibraryExercise } from '../exerciseLibrary';

const lib: LibraryExercise[] = JSON.parse(readFileSync(new URL('../../../public/data/exercises.json', import.meta.url), 'utf8'));
const book: GuideBook = JSON.parse(readFileSync(new URL('../../data/guides/it.json', import.meta.url), 'utf8'));
const ids = new Set(lib.map((e) => e.id));
const KINDS = ['macchina', 'cavi', 'pesi liberi', 'corpo libero'];

describe('schede degli esercizi in italiano', () => {
  it('ha formato, licenza e almeno 40 schede', () => {
    expect(book.format).toBe('ferro-guides-v1');
    expect(book.license).toBe('CC BY-SA 4.0');
    expect(book.guides.length).toBeGreaterThanOrEqual(40);
  });

  it('ogni scheda è completa', () => {
    for (const g of book.guides) {
      expect(g.id, g.id).toMatch(/^[a-z0-9-]+$/);
      expect(KINDS, g.id).toContain(g.kind);
      for (const field of ['name', 'muscles', 'cue', 'feel', 'stop'] as const) expect(g[field].trim(), `${g.id}.${field}`).not.toBe('');
      expect(g.setup.length, g.id).toBeGreaterThanOrEqual(2);
      expect(g.steps.length, g.id).toBeGreaterThanOrEqual(3);
      expect(g.mistakes.length, g.id).toBeGreaterThanOrEqual(3);
      for (const m of g.mistakes) {
        expect(m.error.trim(), g.id).not.toBe('');
        expect(m.fix.trim(), g.id).not.toBe('');
      }
      expect(g.sources.length, g.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('gli id sono unici e ogni esercizio della libreria ha al massimo una scheda', () => {
    expect(new Set(book.guides.map((g) => g.id)).size).toBe(book.guides.length);
    const all = book.guides.flatMap((g) => g.libraryIds);
    expect(all.filter((id, i) => all.indexOf(id) !== i)).toEqual([]);
  });

  it('collega solo esercizi che esistono nella libreria', () => {
    const missing = book.guides.flatMap((g) => g.libraryIds.filter((id) => !ids.has(id)).map((id) => `${g.id}: ${id}`));
    expect(missing).toEqual([]);
  });

  it('ogni fonte citata esiste, è un indirizzo https o http, e viene usata', () => {
    const used = new Set(book.guides.flatMap((g) => g.sources));
    for (const g of book.guides) for (const k of g.sources) expect(book.sources[k], `${g.id}: ${k}`).toBeDefined();
    for (const [k, s] of Object.entries(book.sources)) {
      expect(s.url, k).toMatch(/^https?:\/\//);
      expect(used.has(k), `fonte non usata: ${k}`).toBe(true);
    }
  });

  it('trova la scheda e aggiunge le avvertenze giuste per il tipo di attrezzo', () => {
    const lp = guideFor(book, 'Leg_Press');
    expect(lp?.guide.id).toBe('leg-press');
    expect(lp?.safety).toEqual(book.safety.machine);
    expect(lp?.sources.every((s) => s.url.startsWith('http'))).toBe(true);
    expect(guideFor(book, 'Barbell_Full_Squat')?.safety).toEqual(book.safety.free);
    expect(guideFor(book, 'Plank')?.safety).toEqual([]);
    expect(guideFor(book, 'Esercizio_che_non_esiste')).toBeUndefined();
  });
});
