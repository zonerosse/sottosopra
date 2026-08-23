// verifica.js — orchestrazione dell'analisi e resa del report.
import { CONTROLLI } from './controlli.js';

// --- semaforo -------------------------------------------------------------
// Quattro livelli invece di due: un controllo superato sul 70% delle pagine
// non è "fallito", ed è utile vederlo a colpo d'occhio.
const SEGNI = {
  ok:      '<svg class="segno" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="10" r="8"/><path d="M6.5 10.2l2.4 2.4 4.6-5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  giallo:  '<svg class="segno" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="10" r="8"/><path d="M10 6v5" stroke-linecap="round"/><circle cx="10" cy="14.2" r="1" fill="currentColor" stroke="none"/></svg>',
  arancio: '<svg class="segno" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 2.6l7.6 13.2H2.4z" stroke-linejoin="round"/><path d="M10 8v3.6" stroke-linecap="round"/><circle cx="10" cy="14" r="1" fill="currentColor" stroke="none"/></svg>',
  rosso:   '<svg class="segno" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="10" r="8"/><path d="M7.2 7.2l5.6 5.6M12.8 7.2l-5.6 5.6" stroke-linecap="round"/></svg>',
  grigio:  '<svg class="segno" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="10" r="8" stroke-dasharray="2.5 2.5"/><path d="M6.5 10h7" stroke-linecap="round"/></svg>',
  nota:    '<svg class="segno" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M10 2.6a5 5 0 0 0-3 9v1.6h6V11.6a5 5 0 0 0-3-9z" stroke-linejoin="round"/><path d="M8 16.4h4M8.6 18.2h2.8" stroke-linecap="round"/></svg>',
};
// Cinque livelli. Quello in mezzo, "nota", è la differenza fra un problema e
// una rifinitura: sopra il 95% delle pagine il controllo resta verde e accanto
// compare un suggerimento, non un avviso.
function livello(quota) {
  if (quota == null) return 'grigio';
  if (quota >= 0.999) return 'ok';
  if (quota >= 0.95) return 'nota';
  if (quota >= 0.75) return 'giallo';
  if (quota >= 0.35) return 'arancio';
  return 'rosso';
}
const segno = liv => SEGNI[liv] || SEGNI.grigio;
const pill = (liv, testo) => '<span class="pill liv-' + liv + '">' + segno(liv) + T(testo) + '</span>';

// In un elenco di cose da sistemare ogni voce deve descrivere il difetto, non
// lo stato: "I livelli dei titoli non saltano" fra le cose da fare non si legge.
function difetto(v) {
  const testo = v.no || v.nome;
  if (v._tot && v._quota > 0.001) {
    const quante = v._tot - v._n;
    return testo + ' \u2014 ' + quante + (quante === 1 ? ' pagina' : ' pagine');
  }
  return testo;
}

// Resa della sola sezione velocità: serve quando il codice non è leggibile ma
// Google riesce comunque a misurare la pagina.
function resaLighthouse(lh, sito) {
  const p = ['<h2>Quello che si può misurare lo stesso</h2>',
    '<p class="nota" style="margin:-.5rem 0 1rem">Il codice non è accessibile, ma la velocità di ' +
    T(sito) + ' la misura Google con i propri sistemi.</p>',
    '<div class="gruppi">'];
  for (const c of lh.categorie) {
    const liv = livello(c.punteggio / 100);
    p.push('<div><b class="liv-' + liv + '">' + c.punteggio +
      '<span style="font-size:.8rem;color:var(--grafite);font-weight:400">/100</span></b>' +
      '<span>' + T(c.nome) + '</span><i><em class="liv-' + liv +
      '" style="width:' + c.punteggio + '%"></em></i></div>');
  }
  p.push('</div>');
  if (lh.metriche && lh.metriche.length) {
    p.push('<table style="margin-top:1rem"><tr><th>Metrica</th><th style="text-align:right">Valore</th></tr>');
    for (const m of lh.metriche)
      p.push('<tr><td class="metrica"><span class="segno liv-' + livello(m.esito) + '">\u25CF</span>' +
        '<span><b>' + T(m.nome) + '</b><div class="dove" style="font-family:inherit;color:var(--grafite)">' +
        T(m.spiegazione) + '</div></span></td><td class="num">' +
        pill(livello(m.esito), m.valore) + '</td></tr>');
    p.push('</table>');
  }
  if (lh.rallentamenti && lh.rallentamenti.length) {
    p.push('<h3>Cosa rallenta la pagina</h3>');
    for (const r of lh.rallentamenti)
      p.push('<div class="voce medio"><b>' + T(r.nome) + '</b> ' + T(r.quanto) +
        '<div class="dove" style="font-family:inherit;font-size:.86rem">' + T(r.rimedio) + '</div></div>');
  }
  return p.join('');
}

// Un 403 non è sempre la stessa cosa. Le intestazioni e il corpo della risposta
// dicono chi ha rifiutato e perché, e da lì dipende se si può fare qualcosa.
function spiegaRifiuto(err) {
  const i = err.indizi || {};
  const corpo = (err.assaggio || '').toLowerCase();
  const sfida = !!i['cf-mitigated'] || /attention required|checking your browser|just a moment|captcha/.test(corpo);
  const prodotto = i['x-sucuri-id'] || i['x-sucuri-block'] ? 'Sucuri'
    : i['x-iinfo'] ? 'Imperva Incapsula'
    : /mod_security|modsecurity/.test(corpo) ? 'ModSecurity' : null;
  const origine = /<center>\s*(nginx|apache)/.test(corpo) || /^403 forbidden$/.test(corpo.trim());

  if (sfida) return '<b>Questo sito richiede un test del browser.</b> Prima di mostrare le pagine ' +
    'presenta una verifica che si supera solo eseguendo JavaScript, cosa che un analizzatore non fa. ' +
    'Non è un blocco rivolto a te: è la protezione anti-bot attiva su tutto il traffico automatico.';

  if (prodotto) return '<b>Questo sito è protetto da ' + T(prodotto) + '.</b> Il firewall ha respinto la ' +
    'richiesta prima che arrivasse al sito. Chi lo gestisce può inserire un permesso per le analisi, ' +
    'ma dall\'esterno non c\'è modo di procedere.';

  if (origine) return '<b>Il blocco è sul server del sito, non sul suo firewall.</b> La risposta è la ' +
    'pagina di errore predefinita di nginx, quindi non è un sistema anti-bot: è una regola che rifiuta ' +
    'le richieste in base a <em>da dove</em> arrivano. Questo strumento gira sulla rete di Cloudflare, e ' +
    'molti server escludono per prudenza gli indirizzi dei datacenter — sia quelli dei robot sia quelli ' +
    'degli strumenti legittimi. Con la stringa di un browser è già stato riprovato: il risultato non cambia, ' +
    'perché il filtro non guarda quella.';

  return '<b>Questo sito ha rifiutato la richiesta con un codice 403.</b> La richiesta è stata inviata ' +
    'con tutte le intestazioni di un browser normale e ripetuta una seconda volta, senza esito.';
}

// Cerchio di completamento accanto al titolo di ogni gruppo.
// Il punteggio è su cento, così i gruppi si confrontano fra loro; accanto
// restano i punti veri, che ricordano quanto ciascuno pesa sul totale.
function cerchioGruppo(presi, totali, nome) {
  if (!totali) return '';
  const q = presi / totali;
  const liv = livello(q);
  const R = 17, C = 2 * Math.PI * R;
  const cento = Math.round(q * 100);
  return '<svg class="cerchio-gruppo liv-' + liv + '" width="46" height="46" viewBox="0 0 46 46" ' +
    'role="img" aria-label="' + T(nome) + ': ' + cento + ' su 100">' +
    '<circle cx="23" cy="23" r="' + R + '" fill="none" stroke="var(--linea)" stroke-width="4"/>' +
    (q > 0 ? '<circle cx="23" cy="23" r="' + R + '" fill="none" stroke="currentColor" stroke-width="4" ' +
      'stroke-linecap="round" stroke-dasharray="' + (C * q).toFixed(1) + ' ' + C.toFixed(1) +
      '" transform="rotate(-90 23 23)"/>' : '') +
    '<text x="23" y="27.5" text-anchor="middle" fill="currentColor" ' +
    'style="font-size:13px;font-weight:600">' + cento + '</text></svg>';
}


