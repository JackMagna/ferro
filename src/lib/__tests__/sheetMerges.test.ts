import { describe, expect, it } from 'vitest';
import { a1ToCell, fillMergedCells, isInMerge } from '../sheetMerges';

describe('celle unite', () => {
  const grid = [
    ['GIORNO 1', 'NOTE', '1 SETT.'],
    ['PANCA', 'lento', '3x10'],
    ['CROCI', '', ''],
    ['DIP']
  ];
  it('copia sotto il valore delle unioni verticali, anche oltre la fine della riga', () => {
    const out = fillMergedCells(grid, [{ startRowIndex: 1, endRowIndex: 4, startColumnIndex: 2, endColumnIndex: 3 }]);
    expect(out.map((r) => r[2])).toEqual(['1 SETT.', '3x10', '3x10', '3x10']);
    expect(grid[2][2]).toBe(''); // l'originale non cambia
  });
  it('copia anche le note unite', () => {
    const out = fillMergedCells(grid, [{ startRowIndex: 1, endRowIndex: 3, startColumnIndex: 1, endColumnIndex: 2 }]);
    expect(out[2][1]).toBe('lento');
  });
  it('lascia stare la colonna A e le unioni solo orizzontali', () => {
    const out = fillMergedCells(grid, [
      { startRowIndex: 0, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 1 },
      { startRowIndex: 1, endRowIndex: 2, startColumnIndex: 1, endColumnIndex: 3 }
    ]);
    expect(out).toEqual(grid);
  });
  it('riconosce le celle dove non scrivere', () => {
    const m = [{ startRowIndex: 1, endRowIndex: 4, startColumnIndex: 2, endColumnIndex: 3 }, { startRowIndex: 6, endRowIndex: 7, startColumnIndex: 2, endColumnIndex: 5 }];
    expect(isInMerge(m, 1, 2)).toBe(true);  // prima cella di un'unione su più righe
    expect(isInMerge(m, 3, 2)).toBe(true);  // nascosta
    expect(isInMerge(m, 4, 2)).toBe(false);
    expect(isInMerge(m, 6, 2)).toBe(false); // prima cella di un'unione su una riga: come prima
    expect(isInMerge(m, 6, 3)).toBe(true);
  });
  it('converte A1 in riga e colonna', () => {
    expect(a1ToCell('E12')).toEqual({ row: 11, col: 4 });
    expect(a1ToCell('AA1')).toEqual({ row: 0, col: 26 });
    expect(a1ToCell('x')).toBeNull();
  });
});
