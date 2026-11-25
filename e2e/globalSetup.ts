/** Prima dei test: aspetta che rispondano sia l'emulatore di Authentication sia quello di Firestore (partono in momenti diversi). */
export default async function globalSetup() {
  const urls = ['http://127.0.0.1:9099/', 'http://127.0.0.1:8080/'];
  const deadline = Date.now() + 90_000;
  for (const url of urls) {
    for (;;) {
      try {
        await fetch(url);
        break;
      } catch {
        if (Date.now() > deadline) throw new Error(`Emulatore non raggiungibile: ${url}. Serve Java 21 (vedi playwright.config.ts).`);
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
}
