// Configurazione del sito.
//
// Il sito è statico: Astro genera pagine HTML già pronte, e l'interattività
// degli strumenti vive nei componenti che girano nel browser. Le analisi che
// devono scaricare pagine altrui passano invece dalle funzioni in functions/,
// eseguite da Cloudflare: dal browser non si può, per via delle regole di
// origine che i siti impongono.
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://sottosopra.dev',
  // Ogni pagina in una cartella con lo slash finale: gli indirizzi restano
  // stabili e non si creano doppioni con e senza barra.
  trailingSlash: 'always',
  build: { format: 'directory' },
  compressHTML: true,
});
