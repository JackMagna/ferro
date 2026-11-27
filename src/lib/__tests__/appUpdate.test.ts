import { describe, expect, it } from 'vitest';
import { apkUrlFor, checkForUpdate, isNewer, isRelease, releaseNotes } from '../appUpdate';

const reply = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

describe('aggiornamenti dell’app Android', () => {
  it('confronta le versioni numero per numero', () => {
    expect(isNewer('v2.10.0', 'v2.9.3')).toBe(true);
    expect(isNewer('v2.3.0', 'v2.3.0')).toBe(false);
    expect(isNewer('v2.2.9', 'v2.3.0')).toBe(false);
    expect(isNewer('3.0.0', 'v2.9.9')).toBe(true);
  });

  it('ignora le build di prova e i tag strani', () => {
    expect(isNewer('v3.0.0', 'build-42')).toBe(false);
    expect(isNewer('prova-12', 'v2.3.0')).toBe(false);
    expect(isRelease('v2.6.0')).toBe(true);
    expect(isRelease('build-42')).toBe(false);
    expect(isRelease(undefined)).toBe(false);
  });

  it('propone la release solo se è più nuova, con le novità', async () => {
    const body = '- **Ferro in 5 lingue**: italiano e [altre](https://x.y).\n- Scheda fatta da te.\n- Terza riga.\n';
    expect(await checkForUpdate('v2.3.0', reply({ tag_name: 'v2.4.0', body }))).toEqual({
      tag: 'v2.4.0',
      notes: ['Ferro in 5 lingue: italiano e altre.', 'Scheda fatta da te.']
    });
    expect(await checkForUpdate('v2.4.0', reply({ tag_name: 'v2.4.0' }))).toBeNull();
    expect(await checkForUpdate('build-7', reply({ tag_name: 'v2.4.0' }))).toBeNull();
  });

  it('le novità: solo le righe dell’elenco, accorciate', () => {
    expect(releaseNotes(undefined)).toEqual([]);
    expect(releaseNotes('Testo senza elenco')).toEqual([]);
    const long = releaseNotes(`* ${'a'.repeat(200)}`);
    expect(long[0]).toHaveLength(140);
    expect(long[0].endsWith('…')).toBe(true);
  });

  it('scarica l’APK della versione annunciata', () => {
    expect(apkUrlFor('v2.6.0')).toBe('https://github.com/JackMagna/ferro/releases/download/v2.6.0/ferro-release.apk');
  });

  it('senza rete o con errore non dice niente', async () => {
    expect(await checkForUpdate('v2.3.0', reply({}, false))).toBeNull();
    expect(await checkForUpdate('v2.3.0', (async () => { throw new Error('offline'); }) as unknown as typeof fetch)).toBeNull();
  });
});
