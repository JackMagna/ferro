import type { Page, Route } from '@playwright/test';

/**
 * Google Sheets simulato: un foglio in memoria con le sue schede, che risponde alle stesse chiamate
 * di src/services/googleSheets.ts e tiene traccia di cosa l'app scrive.
 */
export const SHEET_ID = 'foglio-di-prova-123';
export const SHEET_LINK = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=0`;

const unquote = (t: string) => t.replace(/^'(.*)'$/, '$1').replace(/''/g, "'");

/** "A1" → [riga, colonna] da zero. */
function cellIndex(a1: string): [number, number] {
  const m = /^([A-Z]+)(\d+)$/.exec(a1)!;
  const col = [...m[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
  return [Number(m[2]) - 1, col];
}

export class FakeSheets {
  tabs: Map<string, string[][]>;
  /** Celle scritte dall'app, nell'ordine: "SCHEDA!A1" → valore */
  writes: { range: string; value: unknown }[] = [];
  appended: { tab: string; rows: unknown[][] }[] = [];
  requests: string[] = [];

  constructor(tabs: Record<string, string[][]>) {
    this.tabs = new Map(Object.entries(tabs).map(([k, v]) => [k, v.map((r) => [...r])]));
  }

  private tab(title: string) {
    const key = [...this.tabs.keys()].find((t) => t.toLowerCase() === title.toLowerCase());
    if (!key) throw new Error(`scheda ${title} inesistente`);
    return this.tabs.get(key)!;
  }

  private cell(range: string): string {
    const [t, a1] = range.split('!');
    const [r, c] = cellIndex(a1);
    return this.tab(unquote(t))[r]?.[c] ?? '';
  }

  private setCell(range: string, value: unknown) {
    const [t, a1] = range.split('!');
    const grid = this.tab(unquote(t));
    const [r, c] = cellIndex(a1);
    while (grid.length <= r) grid.push([]);
    grid[r][c] = String(value);
    this.writes.push({ range, value });
  }

  async install(page: Page) {
    await page.route('https://sheets.googleapis.com/**', (route) => this.handle(route));
  }

  private async handle(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    const path = decodeURIComponent(url.pathname.replace('/v4/spreadsheets/', ''));
    this.requests.push(`${req.method()} ${path}`);
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (req.headers().authorization !== 'Bearer token-di-prova') return json({ error: { message: 'token' } }, 401);
    if (!path.startsWith(SHEET_ID)) return json({ error: { message: 'not found' } }, 404);
    const rest = path.slice(SHEET_ID.length);
    const body = req.postData() ? JSON.parse(req.postData()!) : {};

    if (rest === '' && req.method() === 'GET') {
      return json({ sheets: [...this.tabs.keys()].map((title) => ({ properties: { title } })) });
    }
    if (rest === ':batchUpdate') {
      for (const r of body.requests ?? []) if (r.addSheet) this.tabs.set(r.addSheet.properties.title, []);
      return json({});
    }
    if (rest === '/values:batchGet') {
      const ranges = url.searchParams.getAll('ranges');
      return json({ valueRanges: ranges.map((r) => ({ range: r, values: [[this.cell(r)]] })) });
    }
    if (rest === '/values:batchUpdate') {
      for (const d of body.data ?? []) this.setCell(d.range, d.values[0][0]);
      return json({});
    }
    const values = /^\/values\/(.+?)(:append)?$/.exec(rest);
    if (values) {
      const range = values[1];
      if (values[2]) {
        const tab = unquote(range.split('!')[0]);
        this.tab(tab).push(...body.values.map((r: unknown[]) => r.map(String)));
        this.appended.push({ tab, rows: body.values });
        return json({});
      }
      if (req.method() === 'PUT') {
        this.tab(unquote(range.split('!')[0])).splice(0, 1, body.values[0].map(String));
        return json({});
      }
      return json({ values: this.tab(unquote(range.split('!')[0])) });
    }
    return json({ error: { message: `chiamata non simulata: ${req.method()} ${path}` } }, 400);
  }
}
