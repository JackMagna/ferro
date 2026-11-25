import { describe, expect, it } from 'vitest';
import { checkForUpdate, isNewer } from '../appUpdate';

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
  });

  it('propone la release solo se è più nuova', async () => {
    expect(await checkForUpdate('v2.3.0', reply({ tag_name: 'v2.4.0' }))).toBe('v2.4.0');
    expect(await checkForUpdate('v2.4.0', reply({ tag_name: 'v2.4.0' }))).toBeNull();
    expect(await checkForUpdate('build-7', reply({ tag_name: 'v2.4.0' }))).toBeNull();
  });

  it('senza rete o con errore non dice niente', async () => {
    expect(await checkForUpdate('v2.3.0', reply({}, false))).toBeNull();
    expect(await checkForUpdate('v2.3.0', (async () => { throw new Error('offline'); }) as unknown as typeof fetch)).toBeNull();
  });
});
