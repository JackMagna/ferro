import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES, detectLang } from '../i18n';
import { MODES, THEMES } from '../theme';

/** Tutti i testi passati a t('…') o t("…") nel codice dell'app. */
function sourceKeys(dir = 'src'): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== '__tests__' && name !== 'i18n') out.push(...sourceKeys(p)); continue; }
    if (!/\.tsx?$/.test(name)) continue;
    const src = readFileSync(p, 'utf8');
    for (const m of src.matchAll(/\bt\((?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g)) out.push((m[1] ?? m[2]).replace(/\\n/g, '\n').replace(/\\'/g, "'"));
  }
  return out;
}
const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

describe('traduzioni', () => {
  const keys = [...new Set([...sourceKeys(), ...THEMES.flatMap((th) => [th.label, th.hint]), ...MODES.map((m) => m.label)])];

  it.each(Object.keys(DICTIONARIES))('%s: ogni testo dell’app è tradotto, con le stesse variabili', (code) => {
    const dict = DICTIONARIES[code as keyof typeof DICTIONARIES];
    expect(keys.filter((k) => !(k in dict))).toEqual([]);
    expect(keys.filter((k) => k in dict && vars(k) !== vars(dict[k]))).toEqual([]);
  });

  it('sceglie la lingua salvata, poi quella del telefono, poi l’inglese', () => {
    expect(detectLang('fr', ['it-IT'])).toBe('fr');
    expect(detectLang(null, ['de-AT', 'en'])).toBe('de');
    expect(detectLang(null, ['pt-BR'])).toBe('en');
    expect(detectLang('xx', ['it'])).toBe('it');
  });
});
