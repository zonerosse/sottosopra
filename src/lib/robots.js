// Lettura e giudizio di un file robots.txt.
//
// Vive in un file suo perché lo usano in due: la pagina, che lo esegue nel
// browser sul testo incollato, e la funzione su Cloudflare, che scarica il file
// da un dominio. Stesso codice, stesso risultato: uno strumento che desse
// risposte diverse a seconda di come lo interroghi non varrebbe niente.

// I crawler che contano, con chi è il padrone e quanto pesa bloccarli.
export const CRAWLER = [
  // modelli generativi: sono quelli per cui questo strumento esiste
  { nome: 'GPTBot', chi: 'ChatGPT — addestramento e ricerca', peso: 'alto', gruppo: 'IA' },
  { nome: 'OAI-SearchBot', chi: 'ChatGPT — ricerca nel web', peso: 'alto', gruppo: 'IA' },
  { nome: 'ChatGPT-User', chi: 'ChatGPT — apre le pagine su richiesta di chi chiede', peso: 'alto', gruppo: 'IA' },
  { nome: 'ClaudeBot', chi: 'Claude — addestramento', peso: 'alto', gruppo: 'IA' },
  { nome: 'Claude-User', chi: 'Claude — apre le pagine su richiesta', peso: 'alto', gruppo: 'IA' },
  { nome: 'PerplexityBot', chi: 'Perplexity', peso: 'alto', gruppo: 'IA' },
  { nome: 'Google-Extended', chi: 'Gemini e le risposte generate di Google', peso: 'alto', gruppo: 'IA' },
  { nome: 'Applebot-Extended', chi: 'Apple Intelligence', peso: 'medio', gruppo: 'IA' },
  { nome: 'Amazonbot', chi: 'Amazon', peso: 'basso', gruppo: 'IA' },
  { nome: 'Bytespider', chi: 'ByteDance, il gruppo di TikTok', peso: 'basso', gruppo: 'IA' },
  { nome: 'CCBot', chi: 'Common Crawl, l\u2019archivio da cui molti modelli imparano', peso: 'medio', gruppo: 'IA' },
  { nome: 'cohere-ai', chi: 'Cohere', peso: 'basso', gruppo: 'IA' },

  // motori di ricerca tradizionali: bloccarli è un guasto, non una scelta
  { nome: 'Googlebot', chi: 'Google — ricerca', peso: 'critico', gruppo: 'ricerca' },
  { nome: 'Googlebot-Image', chi: 'Google — immagini', peso: 'medio', gruppo: 'ricerca' },
  { nome: 'Bingbot', chi: 'Bing, e con lui Copilot', peso: 'alto', gruppo: 'ricerca' },
  { nome: 'Applebot', chi: 'Apple — Siri e Spotlight', peso: 'medio', gruppo: 'ricerca' },
  { nome: 'DuckDuckBot', chi: 'DuckDuckGo', peso: 'basso', gruppo: 'ricerca' },

  // strumenti di analisi: bloccarli è legittimo, ma va saputo
  { nome: 'AhrefsBot', chi: 'Ahrefs — indice di link', peso: 'basso', gruppo: 'analisi' },
  { nome: 'SemrushBot', chi: 'Semrush', peso: 'basso', gruppo: 'analisi' },
  { nome: 'MJ12bot', chi: 'Majestic', peso: 'basso', gruppo: 'analisi' },
];

