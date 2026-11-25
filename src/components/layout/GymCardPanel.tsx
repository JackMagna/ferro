import { useRef, useState } from 'react';
import { readJSON, removeKey, writeJSON } from '../../lib/storage';
import { t } from '../../lib/i18n';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';

/** Tessera della palestra: solo un promemoria da mostrare in reception, non imita il chip della tessera. */
interface GymCard { gym?: string; number?: string; front?: string; back?: string }
// solo su questo dispositivo: mai in Firestore né nel backup (il numero può servire a copiare la tessera)
const KEY = 'irontrack:gym-card';

/** Foto ridotta a 1200 px in JPEG, per stare comoda in localStorage. */
async function shrink(file: File, max = 1200): Promise<string> {
  const img = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

export function GymCardPanel() {
  const toast = useToast();
  const [card, setCard] = useState<GymCard>(() => readJSON<GymCard>(KEY, {}));
  const [view, setView] = useState<'none' | 'show' | 'edit'>('none');
  const [side, setSide] = useState<'front' | 'back'>('front');
  const has = !!(card.number || card.front || card.back);

  const save = (next: GymCard) => {
    if (!writeJSON(KEY, next)) return toast(t('Spazio pieno sul dispositivo: la tessera non è stata salvata.'), 'error');
    setCard(next);
  };
  const remove = () => {
    if (!window.confirm(t('Eliminare la tessera da questo dispositivo?'))) return;
    removeKey(KEY);
    setCard({});
    setView('none');
  };

  return (
    <section className="space-y-3 border-t border-line pt-5">
      <h3 className="font-display text-lg font-semibold">{t('La mia tessera')}</h3>
      <p className="text-sm text-muted">{t('Numero e foto della tessera della palestra, da mostrare in reception. Restano solo su questo dispositivo: non vanno nel cloud né nel backup.')}</p>
      <div className="flex flex-wrap gap-2">
        {has && <Button variant="primary" onClick={() => { setSide(card.front ? 'front' : 'back'); setView('show'); }}>{t('Mostra la tessera')}</Button>}
        <Button onClick={() => setView('edit')}>{has ? t('Modifica') : t('Aggiungi la tessera')}</Button>
      </div>

      <Sheet open={view === 'show'} onClose={() => setView('none')} title={card.gym || t('La mia tessera')} size="lg">
        <div className="space-y-4">
          {card.number && <p className="text-center font-mono text-3xl font-bold tracking-wider">{card.number}</p>}
          {card[side] && <img src={card[side]} alt={side === 'front' ? t('Fronte della tessera') : t('Retro della tessera')} className="mx-auto w-full rounded-xl bg-white" />}
          {card.front && card.back && (
            <Button block onClick={() => setSide(side === 'front' ? 'back' : 'front')}>{side === 'front' ? t('Mostra il retro') : t('Mostra il fronte')}</Button>
          )}
          <p className="text-center text-sm text-muted">{t('Alza la luminosità dello schermo se la reception deve leggere il codice a barre.')}</p>
        </div>
      </Sheet>

      <Sheet open={view === 'edit'} onClose={() => setView('none')} title={t('La mia tessera')}>
        <div className="space-y-4 text-[15px]">
          <label className="block">
            <span className="label">{t('Palestra')}</span>
            <input className="field" value={card.gym ?? ''} onChange={(e) => save({ ...card, gym: e.target.value })} />
          </label>
          <label className="block">
            <span className="label">{t('Numero della tessera')}</span>
            <input className="field font-mono" inputMode="text" autoComplete="off" value={card.number ?? ''} onChange={(e) => save({ ...card, number: e.target.value })} />
          </label>
          <PhotoField label={t('Foto del fronte')} value={card.front} onChange={(front) => save({ ...card, front })} />
          <PhotoField label={t('Foto del retro')} value={card.back} onChange={(back) => save({ ...card, back })} />
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="primary" onClick={() => setView('none')}>{t('Fatto')}</Button>
            {has && <Button variant="danger" onClick={remove}>{t('Elimina la tessera')}</Button>}
          </div>
        </div>
      </Sheet>
    </section>
  );
}

function PhotoField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string | undefined) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const toast = useToast();
  return (
    <div className="space-y-2">
      <span className="block text-sm text-muted">{label}</span>
      {value && <img src={value} alt={label} className="max-h-40 rounded-lg border border-line" />}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => ref.current?.click()}>{value ? t('Cambia foto') : t('Scatta o scegli una foto')}</Button>
        {value && <Button size="sm" variant="ghost" onClick={() => onChange(undefined)}>{t('Togli')}</Button>}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            onChange(await shrink(file));
          } catch {
            toast(t('Non riesco a leggere questa foto.'), 'error');
          }
        }}
      />
    </div>
  );
}
