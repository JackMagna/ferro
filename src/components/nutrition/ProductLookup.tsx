import { useMemo, useState } from 'react';
import { Barcode, Search } from '../ui/icons';
import { fetchProduct, searchProducts } from '../../services/openFoodFacts';
import type { OffProduct } from '../../lib/offMap';
import { FOODS_SOURCE, foodAsProduct, isCommonFoodCode, searchFoods } from '../../lib/foods';
import { parseNumber } from '../../lib/measuresSheet';
import { Button } from '../ui/Button';
import { BarcodeScanner, canScanBarcodes } from './BarcodeScanner';
import { locale, t } from '../../lib/i18n';

interface Props { onPick: (product: OffProduct, grams: number) => void }

const fmt = (n: number | undefined) => (n === undefined ? '–' : n.toLocaleString(locale, { maximumFractionDigits: 1 }));

/**
 * Cerca un alimento: prima nella tabella interna degli alimenti comuni (sul dispositivo, senza rete),
 * poi su Open Food Facts con il codice a barre (fotocamera o a mano) o per nome.
 */
export function ProductLookup({ onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [results, setResults] = useState<OffProduct[]>([]);
  const [product, setProduct] = useState<OffProduct | null>(null);
  const [grams, setGrams] = useState('100');
  const common = useMemo(() => (product ? [] : searchFoods(text)), [text, product]);

  const choose = (p: OffProduct) => {
    setProduct(p);
    setGrams(String(p.servingG ?? 100));
    setResults([]);
    setMsg('');
  };

  const lookup = async (barcode: string) => {
    setScanning(false);
    setBusy(true);
    setMsg('');
    try {
      const p = await fetchProduct(barcode);
      if (p) choose(p);
      else setMsg(t('Prodotto non trovato o senza valori nutrizionali: inseriscili a mano.'));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : t('Ricerca non riuscita.'));
    } finally {
      setBusy(false);
    }
  };

  const search = async () => {
    setBusy(true);
    setMsg('');
    try {
      const list = await searchProducts(text);
      setResults(list);
      if (!list.length) setMsg(t('Nessun risultato. Prova con un nome più preciso.'));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : t('Ricerca non riuscita.'));
    } finally {
      setBusy(false);
    }
  };

  const g = parseNumber(grams);
  const fromTable = product ? isCommonFoodCode(product.code) : false;

  if (!open) {
    return <Button block icon={<Search className="h-4 w-4" />} onClick={() => setOpen(true)}>{t('Cerca un alimento o un prodotto')}</Button>;
  }

  return (
    <section className="space-y-3 rounded-2xl border border-line p-3" aria-label={t('Cerca un alimento')}>
      {scanning ? <BarcodeScanner onCode={(c) => void lookup(c)} onClose={() => setScanning(false)} /> : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input aria-label={t('Alimento o prodotto')} className="field" placeholder={t('Es. petto di pollo, banana, yogurt greco')} value={text} onChange={(e) => { setText(e.target.value); setProduct(null); }} onKeyDown={(e) => { if (e.key === 'Enter' && text.trim().length >= 3 && !busy) void search(); }} />
          </div>
          {common.length > 0 && (
            <div>
              <p className="label">{t('Alimenti comuni')}</p>
              <ul className="divide-y divide-line/60">
                {common.map((f) => (
                  <li key={f.id}>
                    <button type="button" onClick={() => choose(foodAsProduct(f))} className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left">
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      <span className="shrink-0 tabular-nums text-sm text-muted">{fmt(f.kcal)} kcal/100 g</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button block icon={<Search className="h-4 w-4" />} disabled={busy || text.trim().length < 3} onClick={() => void search()}>{t('Cerca tra i prodotti confezionati')}</Button>
          {canScanBarcodes() && <Button block icon={<Barcode className="h-4 w-4" />} onClick={() => setScanning(true)}>{t('Scansiona il codice a barre')}</Button>}
          <div className="flex gap-2">
            <input aria-label={t('Codice a barre')} className="field" inputMode="numeric" placeholder={t('Codice a barre')} value={code} onChange={(e) => setCode(e.target.value)} />
            <Button disabled={busy || code.replace(/\D/g, '').length < 6} onClick={() => void lookup(code)}>{t('Cerca')}</Button>
          </div>
          <p className="text-xs text-faint">{t("Gli alimenti comuni sono nell'app. Per i prodotti confezionati il nome o il codice viene inviato a Open Food Facts, un database pubblico. Controlla sempre i valori.")}</p>
        </div>
      )}

      {busy && <p role="status" className="text-sm text-muted">{t('Cerco…')}</p>}
      {msg && <p role="alert" className="text-sm text-stop">{msg}</p>}

      {results.length > 0 && (
        <ul className="divide-y divide-line/60">
          {results.map((r) => (
            <li key={r.code}>
              <button type="button" onClick={() => choose(r)} className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left">
                <span className="min-w-0 flex-1 truncate">{[r.brand, r.name].filter(Boolean).join(' · ')}</span>
                <span className="shrink-0 tabular-nums text-sm text-muted">{fmt(r.kcal100)} kcal/100 g</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {product && (
        <div className="space-y-2 rounded-xl bg-ink p-3">
          <p className="font-semibold">{[product.brand, product.name].filter(Boolean).join(' · ')}</p>
          <p className="text-sm text-muted">{t('Per 100 g: {kcal} kcal · P {p} · C {c} · G {f}', { kcal: fmt(product.kcal100), p: fmt(product.protein100), c: fmt(product.carbs100), f: fmt(product.fat100) })}{product.nutriScore ? ` · Nutri-Score ${product.nutriScore.toUpperCase()}` : ''}</p>
          {fromTable && <p className="text-xs text-faint">{t('Valori medi da {source}.', { source: FOODS_SOURCE })}</p>}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="label" htmlFor="off-grams">{t('Quantità mangiata (g)')}</label>
              <input id="off-grams" className="field" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} />
            </div>
            <Button variant="primary" disabled={g === undefined || g <= 0} onClick={() => { onPick(product, g!); setProduct(null); setOpen(false); }}>{t('Usa')}</Button>
          </div>
          {fromTable && product.servingG && (
            <p className="text-xs text-faint">{t('Proposta: 1 pezzo ≈ {g} g. Pesalo se puoi.', { g: product.servingG })}</p>
          )}
        </div>
      )}
    </section>
  );
}
