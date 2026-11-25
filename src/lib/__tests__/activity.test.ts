import { describe, expect, it } from 'vitest';
import { activityOf, describeBlock, describePlan, looksLikeActivityText, parseActivity, parseBlockHeader, plannedTotals } from '../activity';

describe('disciplina dal nome', () => {
  it('riconosce cardio, nuoto, pilates e mobilità; il resto è forza', () => {
    expect(activityOf('Cyclette')).toBe('bici');
    expect(activityOf('Spinning')).toBe('bici');
    expect(activityOf('Corsa lenta')).toBe('corsa');
    expect(activityOf('Tapis roulant')).toBe('corsa');
    expect(activityOf('Nuoto')).toBe('nuoto');
    expect(activityOf('Vogatore')).toBe('vogatore');
    expect(activityOf('Ellittica')).toBe('ellittica');
    expect(activityOf('Pilates matwork')).toBe('pilates');
    expect(activityOf('Stretching finale')).toBe('mobilita');
    expect(activityOf('Mobilità anche')).toBe('mobilita');
    expect(activityOf('Chest press presa sopra')).toBe('forza');
    // «rematore» è un esercizio con i pesi, non il vogatore
    expect(activityOf('Rematore al pulley triangolo')).toBe('forza');
    expect(activityOf('Upright row')).toBe('forza');
  });
});

describe('righe da palestra: restano carico × ripetizioni', () => {
  it.each(['3X10', '4x8 AUMENTO PESO', '10-9-8..', '4xMAX', '3x10 rec 90\'\'', '3X10 r 2\''])('%s', (cell) => {
    expect(parseActivity(cell, 'forza')).toEqual({ kind: 'carico' });
  });
  it('una cella vuota di un esercizio con i pesi è carico', () => {
    expect(parseActivity('', 'forza')).toEqual({ kind: 'carico' });
  });
});

describe('tenute', () => {
  it('«3x45\'\'» e «3x1\'» sono tenute, non ripetizioni', () => {
    expect(parseActivity('3x45\'\'', 'forza')).toEqual({ kind: 'tenuta', sets: 3, timeSec: 45 });
    expect(parseActivity('3x1\'', 'forza')).toEqual({ kind: 'tenuta', sets: 3, timeSec: 60 });
    expect(parseActivity('hold 30"', 'forza')).toEqual({ kind: 'tenuta', sets: 1, timeSec: 30 });
  });
});

describe('cardio', () => {
  it('tempo con zona', () => {
    expect(parseActivity('20\'', 'bici')).toMatchObject({ kind: 'tempo', timeSec: 1200 });
    expect(parseActivity('45 min Z2', 'corsa')).toMatchObject({ kind: 'tempo', timeSec: 2700, target: 'Z2' });
    expect(parseActivity('1h30', 'bici')).toMatchObject({ kind: 'tempo', timeSec: 5400 });
  });
  it('distanza, anche con il tempo', () => {
    expect(parseActivity('5 km', 'corsa')).toMatchObject({ kind: 'distanza', distanceM: 5000 });
    expect(parseActivity('10 km in 50\'', 'corsa')).toMatchObject({ kind: 'distanza', distanceM: 10000, timeSec: 3000 });
    expect(parseActivity('2000 m', 'vogatore')).toMatchObject({ kind: 'distanza', distanceM: 2000 });
  });
  it('ripetute di corsa e bici', () => {
    expect(parseActivity('6x1000 r 2\'', 'corsa')).toMatchObject({ kind: 'intervalli', reps: 6, workM: 1000, restSec: 120 });
    expect(parseActivity('10x1\' / 1\'', 'bici')).toMatchObject({ kind: 'intervalli', reps: 10, workSec: 60, restSec: 60 });
    expect(parseActivity('3x5\' @ 300 W rec 2\'', 'bici')).toMatchObject({ kind: 'intervalli', reps: 3, workSec: 300, restSec: 120, target: '300 W' });
  });
  it('il testo non capito resta com\'è', () => {
    expect(parseActivity('Libero, come ti senti', 'corsa')).toEqual({ kind: 'testo', text: 'Libero, come ti senti' });
  });
});

