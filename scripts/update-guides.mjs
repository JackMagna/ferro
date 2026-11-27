// Aggiorna le schede degli esercizi dalla libreria aperta ferro-esercizi (testi CC BY-SA 4.0).
// Uso: node scripts/update-guides.mjs [commit]
// Senza argomento usa GUIDES_COMMIT qui sotto. Per aggiornare: scegli il commit nuovo di
// https://github.com/JackMagna/ferro-esercizi, mettilo in GUIDES_COMMIT e rilancia lo script.
// L'app tiene una copia in src/data/guides/it.json, così le schede funzionano anche offline.
import { writeFile } from 'node:fs/promises';

const GUIDES_COMMIT = '343ee0821ef3fa44d33a2b4ce65092ad638b95d3';
const commit = process.argv[2] ?? GUIDES_COMMIT;
const SOURCES = [
  `https://cdn.jsdelivr.net/gh/JackMagna/ferro-esercizi@${commit}/dist/guides.it.json`,
  `https://raw.githubusercontent.com/JackMagna/ferro-esercizi/${commit}/dist/guides.it.json`
];

let book = null;
for (const url of SOURCES) {
  try {
    const res = await fetch(url);
    if (res.ok) {
      book = await res.json();
      break;
    }
    console.warn(`${url}: ${res.status}`);
  } catch (e) {
    console.warn(`${url}: ${e.message}`);
  }
}
if (!book) throw new Error('Download fallito');
if (book.format !== 'ferro-guides-v1') throw new Error(`Formato inatteso: ${book.format}`);
book.commit = commit;
await writeFile(new URL('../src/data/guides/it.json', import.meta.url), JSON.stringify(book, null, 2) + '\n');
console.log(`Salvate ${book.guides.length} schede (${book.license}) in src/data/guides/it.json`);