// Legge il file e ne ricava i blocchi, riga per riga, conservando il numero di
// riga: serve per dire dove sta il problema invece di dire che c'è.
export function leggiRobots(testo) {
  const righe = String(testo || '').split(/\r?\n/);
  const blocchi = [];
  const sitemap = [];
  const problemi = [];
  let corrente = null;
  let vistoDirettiva = false;

  righe.forEach((originale, indice) => {
    const numero = indice + 1;
    const senzaCommento = originale.replace(/#.*$/, '');
    const riga = senzaCommento.trim();
    if (!riga) return;

    const punto = riga.indexOf(':');
    if (punto < 0) {
      problemi.push({ riga: numero, testo: originale.trim(), gravita: 'medio',
        che: 'Riga senza i due punti: non è una direttiva e viene ignorata.' });
      return;
    }

    const campo = riga.slice(0, punto).trim().toLowerCase();
    const valore = riga.slice(punto + 1).trim();

    if (campo === 'user-agent') {
      // un nuovo User-agent dopo delle regole apre un blocco nuovo;
      // due User-agent di fila valgono entrambi per lo stesso blocco
      if (!corrente || corrente.regole.length) {
        corrente = { agenti: [], regole: [], riga: numero };
        blocchi.push(corrente);
      }
      if (!valore) {
        problemi.push({ riga: numero, testo: originale.trim(), gravita: 'alto',
          che: 'User-agent senza nome: il blocco che segue non si applica a nessuno.' });
      }
      corrente.agenti.push({ nome: valore, riga: numero });
      vistoDirettiva = true;
      return;
    }

    if (campo === 'sitemap') {
      sitemap.push({ url: valore, riga: numero });
      // Sitemap è una direttiva a sé, valida anche da sola: senza questa riga
      // un file che contenga solo la sitemap veniva dichiarato invalido.
      vistoDirettiva = true;
      if (!/^https?:\/\//i.test(valore)) {
        problemi.push({ riga: numero, testo: originale.trim(), gravita: 'alto',
          che: 'La sitemap va dichiarata con l\u2019indirizzo completo, compreso https://. Un percorso relativo non viene seguito.' });
      }
      return;
    }

    if (campo === 'allow' || campo === 'disallow') {
      if (!corrente) {
        problemi.push({ riga: numero, testo: originale.trim(), gravita: 'alto',
          che: 'Regola senza un User-agent che la preceda: non si applica a nessun crawler.' });
        return;
      }
      corrente.regole.push({ tipo: campo, percorso: valore, riga: numero });
      if (valore && !valore.startsWith('/') && !valore.startsWith('*')) {
        problemi.push({ riga: numero, testo: originale.trim(), gravita: 'medio',
          che: 'Il percorso deve cominciare con una barra. Così com\u2019è, la regola non corrisponde a nulla.' });
      }
      vistoDirettiva = true;
      return;
    }

    if (campo === 'crawl-delay') {
      problemi.push({ riga: numero, testo: originale.trim(), gravita: 'basso',
        che: 'Crawl-delay non è una direttiva standard: Google la ignora, Bing la rispetta. Non è un errore, ma non fa quello che molti credono.' });
      return;
    }

    if (campo === 'host' || campo === 'clean-param') {
      problemi.push({ riga: numero, testo: originale.trim(), gravita: 'basso',
        che: 'Direttiva riconosciuta solo da Yandex: gli altri motori la ignorano.' });
      return;
    }

    problemi.push({ riga: numero, testo: originale.trim(), gravita: 'medio',
      che: 'Direttiva sconosciuta: nessun motore la interpreta.' });
  });

  if (!vistoDirettiva && String(testo || '').trim()) {
    problemi.push({ riga: 0, testo: '', gravita: 'alto',
      che: 'Il file non contiene nessuna direttiva valida.' });
  }

  return { blocchi, sitemap, problemi, righe: righe.length };
}

// Decide se un crawler può entrare, seguendo le regole vere del protocollo.
//
// Tre punti che quasi tutti i validatori sbagliano, e che qui sono espliciti:
//  1. il blocco che vale non è solo quello col nome identico. Se non esiste un
//     gruppo per "Googlebot-Image", vale quello di "Googlebot": il nome più
//     lungo fra quelli che sono un prefisso del crawler. Solo dopo si guarda *.
//  2. dentro il blocco vince la regola col percorso più lungo, non la prima;
//     a parità di lunghezza vince Allow.
//  3. l'asterisco vale in mezzo, non solo in fondo, e il dollaro finale ancora
//     la regola alla fine dell'indirizzo.

// Traduce un percorso di robots.txt in espressione regolare.
// Restituisce null se il percorso è vuoto (regola che non seleziona nulla).
function inRegex(percorso) {
  if (!percorso) return null;
  const ancorato = percorso.endsWith('$');
  const corpo = ancorato ? percorso.slice(0, -1) : percorso;
  const schema = corpo
    .split('*')
    .map(pezzo => pezzo.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp('^' + schema + (ancorato ? '$' : ''));
}

// Il blocco applicabile a un crawler, con la specificità con cui è stato scelto.
function bloccoPer(analisi, nomeCrawler) {
  const n = String(nomeCrawler).toLowerCase();
  let scelto = null;
  let lunghezza = -1;

  for (const b of analisi.blocchi) {
    for (const a of b.agenti) {
      const agente = String(a.nome).toLowerCase();
      if (agente === '*') continue;
      // nome identico, oppure nome del bot padre: "googlebot" copre
      // "googlebot-image" quando un gruppo suo non esiste
      if (n === agente || n.startsWith(agente)) {
        if (agente.length > lunghezza) { scelto = b; lunghezza = agente.length; }
      }
    }
  }

  if (scelto) return { blocco: scelto, generico: false };

  const stella = analisi.blocchi.find(b => b.agenti.some(a => a.nome === '*'));
  return stella ? { blocco: stella, generico: true } : { blocco: null, generico: false };
}

export function permesso(analisi, nomeCrawler, percorso = '/') {
  const { blocco, generico } = bloccoPer(analisi, nomeCrawler);

  if (!blocco) return { ammesso: true, motivo: 'nessuna regola lo riguarda', generico: false };

  let vincente = null;

  for (const r of blocco.regole) {
    // "Disallow:" senza valore significa: nessun divieto.
    if (r.tipo === 'disallow' && r.percorso === '') continue;
    if (r.tipo === 'allow' && r.percorso === '') continue;

    let rx;
    try {
      rx = inRegex(r.percorso);
    } catch (e) {
      continue; // percorso che non si lascia tradurre: lo ignoriamo, non lo indoviniamo
    }
    if (!rx || !rx.test(percorso)) continue;

    // La specificità è la lunghezza del percorso dichiarato, jolly compresi.
    const lunghezza = r.percorso.length;
    const lunghezzaVincente = vincente ? vincente.percorso.length : -1;

    if (lunghezza > lunghezzaVincente ||
       (lunghezza === lunghezzaVincente && r.tipo === 'allow')) {
      vincente = r;
    }
  }

  if (!vincente) return { ammesso: true, motivo: 'nessuna regola corrisponde a questo percorso', generico };

  return {
    ammesso: vincente.tipo === 'allow',
    motivo: (vincente.tipo === 'allow' ? 'Allow: ' : 'Disallow: ') + (vincente.percorso || '(vuoto)'),
    riga: vincente.riga,
    generico,
  };
}

// Il giudizio d'insieme, con i rilievi che contano davvero.
export function giudizio(analisi) {
  const rilievi = [];

  const bloccati = CRAWLER.map(c => ({ c, esito: permesso(analisi, c.nome) }))
    .filter(x => !x.esito.ammesso);

  const critici = bloccati.filter(x => x.c.peso === 'critico');
  const ia = bloccati.filter(x => x.c.gruppo === 'IA' && x.c.peso === 'alto');

  if (critici.length)
    rilievi.push({ gravita: 'critico',
      che: critici.map(x => x.c.nome).join(', ') + ' non può leggere il sito',
      come: 'È il crawler della ricerca di Google. Con questa regola il sito sparisce dai risultati. Se non è voluto, togli la riga Disallow che lo riguarda.' });

  if (ia.length)
    rilievi.push({ gravita: 'alto',
      che: ia.length + (ia.length === 1 ? ' crawler di modelli generativi è bloccato' : ' crawler di modelli generativi sono bloccati') +
        ': ' + ia.map(x => x.c.nome).join(', '),
      come: 'Bloccarli è una scelta legittima, ma va fatta sapendo cosa comporta: quelle pagine non potranno essere citate nelle risposte generate. Molti plugin SEO aggiungono queste esclusioni da soli, senza dirlo.' });

  if (!analisi.sitemap.length)
    rilievi.push({ gravita: 'medio',
      che: 'Il file non dichiara nessuna sitemap',
      come: 'Aggiungi una riga Sitemap: seguita dall\u2019indirizzo completo. È il modo più diretto per dire a un motore quali pagine esistono.' });

  for (const p of analisi.problemi)
    rilievi.push({ gravita: p.gravita, che: p.che,
      dove: p.riga ? 'riga ' + p.riga + (p.testo ? ': ' + p.testo : '') : null });

  return rilievi;
}
