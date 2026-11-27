/**
 * Celle unite nel foglio del coach. Google restituisce il valore solo nella prima cella in alto a sinistra:
 * le altre arrivano vuote. Qui si copiano i valori dove serve e si evita di scrivere nelle celle unite.
 */

/** Come lo restituisce l'API (spreadsheets.get, fields=sheets(merges)): indici da 0, fine esclusa. */
export interface GridRange {
  startRowIndex?: number;
  endRowIndex?: number;
  startColumnIndex?: number;
  endColumnIndex?: number;
}

const bounds = (m: GridRange) => ({
  r0: m.startRowIndex ?? 0,
  r1: m.endRowIndex ?? 0,
  c0: m.startColumnIndex ?? 0,
  c1: m.endColumnIndex ?? 0
});

/**
 * Copia il valore delle celle unite in verticale nelle righe sotto, nella stessa colonna.
 * Es. il coach scrive «3x10» una volta e unisce la cella su tre esercizi: tutti e tre ricevono «3x10».
 * Non tocca la colonna A (lì un giorno unito su più righe diventerebbe un giorno per riga)
 * né le unioni solo in orizzontale (titoli e intestazioni larghe, che resterebbero ripetuti).
 */
export function fillMergedCells(values: string[][], merges: GridRange[] = []): string[][] {
  const rows = values.map((r) => [...r]);
  for (const m of merges) {
    const { r0, r1, c0 } = bounds(m);
    if (r1 - r0 < 2 || c0 < 1) continue;
    const v = rows[r0]?.[c0] ?? '';
    if (v === '') continue;
    for (let r = r0 + 1; r < r1; r++) {
      while (rows.length <= r) rows.push([]);
      const row = rows[r];
      while (row.length <= c0) row.push('');
      if (row[c0] === '' || row[c0] === undefined) row[c0] = v;
    }
  }
  return rows;
}

/**
 * L'app non deve scrivere nella cella (indici da 0): è nascosta da un'unione (non è la prima),
 * oppure è la prima di un'unione su più righe, che vale per più esercizi (un carico solo lì sarebbe fuorviante).
 * La prima cella di un'unione su una riga sola resta scrivibile, come prima.
 */
export function isInMerge(merges: GridRange[], row: number, col: number): boolean {
  return merges.some((m) => {
    const { r0, r1, c0, c1 } = bounds(m);
    if (row < r0 || row >= r1 || col < c0 || col >= c1) return false;
    return row !== r0 || col !== c0 || r1 - r0 > 1;
  });
}

/** «E12» → riga 11, colonna 4 (indici da 0). */
export function a1ToCell(a1: string): { row: number; col: number } | null {
  const m = a1.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  const col = [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  return { row: Number(m[2]) - 1, col };
}
