import { Capacitor, registerPlugin } from '@capacitor/core';
import type { WorkoutNoticeState } from '../lib/workoutNotice';

/** Plugin nativo scritto in native/android (FerroWorkoutPlugin.java), presente solo nell'app Android. */
interface NoticeStatus { granted: boolean; exact: boolean }
interface FerroWorkoutPlugin {
  show(state: WorkoutNoticeState): Promise<void>;
  clear(): Promise<void>;
  status(): Promise<NoticeStatus>;
  requestNotifications(): Promise<NoticeStatus>;
  openExactAlarmSettings(): Promise<void>;
}

const plugin = registerPlugin<FerroWorkoutPlugin>('FerroWorkout');

export function workoutNoticeAvailable(): boolean {
  try {
    return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('FerroWorkout');
  } catch {
    return false;
  }
}

/** Richiesta del permesso, una volta per avvio: chi legge lo stato aspetta la risposta. */
let asking: Promise<unknown> | null = null;

/** Chiede il permesso delle notifiche (solo la prima volta): da chiamare al tocco di «Completa serie». */
export function askWorkoutNotice() {
  if (workoutNoticeAvailable()) asking ??= plugin.requestNotifications().catch(() => undefined);
}

/** Mostra o aggiorna la notifica dell'allenamento. */
export async function showWorkoutNotice(state: WorkoutNoticeState): Promise<void> {
  if (!workoutNoticeAvailable()) return;
  try {
    askWorkoutNotice();
    await asking;
    await plugin.show(state);
  } catch (err) {
    console.warn('Notifica allenamento non aggiornata', err);
  }
}

export async function clearWorkoutNotice(): Promise<void> {
  if (!workoutNoticeAvailable()) return;
  await plugin.clear().catch(() => undefined);
}

/** Permesso delle notifiche e degli allarmi puntuali (null fuori dall'app Android). */
export async function workoutNoticeStatus(): Promise<NoticeStatus | null> {
  if (!workoutNoticeAvailable()) return null;
  await asking;
  return plugin.status().catch(() => null);
}

export async function openExactAlarmSettings(): Promise<void> {
  if (workoutNoticeAvailable()) await plugin.openExactAlarmSettings().catch(() => undefined);
}
