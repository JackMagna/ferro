/**
 * Frequenza cardiaca da fascia o orologio via Bluetooth (profilo standard Heart Rate, 0x180D).
 * Funziona con fasce cardio e con gli orologi che "trasmettono" la frequenza (es. Garmin, Polar, Coros).
 * - Nel browser: Web Bluetooth (Chrome su Android e computer; non Safari/iPhone).
 * - Nell'app Android: la WebView non ha Web Bluetooth, quindi si usa il plugin @capacitor-community/bluetooth-le,
 *   con la scelta del dispositivo del sistema. Lo stesso lettore dei dati vale per entrambi.
 * L'Apple Watch non trasmette la frequenza in Bluetooth.
 */
import { Capacitor } from '@capacitor/core';
import { t } from '../lib/i18n';

const HR_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const HR_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';

/* Tipi minimi: Web Bluetooth non è ancora nei tipi DOM di TypeScript */
interface BTCharacteristic extends EventTarget {
  value?: DataView;
  startNotifications(): Promise<BTCharacteristic>;
}
interface BTDevice extends EventTarget {
  name?: string;
  gatt?: {
    connected: boolean;
    connect(): Promise<{ getPrimaryService(s: string): Promise<{ getCharacteristic(c: string): Promise<BTCharacteristic> }> }>;
    disconnect(): void;
  };
}
interface BluetoothNavigator {
  bluetooth?: { requestDevice(opts: unknown): Promise<BTDevice> };
}

const isNativeApp = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

export function isHeartRateSupported(): boolean {
  if (isNativeApp()) return Capacitor.getPlatform() === 'android';
  return typeof navigator !== 'undefined' && !!(navigator as unknown as BluetoothNavigator).bluetooth;
}

export function parseHeartRate(view: DataView): number {
  const flags = view.getUint8(0);
  return flags & 0x01 ? view.getUint16(1, true) : view.getUint8(1);
}

export interface HeartRateConnection {
  deviceName: string;
  disconnect(): void;
}

/** Errore con un nome riconoscibile dalla schermata (NotFoundError = nessun sensore scelto). */
const named = (name: string, message: string) => Object.assign(new Error(message), { name });

export async function connectHeartRate(
  onBpm: (bpm: number) => void,
  onDisconnect: () => void
): Promise<HeartRateConnection> {
  return isNativeApp() ? connectNative(onBpm, onDisconnect) : connectWeb(onBpm, onDisconnect);
}

/* ---------- app Android: plugin Bluetooth LE ---------- */
let bleReady: Promise<void> | null = null;

async function connectNative(onBpm: (bpm: number) => void, onDisconnect: () => void): Promise<HeartRateConnection> {
  const { BleClient } = await import('@capacitor-community/bluetooth-le');
  // neverForLocation: il Bluetooth serve solo alla fascia, mai a capire dove si trova l'utente
  bleReady ??= BleClient.initialize({ androidNeverForLocation: true }).catch((err) => {
    bleReady = null;
    throw err;
  });
  try {
    await bleReady;
  } catch (err) {
    throw new Error(/permission|denied/i.test(String(err)) ? t('Serve il permesso «Dispositivi nelle vicinanze» per trovare la fascia.') : t('Bluetooth non disponibile ({motivo}).', { motivo: err instanceof Error ? err.message : String(err) }));
  }
  if (!(await BleClient.isEnabled())) {
    await BleClient.requestEnable().catch(() => undefined);
    if (!(await BleClient.isEnabled())) throw new Error(t('Accendi il Bluetooth e riprova.'));
  }

  let device;
  try {
    device = await BleClient.requestDevice({ services: [HR_SERVICE] });
  } catch (err) {
    throw /cancel/i.test(String(err)) ? named('NotFoundError', t('Nessun sensore selezionato.')) : err;
  }
  const id = device.deviceId;
  let closedByUser = false;
  await BleClient.connect(id, () => {
    if (!closedByUser) onDisconnect();
  });
  try {
    await BleClient.startNotifications(id, HR_SERVICE, HR_MEASUREMENT, (value) => onBpm(parseHeartRate(value)));
  } catch {
    await BleClient.disconnect(id).catch(() => undefined);
    throw new Error(t('Il dispositivo non espone il servizio frequenza cardiaca.'));
  }
  return {
    deviceName: device.name || t('Sensore cardio'),
    disconnect() {
      closedByUser = true;
      void BleClient.stopNotifications(id, HR_SERVICE, HR_MEASUREMENT)
        .catch(() => undefined)
        .then(() => BleClient.disconnect(id))
        .catch(() => undefined);
    }
  };
}

/* ---------- browser: Web Bluetooth ---------- */
async function connectWeb(onBpm: (bpm: number) => void, onDisconnect: () => void): Promise<HeartRateConnection> {
  const bt = (navigator as unknown as BluetoothNavigator).bluetooth;
  if (!bt) throw new Error(t('Questo browser non supporta il Bluetooth. Usa Chrome su Android o su computer.'));

  const device = await bt.requestDevice({ filters: [{ services: ['heart_rate'] }] });
  if (!device.gatt) throw new Error(t('Il dispositivo non espone il servizio frequenza cardiaca.'));

  device.addEventListener('gattserverdisconnected', onDisconnect);
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService('heart_rate');
  const characteristic = await service.getCharacteristic('heart_rate_measurement');
  await characteristic.startNotifications();
  characteristic.addEventListener('characteristicvaluechanged', () => {
    if (characteristic.value) onBpm(parseHeartRate(characteristic.value));
  });

  return {
    deviceName: device.name || t('Sensore cardio'),
    disconnect() {
      device.removeEventListener('gattserverdisconnected', onDisconnect);
      if (device.gatt?.connected) device.gatt.disconnect();
    }
  };
}
