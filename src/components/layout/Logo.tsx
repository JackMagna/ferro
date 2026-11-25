/**
 * Logo di Ferro: il bilanciere sul "disco" del tema. I colori vengono dal tema scelto
 * (accento e testo sopra l'accento), come le icone in public/icons/ (scripts/make-icons.mjs).
 */
export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--color-plate)" />
      <rect x="12.5" y="30.6" width="39" height="2.8" rx="0.5" fill="var(--color-plate-ink)" />
      <rect x="18.25" y="18.25" width="6.5" height="27.5" rx="1.25" fill="var(--color-plate-ink)" />
      <rect x="39.25" y="18.25" width="6.5" height="27.5" rx="1.25" fill="var(--color-plate-ink)" />
    </svg>
  );
}
