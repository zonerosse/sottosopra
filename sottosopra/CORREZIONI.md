# Passo 2 — il risultato mostra quello che il motore sa

Tre file. Sostituiscono quelli esistenti. Nessuna dipendenza nuova.

| File | Cosa cambia |
|---|---|
| `src/lib/robots.js` | due funzioni nuove, `giudizio()` più completo |
| `src/pages/robots.astro` | riepilogo in cima, prova di un indirizzo, regole per percorso |
| `prove/robots.mjs` | da 20 a 28 prove |

## Perché

Il motore corretto sapeva più di quanto la pagina mostrasse.

Le tabelle provano solo la radice del sito, quindi una regola come
`Disallow: /*.pdf$` veniva valutata correttamente e poi non compariva da
nessuna parte. Adesso c'è un campo dove scrivi un indirizzo qualsiasi e le
tabelle si ridisegnano su quello: è lì che le regole con asterisco si vedono.

I rilievi coprivano solo i crawler critici e quelli generativi. Un
`Googlebot-Image` bloccato per eredità restava fuori da ogni segnalazione.

E quando il file era a posto la pagina restava quasi vuota, il che sembra un
guasto. Ora in cima c'è sempre il conteggio: quanti crawler entrano su quanti,
quante righe lette, quanti errori di sintassi. Un numero dice che il controllo
è stato fatto; il silenzio no.

## Nuove funzioni in robots.js

- `percorsiLimitati(analisi)` — le regole che riguardano percorsi e non
  l'intero sito, con la riga in cui stanno e chi le subisce. Le regole con
  asterisco o dollaro sono marcate.
- `conteggio(analisi)` — quanti crawler entrano, quanti no, su quanti.

## Le prove

```
node prove\robots.mjs
```

28 passate, 0 fallite.

## Da provare a video

Incolla questo nel campo di testo:

```
User-agent: Googlebot
Disallow: /

User-agent: *
Disallow: /area/
Allow: /area/pubblica
Disallow: /*.pdf$
Sitemap: https://esempio.it/sitemap.xml
```

Poi, nel campo "prova un indirizzo", scrivi `/listino.pdf` e premi Verifica.
Tutti i crawler devono passare da "entra" a "bloccato". Con `/area/pubblica/x`
devono tornare ammessi: vince la regola col percorso più lungo.
