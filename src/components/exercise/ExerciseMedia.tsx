import { useEffect, useRef, useState } from 'react';
import { ImageOff, Pause, Play } from '../ui/icons';
import type { LibraryExercise } from '../../lib/exerciseLibrary';
import { animationForLibrary, type ExerciseAnimation } from '../../lib/exerciseAnimations';
import { SafeImg } from './SafeImg';
import { t } from '../../lib/i18n';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const switchClass = 'absolute left-2 top-2 inline-flex h-9 items-center rounded-full bg-ink/85 px-3 text-sm font-medium text-chalk';

/**
 * Animazione 3D di ferro-esercizi quando c'è (un tocco passa alle foto), altrimenti le foto di free-exercise-db.
 */
export function ExerciseMedia({ exercise, className = '' }: { exercise?: LibraryExercise; className?: string }) {
  const animation = animationForLibrary(exercise?.id);
  const [photos, setPhotos] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setPhotos(false);
    setBroken(false);
  }, [exercise?.id]);

  if (exercise && animation && !photos && !broken) {
    return (
      <AnimationMedia
        animation={animation}
        name={exercise.name}
        className={className}
        onFail={() => setBroken(true)}
        onPhotos={exercise.images.length > 0 ? () => setPhotos(true) : undefined}
      />
    );
  }
  return (
    <PhotoMedia exercise={exercise} className={className} onAnimation={animation && !broken ? () => setPhotos(false) : undefined} />
  );
}

/** Mini video in loop, senza audio; con «riduci movimento» parte fermo. */
function AnimationMedia({ animation, name, className, onFail, onPhotos }: {
  animation: ExerciseAnimation; name: string; className: string; onFail: () => void; onPhotos?: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (playing) v.play()?.catch(() => setPlaying(false));
    else v.pause();
  }, [playing, animation.id]);

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl bg-[#2a2e33] ${className}`}>
      <video
        ref={video}
        key={animation.id}
        className="mx-auto aspect-square w-full max-w-[420px] object-contain"
        poster={animation.poster}
        loop
        muted
        playsInline
        autoPlay={playing}
        preload="auto"
        aria-label={t('{name}: animazione del movimento', { name })}
        onError={onFail}
      >
        <source src={animation.webm} type="video/webm" />
        <source src={animation.mp4} type="video/mp4" onError={onFail} />
      </video>
      {onPhotos && (
        <button type="button" onClick={onPhotos} className={switchClass}>{t('Foto')}</button>
      )}
      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? t('Ferma animazione') : t('Avvia animazione')}
        className="absolute bottom-2 right-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink/85 text-chalk"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
    </div>
  );
}

/**
 * Le foto di free-exercise-db mostrano posizione iniziale e finale.
 * Alternandole si vede il movimento; si può mettere in pausa.
 */
function PhotoMedia({ exercise, className = '', onAnimation }: { exercise?: LibraryExercise; className?: string; onAnimation?: () => void }) {
  const frames = exercise?.images ?? [];
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFrame(0);
    setFailed(false);
  }, [exercise?.id]);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % frames.length), 1100);
    return () => clearInterval(t);
  }, [playing, frames.length]);

  if (!exercise || frames.length === 0 || failed) {
    return (
      <div className={`flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-2xl bg-ink text-faint ${className}`}>
        <ImageOff className="h-6 w-6" />
        <span className="px-6 text-center text-sm">
          {failed ? t('Foto non disponibili: controlla la connessione') : t('Nessuna foto collegata a questo esercizio')}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl bg-white ${className}`}>
      {frames.map((path, i) => (
        <SafeImg
          key={path}
          path={path}
          alt={i === 0 ? t('{name}: posizione iniziale', { name: exercise.name }) : t('{name}: posizione finale', { name: exercise.name })}
          onFail={() => setFailed(true)}
          eager={i === 0}
          className={`aspect-[4/3] w-full object-contain ${i === frame ? 'relative' : 'absolute inset-0 opacity-0'}`}
        />
      ))}
      {onAnimation && (
        <button type="button" onClick={onAnimation} className={switchClass}>{t('Animazione 3D')}</button>
      )}
      {frames.length > 1 && (
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? t('Ferma animazione') : t('Avvia animazione')}
          className="absolute bottom-2 right-2 inline-flex h-10 items-center gap-1.5 rounded-full bg-ink/85 px-3 text-sm font-medium text-chalk"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {frame === 0 ? t('Partenza') : t('Arrivo')}
        </button>
      )}
    </div>
  );
}
