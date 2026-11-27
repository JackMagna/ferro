// Aggiorna le animazioni degli esercizi dalla libreria aperta ferro-esercizi (video e disegni CC BY-SA 4.0).
// Uso: node scripts/update-animations.mjs [commit]
// Senza argomento usa ANIMATIONS_COMMIT qui sotto. Per ogni scheda di src/data/guides/it.json prova a scaricare
// <id>.webm, <id>.mp4, <id>.poster.webp e <id>.setup.webp in public/animations/ (copia nel pacchetto, così
// funzionano anche offline) e scrive l'elenco in src/data/animations.json.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const ANIMATIONS_COMMIT = '5859e893df335256d4a0bcbae0a8f94f4375141c';
const commit = process.argv[2] ?? ANIMATIONS_COMMIT;
const FILES = ['webm', 'mp4', 'poster.webp', 'setup.webp'];
const url = (file) => `https://raw.githubusercontent.com/JackMagna/ferro-esercizi/${commit}/dist/animations/${file}`;

const book = JSON.parse(await readFile(new URL('../src/data/guides/it.json', import.meta.url), 'utf8'));
const dir = new URL('../public/animations/', import.meta.url);
await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });

const items = [];
for (const guide of book.guides) {
  const first = await fetch(url(`${guide.id}.${FILES[0]}`));
  if (first.status === 404) continue;
  if (!first.ok) throw new Error(`${guide.id}: ${first.status}`);
  const files = { [FILES[0]]: Buffer.from(await first.arrayBuffer()) };
  for (const ext of FILES.slice(1)) {
    const res = await fetch(url(`${guide.id}.${ext}`));
    if (!res.ok) throw new Error(`${guide.id}.${ext}: ${res.status}`);
    files[ext] = Buffer.from(await res.arrayBuffer());
  }
  for (const [ext, buf] of Object.entries(files)) await writeFile(new URL(`${guide.id}.${ext}`, dir), buf);
  items.push({ id: guide.id, libraryIds: guide.libraryIds });
}

const out = { format: 'ferro-animations-v1', license: 'CC BY-SA 4.0', commit, items };
await writeFile(new URL('../src/data/animations.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(`Salvate ${items.length} animazioni (${items.map((i) => i.id).join(', ')}) in public/animations/`);