// Ragnatela dei punteggi, affiancata ai riquadri dei gruppi.
// I due elementi si dividono il lavoro: il grafico mostra la forma dello
// squilibrio — quale lato del sito cede — i riquadri danno i numeri esatti.
// Insieme stanno in una schermata; uno sotto l'altro ne occupavano due.

const SIGLE = {
  'Accesso dei motori IA': 'Motori IA',
  'Dati strutturati': 'Dati strutturati',
  'Segnali E-E-A-T': 'E-E-A-T',
  'Struttura dei contenuti': 'Struttura',
  'Indicizzazione': 'Indicizzazione',
  'Metadati e condivisione': 'Metadati',
  'Sicurezza e configurazione': 'Sicurezza',
  'Peso della pagina': 'Peso pagina',
  'Velocità misurata': 'Velocità',
};

function ragnatela(gruppi) {
  const validi = gruppi.filter(g => g.totali > 0);
  if (validi.length < 3) return '';

  const L = 500, C = L / 2, R = 138, n = validi.length;
  const ang = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i, q) => [C + Math.cos(ang(i)) * R * q, C + Math.sin(ang(i)) * R * q];
  const quote = validi.map(g => g.presi / g.totali);

  const p = ['<svg class="ragnatela" viewBox="0 0 ' + L + ' ' + L + '" role="img" ' +
    'aria-label="Punteggio per gruppo di controlli">'];

  for (const v of [0.25, 0.5, 0.75, 1])
    p.push('<polygon points="' + validi.map((_, i) => pt(i, v).map(x => x.toFixed(1)).join(',')).join(' ') +
      '" fill="none" stroke="var(--linea)"' + (v === 1 ? '' : ' stroke-dasharray="2 4"') + '/>');

  for (let i = 0; i < n; i++) {
    const [x, y] = pt(i, 1);
    p.push('<line x1="' + C + '" y1="' + C + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) +
      '" stroke="var(--linea)"/>');
  }

  p.push('<polygon points="' +
    validi.map((_, i) => pt(i, Math.max(quote[i], 0.02)).map(x => x.toFixed(1)).join(',')).join(' ') +
    '" fill="var(--verde)" fill-opacity="0.14" stroke="var(--verde)" stroke-width="2.5" ' +
    'stroke-linejoin="round"/>');

  for (let i = 0; i < n; i++) {
    const liv = livello(quote[i]);
    const [x, y] = pt(i, Math.max(quote[i], 0.02));
    p.push('<circle class="liv-' + liv + '" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) +
      '" r="4.5" fill="currentColor"/>');
    const a = ang(i);
    const lx = C + Math.cos(a) * (R + 26);
    const ly = C + Math.sin(a) * (R + 26) + 4;
    const anc = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
    p.push('<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + anc +
      '" class="et-nome">' + T(SIGLE[validi[i].gruppo] || validi[i].gruppo) + '</text>');
  }

  p.push('</svg>');
  return p.join('');
}

// Un'ancora stabile per ogni gruppo: serve a collegare i riquadri in cima alla
// sezione corrispondente più in basso. Ricavata dal nome, senza accenti né
// spazi, così resta la stessa fra un'analisi e l'altra.
function ancora(nome) {
  return 'g-' + String(nome).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}


// L'elenco delle pagine su cui un controllo non passa, con il valore misurato
// accanto a ciascuna. Fino a cinque righe resta aperto: aprire una tendina per
// leggere tre righe è un clic sprecato. Dalla sesta si chiude, ma l'elenco è
// sempre completo — nessun "e altre N".
function dovManca(v, pagine, radice) {
  if (!v || !v.id || !pagine || !pagine.length) return '';
  const ko = pagine.filter(q => q.flag && q.flag[v.id] === false);
  if (!ko.length) return '';

  const riga = (q) => {
    const misura = q.valori && q.valori[v.id];
    return '<span class="riga-dove"><a href="' + T(q.url) + '" target="_blank" rel="noopener">' +
      T(q.url.replace(radice, '') || '/') + '</a>' +
      (misura ? '<em>' + T(misura) + '</em>' : '') + '</span>';
  };

  const corpo = ko.map(riga).join('');
  const titolo = ko.length === 1 ? 'Dove manca \u2014 1 pagina'
    : 'Dove manca \u2014 ' + ko.length + ' pagine';

  if (ko.length <= 5)
    return '<div class="dove-manca"><b>' + titolo + '</b>' + corpo + '</div>';

  return '<details class="dove-manca chiusa"><summary><b>' + titolo + '</b>' +
    '<span class="apri">mostra l\'elenco</span></summary>' + corpo + '</details>';
}

// Il difetto scritto con i numeri di questo sito, non con una formula.
function difettoConcreto(v, pagine) {
  if (!v.id || !pagine || !pagine.length) return '';
  const ko = pagine.filter(q => q.flag && q.flag[v.id] === false);
  if (!ko.length) return '';
  const misure = ko.map(q => q.valori && q.valori[v.id]).filter(Boolean);
  if (!misure.length) return '';
  // se il valore è lo stesso ovunque lo si dice una volta; altrimenti si dà
  // l'intervallo, che è l'informazione che serve per capire quanto è grave
  const distinti = [...new Set(misure)];
  if (distinti.length === 1)
    return '<p class="difetto"><b>Su questo sito</b>' + T(distinti[0]) + '</p>';
  const numeri = misure.map(x => parseFloat(String(x))).filter(x => !isNaN(x));
  if (numeri.length === misure.length) {
    const min = Math.min(...numeri), max = Math.max(...numeri);
    const unita = String(misure[0]).replace(/^[\d.,]+\s*/, '');
    if (min !== max)
      return '<p class="difetto"><b>Su questo sito</b>da ' + min + ' a ' + max + ' ' + T(unita) + '</p>';
  }
  return '<p class="difetto"><b>Su questo sito</b>' + T(distinti[0]) +
    (distinti.length > 1 ? ' e altri valori' : '') + '</p>';
}

const GRAVITA = [
  ['alto', 'Da sistemare', 'rosso'],
  ['medio', 'Da valutare', 'arancio'],
  ['basso', 'Suggerimenti', 'nota'],
];

const $ = id => document.getElementById(id);
const modulo = $('modulo'), campo = $('indirizzo'), bottone = $('avvia');
const avanzamento = $('avanzamento'), riempimento = $('riempimento'), passo = $('passo');
const esito = $('esito'), zonaErrore = $('zonaErrore');

const T = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const percorso = u => { try { return new URL(u).pathname; } catch { return u; } };

function avanza(fatte, totale, testo) {
  riempimento.style.width = (totale ? Math.round(fatte / totale * 100) : 0) + '%';
  passo.textContent = testo;
}

