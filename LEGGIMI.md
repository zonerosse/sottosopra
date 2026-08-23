# Sottosopra

Strumenti gratuiti di analisi tecnica dei siti web. Astro + Cloudflare Pages.

## Lavorare in locale

```
npm install      una volta sola
npm run dev      anteprima su http://localhost:4321
npm run build    genera il sito in dist/
```

Serve Node.js installato: nodejs.org, versione LTS.

## Come è organizzato

- `src/pages/` — una pagina per file. Il nome del file è l'indirizzo:
  `robots.astro` diventa `/robots/`.
- `src/layouts/Base.astro` — intestazione, piede e dati strutturati, comuni a tutto.
- `src/lib/` — i motori di analisi, in JavaScript puro. Vengono usati sia dalle
  pagine sia dalle funzioni: stesso codice, stessi risultati.
- `src/styles/globale.css` — l'unico foglio di stile.
- `functions/api/` — le funzioni eseguite da Cloudflare, per tutto ciò che deve
  scaricare pagine di altri domini.

## Pubblicare

Cloudflare Pages, collegato al repository. Comando di build `npm run build`,
cartella di output `dist`.
