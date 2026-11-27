# Schede degli esercizi (Ferro)

`it.json` contiene le schede di esecuzione in italiano che Ferro mostra in «Come si esegue»:
regolazioni della macchina, passi, errori comuni con la correzione, dove si deve sentire,
quando fermarsi e le fonti consultate.

## Da dove vengono

Le schede vengono dalla libreria aperta [ferro-esercizi](https://github.com/JackMagna/ferro-esercizi),
una scheda per file con controllo automatico. **Non modificare `it.json` a mano**: correggi la scheda
nella libreria, poi qui:

```bash
node scripts/update-guides.mjs            # scarica il commit indicato in GUIDES_COMMIT
node scripts/update-guides.mjs <commit>   # oppure un commit preciso della libreria
```

Il commit usato è salvato anche in `it.json` (`commit`). L'app tiene la copia nel proprio pacchetto,
così le schede funzionano anche offline e non dipendono da un servizio esterno.

## Licenza

Testi [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.it), citando «ferro-esercizi»
con un link alla libreria. Se si modificano o traducono i testi, la nuova versione va pubblicata con la
stessa licenza. Il resto del codice di Ferro resta con la sua licenza (vedi `LICENSE` alla radice).

I testi sono originali, scritti confrontando le istruzioni pubbliche di produttori e associazioni
(elencate in `sources`). Non sono consigli medici.

## Formato (`ferro-guides-v1`)

- `sources`: fonti, per chiave (`title`, `url`).
- `safety`: avvertenze comuni per macchine e cavi (`machine`), pesi liberi (`free`) e per tutti (`general`).
- `guides[]`: una scheda per esercizio (`id`, `name`, `aliases`, `libraryIds`, `kind`, `muscles`,
  `setup[]`, `steps[]`, `mistakes[]` con `error` e `fix`, `cue`, `feel`, `stop`, `sources[]`).

Il test `src/lib/__tests__/exerciseGuides.test.ts` controlla che ogni scheda sia completa,
che gli esercizi esistano in free-exercise-db e che le fonti citate ci siano.
