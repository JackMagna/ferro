import type { SVGProps } from 'react';

/**
 * Icone di Ferro, disegnate a mano su una griglia 24×24 con la stessa logica del logo
 * (rettangoli, linee dritte, il bilanciere come forma base). Lo spessore e le estremità
 * del tratto vengono dal tema (--icon-stroke, --icon-cap, --icon-join in index.css).
 * Le icone meno frequenti restano quelle di lucide-react, uniformate con lo stesso spessore.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string };

function make(displayName: string, d: string) {
  const Icon = ({ className = '', size, strokeWidth, ...rest }: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size ?? 24}
      height={size ?? 24}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? 2}
      aria-hidden="true"
      focusable="false"
      className={`fi ${className}`}
      {...rest}
    >
      <path d={d} />
    </svg>
  );
  Icon.displayName = displayName;
  return Icon;
}

/* sezioni */
/** Allenamento: il bilanciere del logo */
export const Dumbbell = make('Dumbbell', 'M2 12h20M6 6h3v12H6zM15 6h3v12h-3z');
/** Scheda: il foglio del coach, a righe e colonne */
export const ClipboardList = make('ClipboardList', 'M4 3h16v18H4zM4 9h16M4 15h16M10 3v18');
/** Pasti: la ciotola */
export const Utensils = make('Utensils', 'M3 11h18M4.5 11a7.5 7.5 0 0 0 15 0M9 20.5h6M9 4.5v3M12 3.5v4M15 4.5v3');
/** Esercizi: il libro aperto, a spigoli vivi */
export const BookOpen = make('BookOpen', 'M12 7v13M12 7c-2-2-5-2.5-9-2v13c4-.5 7 0 9 2M12 7c2-2 5-2.5 9-2v13c-4-.5-7 0-9 2');
/** Progressi: dischi che salgono */
export const LineChart = make('LineChart', 'M3 3v18h18M7 17v-3M11 17v-6M15 17v-4M19 17V8');
export const UserRound = make('UserRound', 'M12 4a4 4 0 1 1 0 8a4 4 0 0 1 0-8zM4 21c.8-4 4.2-6 8-6s7.2 2 8 6');

/* azioni */
export const Plus = make('Plus', 'M12 4v16M4 12h16');
export const Minus = make('Minus', 'M4 12h16');
export const Check = make('Check', 'M4 12.5l5 5L20 6.5');
export const X = make('X', 'M5 5l14 14M19 5L5 19');
export const ChevronLeft = make('ChevronLeft', 'M15 4l-8 8 8 8');
export const ChevronRight = make('ChevronRight', 'M9 4l8 8-8 8');
export const ChevronDown = make('ChevronDown', 'M4 9l8 8 8-8');
export const Trash2 = make('Trash2', 'M3 6h18M9 6V3h6v3M5.5 6l1 15h11l1-15M10 10v7M14 10v7');
export const Pencil = make('Pencil', 'M15 4l5 5L9 20H4v-5zM12.5 6.5l5 5');
export const Search = make('Search', 'M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13zM15.5 15.5L21 21');
export const Play = make('Play', 'M7 4v16l13-8z');
export const Pause = make('Pause', 'M8 4v16M16 4v16');

/* palestra */
/** Record: il disco punzonato */
export const Trophy = make('Trophy', 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM12 9.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 0 1 0-5zM12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21');
/** Peso: la bilancia vista dall'alto */
export const Scale = make('Scale', 'M3 4h18v16H3zM8 10a4 4 0 0 1 8 0M12 10l1.8-2.6');
export const Barcode = make('Barcode', 'M4 5v14M7 5v14M11 5v14M13 5v14M17 5v14M20 5v14');
/** Acqua: la goccia */
export const Droplet = make('Droplet', 'M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z');
/** Pasto salvato: il segnalibro */
export const Bookmark = make('Bookmark', 'M6 3h12v18l-6-5-6 5z');
/** Scelta di altri utenti: due teste */
export const Users = make('Users', 'M9 4a3.5 3.5 0 1 1 0 7a3.5 3.5 0 0 1 0-7zM2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 4.5a3 3 0 0 1 0 6M18 14.8c2 .7 3.2 2.5 3.5 5.2');

/** Lezioni: il calendario */
export const Calendar = make('Calendar', 'M4 5h16v15H4zM4 10h16M8 3v4M16 3v4');

/** Guida: la bussola */
export const Compass = make('Compass', 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM15.5 8.5l-2 5l-5 2l2-5z');

/* le altre restano di lucide-react */
export {
  AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, CloudOff, Copy, Download, ExternalLink, FileText, Heart, ImageOff,
  Link2, LogIn, LogOut, RefreshCw, RotateCcw, Smartphone, TriangleAlert, Unlink, Upload, WifiOff
} from 'lucide-react';
