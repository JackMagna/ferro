import type { WorkoutSession } from '../types';
import { workoutKind, workoutNotes } from './workoutKind';

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Sport del TCX: il formato conosce solo corsa, bici e «altro». */
export function tcxSport(s: WorkoutSession): 'Running' | 'Biking' | 'Other' {
  const k = workoutKind(s);
  if (k === 'running' || k === 'running_treadmill' || k === 'walking') return 'Running';
  if (k === 'biking' || k === 'biking_stationary') return 'Biking';
  return 'Other';
}

/** Nome del file: data e titolo, senza caratteri strani. */
export function tcxFilename(s: WorkoutSession): string {
  const slug = s.dayTitle.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `ferro-${s.date}${slug ? `-${slug}` : ''}.tcx`;
}

/**
 * File TCX della seduta, da caricare a mano su Strava (strava.com → Carica attività) o Garmin Connect.
 * Niente GPS: due punti (inizio e fine) con tempo, distanza e frequenza, come i file dei rulli da interno.
 */
export function sessionToTCX(session: WorkoutSession): string {
  const startMs = session.startedAt || Date.parse(session.date);
  const start = new Date(startMs).toISOString();
  const seconds = Math.max(60, Math.round((session.endedAt - session.startedAt) / 1000) || session.durationMinutes * 60);
  const end = new Date(startMs + seconds * 1000).toISOString();
  const distance = Math.round(session.sets.reduce((t, x) => t + (x.distanceM ?? 0), 0));
  const notes = `${session.dayTitle}. ${workoutNotes(session)}`;
  const bpm = (v?: number, tag = 'HeartRateBpm') => (v ? `<${tag}><Value>${Math.round(v)}</Value></${tag}>` : '');
  const point = (time: string, m: number) =>
    `\n          <Trackpoint><Time>${time}</Time><DistanceMeters>${m}</DistanceMeters>${bpm(session.avgBpm)}</Trackpoint>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="${tcxSport(session)}">
      <Id>${start}</Id>
      <Lap StartTime="${start}">
        <TotalTimeSeconds>${seconds}</TotalTimeSeconds>
        <DistanceMeters>${distance}</DistanceMeters>
        <Calories>0</Calories>${session.avgBpm ? `\n        ${bpm(session.avgBpm, 'AverageHeartRateBpm')}` : ''}${session.maxBpm ? `\n        ${bpm(session.maxBpm, 'MaximumHeartRateBpm')}` : ''}
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>${point(start, 0)}${point(end, distance)}
        </Track>
      </Lap>
      <Notes>${esc(notes)}</Notes>
    </Activity>
  </Activities>
</TrainingCenterDatabase>
`;
}
