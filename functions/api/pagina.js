// pagina.js — analizza una singola pagina.
// Una chiamata esterna sola per invocazione: resta larghissima sui limiti
// del piano gratuito (50 chiamate, 10 ms di CPU).

import { analizzaPagina } from './_analisi.js';

const UA = 'SottosopraBot/1.0 (+https://sottosopra.dev/)';
const UA_BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const INTESTAZIONI = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Upgrade-Insecure-Requests': '1',
};
const MAX_BYTE = 500000; // oltre questa soglia la pagina viene troncata

export async function onRequest(context) {
  try {
    return await pagina(context);
  } catch (err) {
    return risposta({ errore: 'Analisi non riuscita', dettaglio: String(err && err.message || err).slice(0, 140) }, 200);
  }
}

async function pagina(context) {
  const parametri = new URL(context.request.url).searchParams;
  const indirizzo = (parametri.get('url') || '').trim();
  if (!/^https?:\/\//i.test(indirizzo))
    return risposta({ errore: 'Indirizzo non valido' }, 400);

  const inizio = Date.now();
  let recupero;
  try {
    recupero = await fetch(indirizzo, {
      headers: INTESTAZIONI,
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      cf: { cacheTtl: 300, cacheEverything: true },
    });
  } catch (err) {
    return risposta({ url: indirizzo, errore: 'Pagina irraggiungibile', dettaglio: String(err).slice(0, 120) }, 200);
  }

  if (!recupero.ok && [401, 403, 405, 406, 429].includes(recupero.status)) {
    // Il permesso è già stato verificato sul robots.txt prima di arrivare qui:
    // questo è solo un filtro sulla stringa del browser.
    if (recupero.body) { try { await recupero.body.cancel(); } catch (e) {} }
    recupero = await fetch(indirizzo, {
      headers: Object.assign({}, INTESTAZIONI, { 'User-Agent': UA_BROWSER }),
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      cf: { cacheTtl: 300, cacheEverything: true },
    }).catch(() => recupero);
  }

  if (!recupero.ok) {
    if (recupero.body) { try { await recupero.body.cancel(); } catch (e) {} }
    return risposta({ url: indirizzo, errore: 'Il server ha risposto ' + recupero.status, stato: recupero.status }, 200);
  }

  const tipo = recupero.headers.get('content-type') || '';
  if (!/html/i.test(tipo)) {
    if (recupero.body) { try { await recupero.body.cancel(); } catch (e) {} }
    return risposta({ url: indirizzo, errore: 'Non è una pagina HTML (' + tipo.split(';')[0] + ')' }, 200);
  }

  // Le intestazioni servono ai controlli di sicurezza e compressione.
  const intestazioni = {};
  for (const nome of ['content-encoding','content-type','strict-transport-security',
                      'x-content-type-options','x-frame-options','referrer-policy',
                      'content-security-policy','cache-control','server']) {
    const v = recupero.headers.get(nome);
    if (v) intestazioni[nome] = v;
  }

  // Si legge solo la porzione che serve: decodificare una pagina da più
  // megabyte costerebbe più CPU di quanta ne concede il piano gratuito.
  let html = '';
  let troncata = false;
  if (recupero.body) {
    const lettore = recupero.body.getReader();
    const pezzi = [];
    let presi = 0;
    try {
      while (presi < MAX_BYTE) {
        const { done, value } = await lettore.read();
        if (done) break;
        pezzi.push(value);
        presi += value.length;
      }
      troncata = presi >= MAX_BYTE;
    } finally {
      try { await lettore.cancel(); } catch (e) { /* già chiuso */ }
    }
    const insieme = new Uint8Array(Math.min(presi, MAX_BYTE));
    let posizione = 0;
    for (const pezzo of pezzi) {
      if (posizione >= insieme.length) break;
      const quanto = Math.min(pezzo.length, insieme.length - posizione);
      insieme.set(pezzo.subarray(0, quanto), posizione);
      posizione += quanto;
    }
    html = new TextDecoder('utf-8', { fatal: false }).decode(insieme);
  }

  const esito = analizzaPagina(html, recupero.url || indirizzo, intestazioni);
  esito.peso = html.length;
  esito.troncata = troncata;
  esito.millisecondi = Date.now() - inizio;
  esito.stato = recupero.status;
  esito.finale = recupero.url !== indirizzo ? recupero.url : null;

  return risposta(esito);
}

function risposta(dati, stato) {
  return new Response(JSON.stringify(dati), {
    status: stato || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
