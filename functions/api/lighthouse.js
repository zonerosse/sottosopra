// lighthouse.js — misura reale delle prestazioni tramite PageSpeed Insights.
//
// PageSpeed Insights È Lighthouse, eseguito sui server di Google. Restituisce
// i quattro punteggi (prestazioni, accessibilità, buone pratiche, SEO), le
// metriche Core Web Vitals di laboratorio e, quando il sito ha abbastanza
// traffico, anche i dati reali raccolti dai browser Chrome.
//
// Serve una chiave gratuita: console.cloud.google.com → API e servizi →
// abilita "PageSpeed Insights API" → Credenziali → Crea chiave API.
// La chiave va messa nelle variabili d'ambiente del progetto Cloudflare Pages
// con nome PSI_KEY. Senza chiave l'endpoint risponde "non configurato" e il
// resto dello strumento continua a funzionare.
//
// Quota gratuita: 25.000 chiamate al giorno. Ogni analisi ne usa una o due.

const CAMPI = 'lighthouseResult(categories,audits),loadingExperience(overall_category)';

// Le voci che il report mostra come "cosa rallenta la pagina".
const RIMEDI = {
  'render-blocking-resources': 'Sposta CSS e JavaScript non essenziali fuori dal percorso critico, o aggiungi defer agli script.',
  'modern-image-formats': 'Converti le immagini in AVIF o WebP: pesano circa la metà a parità di qualità.',
  'uses-responsive-images': 'Servi immagini della dimensione in cui vengono mostrate, non più grandi.',
  'offscreen-images': 'Carica con loading="lazy" le immagini che stanno sotto la prima schermata.',
  'uses-optimized-images': 'Comprimi le immagini: molte arrivano dal fotografo o dallo smartphone senza alcuna riduzione.',
  'unused-javascript': 'Rimuovi il JavaScript che non viene eseguito: spesso sono plugin o librerie non più usate.',
  'unused-css-rules': 'Elimina le regole CSS che nessun elemento usa: nei temi pronti sono spesso la maggior parte.',
  'unminified-javascript': 'Minifica il JavaScript: è un passaggio automatico che toglie spazi e commenti.',
  'unminified-css': 'Minifica il CSS.',
  'legacy-javascript': 'Stai servendo codice compatibile con browser che non usa più nessuno: pesa e rallenta.',
  'duplicated-javascript': 'La stessa libreria è caricata più volte: capita quando i plugin includono le proprie copie.',
  'uses-text-compression': 'Attiva la compressione Brotli o gzip sul server.',
  'server-response-time': 'Il server impiega troppo a rispondere: valuta una cache o un sito statico.',
  'total-byte-weight': 'La pagina pesa troppo in totale: quasi sempre sono le immagini.',
  'third-party-summary': 'Gli script di terze parti — analitiche, chat, mappe, pubblicità — occupano il browser a lungo.',
  'largest-contentful-paint-element': "È l'elemento che ci mette più tempo a comparire: da lì si parte.",
  'prioritize-lcp-image': "Dichiara l'immagine principale come prioritaria con fetchpriority=\"high\".",
  'uses-rel-preconnect': 'Anticipa la connessione ai domini esterni da cui carichi risorse.',
  'font-display': 'Con font-display: swap il testo compare subito con un carattere di riserva.',
  'redirects': 'Ci sono reindirizzamenti a catena: ogni salto aggiunge un giro di rete.',
};

const NOMI = {
  performance: 'Prestazioni',
  accessibility: 'Accessibilità',
  'best-practices': 'Buone pratiche',
  seo: 'SEO di base',
};

export async function onRequest(context) {
  try {
    return await lighthouse(context);
  } catch (err) {
    return risposta({ errore: 'Analisi non riuscita', dettaglio: String(err && err.message || err).slice(0, 140) }, 200);
  }
}

