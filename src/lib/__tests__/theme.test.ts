import { describe, expect, it } from 'vitest';
import { BAR_COLOR, DEFAULT_THEME, normalizeTheme, resolveMode } from '../theme';

describe('tema', () => {
  it('valori mancanti o non validi tornano al predefinito', () => {
    expect(normalizeTheme(null)).toEqual(DEFAULT_THEME);
    expect(normalizeTheme({ theme: 'blu', mode: 'viola' })).toEqual(DEFAULT_THEME);
    expect(normalizeTheme('x')).toEqual(DEFAULT_THEME);
  });
  it('il predefinito è Classico con modalità Sistema', () => {
    expect(DEFAULT_THEME).toEqual({ theme: 'classico', mode: 'system' });
  });
  it('converte i nomi della prima versione dei temi', () => {
    expect(normalizeTheme({ theme: 'attuale', mode: 'dark' })).toEqual({ theme: 'classico', mode: 'dark' });
    expect(normalizeTheme({ theme: 'nothing', mode: 'light' })).toEqual({ theme: 'grafite', mode: 'light' });
    expect(normalizeTheme({ theme: 'ibrido' })).toEqual({ theme: 'brace', mode: 'system' });
  });
  it('legge una scelta valida', () => {
    expect(normalizeTheme({ theme: 'brace', mode: 'light' })).toEqual({ theme: 'brace', mode: 'light' });
    expect(normalizeTheme({ theme: 'grafite' })).toEqual({ theme: 'grafite', mode: 'system' });
  });
  it('"Sistema" segue il telefono, le altre no', () => {
    expect(resolveMode('system', true)).toBe('dark');
    expect(resolveMode('system', false)).toBe('light');
    expect(resolveMode('dark', false)).toBe('dark');
    expect(resolveMode('light', true)).toBe('light');
  });
  it('ogni tema ha il colore della barra per scuro e chiaro', () => {
    for (const t of ['classico', 'grafite', 'brace'] as const) {
      expect(BAR_COLOR[t].dark).toMatch(/^#[0-9a-f]{6}$/);
      expect(BAR_COLOR[t].light).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('icona per tema', () => {
  it('una variante per tema; Grafite cambia tra scuro e chiaro', async () => {
    const { iconVariant } = await import('../theme');
    expect(iconVariant('classico', 'light')).toBe('classico');
    expect(iconVariant('brace', 'dark')).toBe('brace');
    expect(iconVariant('grafite', 'dark')).toBe('grafite-dark');
    expect(iconVariant('grafite', 'light')).toBe('grafite-light');
  });
  it('i file delle icone esistono per ogni variante', async () => {
    const { existsSync } = await import('node:fs');
    for (const v of ['classico', 'brace', 'grafite-dark', 'grafite-light']) {
      for (const f of [`ferro-${v}.svg`, `ferro-${v}-180.png`, `ferro-${v}-192.png`, `ferro-${v}-512.png`, `manifest-${v}.webmanifest`]) {
        expect(existsSync(`public/icons/${f}`), f).toBe(true);
      }
    }
  });
});
