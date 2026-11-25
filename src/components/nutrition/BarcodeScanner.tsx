import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';

interface DetectorLike { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> }
type DetectorCtor = new (opts?: { formats?: string[] }) => DetectorLike;

const detectorCtor = (): DetectorCtor | null => {
  const ctor = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  return typeof ctor === 'function' ? ctor : null;
};

/** true se il browser sa leggere i codici a barre con la fotocamera. */
export const canScanBarcodes = () => detectorCtor() !== null && !!navigator.mediaDevices?.getUserMedia;

interface Props { onCode: (code: string) => void; onClose: () => void }

/** Fotocamera + BarcodeDetector. Si ferma da sola alla prima lettura o alla chiusura. */
export function BarcodeScanner({ onCode, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    const Ctor = detectorCtor();
    if (!Ctor) {
      setError('Questo browser non legge i codici a barre: scrivi il codice a mano.');
      return;
    }
    const detector = new Ctor({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        timer = window.setInterval(async () => {
          if (video.readyState < 2) return;
          try {
            const found = await detector.detect(video);
            if (found[0]?.rawValue) onCode(found[0].rawValue);
          } catch {
            /* un fotogramma non leggibile: si riprova al prossimo */
          }
        }, 400);
      } catch {
        setError('Non riesco ad aprire la fotocamera. Controlla il permesso del browser oppure scrivi il codice a mano.');
      }
    })();
    return () => {
      stopped = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // onCode cambia a ogni rendering del genitore: la lettura deve partire una volta sola
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2 rounded-2xl border border-line p-3">
      {error ? <p role="alert" className="text-sm text-stop">{error}</p> : (
        <video ref={videoRef} muted playsInline aria-label="Anteprima della fotocamera" className="aspect-video w-full rounded-xl bg-ink object-cover" />
      )}
      <p className="text-sm text-muted">Inquadra il codice a barre del prodotto.</p>
      <Button onClick={onClose}>Chiudi la fotocamera</Button>
    </div>
  );
}
