# Sottosopra — landing completa

Si estrae **direttamente** dentro `C:\Hugo\sottosopra`.
Dentro ci sono già `src` e `functions`: niente cartella in più.

## Cosa c'è

| File | |
|---|---|
| `src/pages/index.astro` | la landing: tool, report, estensione, nove gruppi, perché, domande |
| `src/pages/robots.astro` | il validatore robots.txt |
| `src/layouts/Base.astro` | intestazione, menu, piede |
| `src/styles/globale.css` | la palette e gli stili comuni |
| `src/lib/verifica/*` | il motore dei 48 controlli |
| `src/lib/robots.js` | il motore del robots.txt |
| `functions/api/*` | le cinque funzioni Cloudflare |

Se in `src/pages/` trovi `verifica.astro`, `strumenti.astro`, `guide.astro` o
`chi-sono.astro`, **cancellali**: erano dell'assetto precedente e adesso la
landing è una pagina sola.

## L'aspetto

Palette letta dalle schermate di Sitechecker: apertura blu notte `#1b2a47`,
pulsanti blu `#1f6feb`, piede blu acceso `#1668ff`, testo grigio-blu `#4d6180`,
titoli `#16264a`.

I nove gruppi hanno ciascuno la banda colorata a sinistra e il quadrante nella
mappa in cima, con l'arco proporzionale al peso in punti.

## Collegamenti ancora da creare

Tre riassunti rimandano a guide che non esistono:

- `/guide/crawler-ai/`
- `/guide/dati-strutturati/`
- `/guide/indicizzazione/`

Finché non le scriviamo danno 404. Se pubblichi prima, togli le tre righe
`<p class="continua">` da `index.astro`.

## Prove

```
node prove\robots.mjs
```

28 passate, 0 fallite.

## In locale

L'analisi non parte: le funzioni girano su Cloudflare, non nell'anteprima.
Vedrai la pagina, il pulsante darà errore. Normale.