describe('nuoto', () => {
  it('ripetute con stile e recupero: l\'apice qui è in secondi', () => {
    expect(parseActivity('8x50 SL r 15\'', 'nuoto')).toMatchObject({ kind: 'intervalli', reps: 8, workM: 50, restSec: 15, stroke: 'SL' });
    expect(parseActivity('8 x 100 a 1.25', 'nuoto')).toMatchObject({ kind: 'intervalli', reps: 8, workM: 100, sendOffSec: 85 });
    expect(parseActivity('12X50 dorso r = 30\'\'', 'nuoto')).toMatchObject({ kind: 'intervalli', reps: 12, workM: 50, restSec: 30, stroke: 'DO' });
  });
  it('seduta in più parti: totale in metri', () => {
    const plan = parseActivity('400 risc\n8x50 SL r 15\'\'\n200 def', 'nuoto');
    expect(plan).toMatchObject({ kind: 'nuoto', totalM: 1000 });
  });
  it('un numero solo è metri', () => {
    expect(parseActivity('1500', 'nuoto')).toMatchObject({ kind: 'distanza', distanceM: 1500 });
  });
});

describe('testi e totali', () => {
  it('descrive in italiano', () => {
    expect(describePlan({ kind: 'intervalli', reps: 6, workM: 1000, restSec: 120 })).toBe('6 ripetute da 1 km, recupero 2 min');
    expect(describePlan({ kind: 'tempo', timeSec: 1200, target: 'Z2' })).toBe('20 min · Z2');
    expect(describePlan({ kind: 'tenuta', sets: 3, timeSec: 45 })).toBe('3 tenute da 45"');
  });
  it('propone durata e distanza totali', () => {
    expect(plannedTotals({ kind: 'intervalli', reps: 6, workM: 1000, restSec: 120 })).toEqual({ distanceM: 6000, durationSec: undefined });
    expect(plannedTotals({ kind: 'intervalli', reps: 10, workSec: 60, restSec: 60 })).toEqual({ distanceM: undefined, durationSec: 1140 });
  });
  it('riconosce il testo da non scartare nel foglio', () => {
    for (const t of ['20\'', '5 km', '45 min', 'AMRAP 12\'', '3x45\'\'', '1:30']) expect(looksLikeActivityText(t)).toBe(true);
    for (const t of ['3X10', '40', '10-9-8..']) expect(looksLikeActivityText(t)).toBe(false);
  });
});

describe('blocchi', () => {
  it('AMRAP, EMOM, For Time, giri, Tabata, circuiti', () => {
    expect(parseBlockHeader('AMRAP 12\'')).toMatchObject({ format: 'amrap', durationSec: 720, score: 'giri_rip' });
    expect(parseBlockHeader('EMOM 10\'')).toMatchObject({ format: 'emom', everySec: 60, durationSec: 600 });
    expect(parseBlockHeader('Ogni 2\' x 5')).toMatchObject({ format: 'emom', everySec: 120, rounds: 5 });
    expect(parseBlockHeader('For Time (cap 15\')')).toMatchObject({ format: 'for_time', timeCapSec: 900, score: 'tempo' });
    expect(parseBlockHeader('5 RFT')).toMatchObject({ format: 'for_time', rounds: 5 });
    expect(parseBlockHeader('Tabata')).toMatchObject({ format: 'intervalli', workSec: 20, restSec: 10, rounds: 8 });
    expect(parseBlockHeader('Circuito x3')).toMatchObject({ format: 'circuito', rounds: 3 });
    expect(parseBlockHeader('Chest press')).toBeNull();
    expect(parseBlockHeader('Progressione serie x rep rip. 2\'')).toBeNull();
  });
  it('descrive il blocco', () => {
    expect(describeBlock({ id: 'b', format: 'amrap', durationSec: 720 })).toBe('AMRAP 12 min: più giri possibili');
    expect(describeBlock({ id: 'b', format: 'for_time', rounds: 5, timeCapSec: 900 })).toBe('5 giri per tempo, massimo 15 min');
  });
});