// Accetta quello che la gente scrive davvero: esempio.it, www.esempio.it,
// http://esempio.it, o l'indirizzo copiato dalla barra del browser.
function normalizza(scritto) {
  let v = scritto.trim().replace(/\s+/g, '');
  if (!v) return null;
  v = v.replace(/^https?:\/\//i, m => m.toLowerCase());
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  let u;
  try { u = new URL(v); } catch { return null; }
  if (!u.hostname.includes('.') || u.hostname.endsWith('.')) return null;
  return u.origin;
}

modulo.addEventListener('submit', async e => {
  e.preventDefault();
  const indirizzo = normalizza(campo.value);
  if (!indirizzo) {
    zonaErrore.innerHTML = '<div class="errore"><b>Non riconosco questo indirizzo.</b> ' +
      'Scrivi il dominio, per esempio <code>iltuosito.it</code>. Il resto lo aggiungo io.</div>';
    campo.focus();
    return;
  }
  campo.value = indirizzo;

  bottone.disabled = true;
  zonaErrore.innerHTML = '';
  esito.classList.remove('attivo');
  esito.innerHTML = '';
  avanzamento.classList.add('attivo');
  avanza(0, 1, 'Cerco robots.txt e sitemap…');

  let scoperta;
  try {
    const r = await fetch('/api/scopri?url=' + encodeURIComponent(indirizzo));
    const grezzo = await r.text();
    try { scoperta = JSON.parse(grezzo); }
    catch (e) {
      // Se al posto del JSON arriva una pagina HTML, la richiesta è stata
      // interrotta prima di completarsi: capita sui siti molto grandi.
      throw new Error('il server ha interrotto l\'analisi di questo sito.');
    }
    if (scoperta.errore) {
      const e = new Error(scoperta.errore);
      e.indizi = scoperta.indizi;
      e.assaggio = scoperta.assaggio;
      throw e;
    }
  } catch (err) {
    const vietato = /robots\.txt/i.test(err.message);
    const bloccato = !vietato && /403|401/.test(err.message);

    const spiegazione = vietato
      ? '<b>Il robots.txt di questo sito vieta la scansione automatica.</b> Non è un ostacolo tecnico: è ' +
        'una richiesta esplicita di chi lo gestisce, e viene rispettata. Se il sito è tuo puoi modificare ' +
        'quel file, oppure scrivimi e lo guardo a mano.'
      : bloccato
      ? spiegaRifiuto(err)
      : '<b>Non riesco a leggere questo sito.</b> ' + T(err.message) +
        '<br><br>Le cause più frequenti sono tre: l\'indirizzo è scritto male, il sito blocca i programmi ' +
        'automatici, oppure è talmente grande che l\'analisi si interrompe prima di finire.';

    // La spiegazione compare subito: aspettare la misura lascerebbe l'utente
    // davanti a una riga di testo per mezzo minuto.
    avanzamento.classList.remove('attivo');
    bottone.disabled = false;
    let tracce = '';
    if (err.indizi && Object.keys(err.indizi).length) {
      tracce = '<details style="margin-top:.8rem"><summary style="cursor:pointer;font-size:.85rem">' +
        'Dettagli tecnici del rifiuto</summary><div class="dove" style="margin-top:.5rem">' +
        Object.entries(err.indizi).map(([k, v]) => T(k) + ': ' + T(v)).join('<br>') +
        (err.assaggio ? '<br><br>' + T(err.assaggio) : '') + '</div></details>';
    }
    zonaErrore.innerHTML = '<div class="errore">' + spiegazione +
      '<br><br>Se il sito è tuo puoi togliere quel blocco per il tempo dell\'analisi, oppure ' +
      'l\u2019analisi va rifatta a mano. ' +
      'La velocità, intanto, è misurata qui sotto.' + tracce + '</div>';

    if (vietato) return;

    // La velocità però si può misurare lo stesso: la rileva Google con i propri
    // sistemi, che i firewall raramente bloccano. Ci mette qualche decina di
    // secondi, quindi si mostra l'attesa e si aggiunge il risultato quando arriva.
    esito.innerHTML = '<h2>Quello che si può misurare lo stesso</h2>' +
      '<div class="grigio" id="attesaVelocita">Il codice non è accessibile, ma sto chiedendo a Google di ' +
      'misurare la velocità della home. Ci vogliono dai venti ai quaranta secondi: puoi lasciare la ' +
      'pagina aperta.</div>';
    esito.classList.add('attivo');

    let ripiego = null;
    try {
      const r = await fetch('/api/lighthouse?url=' + encodeURIComponent(indirizzo + '/'));
      ripiego = JSON.parse(await r.text());
    } catch (e) { /* niente da fare */ }

    if (ripiego && ripiego.disponibile) {
      esito.innerHTML = resaLighthouse(ripiego, indirizzo);
    } else {
      const attesa = document.getElementById('attesaVelocita');
      if (attesa) attesa.textContent = 'Non è stato possibile misurare nemmeno la velocità: ' +
        ((ripiego && ripiego.motivo) || 'Google non ha risposto in tempo') + '.';
    }
    return;
  }

  const pagine = (scoperta.pagine && scoperta.pagine.length) ? scoperta.pagine : [scoperta.sito + '/'];

  // La misura Lighthouse parte subito e viaggia in parallelo: è la più lenta.
  const misura = fetch('/api/lighthouse?url=' + encodeURIComponent(scoperta.sito + '/'))
    .then(r => r.text()).then(t => JSON.parse(t))
    .catch(() => ({ disponibile: false, motivo: 'Misura delle prestazioni non riuscita.' }));

  const risultati = [];
  let fatte = 0;
  const coda = pagine.slice();
  async function operaio() {
    while (coda.length) {
      const u = coda.shift();
      try {
        const grezzo = await (await fetch('/api/pagina?url=' + encodeURIComponent(u))).text();
        risultati.push(JSON.parse(grezzo));
      } catch { risultati.push({ url: u, errore: 'Pagina non analizzabile' }); }
      avanza(++fatte, pagine.length + 1, 'Lette ' + fatte + ' pagine su ' + pagine.length);
    }
  }
  await Promise.all([operaio(), operaio(), operaio(), operaio()]);

  avanza(pagine.length, pagine.length + 1,
    'Pagine lette. Aspetto la misura di velocità da Google (venti-quaranta secondi)…');
  const lighthouse = await misura;

  avanzamento.classList.remove('attivo');
  bottone.disabled = false;
  disegna(scoperta, risultati, lighthouse);
  esito.classList.add('attivo');
  esito.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function disegna(scoperta, risultati, lighthouse) {
  const buone = risultati.filter(r => !r.errore);
  const rotte = risultati.filter(r => r.errore);
  if (!buone.length) {
    zonaErrore.innerHTML = '<div class="errore"><b>Nessuna pagina leggibile.</b> Il sito potrebbe bloccare i ' +
      'programmi automatici, oppure costruire i contenuti con JavaScript. Scrivimi e lo guardo a mano.</div>';
    return;
  }

  const crawler = scoperta.robots.crawler || [];
  const primari = crawler.filter(c => c.livello === 1);
  const secondari = crawler.filter(c => c.livello === 2);
  const valori = k => Array.from(new Set(buone.map(p => p.contatti && p.contatti[k]).filter(Boolean)));

  // controlli che si vedono solo confrontando le pagine fra loro
  const conta = (lista) => { const c = {}; for (const x of lista) if (x) c[x] = (c[x] || 0) + 1; return c; };
  // Una pagina italiana e la sua traduzione inglese possono avere lo stesso
  // titolo — "Privacy Policy" si scrive uguale — senza che sia un errore: sono
  // collegate da hreflang e i motori le trattano come versioni, non come copie.
  // Il confronto si fa quindi dentro ogni lingua, non fra lingue diverse.
  const perLingua = {};
  for (const q of buone) {
    const l = q.lang || '?';
    (perLingua[l] = perLingua[l] || []).push(q);
  }
  let titoliDoppi = 0, descrDoppie = 0;
  for (const gruppo of Object.values(perLingua)) {
    titoliDoppi += Object.values(conta(gruppo.map(x => x.titolo))).filter(n => n > 1).length;
    descrDoppie += Object.values(conta(gruppo.map(x => x.descrizione))).filter(n => n > 1).length;
  }
  const canonicalFuori = buone.filter(p => {
    if (!p.canonical) return false;
    try { return new URL(p.canonical).pathname.replace(/\/$/, '') !== new URL(p.url).pathname.replace(/\/$/, ''); }
    catch { return false; }
  }).length;

  // Pagine istituzionali: si riconoscono dall'indirizzo, in italiano e non solo.
  const indirizzi = (scoperta.pagine || []).concat(buone.map(p => p.url)).join(' ').toLowerCase();
  const hoPagina = (...parole) => parole.some(x => indirizzi.includes(x));
  const privacy = hoPagina('privacy', 'informativa', 'datenschutz');
  const legale = hoPagina('note-legali', 'legal', 'impressum', 'termini', 'condizioni', 'cookie');
  const contatti = hoPagina('contatt', 'contact', 'kontakt', 'preventivo');

  const perPagina = {};
  for (const k of Object.keys(buone[0].flag || {})) {
    const n = buone.filter(p => p.flag && p.flag[k]).length;
    perPagina[k] = { quota: n / buone.length, n, tot: buone.length };
  }

  const lh = lighthouse && lighthouse.disponibile ? lighthouse : null;
  const cat = id => lh && (lh.categorie.find(c => c.id === id) || null);
  const daCategoria = id => { const c = cat(id); return c ? { quota: c.punteggio / 100, valore: c.punteggio + '/100' } : null; };

  const esiti = Object.assign({}, perPagina, {
    botPrimari: { quota: primari.length ? primari.filter(c => c.ammesso).length / primari.length : 1 },
    botSecondari: { quota: secondari.length ? secondari.filter(c => c.ammesso).length / secondari.length : 1 },
    sitemap: { quota: scoperta.sitemapTrovate ? 1 : 0 },
    llms: { quota: scoperta.llmsPresente ? 1 : 0 },
    nap: { quota: ['via', 'cap', 'coordinate', 'telefono'].every(k => valori(k).length <= 1) ? 1 : 0 },
    paginePolicy: { quota: (privacy ? 0.5 : 0) + (legale ? 0.5 : 0) },
    paginaContatti: { quota: contatti ? 1 : 0 },
    titoliUnici: { quota: (titoliDoppi + descrDoppie) === 0 ? 1 : Math.max(0, 1 - (titoliDoppi + descrDoppie) / buone.length) },
    canonicalCoerente: { quota: 1 - canonicalFuori / buone.length },
    quattroZeroQuattro: { quota: scoperta.quattroZeroQuattro === 404 ? 1 : scoperta.quattroZeroQuattro == null ? null : 0 },
    lhPerformance: daCategoria('performance'),
    lhAccessibility: daCategoria('accessibility'),
    lhBestPractices: daCategoria('best-practices'),
    lhSeo: daCategoria('seo'),
  });

  // ---- punteggio
  let totale = 0, massimo = 0;
  for (const g of CONTROLLI) {
    g._punti = 0; g._max = 0;
    for (const v of g.voci) {
      const e = esiti[v.id];
      if (!e || e.quota == null) { v._stato = 'assente'; continue; }
      v._stato = 'misurato'; v._quota = e.quota; v._valore = e.valore || null;
      v._n = e.n; v._tot = e.tot;
      v._punti = Math.round(v.punti * e.quota);
      g._punti += v._punti; g._max += v.punti;
    }
    totale += g._punti; massimo += g._max;
  }
  const voto = massimo ? Math.round(totale / massimo * 100) : 0;

  // ---- segnalazioni
  const segnalazioni = [];
  for (const p of buone) for (const q of (p.problemi || [])) segnalazioni.push({ ...q, url: p.url });
  const agg = (categoria, gravita, messaggio) => segnalazioni.push({ categoria, gravita, messaggio, url: '' });
  for (const c of crawler.filter(c => !c.ammesso))
    agg('Motori IA', c.livello === 1 ? 'alto' : 'medio',
      c.nome + ' è escluso dal robots.txt: ' + c.chi + ' non può leggere il sito');
  if (!scoperta.sitemapTrovate) agg('Indicizzazione', 'alto', 'Nessuna sitemap trovata');
  if (!scoperta.llmsPresente) agg('Motori IA', 'basso', 'Manca il file llms.txt');
  if (!privacy) agg('E-E-A-T', 'alto', 'Nessuna pagina di privacy policy trovata: è un obbligo di legge e un segnale di affidabilità');
  if (!legale) agg('E-E-A-T', 'medio', 'Nessuna pagina di note legali o termini trovata');
  if (!contatti) agg('E-E-A-T', 'alto', 'Nessuna pagina di contatti trovata: chi valuta il sito non sa come raggiungerti');
  if (scoperta.quattroZeroQuattro != null && scoperta.quattroZeroQuattro !== 404)
    agg('Configurazione', 'alto', 'Un indirizzo inesistente risponde ' + scoperta.quattroZeroQuattro +
      ' invece di 404: i motori indicizzeranno pagine fantasma');
  if (scoperta.alternativo && !scoperta.alternativo.reindirizza && scoperta.alternativo.stato === 200)
    agg('Indicizzazione', 'alto', 'Il sito risponde sia con che senza www senza reindirizzare: ' +
      'per Google sono due siti gemelli che si fanno concorrenza');
  if (titoliDoppi) agg('Metadati', 'medio', titoliDoppi + ' titoli usati su più pagine');
  if (descrDoppie) agg('Metadati', 'basso', descrDoppie + ' descrizioni usate su più pagine');
  if (canonicalFuori) agg('Indicizzazione', 'alto', canonicalFuori + ' pagine hanno un canonical che punta altrove: ' +
    'stanno chiedendo a Google di ignorarle');
  for (const p of rotte) agg('Collegamenti', 'alto', 'Pagina in sitemap ma irraggiungibile: ' + p.errore);
  for (const k of ['via', 'cap', 'coordinate', 'telefono']) {
    const v = valori(k);
    if (v.length > 1) agg('Coerenza dei contatti', 'alto',
      'Il sito dichiara ' + v.length + ' valori diversi per ' + k + ' — ' + v.join('  ·  '));
  }

  const gravi = segnalazioni.filter(s => s.gravita === 'alto');
  const perse = [];
  for (const g of CONTROLLI) for (const v of g.voci)
    if (v._stato === 'misurato' && v._quota < 0.999) perse.push({ nome: difetto(v), persi: v.punti - v._punti, come: v.come, quota: v._quota });
  perse.sort((a, b) => b.persi - a.persi);
  const principali = perse.filter(x => x.persi > 0).slice(0, 3);

  // ---- con cosa è fatto il sito: serve subito, va in cima al report
  const contaTec = {};
  for (const q of buone) for (const t of (q.tecnologie || [])) {
    const chiave = t.nome + '|' + t.tipo;
    contaTec[chiave] = (contaTec[chiave] || 0) + 1;
  }
  // La piattaforma è una sola per tutto il sito e a volte lascia tracce su una
  // pagina soltanto — il tag generator, per esempio, spesso sta solo in home.
  // Per quelle categorie basta una pagina; per librerie e strumenti di terze
  // parti serve una presenza diffusa, altrimenti si scambia un'eccezione per
  // una scelta tecnologica.
  const SEMPRE = ['piattaforma', 'costruttore', 'negozio', 'server', 'rete'];
  const sogliaDiffusa = Math.max(2, Math.floor(buone.length * 0.2));
  const trovate = Object.entries(contaTec)
    .map(([k, n]) => { const [nome, tipo] = k.split('|'); return { nome, tipo, n }; })
    .filter(t => SEMPRE.includes(t.tipo) ? t.n >= 1 : t.n >= sogliaDiffusa)
    .sort((a, b) => b.n - a.n);

  const generatore = (buone.find(q => q.generatore) || {}).generatore;
  // Se il generatore è dichiarato ma nessuna firma lo conferma, vale comunque
  // come piattaforma: è il sito stesso a dirlo.
  if (generatore && !trovate.some(t => t.tipo === 'piattaforma')) {
    trovate.unshift({ nome: generatore.split(/[-–—(]/)[0].trim().replace(/!$/, ''), tipo: 'piattaforma', n: 1 });
  }

  // Frase in chiaro: piattaforma, con il costruttore di pagine se c'è.
  const piattaforma = trovate.find(t => t.tipo === 'piattaforma');
  const costruttore = trovate.find(t => t.tipo === 'costruttore');
  const negozio = trovate.find(t => t.tipo === 'negozio');
  let conCosa = '';
  if (piattaforma) {
    conCosa = piattaforma.nome;
    const aggiunte = [costruttore, negozio].filter(Boolean).map(x => x.nome);
    if (aggiunte.length === 1) conCosa += ', con ' + aggiunte[0];
    else if (aggiunte.length > 1) conCosa += ', con ' + aggiunte.slice(0, -1).join(', ') + ' e ' + aggiunte[aggiunte.length - 1];
  } else if (generatore) {
    // il tag generator è spesso prolisso: si tiene solo il nome
    conCosa = generatore.split(/[-–—(]/)[0].trim().replace(/!$/, '');
  }

  // ---- resa
  const p = [];
  const R = 50, C = 2 * Math.PI * R;
  const livVoto = livello(voto / 100 >= 0.999 ? 1 : voto / 100);
  const colore = { ok:'var(--verde)', nota:'var(--verde)', giallo:'var(--giallo)',
                   arancio:'var(--arancio)', rosso:'var(--rosso)', grigio:'#98a5a1' }[livVoto];
  const giudizio = voto >= 90 ? 'Il sito è in ottimo stato: quello che manca è rifinitura.'
    : voto >= 75 ? 'Buona base, con qualche punto da sistemare.'
    : voto >= 50 ? 'Ci sono problemi concreti che limitano quanto Google e i motori IA capiscono del sito.'
    : 'Il sito ha carenze tecniche importanti: gran parte di quello che pubblichi non arriva ai motori.';

  if (scoperta.ripiegoUA)
    p.push('<div class="grigio" style="margin-bottom:1rem">Questo sito ha rifiutato la prima richiesta. ' +
      'Il suo robots.txt però consente la scansione, quindi l\'analisi è stata completata presentandosi ' +
      'come un normale browser. È una scelta dichiarata, non un aggiramento: il robots.txt resta il ' +
      'criterio, e quando vieta la scansione lo strumento si ferma.</div>');

  p.push('<h2>Risultato</h2><div class="punteggio"><div class="quadrante">' +
    '<svg width="112" height="112" viewBox="0 0 112 112">' +
    '<circle cx="56" cy="56" r="' + R + '" fill="none" stroke="var(--linea)" stroke-width="9"/>' +
    '<circle cx="56" cy="56" r="' + R + '" fill="none" stroke="' + colore + '" stroke-width="9" ' +
    'stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - voto / 100)) + '"/>' +
    '<text x="56" y="56" text-anchor="middle" dominant-baseline="central" ' +
    'class="cifra-grande" fill="' + colore + '">' + voto + '</text>' +
    '</svg></div><div class="parole">' +
    '<div class="dominio">' + T(scoperta.sito) + ' · ' + buone.length + ' pagine lette' +
    (lh ? ' · velocità misurata su ' + T(lh.dispositivo) : '') + '</div>' +
    (conCosa ? '<p class="conCosa">Il sito è stato creato con <b>' + T(conCosa) + '</b></p>' : '') +
    '<p>' + T(giudizio) + '</p></div></div>');

  // Grafico e riquadri affiancati: la forma d'insieme a sinistra, i numeri a destra.
  const perGrafico = CONTROLLI.filter(g => g._max)
    .map(g => ({ gruppo: g.gruppo, presi: g._punti, totali: g._max }));

  p.push('<div class="testata-gruppi">');
  p.push('<div class="lato-grafico">' + ragnatela(perGrafico) + '</div>');
  p.push('<div class="gruppi">');
  for (const g of CONTROLLI) {
    if (!g._max) continue;
    const q = Math.round(g._punti / g._max * 100);
    const liv = livello(g._punti / g._max);
    // Un quadrante per gruppo invece di una barra: la stessa forma del
    // punteggio grande, ripetuta, si legge a colpo d'occhio e regge la stampa.
    const CIRC = 2 * Math.PI * 26;
    p.push('<a class="riquadro-gruppo" href="#' + ancora(g.gruppo) + '">' +
      // Il numero sta dentro l'SVG, non sovrapposto: così lo centra il disegno
      // e non può scivolare per via degli stili attorno.
      '<span class="quadrantino"><svg viewBox="0 0 64 64" width="64" height="64" role="img" ' +
      'aria-label="' + q + ' su 100">' +
      '<circle cx="32" cy="32" r="26" fill="none" stroke="var(--linea)" stroke-width="6"/>' +
      '<circle cx="32" cy="32" r="26" fill="none" class="arco liv-' + liv + '" stroke-width="6" ' +
      'stroke-linecap="round" stroke-dasharray="' + CIRC.toFixed(1) + '" ' +
      'stroke-dashoffset="' + (CIRC * (1 - q / 100)).toFixed(1) + '" ' +
      'transform="rotate(-90 32 32)"/>' +
      '<text x="32" y="32" text-anchor="middle" dominant-baseline="central" ' +
      'class="cifra liv-' + liv + '">' + q + '</text></svg></span>' +
      '<span class="nome-gruppo">' + T(g.gruppo) + '</span>' +
      '<span class="punti-gruppo">' + g._punti + '/' + g._max + ' punti</span></a>');
  }
  p.push('</div></div>');

  if (principali.length) {
    p.push('<h2>Le tre cose che pesano di più</h2>');
    for (const v of principali) {
      const liv = livello(v.quota);
      p.push('<div class="voce ' + (liv === 'rosso' ? 'alto' : liv === 'arancio' ? 'medio' : 'basso') + '">' +
        '<span class="cat liv-' + liv + '">' + segno(liv) + '−' + v.persi + ' punti</span> ' + T(v.nome) +
        '<div class="dove" style="font-family:inherit;font-size:.87rem;color:var(--grafite)">' +
        T(v.come) + '</div></div>');
    }
  }

  p.push('<h2>Tutti i controlli, uno per uno</h2>' +
    '<p class="nota" style="margin:-.5rem 0 .6rem">Apri una voce per leggere perché conta e come si sistema.</p>' +
    '<div class="legenda">' +
    '<span class="liv-ok">' + SEGNI.ok + 'superato ovunque</span>' +
    '<span class="liv-nota">' + SEGNI.nota + 'suggerimento</span>' +
    '<span class="liv-giallo">' + SEGNI.giallo + 'manca su poche pagine</span>' +
    '<span class="liv-arancio">' + SEGNI.arancio + 'manca su molte pagine</span>' +
    '<span class="liv-rosso">' + SEGNI.rosso + 'non superato</span>' +
    '<span class="liv-grigio">' + SEGNI.grigio + 'non misurato</span></div>');
  for (const g of CONTROLLI) {
    p.push('<h3 class="titolo-gruppo" id="' + ancora(g.gruppo) + '">' +
      cerchioGruppo(g._punti, g._max, g.gruppo) +
      '<span class="nome">' + T(g.gruppo) + '</span>' +
      '<span class="punti">' + g._punti + ' punti su ' + g._max + '</span></h3>');
    for (const v of g.voci) {
      const assente = v._stato === 'assente';
      const liv = assente ? 'grigio' : livello(v._quota);
      // Sotto la metà delle pagine l'affermazione sarebbe falsa: si usa la
      // forma negativa, così la riga dice quello che il colore già mostra.
      const nome = (!assente && v._quota < 0.5 && v.no) ? v.no : v.nome;
      let etichetta;
      if (assente) etichetta = 'non misurato';
      else if (v._valore) etichetta = v._valore;
      else if (v._quota >= 0.999) etichetta = 'superato';
      else if (v._quota <= 0.001) etichetta = 'non superato';
      else if (v._tot) {
        // Il numero che serve è sempre quello delle pagine da sistemare.
        // Il verbo cambia perché sotto la metà la riga è già in negativo.
        const daSistemare = v._tot - v._n;
        const parola = daSistemare === 1 ? ' pagina' : ' pagine';
        etichetta = (v._quota < 0.5 && v.no ? 'su ' : 'manca su ') + daSistemare + parola;
      }
      else etichetta = 'manca sul ' + Math.round((1 - v._quota) * 100) + '%';
      const punti = assente ? '—' : v._punti + ' / ' + v.punti;
      p.push('<details class="controllo liv-' + liv + '"><summary>' +
        '<span class="che"><span class="liv-' + liv + '">' + segno(liv) + '</span>' + T(nome) + '</span>' +
        '<span class="val">' + pill(liv, etichetta) +
        ' <span class="punti-voce">' + punti + '</span></span></summary>' +
        '<div class="spiega">' +
        (liv === 'nota' ? '<p class="rifinitura">Superato su ' + (v._tot ? v._n + ' pagine su ' + v._tot : 'quasi tutte le pagine') +
          '. Non è un problema, ma se vuoi chiudere il cerchio è qui che si interviene.</p>' : '') +
        difettoConcreto(v, buone) +
        dovManca(v, buone, scoperta.sito) +
        '<p><b>Come si sistema</b>' + T(v.come) + '</p>' +
        '<p><b>Perché conta</b>' + T(v.perche) + '</p>' +
        (v.fonte ? '<p class="fonte"><b>Fonte</b><a href="' + T(v.fonte.u) +
          '" target="_blank" rel="noopener nofollow">' + T(v.fonte.n) + '</a></p>' : '') +
        '</div></details>');
    }
  }

  // ---- Lighthouse
  p.push('<h2>Velocità misurata</h2>');
  if (!lh) {
    const motivo = (lighthouse && lighthouse.motivo) || 'Misura non disponibile.';
    p.push('<div class="grigio"><b>' + T(motivo) + '</b><br>' +
      "Il resto dell'analisi non ne risente: i dieci punti di questo gruppo sono esclusi dal totale, " +
      'non contati come zero.</div>');
  } else {
    // Gli stessi cerchi dei gruppi: il punteggio Lighthouse è già su cento.
    p.push('<div class="cerchi-velocita">');
    for (const c of lh.categorie)
      p.push('<div>' + cerchioGruppo(c.punteggio, 100, c.nome) +
        '<span>' + T(c.nome) + '</span></div>');
    p.push('</div>');
    p.push('<table><tr><th>Metrica</th><th style="text-align:right">Valore</th></tr>');
    for (const m of lh.metriche)
      p.push('<tr><td class="metrica"><span class="segno liv-' + livello(m.esito) + '">\u25CF</span>' +
        '<span><b>' + T(m.nome) + '</b><div class="dove" style="font-family:inherit;color:var(--grafite)">' +
        T(m.spiegazione) + '</div></span></td><td class="num">' +
        pill(livello(m.esito), m.valore) + '</td></tr>');
    p.push('</table>');
    if (lh.rallentamenti.length) {
      p.push('<h3>Cosa rallenta la pagina</h3>');
      for (const r of lh.rallentamenti)
        p.push('<div class="voce medio"><b>' + T(r.nome) + '</b> ' + T(r.quanto) +
          '<div class="dove" style="font-family:inherit;font-size:.86rem">' + T(r.rimedio) + '</div></div>');
    }
  }

  // ---- crawler
  p.push('<h2>Chi può leggere il sito</h2><div class="crawler">');
  for (const c of crawler)
    p.push('<div class="bot"><div><span class="nome">' + T(c.nome) + '</span>' +
      '<span class="chi">' + T(c.chi) + '</span></div><span class="esito-bot ' +
      (c.ammesso ? 'si">entra' : 'no">bloccato') + '</span></div>');
  p.push('</div>');

  // ---- schema
  const tipi = {};
  for (const q of buone) for (const t of (q.tipiSchema || [])) tipi[t] = (tipi[t] || 0) + 1;
  const elenco = Object.entries(tipi).sort((a, b) => b[1] - a[1]);
  p.push('<h2>Dati strutturati trovati</h2>');
  if (!elenco.length) p.push('<div class="errore">Nessun dato strutturato su nessuna pagina analizzata.</div>');
  else {
    p.push('<table><tr><th>Tipo</th><th style="text-align:right">Pagine</th></tr>');
    for (const [n, q] of elenco) p.push('<tr><td>' + T(n) + '</td><td class="num">' + q + '</td></tr>');
    p.push('</table>');
  }

  // ---- tabella completa delle tecnologie
  if (trovate.length) {
    const ORDINE = ['piattaforma', 'costruttore', 'negozio', 'server', 'rete',
                    'libreria', 'stili', 'misurazione', 'consensi', 'contatto'];
    const ETICHETTE = {
      piattaforma: 'Piattaforma', costruttore: 'Costruttore di pagine', negozio: 'Commercio elettronico',
      server: 'Server', rete: 'Rete di distribuzione', libreria: 'Librerie',
      stili: 'Fogli di stile e caratteri', misurazione: 'Misurazione', consensi: 'Gestione dei consensi',
      contatto: 'Contatto e prenotazioni',
    };
    p.push('<h2>Con cosa è fatto il sito</h2>');
    p.push('<p class="nota" style="margin:-.5rem 0 1rem">Riconoscimento per firme lasciate nel codice: ' +
      'è un\'indicazione attendibile ma non una certezza.' +
      (generatore ? ' Il sito dichiara di essere generato da <b>' + T(generatore) + '</b>.' : '') + '</p>');
    p.push('<table><tr><th>Categoria</th><th>Rilevato</th></tr>');
    for (const tipo of ORDINE) {
      const gruppo = trovate.filter(t => t.tipo === tipo);
      if (!gruppo.length) continue;
      p.push('<tr><td>' + T(ETICHETTE[tipo] || tipo) + '</td><td class="dato">' +
        gruppo.map(t => T(t.nome)).join(' · ') + '</td></tr>');
    }
    p.push('</table>');

    // Una nota utile invece di un elenco muto
    const php = trovate.find(t => /^PHP /.test(t.nome));
    const note = [];
    if (piattaforma && /WordPress|Joomla|Drupal|PrestaShop|Magento/.test(piattaforma.nome))
      note.push('Una piattaforma con database e plugin richiede aggiornamenti periodici e resta esposta ' +
        'alle vulnerabilità dei componenti che monta.');
    if (php) note.push('Il server dichiara pubblicamente la versione di ' + T(php.nome) +
      ': è un\'informazione che conviene nascondere, e se la versione non è più supportata va aggiornata.');
    const misure = trovate.filter(t => t.tipo === 'misurazione').length;
    const consensi = trovate.filter(t => t.tipo === 'consensi').length;
    if (misure && !consensi) note.push('Ci sono ' + misure + ' strumenti di misurazione ma nessun sistema ' +
      'di raccolta del consenso rilevato: in Europa i cookie di misurazione richiedono il consenso preventivo.');
    for (const n of note) p.push('<div class="voce basso">' + n + '</div>');
  }

  // ---- segnalazioni
  // ---- indirizzi dichiarati nella sitemap che non sono pagine
  const malformati = scoperta.malformati || [];
  if (malformati.length) {
    p.push('<h2>La sitemap dichiara indirizzi che non sono validi</h2>');
    p.push('<div class="voce alto"><b>' + malformati.length +
      (malformati.length === 1 ? ' voce non è un indirizzo valido' : ' voci non sono indirizzi validi') +
      '</b> \u2014 righe scritte male dentro il file: indirizzi relativi malformati, spazi non ' +
      'codificati, o testo finito dentro un tag loc. Un motore le scarta, ma il file resta ' +
      'segnalato come non conforme. Rigenera la sitemap dal plugin, o correggila se è scritta a mano.</div>');
    const righe = malformati.map(u =>
      '<span class="riga-dove"><code>' + T(u) + '</code></span>').join('');
    p.push(malformati.length <= 5
      ? '<div class="dove-manca"><b>Quali</b>' + righe + '</div>'
      : '<details class="dove-manca chiusa"><summary><b>Quali \u2014 ' + malformati.length +
        ' voci</b><span class="apri">mostra l\'elenco</span></summary>' + righe + '</details>');
  }

  if (!segnalazioni.length) p.push('<h2>Segnalazioni</h2><div class="pulito">' + SEGNI.ok +
    ' Nessun problema rilevato sulle pagine analizzate.</div>');
  else for (const [chiave, etichetta, colore] of GRAVITA) {
    const gruppo = segnalazioni.filter(s => s.gravita === chiave);
    if (!gruppo.length) continue;
    p.push('<h2><span class="liv-' + colore + '">' + segno(colore) + '</span> ' +
      etichetta + ' — ' + gruppo.length + '</h2>');
    const raggruppate = {};
    for (const s of gruppo) (raggruppate[s.categoria + '||' + s.messaggio] ||= []).push(s.url);
    for (const [k, indirizzi] of Object.entries(raggruppate)) {
      const [categoria, messaggio] = k.split('||');
      const validi = indirizzi.filter(Boolean);
      // Fino a cinque pagine si leggono in riga. Oltre, una tendina con
      // l'elenco completo: "e altre 137" non permette di sistemarne nessuna.
      let dove = '';
      if (validi.length && validi.length <= 5)
        dove = '<div class="dove">' + validi.map(u => T(percorso(u))).join('  ·  ') + '</div>';
      else if (validi.length)
        dove = '<details class="elenco-pagine"><summary>' + validi.length +
          ' pagine</summary><div class="dove">' +
          validi.map(u => '<span class="riga-dove">' + T(percorso(u)) + '</span>').join('') +
          '</div></details>';
      p.push('<div class="voce ' + chiave + '"><span class="cat">' + T(categoria) + '</span>' + T(messaggio) + dove + '</div>');
    }
  }

  // ---- contenuto pagina per pagina: cosa c'è scritto davvero
  // Un punteggio dice se una cosa manca. Questa sezione fa vedere com'è fatta,
  // che è l'unico modo per accorgersi di un titolo presente ma scritto male.
  p.push('<h2>Cosa c\'è scritto, pagina per pagina</h2>');
  p.push('<p class="nota" style="margin:-.5rem 0 1rem">Titoli, descrizioni, scaletta dei ' +
    'sottotitoli, dati strutturati e collegamenti in uscita di ogni pagina letta. ' +
    'Apri una voce per vederne il contenuto.</p>');

  const perLunghezza = (n, min, max) =>
    n === 0 ? 'rosso' : (n < min || n > max) ? 'giallo' : 'ok';

  // Tutte le pagine lette, ordinate per indirizzo: così le lingue restano
  // raggruppate e si ritrova la pagina che si sta cercando.
  const perContenuto = buone.slice().sort((a, b) => a.url.localeCompare(b.url));
  // Prime dieci schede visibili, il resto dietro una tendina: su un sito da
  // duecento pagine l'elenco intero stanca prima di essere utile.
  let contate = 0;
  for (const q of perContenuto) {
    if (contate === 10)
      p.push('<details class="altre-schede"><summary>Mostra le altre ' +
        (perContenuto.length - 10) + ' pagine</summary>');
    contate++;
    const percorso
 = q.url.replace(scoperta.sito, '') || '/';
    const tl = (q.titolo || '').length, dl = (q.descrizione || '').length;
    p.push('<details class="contenuto"><summary><span class="dove">' + T(percorso) + '</span>' +
      '<span class="pill liv-' + perLunghezza(tl, 30, 60) + '">title ' + tl + '</span>' +
      '<span class="pill liv-' + perLunghezza(dl, 70, 160) + '">descr ' + dl + '</span>' +
      '<span class="pill liv-' + (q.h1 === 1 ? 'ok' : 'rosso') + '">H1 ' + q.h1 + '</span>' +
      '</summary><div class="dentro">');

    p.push('<div class="campo"><b>Titolo per Google</b><span class="testo">' +
      (q.titolo ? T(q.titolo) : '<em>assente</em>') + '</span>' +
      '<span class="misura">' + tl + ' caratteri' +
      (tl > 60 ? ' \u2014 oltre i 60, viene troncato nei risultati' :
       (tl && tl < 30) ? ' \u2014 sotto i 30, spreca spazio utile' : '') + '</span></div>');

    p.push('<div class="campo"><b>Descrizione</b><span class="testo">' +
      (q.descrizione ? T(q.descrizione) : '<em>assente</em>') + '</span>' +
      '<span class="misura">' + dl + ' caratteri' +
      (dl > 160 ? ' \u2014 oltre i 160, viene troncata' :
       (dl && dl < 70) ? ' \u2014 sotto i 70, poco informativa' : '') + '</span></div>');

    if (q.og && (q.og.titolo || q.og.immagine)) {
      const diverso = q.og.titolo && q.titolo && q.og.titolo !== q.titolo;
      p.push('<div class="campo"><b>Come appare se condivisa</b><span class="testo">' +
        T(q.og.titolo || q.titolo || '') + '</span>' +
        (diverso ? '<span class="misura">diverso dal titolo per Google: pu\u00f2 essere voluto, ' +
          'ma verifica che lo sia</span>' : '') +
        (q.og.immagine ? '<span class="misura mono">' + T(q.og.immagine) + '</span>' : '') +
        '</div>');
    }

    if (q.meta) {
      const m = q.meta;
      const righe = [
        ['charset', m.charset, 'la codifica dei caratteri: senza, gli accenti escono sbagliati'],
        ['lang', m.lang, 'la lingua dichiarata della pagina'],
        ['canonical', m.canonical, 'l\'indirizzo che la pagina indica come proprio'],
        ['robots', m.robots || 'non dichiarato', m.robots && /noindex/i.test(m.robots)
          ? 'questa pagina chiede di NON essere indicizzata' : 'senza direttiva vale index, follow'],
        ['viewport', m.viewport, 'come la pagina si adatta allo schermo del telefono'],
        ['og:type', m.ogTipo, 'che tipo di contenuto dichiara di essere quando viene condivisa'],
        ['og:locale', m.ogLingua, null],
        ['og:site_name', m.ogSito, null],
        ['twitter:card', m.twitter, 'il formato dell\'anteprima su X e su altri servizi'],
        ['author', m.autore, null],
        ['theme-color', m.tema, 'il colore della barra del browser su telefono'],
        ['hreflang', (m.lingue && m.lingue.length) ? m.lingue.join(', ') : null,
          'le altre lingue collegate a questa pagina'],
        ['favicon', m.favicon ? 'dichiarata' : null, 'l\'icona che compare nei risultati di Google'],
      ].filter(r => r[1]);

      p.push('<div class="campo"><b>Meta tag</b><table class="meta">');
      for (const [nome, valore, spiega] of righe)
        p.push('<tr><td class="chiave">' + T(nome) + '</td><td class="valore">' + T(valore) +
          (spiega ? '<span class="spiegam">' + T(spiega) + '</span>' : '') + '</td></tr>');
      p.push('</table></div>');
    }

    if (q.scaletta && q.scaletta.length) {
      p.push('<div class="campo"><b>Scaletta dei titoli</b><div class="scaletta">');
      let precedente = 0;
      for (const t of q.scaletta) {
        const salta = precedente && t.l > precedente + 1;
        p.push('<div class="riga-h' + (salta ? ' salto' : '') + '" style="padding-left:' +
          ((t.l - 1) * 14) + 'px"><span class="liv">H' + t.l + '</span>' + T(t.t) +
          (salta ? '<span class="avviso">salta un livello</span>' : '') + '</div>');
        precedente = t.l;
      }
      p.push('</div></div>');
    }

    if (q.tipiSchema && q.tipiSchema.length)
      p.push('<div class="campo"><b>Dati strutturati</b><span class="testo mono">' +
        q.tipiSchema.map(T).join(' \u00b7 ') + '</span>' +
        '<span class="misura">' + q.blocchiJsonLd + ' blocchi JSON-LD' +
        (q.jsonLdInvalidi ? ', di cui ' + q.jsonLdInvalidi + ' non validi' : ', tutti validi') +
        '</span></div>');

    p.push('<div class="campo"><b>Collegamenti in uscita</b>' +
      (q.domini && q.domini.length
        ? '<span class="testo mono">' + q.domini.map(T).join(' \u00b7 ') + '</span>'
        : '<span class="testo"><em>nessuno: la pagina non rimanda a nulla fuori dal sito</em></span>') +
      '<span class="misura">' + q.linkInterni + ' collegamenti interni, ' +
      q.linkEsterni + ' esterni</span></div>');

    p.push('</div></details>');
  }
  if (perContenuto.length > 10) p.push('</details>');

  // ---- pagina per pagina
  // Su un sito curato quasi tutte le righe segnano il punteggio pieno, e
  // scorrerne centoquaranta per trovarne tredici è tempo perso. Quindi prima
  // le pagine che hanno qualcosa da sistemare, con scritto *quale* controllo
  // manca; la tabella completa resta sotto, in una tendina, per chi la vuole.
  const nomeControllo = {};
  // Il nome puro del controllo: difetto() aggiungerebbe "— N pagine", che in
  // una riga riferita a una sola pagina non ha senso.
  for (const g of CONTROLLI) for (const v of g.voci) nomeControllo[v.id] = v.no || v.nome;

  const conProblemi = buone
    .map(q => ({ q, mancanti: Object.keys(q.flag || {}).filter(k => q.flag[k] === false) }))
    .filter(x => x.mancanti.length)
    .sort((a, b) => b.mancanti.length - a.mancanti.length);

  p.push('<h2>Pagine da sistemare</h2>');

  if (!conProblemi.length) {
    p.push('<p class="tutto-a-posto">Nessuna: tutte le ' + buone.length +
      ' pagine lette passano ogni controllo applicabile.</p>');
  } else {
    p.push('<p class="nota" style="margin:-.5rem 0 1rem">' + conProblemi.length +
      (conProblemi.length === 1 ? ' pagina su ' : ' pagine su ') + buone.length +
      ' hanno almeno un controllo non superato. Le altre non compaiono qui.</p>');
    p.push('<table class="da-sistemare"><tr><th>Pagina</th><th>Cosa manca</th>' +
      '<th style="text-align:right">Controlli</th></tr>');
    for (const { q, mancanti } of conProblemi) {
      const tot = Object.keys(q.flag || {}).length;
      const ok = tot - mancanti.length;
      p.push('<tr><td class="percorso"><a href="' + T(q.url) + '" target="_blank" rel="noopener">' +
        T(percorso(q.url)) + '</a></td>' +
        '<td class="manca">' + mancanti.map(k => '<span>' + T(nomeControllo[k] || k) + '</span>').join('') + '</td>' +
        '<td class="num liv-' + livello(ok / tot) + '" style="font-weight:700">' + ok + '/' + tot + '</td></tr>');
    }
    p.push('</table>');
  }

  // La tabella completa: sopra le dieci righe entra in una tendina chiusa.
  const tanteRighe = buone.length > 10;
  if (tanteRighe)
    p.push('<details class="tabella-lunga"><summary><b>Tutte le pagine</b>' +
      '<span>' + buone.length + ' pagine analizzate</span></summary>');
  else
    p.push('<h2>Tutte le pagine</h2>');
  p.push('<table><tr><th>Pagina</th>' +
    '<th style="text-align:right">Parole</th><th style="text-align:right">Schema</th>' +
    '<th style="text-align:right">Link</th><th style="text-align:right">Controlli</th></tr>');
  const ordinate = buone.slice().sort((a, b) =>
    Object.values(a.flag || {}).filter(Boolean).length - Object.values(b.flag || {}).filter(Boolean).length);
  for (const q of ordinate) {
    const tot = Object.keys(q.flag || {}).length;
    const ok = Object.values(q.flag || {}).filter(Boolean).length;
    p.push('<tr><td class="percorso">' + T(percorso(q.url)) + '</td>' +
      '<td class="num">' + (q.parole || 0) + '</td><td class="num">' + (q.blocchiJsonLd || 0) + '</td>' +
      '<td class="num">' + (q.linkInterni || 0) + '</td>' +
      '<td class="num liv-' + livello(ok / tot) + '" style="font-weight:700">' + ok + '/' + tot + '</td></tr>');
  }
  p.push('</table>');
  p.push('<p class="nota">In cima le pagine con più controlli non superati.</p>');
  if (tanteRighe) p.push('</details>');

  // ---- chiusura
  // Qui stava il blocco commerciale di Punto Web Ferrara: presentazione,
  // richiesta di preventivo e listino. Su questo sito non ha senso — è la
  // ragione per cui i due progetti sono separati. Il segnaposto qui sotto va
  // sostituito con quello che Sottosopra vuole dire alla fine di un report.
  const c = ['<div class="chiusura"><h2>' + (gravi.length ? 'Da dove partirei' : 'Il sito \u00e8 gi\u00e0 messo bene') + '</h2>'];
  if (principali.length) {
    c.push('<p>In ordine di peso, i punti che rendono di pi\u00f9 se corretti:</p><ol>');
    for (const v of principali) c.push('<li>' + T(v.nome) + '</li>');
    c.push('</ol>');
  }
  c.push('<p>Ogni voce del report spiega come si sistema, con la fonte ufficiale accanto. ' +
    'Nessun dato di questa analisi viene conservato: chiudendo la pagina sparisce.</p>');
  c.push('<div class="azioni"><a class="vuoto" href="#" id="stampa">Salva questo report in PDF</a></div></div>');

  esito.innerHTML = p.join('') + c.join('');
  const bottoneStampa = document.getElementById('stampa');
  if (bottoneStampa) bottoneStampa.addEventListener('click', ev => {
    ev.preventDefault();
    document.querySelectorAll('.controllo').forEach(d => { if (!d.open) d.dataset.chiuso = '1'; d.open = true; });
    window.print();
    document.querySelectorAll('.controllo[data-chiuso]').forEach(d => { d.open = false; delete d.dataset.chiuso; });
  });
}
