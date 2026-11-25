// Controlla il contrasto dei colori di ogni tema (WCAG): node scripts/check-contrast.mjs
// Legge i colori da src/index.css. Testo normale: almeno 4,5:1.
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const vars = (block) => Object.fromEntries([...block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));
const base = vars(css.match(/@theme\s*{([\s\S]*?)\n}/)[1]);
const override = (sel) => {
  const m = css.match(new RegExp(sel.replace(/[[\]"]/g, '\\$&') + '\\s*{([^}]*)}'));
  return m ? vars(m[1]) : {};
};
const combos = {
  'classico scuro': base,
  'classico chiaro': { ...base, ...override('html[data-theme="classico"][data-mode="light"]') },
  'grafite scuro': { ...base, ...override('html[data-theme="grafite"][data-mode="dark"]') },
  'grafite chiaro': { ...base, ...override('html[data-theme="grafite"][data-mode="light"]') },
  'brace scuro': { ...base, ...override('html[data-theme="brace"][data-mode="dark"]') },
  'brace chiaro': { ...base, ...override('html[data-theme="brace"][data-mode="light"]') }
};

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const PAIRS = [
  ['chalk', 'ink'], ['chalk', 'panel'], ['chalk', 'raised'],
  ['muted', 'ink'], ['muted', 'panel'], ['muted', 'raised'],
  ['faint', 'ink'], ['faint', 'panel'],
  ['plate-ink', 'plate'], ['plate-text', 'ink'], ['plate-text', 'panel'],
  ['go-ink', 'go'], ['go', 'ink'], ['go', 'panel'], ['stop', 'ink'], ['stop', 'panel']
];
let bad = 0;
for (const [name, t] of Object.entries(combos)) {
  for (const [fg, bg] of PAIRS) {
    if (!t[fg] || !t[bg]) { console.log(`${name}: manca ${!t[fg] ? fg : bg}`); bad++; continue; }
    const r = ratio(t[fg], t[bg]);
    if (r < 4.5) { console.log(`${name}: ${fg} su ${bg} = ${r.toFixed(2)} (< 4,5)`); bad++; }
  }
}
console.log(bad ? `${bad} problemi` : 'Contrasto ok in tutte le combinazioni');
process.exit(bad ? 1 : 0);
