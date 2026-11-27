import type { ReactNode } from 'react';
import { Check, ExternalLink, X } from '../ui/icons';
import type { ResolvedGuide } from '../../lib/exerciseGuides';
import { t } from '../../lib/i18n';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-display text-lg font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** Scheda da coach: regolazioni, esecuzione, errori comuni, sensazione giusta, quando fermarsi, fonti. */
export function GuideSections({ resolved, setupImage }: { resolved: ResolvedGuide; setupImage?: string }) {
  const { guide, sources, safety, general, license } = resolved;
  return (
    <div className="space-y-5 text-[15px] leading-relaxed text-chalk/90">
      <p className="rounded-2xl bg-plate-soft px-4 py-3 font-medium text-chalk">
        <span className="block text-sm font-normal text-muted">{t('Da ricordare durante la serie')}</span>
        {guide.cue}
      </p>

      <Section title={guide.kind === 'macchina' || guide.kind === 'cavi' ? t('Regolazioni') : t('Posizione di partenza')}>
        {setupImage ? (
          <>
            <img
              src={setupImage}
              alt={t('Posizione di partenza: i numeri corrispondono alle regolazioni qui sotto')}
              loading="lazy"
              className="mb-3 aspect-square w-full max-w-[320px] rounded-2xl bg-[#2a2e33] object-contain"
            />
            <ol className="list-decimal space-y-1.5 pl-5">
              {guide.setup.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </>
        ) : (
          <ul className="list-disc space-y-1.5 pl-5">
            {guide.setup.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        )}
      </Section>

      <Section title={t('Esecuzione')}>
        <ol className="list-decimal space-y-1.5 pl-5">
          {guide.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      </Section>

      <Section title={t('Errori comuni')}>
        <ul className="space-y-3">
          {guide.mistakes.map((m, i) => (
            <li key={i} className="rounded-2xl border border-line p-3">
              <p className="flex gap-2 font-medium text-chalk">
                <X className="mt-1 h-4 w-4 shrink-0 text-stop" aria-hidden="true" />
                <span><span className="sr-only">{t('Errore:')} </span>{m.error}</span>
              </p>
              <p className="mt-1 flex gap-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-go" aria-hidden="true" />
                <span><span className="sr-only">{t('Correzione:')} </span>{m.fix}</span>
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('Dove lo devi sentire')}>
        <p>{guide.feel}</p>
        <p className="mt-1 text-sm text-muted">{t('Muscoli: {list}', { list: guide.muscles })}</p>
      </Section>

      <Section title={t('Quando fermarti')}>
        <p>{guide.stop}</p>
        {safety.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {safety.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        )}
        <p className="mt-2 text-sm text-muted">{general}</p>
      </Section>

      {sources.length > 0 && (
        <details className="text-sm text-muted">
          <summary className="min-h-11 cursor-pointer py-2 font-medium text-chalk">{t('Fonti consultate')}</summary>
          <p className="mb-2">{t('Testo scritto da Ferro confrontando le istruzioni pubbliche di produttori e associazioni (licenza {license}).', { license })}</p>
          {setupImage && <p className="mb-2">{t('Animazione e disegno di ferro-esercizi, fatti da Ferro in 3D (licenza {license}).', { license })}</p>}
          <ul className="space-y-1.5">
            {sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 text-plate-text hover:underline">
                  <span>{s.title}</span> <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
