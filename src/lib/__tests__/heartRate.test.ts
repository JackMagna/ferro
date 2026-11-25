import { describe, expect, it } from 'vitest';
import { isHeartRateSupported, parseHeartRate } from '../../services/heartRate';

const view = (...bytes: number[]) => new DataView(new Uint8Array(bytes).buffer);

describe('fascia cardio', () => {
  it('legge la frequenza a 8 bit e a 16 bit (profilo Heart Rate)', () => {
    expect(parseHeartRate(view(0x00, 72))).toBe(72);
    // flag 0x01: valore a 16 bit little endian (300 = 0x012C)
    expect(parseHeartRate(view(0x01, 0x2c, 0x01))).toBe(300);
    // altri flag (contatto sensore, energia) non cambiano la lettura
    expect(parseHeartRate(view(0x16, 145, 0, 0))).toBe(145);
  });

  it('nel browser senza Web Bluetooth non è disponibile', () => {
    expect(isHeartRateSupported()).toBe(false);
  });
});
