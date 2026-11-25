import { Capacitor, registerPlugin } from '@capacitor/core';
import type { WidgetData } from '../lib/widgetData';

/** Plugin nativo scritto in native/android (FerroWidgetsPlugin.java), presente solo nell'app Android. */
interface FerroWidgetsPlugin {
  update(options: { data: string }): Promise<void>;
  /** sezione da aprire se l'app è stata aperta da un widget; la restituisce una volta sola */
  takeLaunchTab(): Promise<{ tab?: string }>;
}

const plugin = registerPlugin<FerroWidgetsPlugin>('FerroWidgets');

export function widgetsAvailable(): boolean {
  try {
    return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('FerroWidgets');
  } catch {
    return false;
  }
}

export async function pushWidgetData(data: WidgetData): Promise<void> {
  if (!widgetsAvailable()) return;
  try {
    await plugin.update({ data: JSON.stringify(data) });
  } catch (err) {
    console.warn('Widget non aggiornati', err);
  }
}

export async function takeLaunchTab(): Promise<string | undefined> {
  if (!widgetsAvailable()) return undefined;
  try {
    return (await plugin.takeLaunchTab()).tab || undefined;
  } catch {
    return undefined;
  }
}
