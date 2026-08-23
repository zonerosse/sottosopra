# Correzioni — 23 agosto 2026

Cinque file. Sostituiscono quelli esistenti, tranne `prove/robots.mjs` che è nuovo.
Nessun file viene cancellato, nessuna dipendenza aggiunta.

| File | Cosa cambia |
|---|---|
| `src/lib/robots.js` | tre bug corretti (vedi sotto) |
| `functions/api/robots.js` | origine limitata al sito, cache di 15 minuti |
| `src/layouts/Base.astro` | schema colore dichiarato, tolti i due riferimenti a file inesistenti |
| `src/styles/globale.css` | `color-scheme: light` |
| `prove/robots.mjs` | **nuovo** — 20 prove automatiche |

## I tre bug

1. **Sitemap da sola.** Un robots.txt contenente solo `Sitemap: …` veniva
   dichiarato privo di direttive valide, con gravità alta. Su un file corretto.

2. **Bot figli.** Con `User-agent: Googlebot` + `Disallow: /`, lo strumento
   diceva che `Googlebot-Image` poteva entrare. Non è così: se non esiste un
   gruppo col suo nome, un crawler ricade sul gruppo del bot padre, e solo dopo
   sull'asterisco. Ora la scelta del blocco segue quell'ordine.

3. **Asterisco e dollaro.** `Disallow: /*.pdf$` non bloccava niente: il codice
   toglieva solo gli asterischi finali e poi confrontava l'inizio della stringa.
   Ora i percorsi diventano espressioni regolari vere, con `*` come jolly e `$`
   come ancora di fine. Era un falso negativo silenzioso, il tipo di errore
   peggiore per uno strumento che si vende sulla precisione.

## Le prove

```
node prove/robots.mjs
```

Nessuna libreria, nessuna installazione. Ogni prova nasce da un caso che il
motore sbagliava davvero. Quando aggiungi un controllo, scrivi prima la prova
che fallisce.

## Una cosa da cambiare a mano

In `functions/api/robots.js`, in cima, c'è l'elenco delle origini ammesse:

```js
const ORIGINI = ['https://sottosopra.dev', 'http://localhost:4321'];
```

Se il dominio definitivo è un altro, correggilo lì. Se sbagli, lo strumento
smette di funzionare online e in locale continua ad andare — così te ne accorgi
tardi.
