// Scarica il robots.txt di un dominio.
//
// Dal browser non si può: i siti impongono regole di origine che bloccano le
// richieste da un dominio diverso. Questa funzione fa da tramite — scarica il
// file e lo restituisce — senza conservare né l'indirizzo né il contenuto.

const UA = 'SottosopraBot/1.0 (+https://sottosopra.dev/robots/)';
const SCADENZA = 8000;
const MAX = 200000;

const risposta = (dati, stato = 200) => new Response(JSON.stringify(dati), {
  status: stato,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  },
});

export async function onRequest(context) {
  try {
    const parametri = new URL(context.request.url).searchParams;
    const grezzo = (parametri.get('sito') || '').trim();
    if (!grezzo) return risposta({ errore: 'Manca l\u2019indirizzo del sito.' });

    let origine;
    try {
      const u = new URL(/^https?:\/\//i.test(grezzo) ? grezzo : 'https://' + grezzo);
      if (!/^https?:$/.test(u.protocol)) throw new Error('protocollo');
      origine = u.origin;
    } catch (e) {
      return risposta({ errore: 'Indirizzo non valido.' });
    }

    const r = await fetch(origine + '/robots.txt', {
      headers: { 'User-Agent': UA, 'Accept': 'text/plain,*/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(SCADENZA),
    });

    if (r.status === 404) {
      if (r.body) { try { await r.body.cancel(); } catch (e) {} }
      return risposta({
        errore: 'Questo sito non ha un robots.txt. Non è un difetto grave — senza il file ' +
          'tutti i crawler considerano il sito visitabile — ma perdi il modo più diretto per ' +
          'dichiarare la sitemap.',
      });
    }

    if (!r.ok) {
      if (r.body) { try { await r.body.cancel(); } catch (e) {} }
      return risposta({ errore: 'Il server ha risposto ' + r.status + ' invece di consegnare il file.' });
    }

    let testo = await r.text();
    if (testo.length > MAX) testo = testo.slice(0, MAX);

    // capita che un server risponda con la home invece del file: va detto,
    // altrimenti lo strumento analizza dell'HTML e dà risultati senza senso
    if (/^\s*<(!doctype|html)/i.test(testo))
      return risposta({ errore: 'A quell\u2019indirizzo il sito risponde con una pagina HTML, non con un robots.txt. Di solito significa che il file non esiste e il server serve la home al suo posto.' });

    return risposta({ testo, origine });
  } catch (err) {
    return risposta({
      errore: /timeout|abort/i.test(String(err && err.message))
        ? 'Il sito non ha risposto in tempo utile.'
        : 'Non sono riuscito a raggiungere quel sito.',
    });
  }
}