async function lighthouse(context) {
  const chiave = context.env && context.env.PSI_KEY;
  const parametri = new URL(context.request.url).searchParams;
  const indirizzo = (parametri.get('url') || '').trim();
  const dispositivo = parametri.get('mobile') === '0' ? 'desktop' : 'mobile';

  if (!/^https?:\/\//i.test(indirizzo))
    return risposta({ errore: 'Indirizzo non valido' }, 400);

  if (!chiave)
    return risposta({
      disponibile: false,
      motivo: 'Misura delle prestazioni non configurata: manca la chiave PageSpeed Insights.',
    });

  const base = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
    + '?url=' + encodeURIComponent(indirizzo)
    + '&strategy=' + dispositivo
    + '&category=performance&category=accessibility&category=best-practices&category=seo'
    + '&locale=it'
    + '&key=' + encodeURIComponent(chiave);

  // Prima con la risposta abbreviata, che pesa molto meno. Se Google non la
  // gradisce, si ripiega sulla risposta intera: meglio lenta che assente.
  async function chiedi(url) {
    const r = await fetch(url, { signal: AbortSignal.timeout(45000), cf: { cacheTtl: 900, cacheEverything: true } });
    if (r.ok) return { ok: true, dati: await r.json() };
    let messaggio = '';
    try {
      const errore = await r.json();
      messaggio = (errore.error && errore.error.message) || '';
    } catch (e) { /* la risposta non era JSON */ }
    return { ok: false, stato: r.status, messaggio: messaggio.slice(0, 180) };
  }

  let dati;
  try {
    let esito = await chiedi(base + '&fields=' + encodeURIComponent(CAMPI));
    if (!esito.ok) esito = await chiedi(base);
    if (!esito.ok) return risposta({
      disponibile: false,
      motivo: 'Google ha risposto ' + esito.stato + (esito.messaggio ? ': ' + esito.messaggio : ''),
    });
    dati = esito.dati;
  } catch (err) {
    return risposta({ disponibile: false, motivo: 'Misura non riuscita', dettaglio: String(err).slice(0, 120) });
  }

  const lh = dati.lighthouseResult || {};
  const audit = lh.audits || {};
  const val = k => (audit[k] && audit[k].displayValue) || null;
  const punti = k => (audit[k] && typeof audit[k].score === 'number') ? audit[k].score : null;

  const categorie = [];
  for (const [chiaveCat, cat] of Object.entries(lh.categories || {}))
    if (cat && typeof cat.score === 'number')
      categorie.push({ id: chiaveCat, nome: NOMI[chiaveCat] || chiaveCat, punteggio: Math.round(cat.score * 100) });

  const metriche = [
    { id: 'largest-contentful-paint', nome: 'Comparsa del contenuto principale',
      spiegazione: 'Quanto tempo passa prima che il visitatore veda la parte più grossa della pagina. Sotto 2,5 secondi è buono.' },
    { id: 'cumulative-layout-shift', nome: 'Stabilità del disegno',
      spiegazione: 'Quanto la pagina "salta" mentre carica. Sotto 0,1 è buono. Di solito dipende da immagini senza misure dichiarate.' },
    { id: 'total-blocking-time', nome: 'Tempo in cui la pagina non risponde',
      spiegazione: 'Per quanto il browser resta occupato e ignora i clic. Sotto 200 millisecondi è buono.' },
    { id: 'first-contentful-paint', nome: 'Prima comparsa di qualcosa',
      spiegazione: 'Quando appare il primo pezzo di contenuto. Sotto 1,8 secondi è buono.' },
    { id: 'speed-index', nome: 'Velocità percepita',
      spiegazione: 'Quanto in fretta la pagina sembra completa a chi guarda.' },
    { id: 'server-response-time', nome: 'Risposta del server',
      spiegazione: 'Quanto ci mette il server a mandare la prima riga di HTML. Sotto 600 millisecondi è buono.' },
  ].map(x => {
    let valore = val(x.id);
    // Alcune voci restano in inglese anche chiedendo l'italiano: si riscrivono.
    if (valore) {
      const m = String(valore).match(/^Root document took\s+([\d.,]+)\s*(ms|s)$/i);
      if (m) valore = m[1] + ' ' + m[2];
    }
    return { ...x, valore, esito: punti(x.id) };
  }).filter(x => x.valore);

  // Molte diagnosi di Lighthouse non hanno un punteggio ma indicano comunque
  // quanto tempo o quanti byte si risparmierebbero: vanno mostrate lo stesso.
  const risparmio = a => (a.details && (a.details.overallSavingsMs || a.details.overallSavingsBytes)) || 0;
  const rallentamenti = Object.keys(RIMEDI)
    .filter(k => {
      const a = audit[k];
      if (!a) return false;
      if (typeof a.score === 'number' && a.score < 0.9) return true;
      return a.score === null && (!!a.displayValue || risparmio(a) > 0);
    })
    .sort((x, y) => risparmio(audit[y]) - risparmio(audit[x]))
    .slice(0, 8)
    .map(k => ({
      nome: (audit[k].title || k),
      quanto: audit[k].displayValue || '',
      rimedio: RIMEDI[k],
    }));

  const reali = dati.loadingExperience && dati.loadingExperience.overall_category
    ? { giudizio: dati.loadingExperience.overall_category }
    : null;

  return risposta({
    disponibile: true,
    dispositivo,
    categorie,
    metriche,
    rallentamenti,
    datiReali: reali,
  });
}

function risposta(dati, stato) {
  return new Response(JSON.stringify(dati), {
    status: stato || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
