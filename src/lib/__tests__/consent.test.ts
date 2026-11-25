import { describe, expect, it } from 'vitest';
import { CONSENT_VERSION, consentDate, hasValidConsent, newConsent, normalizeConsent } from '../consent';

describe('consenso sui dati sanitari', () => {
  it('legge solo consensi validi', () => {
    expect(normalizeConsent({ version: 1, at: '2026-10-28T10:00:00.000Z' })).toEqual({ version: 1, at: '2026-10-28T10:00:00.000Z' });
    expect(normalizeConsent(null)).toBeNull();
    expect(normalizeConsent('si')).toBeNull();
    expect(normalizeConsent({ version: '1', at: '2026-10-28' })).toBeNull();
    expect(normalizeConsent({ version: 1, at: 'ieri' })).toBeNull();
    expect(normalizeConsent({ version: 0, at: '2026-10-28' })).toBeNull();
  });
  it('vale solo per la versione attuale del testo', () => {
    expect(hasValidConsent({ version: CONSENT_VERSION, at: '2026-10-28T10:00:00Z' })).toBe(true);
    expect(hasValidConsent({ version: CONSENT_VERSION + 1, at: '2026-10-28T10:00:00Z' })).toBe(false);
    expect(hasValidConsent(null)).toBe(false);
    expect(hasValidConsent(undefined)).toBe(false);
  });
  it('un consenso nuovo ha versione e data', () => {
    const c = newConsent(new Date('2026-10-28T09:30:00Z'));
    expect(c).toEqual({ version: CONSENT_VERSION, at: '2026-10-28T09:30:00.000Z' });
    expect(consentDate(c)).toBe('28/10/2026');
  });
});
