import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALIAS_IDS, matchExercise, suggestLibraryId } from '../exerciseMatch';
import { DEFAULT_PROGRAM } from '../../data/defaultProgram';
import type { LibraryExercise } from '../exerciseLibrary';

const lib: LibraryExercise[] = JSON.parse(readFileSync(new URL('../../../public/data/exercises.json', import.meta.url), 'utf8'));

/** Nomi come li scrive un coach italiano → esercizio giusto della libreria. */
const GOLD: [string, string][] = [
  ['Panca piana bilanciere', 'Barbell_Bench_Press_-_Medium_Grip'],
  ['Panca piana manubri', 'Dumbbell_Bench_Press'],
  ['Panca inclinata manubri', 'Incline_Dumbbell_Press'],
  ['Panca inclinata bilanciere', 'Barbell_Incline_Bench_Press_-_Medium_Grip'],
  ['Panca declinata', 'Decline_Barbell_Bench_Press'],
  ['Chest press', 'Leverage_Chest_Press'],
  ['Croci ai cavi', 'Cable_Crossover'],
  ['Croci manubri panca piana', 'Dumbbell_Flyes'],
  ['Pectoral machine', 'Butterfly'],
  ['Peck deck', 'Butterfly'],
  ['Dips alle parallele', 'Parallel_Bar_Dip'],
  ['Piegamenti sulle braccia', 'Pushups'],
  ['Push up', 'Pushups'],
  ['Lat machine avanti', 'Wide-Grip_Lat_Pulldown'],
  ['Lat machine presa stretta', 'Close-Grip_Front_Lat_Pulldown'],
  ['Lat machine presa inversa', 'Underhand_Cable_Pulldowns'],
  ['Trazioni alla sbarra', 'Pullups'],
  ['Trazioni presa supina', 'Chin-Up'],
  ['Pulley basso', 'Seated_Cable_Rows'],
  ['Rematore con bilanciere', 'Bent_Over_Barbell_Row'],
  ['Rematore manubrio', 'One-Arm_Dumbbell_Row'],
  ['Pullover ai cavi', 'Straight-Arm_Pulldown'],
  ['Stacco da terra', 'Barbell_Deadlift'],
  ['Stacco rumeno', 'Romanian_Deadlift'],
  ['Stacco gambe tese', 'Stiff-Legged_Barbell_Deadlift'],
  ['Good morning', 'Good_Morning'],
  ['Military press', 'Standing_Military_Press'],
  ['Lento avanti manubri', 'Dumbbell_Shoulder_Press'],
  ['Shoulder press macchina', 'Machine_Shoulder_Military_Press'],
  ['Alzate laterali manubri', 'Side_Lateral_Raise'],
  ['Alzate laterali ai cavi', 'Cable_Seated_Lateral_Raise'],
  ['Alzate frontali', 'Front_Dumbbell_Raise'],
  ['Alzate posteriori', 'Seated_Bent-Over_Rear_Delt_Raise'],
  ['Face pull', 'Face_Pull'],
  ['Tirate al mento', 'Upright_Barbell_Row'],
  ['Scrollate con manubri', 'Dumbbell_Shrug'],
  ['Curl manubri alternato', 'Dumbbell_Alternate_Bicep_Curl'],
  ['Curl a martello', 'Hammer_Curls'],
  ['Curl ai cavi', 'Standing_Biceps_Cable_Curl'],
  ['Curl panca Scott', 'Preacher_Curl'],
  ['Curl concentrato', 'Concentration_Curls'],
  ['French press', 'EZ-Bar_Skullcrusher'],
  ['Push down ai cavi', 'Triceps_Pushdown'],
  ['Push down corda', 'Triceps_Pushdown_-_Rope_Attachment'],
  ['Estensioni tricipiti sopra la testa', 'Standing_Dumbbell_Triceps_Extension'],
  ['Kickback manubrio', 'Tricep_Dumbbell_Kickback'],
  ['Dip alla panca', 'Bench_Dips'],
  ['Squat', 'Barbell_Squat'],
  ['Front squat', 'Front_Barbell_Squat'],
  ['Squat bulgaro', 'Split_Squat_with_Dumbbells'],
  ['Leg press', 'Leg_Press'],
  ['Affondi con manubri', 'Dumbbell_Lunges'],
  ['Affondi camminati', 'Bodyweight_Walking_Lunge'],
  ['Leg extension', 'Leg_Extensions'],
  ['Leg curl sdraiato', 'Lying_Leg_Curls'],
  ['Hip thrust', 'Barbell_Hip_Thrust'],
  ['Abductor machine', 'Thigh_Abductor'],
  ['Adductor machine', 'Thigh_Adductor'],
  ['Calf raise in piedi', 'Standing_Calf_Raises'],
  ['Calf seduto', 'Seated_Calf_Raise'],
  ['Polpacci alla pressa', 'Calf_Press_On_The_Leg_Press_Machine'],
  ['Crunch', 'Crunches'],
  ['Crunch ai cavi', 'Cable_Crunch'],
  ['Reverse crunch', 'Reverse_Crunch'],
  ['Plank', 'Plank'],
  ['Plank laterale', 'Side_Bridge'],
  ['Sollevamento gambe alla sbarra', 'Hanging_Leg_Raise'],
  ['Ab wheel', 'Ab_Roller'],
  ['Kettlebell swing', 'One-Arm_Kettlebell_Swings'],
  ['Hack squat', 'Hack_Squat'],
  ['Romanian deadlift', 'Romanian_Deadlift']
];

describe('collegamento esercizi alla libreria', () => {
  it('la tabella punta solo a esercizi che esistono', () => {
    const ids = new Set(lib.map((e) => e.id));
    expect(ALIAS_IDS.filter((id) => !ids.has(id))).toEqual([]);
  });

  it.each(GOLD)('%s → %s', (name, id) => expect(suggestLibraryId(name, lib)).toBe(id));

  it('ritrova tutti gli esercizi della scheda di esempio', () => {
    for (const day of DEFAULT_PROGRAM.days) {
      for (const e of day.exercises) expect([e.name, suggestLibraryId(e.name, lib)]).toEqual([e.name, e.libraryId]);
    }
  });

  it('non collega nomi sconosciuti, ma propone qualcosa se può', () => {
    expect(suggestLibraryId('Esercizio misterioso xyz', lib)).toBeUndefined();
    expect(suggestLibraryId('Burpees', lib)).toBeUndefined();
    const m = matchExercise('Spinte strane al cavo', lib);
    expect(m.id).toBeUndefined();
    expect(m.suggestions.length).toBeGreaterThan(0);
  });

  it('le proposte iniziano dal collegamento sicuro', () => {
    const m = matchExercise('Panca piana manubri', lib);
    expect(m.suggestions[0]).toBe('Dumbbell_Bench_Press');
    expect(new Set(m.suggestions).size).toBe(m.suggestions.length);
  });
});
