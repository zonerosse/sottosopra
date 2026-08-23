# Passo 3 — il tool diventa la home

Lo zip si estrae **direttamente** dentro `C:\Hugo\sottosopra`.
Niente cartella in più stavolta: dentro ci sono già `src` e `functions`.

## Cosa cambia

| File | |
|---|---|
| `src/pages/index.astro` | **la home è ora lo strumento** (era la vetrina) |
| `src/pages/strumenti.astro` | **nuovo** — la vecchia home, spostata su `/strumenti/` |
| `src/lib/verifica/verifica.js` | il motore, spostato da Punto Web Ferrara |
| `src/lib/verifica/controlli.js` | i 48 controlli con fonte |
| `src/layouts/Base.astro` | menu aggiornato |
| `functions/api/_analisi.js` | analisi di una pagina |
| `functions/api/scopri.js` | scoperta della sitemap |
| `functions/api/pagina.js` | scarico di una pagina |
| `functions/api/lighthouse.js` | misura della velocità |

## Cosa ho tolto

Il codice arrivava da Punto Web Ferrara e conteneva i suoi rimandi commerciali:

- il blocco finale del report con «Sono Paolo Boldrini, lavoro da Ferrara»,
  la richiesta di preventivo e il listino prezzi
- i collegamenti a `/servizi/`, `/contatti/`, `/siti-web-allevamenti/`, `/blog/`
- lo user-agent dei bot, che si presentava come `VerificaSitoBot` di
  puntowebferrara.com — ora è `SottosopraBot`

Al posto del blocco finale c'è un segnaposto neutro. **Va deciso cosa
scriverci**: è l'ultima cosa che uno legge dopo aver visto il proprio
punteggio, quindi è il punto più importante della pagina.

## Da sapere

In locale l'analisi **non parte**: le quattro funzioni girano su Cloudflare,
non nell'anteprima. Vedrai la pagina ma il pulsante darà errore. È normale, ed
è lo stesso motivo per cui il validatore robots.txt in locale accetta solo il
testo incollato.

Per provarla davvero serve pubblicare su Cloudflare Pages.
