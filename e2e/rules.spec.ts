import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';

/** Regole di firestore.rules: chi può leggere e scrivere cosa (senza browser, direttamente sull'emulatore). */
let env: RulesTestEnvironment;

test.beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ferro',
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') }
  });
});
test.afterAll(async () => {
  // le regole caricate restano quelle del file: l'app le usa anche negli altri test
  await env.cleanup();
});
test.beforeEach(async () => {
  await env.clearFirestore();
});

const vote = (libraryId = 'Barbell_Bench_Press') => ({ name: 'Panca piana', libraryId, previous: '', at: serverTimestamp() });

test.describe('Regole Firestore', () => {
  test('i dati di un utente sono solo suoi', async () => {
    const mario = env.authenticatedContext('mario').firestore();
    const lucia = env.authenticatedContext('lucia').firestore();
    const anon = env.unauthenticatedContext().firestore();

    await assertSucceeds(setDoc(doc(mario, 'users/mario'), { program: { title: 'Scheda' } }));
    await assertSucceeds(setDoc(doc(mario, 'users/mario/sessions/s1'), { userId: 'mario', sets: [] }));
    await assertSucceeds(getDoc(doc(mario, 'users/mario/sessions/s1')));

    await assertFails(getDoc(doc(lucia, 'users/mario')));
    await assertFails(getDocs(collection(lucia, 'users/mario/sessions')));
    await assertFails(setDoc(doc(lucia, 'users/mario/meals/p1'), { userId: 'lucia' }));
    await assertFails(getDoc(doc(anon, 'users/mario')));
    // userId nel documento deve essere il proprietario
    await assertFails(setDoc(doc(mario, 'users/mario/measurements/m1'), { userId: 'lucia' }));
    await assertSucceeds(deleteDoc(doc(mario, 'users/mario')));
  });

  test('raccolte non previste: tutto vietato', async () => {
    const mario = env.authenticatedContext('mario').firestore();
    await assertFails(setDoc(doc(mario, 'altro/x'), { a: 1 }));
    await assertFails(getDoc(doc(mario, 'altro/x')));
  });

  test('voti sulle foto: leggibili da chi ha un account, scrivibili solo dal votante e nel formato giusto', async () => {
    const mario = env.authenticatedContext('mario').firestore();
    const lucia = env.authenticatedContext('lucia').firestore();
    const anon = env.unauthenticatedContext().firestore();

    await assertSucceeds(setDoc(doc(mario, 'exerciseLinks/panca-piana/votes/mario'), vote()));
    await assertSucceeds(getDocs(collection(lucia, 'exerciseLinks/panca-piana/votes')));
    await assertFails(getDocs(collection(anon, 'exerciseLinks/panca-piana/votes')));

    await assertFails(setDoc(doc(lucia, 'exerciseLinks/panca-piana/votes/mario'), vote())); // voto a nome di un altro
    await assertFails(setDoc(doc(mario, 'exerciseLinks/Panca Piana/votes/mario'), vote())); // chiave non valida
    await assertFails(setDoc(doc(mario, 'exerciseLinks/panca-piana/votes/mario'), { ...vote(), email: 'x@y.it' })); // campi in più
    await assertFails(setDoc(doc(mario, 'exerciseLinks/panca-piana/votes/mario'), { ...vote(), at: new Date(2020, 0, 1) })); // data falsa
    await assertFails(setDoc(doc(mario, 'exerciseLinks/panca-piana/votes/mario'), vote('x'.repeat(101)))); // troppo lungo

    await assertFails(deleteDoc(doc(lucia, 'exerciseLinks/panca-piana/votes/mario')));
    await assertSucceeds(deleteDoc(doc(mario, 'exerciseLinks/panca-piana/votes/mario')));
    expect(true).toBe(true);
  });
});
