# Schede degli esercizi (Ferro)

`it.json` contiene le schede di esecuzione in italiano che Ferro mostra in «Come si esegue»:
regolazioni della macchina, passi, errori comuni con la correzione, dove si deve sentire,
quando fermarsi e le fonti consultate.

## Licenza

I testi di questa cartella sono rilasciati con licenza
[Creative Commons Attribuzione 4.0 (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/deed.it):
si possono copiare, tradurre e usare anche in app commerciali, citando «Ferro – schede degli esercizi».
Il resto del codice di Ferro resta con la sua licenza (vedi `LICENSE` alla radice).

## Da dove vengono

I testi sono originali. Sono stati scritti confrontando le istruzioni pubbliche dei produttori
(manuali e cartelli di Life Fitness, Matrix, Precor, articoli di Technogym) e delle associazioni
(ACE, NSCA, NASM, ACSM), elencate in `sources`. Nessun testo, immagine o video è stato copiato.
Non sono consigli medici.

## Formato (`ferro-guides-v1`)

- `sources`: fonti, per chiave (`title`, `url`).
- `safety`: avvertenze comuni per macchine e cavi (`machine`), pesi liberi (`free`) e per tutti (`general`).
- `guides[]`: una scheda per esercizio
  - `id`: nome breve, minuscolo con trattini;
  - `libraryIds`: gli esercizi di [free-exercise-db](https://github.com/yuhonas/free-exercise-db) descritti;
  - `kind`: `macchina`, `cavi`, `pesi liberi` o `corpo libero`;
  - `name`, `aliases`, `muscles`, `setup[]`, `steps[]`, `mistakes[]` (`error`, `fix`), `cue`, `feel`, `stop`, `sources[]`.

Il test `src/lib/__tests__/exerciseGuides.test.ts` controlla che ogni scheda sia completa,
che gli esercizi esistano nella libreria e che le fonti citate ci siano.

Un esercizio della libreria può avere una sola scheda. Per proporre correzioni: una pull request
su questo file, indicando la fonte.
