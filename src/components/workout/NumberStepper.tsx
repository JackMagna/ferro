import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Minus, Pencil, Plus } from '../ui/icons';
import { decimalText, parseTyped } from '../../lib/weightStep';

interface Props {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  steps: number[];
  min?: number;
  decimals?: boolean;
  size?: 'xl' | 'lg';
  /** controllo accanto all'etichetta (es. il passo del carico) */
  extra?: ReactNode;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Valore grande con pulsanti rapidi. Toccando il numero (o «Scrivi») lo si scrive con la tastiera.
 * Pensato per l'uso con le mani sudate: bersagli di almeno 48px.
 */
export function NumberStepper({ label, unit, value, onChange, steps, min = 0, decimals, size = 'xl', extra }: Props) {
  const show = (v: number) => (decimals ? decimalText(v) : String(v));
  const [text, setText] = useState(show(value));
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!editing) setText(show(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editing, decimals]);

  const commit = () => {
    setEditing(false);
    const n = parseTyped(text);
    if (n !== undefined) onChange(Math.max(min, decimals ? round(n) : Math.round(n)));
    else setText(show(value));
  };
  const bump = (d: number) => onChange(Math.max(min, round(value + d)));
  const minus = [...steps].reverse();
  const stepText = (s: number) => (decimals ? decimalText(s) : String(s));

  return (
    <div className="rounded-2xl bg-ink p-2.5 sm:p-4">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted">{label}</span>
        <span className="flex items-center gap-1">
          {extra}
          <button
            type="button"
            onClick={() => input.current?.focus()}
            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm text-muted hover:text-chalk"
          >
            <Pencil className="h-3.5 w-3.5" />Scrivi
          </button>
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => bump(-steps[0])} aria-label={`Togli ${stepText(steps[0])} ${unit}`} className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-raised text-chalk active:scale-95">
          <Minus className="h-6 w-6" />
        </button>
        <label className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
          <span className="sr-only">{label} in {unit}</span>
          <input
            ref={input}
            inputMode={decimals ? 'decimal' : 'numeric'}
            enterKeyHint="done"
            autoComplete="off"
            value={text}
            onFocus={(e) => { setEditing(true); e.target.select(); }}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className={`w-full min-w-0 rounded-xl bg-transparent num-live text-center font-display font-bold leading-none text-chalk outline-none focus:bg-raised focus:text-plate ${size === 'xl' ? 'text-5xl sm:text-7xl' : 'text-4xl sm:text-5xl'}`}
          />
          <span className="font-display text-xl font-semibold text-muted">{unit}</span>
        </label>
        <button type="button" onClick={() => bump(steps[0])} aria-label={`Aggiungi ${stepText(steps[0])} ${unit}`} className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-raised text-chalk active:scale-95">
          <Plus className="h-6 w-6" />
        </button>
      </div>
      {steps.length > 1 && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {[...minus.slice(0, -1).map((s) => -s), ...steps.slice(1)].map((d) => (
            <button key={d} type="button" onClick={() => bump(d)} className="h-11 rounded-xl border border-line text-[15px] font-semibold tabular-nums text-muted active:scale-95 hover:text-chalk">
              {d > 0 ? `+${stepText(d)}` : `−${stepText(-d)}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
