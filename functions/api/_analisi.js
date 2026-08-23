// _analisi.js — analisi di una singola pagina.
// Nessuna dipendenza. Espressioni regolari volutamente semplici: il piano
// gratuito di Cloudflare concede 10 millisecondi di CPU per invocazione.

const RE_SCRIPT = /<script[\s\S]*?<\/script>/gi;
const RE_STYLE = /<style[\s\S]*?<\/style>/gi;
const RE_LD = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const RE_TITLE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const RE_TAG = /<[^>]+>/g;

function meta(html, nome) {
  const a = html.match(new RegExp('<meta[^>]+name=["\']' + nome + '["\'][^>]+content=["\']([^"\']*)["\']', 'i'));
  if (a) return a[1];
  const b = html.match(new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']' + nome + '["\']', 'i'));
  return b ? b[1] : null;
}
function prop(html, p) {
  const m = html.match(new RegExp('<meta[^>]+property=["\']' + p + '["\'][^>]+content=["\']([^"\']*)["\']', 'i'));
  return m ? m[1] : null;
}
function pulisci(s) {
  return s.replace(RE_TAG, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}
const attr = (tag, nome) => {
  const m = tag.match(new RegExp(nome + '\\s*=\\s*["\']([^"\']*)["\']', 'i'));
  return m ? m[1] : null;
};


// ---------------------------------------------------------------- tecnologie
// Riconoscimento per firme: tag generator, percorsi dei file, intestazioni.
// È un'euristica, non una certezza: si dichiarano solo le cose che lasciano
// tracce inequivocabili.
const FIRME = [
  // piattaforme
  ['WordPress', 'piattaforma', /wp-content\/|wp-includes\/|<link[^>]+wp-json|name=["']generator["'][^>]+WordPress/i],
  ['Joomla', 'piattaforma', /name=["']generator["'][^>]+Joomla|\/media\/jui\//i],
  ['Drupal', 'piattaforma', /name=["']generator["'][^>]+Drupal|drupal-settings-json|\/sites\/default\/files/i],
  ['PrestaShop', 'piattaforma', /prestashop|\/modules\/ps_/i],
  ['Magento', 'piattaforma', /Mage\.Cookies|\/static\/version\d+\/frontend\//i],
  ['Shopify', 'piattaforma', /cdn\.shopify\.com|Shopify\.theme/i],
  ['Wix', 'piattaforma', /static\.wixstatic\.com|wix-warmup-data/i],
  ['Squarespace', 'piattaforma', /squarespace\.com\/universal|static1\.squarespace\.com/i],
  ['Webflow', 'piattaforma', /assets\.website-files\.com|data-wf-page|assets-global\.website-files/i],
  ['Ghost', 'piattaforma', /name=["']generator["'][^>]+Ghost/i],
  ['Hugo', 'piattaforma', /name=["']generator["'][^>]+Hugo/i],
  ['Jekyll', 'piattaforma', /name=["']generator["'][^>]+Jekyll/i],
  ['Astro', 'piattaforma', /name=["']generator["'][^>]+Astro/i],
  ['Next.js', 'piattaforma', /__NEXT_DATA__|\/_next\/static/i],
  ['Nuxt', 'piattaforma', /__NUXT__|\/_nuxt\//i],
  ['Gatsby', 'piattaforma', /___gatsby|\/page-data\//i],
  ['GoDaddy Website Builder', 'piattaforma', /img1\.wsimg\.com|websitebuilder/i],
  ['Aruba WebSite Creator', 'piattaforma', /aruba\.it\/.*sitebuilder|websitecreator/i],

  // costruttori e temi WordPress
  ['Elementor', 'costruttore', /elementor-page|\/elementor\/assets\//i],
  ['Divi', 'costruttore', /et_pb_|\/themes\/Divi\//i],
  ['WPBakery', 'costruttore', /vc_row|js_composer/i],
  ['Beaver Builder', 'costruttore', /fl-builder/i],
  ['Gutenberg', 'costruttore', /wp-block-|\/wp-includes\/css\/dist\/block-library/i],
  ['WooCommerce', 'negozio', /woocommerce|wc-block/i],

  // librerie e stili
  ['jQuery', 'libreria', /jquery[.-][\d.]*(min\.)?js/i],
  ['React', 'libreria', /data-reactroot|_reactListening|react-dom/i],
  ['Vue', 'libreria', /data-v-[0-9a-f]{6,}|vue(\.runtime)?(\.min)?\.js/i],
  ['Angular', 'libreria', /ng-version=|angular(\.min)?\.js/i],
  ['Bootstrap', 'stili', /bootstrap[.-][\d.]*(min\.)?css|class=["'][^"']*\b(col-md-|navbar-expand)/i],
  ['Tailwind', 'stili', /tailwind|class=["'][^"']*\b(flex items-center|text-gray-\d00)/i],
  ['Font Awesome', 'stili', /font-?awesome/i],
  ['Google Fonts', 'stili', /fonts\.googleapis\.com|fonts\.gstatic\.com/i],

  // misurazione e marketing
  ['Google Analytics 4', 'misurazione', /gtag\/js\?id=G-|googletagmanager\.com\/gtag/i],
  ['Google Tag Manager', 'misurazione', /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{5,}/],
  ['Meta Pixel', 'misurazione', /connect\.facebook\.net\/[^"']*fbevents/i],
  ['Hotjar', 'misurazione', /static\.hotjar\.com/i],
  ['Microsoft Clarity', 'misurazione', /clarity\.ms/i],
  ['Matomo', 'misurazione', /matomo\.js|piwik\.js/i],

  // consensi
  ['Iubenda', 'consensi', /iubenda/i],
  ['Cookiebot', 'consensi', /consent\.cookiebot/i],
  ['CookieYes', 'consensi', /cookieyes|cky-/i],
  ['Complianz', 'consensi', /complianz/i],

  // chat e prenotazioni
  ['WhatsApp', 'contatto', /wa\.me\/|api\.whatsapp\.com/i],
  ['Tawk.to', 'contatto', /embed\.tawk\.to/i],
  ['Calendly', 'contatto', /calendly\.com/i],
];

const FIRME_INTESTAZIONI = [
  ['Cloudflare', 'rete', 'server', /cloudflare/i],
  ['Fastly', 'rete', 'server', /fastly/i],
  ['Akamai', 'rete', 'server', /akamai/i],
  ['Amazon CloudFront', 'rete', 'via', /cloudfront/i],
  ['Vercel', 'rete', 'server', /vercel/i],
  ['Netlify', 'rete', 'server', /netlify/i],
  ['GitHub Pages', 'rete', 'server', /github\.com/i],
  ['nginx', 'server', 'server', /nginx/i],
  ['Apache', 'server', 'server', /apache/i],
  ['LiteSpeed', 'server', 'server', /litespeed/i],
  ['Microsoft IIS', 'server', 'server', /iis/i],
];

export function analizzaPagina(html, url, intestazioni) {
  const H = intestazioni || {};
  const problemi = [];
  const segnala = (categoria, gravita, messaggio) => problemi.push({ categoria, gravita, messaggio });

  const corpo = html.replace(RE_SCRIPT, ' ').replace(RE_STYLE, ' ');
  const visibile = pulisci(corpo);
  const parole = visibile ? visibile.split(' ').length : 0;

  // ------------------------------------------------------------ titoli
  const titoli = [];
  const reH = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = reH.exec(corpo)) !== null) {
    titoli.push({ livello: Number(m[1]), testo: pulisci(m[2]) });
    if (titoli.length > 250) break;
  }
  const h1 = titoli.filter(t => t.livello === 1);
  if (!h1.length) segnala('Struttura', 'alto', 'Nessun H1: la pagina non dichiara il proprio argomento');
  else if (h1.length > 1) segnala('Struttura', 'alto', h1.length + ' tag H1 nella stessa pagina: deve essercene uno solo');
  if (h1.length === 1 && h1[0].testo.length > 70)
    segnala('Struttura', 'basso', 'H1 di ' + h1[0].testo.length + ' caratteri: troppo lungo per fare da titolo');

  let prec = 0, salta = false, primoSalto = null;
  for (const t of titoli) {
    if (prec && t.livello > prec + 1) {
      segnala('Struttura', 'medio', 'Salto di livello: H' + t.livello + ' dopo H' + prec +
        ' \u2014 "' + t.testo.slice(0, 45) + '"');
      salta = true;
      primoSalto = { livello: t.livello, dopo: prec, testo: t.testo };
      break;
    }
    prec = t.livello;
  }
  const haH2 = titoli.some(t => t.livello === 2);
  if (parole > 500 && !haH2) segnala('Struttura', 'medio', 'Contenuto lungo senza nessun H2: non c\u2019\u00e8 nulla da estrarre a blocchi');

  // ------------------------------------------------------------ metadati
  const mt = html.match(RE_TITLE);
  const titolo = mt ? pulisci(mt[1]) : '';
  if (!titolo) segnala('Metadati', 'alto', 'Title assente');
  else if (titolo.length > 60) segnala('Metadati', 'basso', 'Title di ' + titolo.length + ' caratteri: Google ne mostra circa 60');
  else if (titolo.length < 15) segnala('Metadati', 'medio', 'Title di ' + titolo.length + ' caratteri: troppo corto per dire di cosa parla la pagina');

  const descr = meta(html, 'description');
  if (!descr) segnala('Metadati', 'medio', 'Meta description assente: Google si inventa lo snippet');
  else if (descr.length > 165) segnala('Metadati', 'basso', 'Description di ' + descr.length + ' caratteri: viene troncata');
  else if (descr.length < 70) segnala('Metadati', 'basso', 'Description di ' + descr.length + ' caratteri: spazio sprecato');

  const og = !!(prop(html, 'og:title') && prop(html, 'og:image') && prop(html, 'og:description'));
  if (!og) segnala('Metadati', 'basso', 'Open Graph incompleto: le condivisioni escono senza anteprima');
  const twitter = !!(meta(html, 'twitter:card') || prop(html, 'og:image'));

  // ------------------------------------------------------------ indicizzazione
  const canonicalTag = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i);
  const canonicalUrl = canonicalTag ? attr(canonicalTag[0], 'href') : null;
  if (!canonicalTag) segnala('Indicizzazione', 'alto', 'Manca il link canonical: rischio di contenuti duplicati');

  const robots = (meta(html, 'robots') || '').toLowerCase();
  const noindex = /noindex/.test(robots);
  if (noindex) segnala('Indicizzazione', 'basso', 'Pagina esclusa dagli indici con noindex: se \u00e8 voluto va bene cos\u00ec');
  if (/nofollow/.test(robots)) segnala('Indicizzazione', 'medio', 'La pagina blocca il passaggio di autorit\u00e0 con nofollow');

  const hreflang = (html.match(/hreflang=["'][^"']+["']/gi) || []).length;
  const lang = (html.match(/<html[^>]+lang=["']([^"']+)["']/i) || [, null])[1];
  if (!lang) segnala('Indicizzazione', 'medio', 'Manca l\u2019attributo lang: i motori non sanno in che lingua \u00e8 scritta');

  const viewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  if (!viewport) segnala('Mobile', 'alto', 'Manca il meta viewport: su telefono la pagina esce rimpicciolita');
  const charset = /<meta[^>]+charset/i.test(html);

  // ------------------------------------------------------------ dati strutturati
  const tipi = [];
  let blocchi = 0, invalidi = 0;
  const contatti = { via: null, cap: null, coordinate: null, telefono: null };
  let entitaCompleta = null;
  const reLd = new RegExp(RE_LD.source, 'gi');
  while ((m = reLd.exec(html)) !== null) {
    blocchi++;
    let dato;
    try { dato = JSON.parse(m[1]); }
    catch (err) {
      invalidi++;
      segnala('Dati strutturati', 'alto', 'Blocco JSON-LD non valido, quindi ignorato: ' + String(err.message).slice(0, 70));
      continue;
    }
    const lista = Array.isArray(dato) ? dato : (dato['@graph'] || [dato]);
    for (const o of lista) {
      if (!o || typeof o !== 'object') continue;
      const t = o['@type'];
      const tt = Array.isArray(t) ? t : [t];
      for (const n of tt) if (n) tipi.push(String(n));
      const ind = o.address;
      if (ind && typeof ind === 'object') {
        if (ind.streetAddress) contatti.via = String(ind.streetAddress);
        if (ind.postalCode) contatti.cap = String(ind.postalCode);
      }
      if (o.geo && o.geo.latitude != null) contatti.coordinate = o.geo.latitude + ',' + o.geo.longitude;
      if (o.telephone) contatti.telefono = String(o.telephone).replace(/[^\d+]/g, '');
      if (tt.some(x => ['Organization', 'LocalBusiness', 'ProfessionalService', 'Store'].includes(x))) {
        const completa = !!(o.name && (o.telephone || o.email) && o.address && o.url);
        entitaCompleta = entitaCompleta === false ? false : completa;
        if (!completa) segnala('Dati strutturati', 'medio',
          'La scheda dell\u2019attivit\u00e0 \u00e8 incompleta: mancano nome, contatto, indirizzo o sito');
      }
    }
  }
  if (!blocchi) segnala('Dati strutturati', 'alto',
    'Nessun dato strutturato: i motori IA non hanno appigli per capire di chi \u00e8 il sito');
  if (tipi.filter(t => t === 'FAQPage').length > 1)
    segnala('Dati strutturati', 'alto', 'Due o pi\u00f9 blocchi FAQPage sulla stessa pagina: rischiano di essere ignorati entrambi');

  // Una domanda vale come FAQ solo se sotto c'è una risposta vera. I richiami
  // pubblicitari sono scritti col punto interrogativo ma seguiti da una riga e
  // un pulsante: contarli come domande produrrebbe uno schema falso.
  const domande = [];
  const reDomanda = /<h([23])[^>]*>([^<]*\?)<\/h\1>([\s\S]{0,1800}?)(?=<h[1-6][^>]*>|$)/gi;
  let d;
  while ((d = reDomanda.exec(corpo)) !== null) {
    const testoDomanda = pulisci(d[2]);
    if (testoDomanda.length <= 12) continue;
    if (/^(vuoi|hai bisogno|pronto|scopri|want|do you|ready|m\u00f6chten)/i.test(testoDomanda)) continue;
    const sotto = d[3] || '';
    // un blocco con un pulsante e poche righe è una chiamata all'azione
    if (/class=["'][^"']*\bbtn\b/i.test(sotto)) continue;
    if (pulisci(sotto).length < 100) continue;
    domande.push({ testo: testoDomanda });
    if (domande.length > 60) break;
  }
  if (domande.length >= 3 && !tipi.includes('FAQPage'))
    segnala('FAQ', 'medio', domande.length + ' domande nei titoli senza schema FAQPage: i motori non le riconoscono come domande');

  // ------------------------------------------------------------ immagini
  const immagini = corpo.match(/<img[^>]*>/gi) || [];
  let senzaAlt = 0, senzaMisure = 0, pesanti = 0, pigre = 0;
  for (const tag of immagini) {
    if (!/\salt\s*=/i.test(tag)) senzaAlt++;
    if (!(attr(tag, 'width') && attr(tag, 'height'))) senzaMisure++;
    const src = attr(tag, 'src') || '';
    if (/\.(jpe?g|png)(\?|$)/i.test(src)) pesanti++;
    if (/loading\s*=\s*["']lazy/i.test(tag)) pigre++;
  }
  if (senzaAlt) segnala('Immagini', 'medio', senzaAlt + ' immagini su ' + immagini.length +
    ' senza testo alternativo: invisibili a chi non vede e ai motori');
  if (senzaMisure > 2) segnala('Immagini', 'medio', senzaMisure + ' immagini senza width e height: la pagina "salta" mentre carica');
  if (pesanti > 2) segnala('Immagini', 'basso', pesanti + ' immagini in JPG o PNG: in AVIF o WebP peserebbero circa la met\u00e0');

  // ------------------------------------------------------------ codice e peso
  const scriptEsterni = (html.match(/<script[^>]+src=/gi) || []).length;
  const scriptBloccanti = (html.match(/<script(?![^>]*(?:async|defer))[^>]+src=/gi) || []).length;
  const cssEsterni = (html.match(/<link[^>]+rel=["']stylesheet["']/gi) || []).length;
  if (scriptBloccanti > 3) segnala('Prestazioni', 'medio',
    scriptBloccanti + ' script bloccano il disegno della pagina: basterebbe aggiungere defer');
  if (html.length > 250000) segnala('Prestazioni', 'medio',
    'Pagina da ' + Math.round(html.length / 1024) + ' KB di solo HTML: pesante da scaricare e da leggere');

  // ------------------------------------------------------------ contenuto e link
  if (parole < 150 && !noindex) segnala('Contenuto', 'medio',
    'Solo ' + parole + ' parole: troppo poco perch\u00e9 un motore IA possa citarla');

  const linkTag = corpo.match(/<a\s[^>]*href=["'][^"']+["'][^>]*>/gi) || [];
  let interni = 0, esterni = 0;
  let dominio = '';
  try { dominio = new URL(url).origin; } catch (e) {}
  for (const t of linkTag) {
    const href = attr(t, 'href') || '';
    if (/^https?:\/\//i.test(href)) { if (dominio && href.startsWith(dominio)) interni++; else esterni++; }
    else if (href.startsWith('/')) interni++;
  }
  if (interni < 3 && parole > 300) segnala('Collegamenti', 'basso',
    'Solo ' + interni + ' collegamenti verso altre pagine del sito: la pagina resta isolata');

  // ------------------------------------------------------------ intestazioni HTTP
  const conIntestazioni = Object.keys(H).length > 0;
  const h = k => String(H[k] || '').toLowerCase();
  const https = /^https:/i.test(url);
  const compresso = /gzip|br|zstd|deflate/.test(h('content-encoding'));
  const sicurezza = ['x-content-type-options', 'x-frame-options', 'referrer-policy', 'content-security-policy']
    .filter(k => h(k)).length;
  const hsts = !!h('strict-transport-security');
  if (!https) segnala('Sicurezza', 'alto', 'Pagina non servita in HTTPS: i browser la segnalano come non sicura');
  if (https && conIntestazioni && !hsts) segnala('Sicurezza', 'basso',
    'Manca HSTS: il primo accesso pu\u00f2 ancora passare in chiaro');
  if (conIntestazioni && sicurezza < 3) segnala('Sicurezza', 'medio',
    'Solo ' + sicurezza + ' intestazioni di sicurezza su 4');
  // Nota: la compressione non è verificabile da qui. Cloudflare decomprime la
  // risposta e rimuove l'intestazione content-encoding, quindi risulterebbe
  // sempre assente. Il controllo lo fa Lighthouse, che vede la pagina davvero.

  // ------------------------------------------------------------ segnali E-E-A-T
  // Non sono una misura di E-E-A-T: sono gli elementi verificabili che la
  // documentazione di Google associa a esperienza, competenza, autorevolezza
  // e affidabilità. Il giudizio resta umano, questi sono gli appigli.
  let autoreSchema = false, sameAs = 0, dataModifica = false, nomeAutore = '';
  const reLd2 = new RegExp(RE_LD.source, 'gi');
  let m2;
  while ((m2 = reLd2.exec(html)) !== null) {
    let dato;
    try { dato = JSON.parse(m2[1]); } catch (e) { continue; }
    const lista = Array.isArray(dato) ? dato : (dato['@graph'] || [dato]);
    for (const o of lista) {
      if (!o || typeof o !== 'object') continue;
      if (o.author) {
        autoreSchema = true;
        const a = Array.isArray(o.author) ? o.author[0] : o.author;
        if (a && a.name) nomeAutore = String(a.name);
      }
      const t2 = o['@type'];
      const tt2 = Array.isArray(t2) ? t2 : [t2];
      if (tt2.includes('Person') && o.name) { autoreSchema = true; nomeAutore = nomeAutore || String(o.name); }
      if (Array.isArray(o.sameAs)) sameAs = Math.max(sameAs, o.sameAs.length);
      if (o.dateModified || o.datePublished) dataModifica = true;
    }
  }

  const firmaVisibile = !!(nomeAutore && visibile.includes(nomeAutore))
    || /<time[^>]+datetime=/i.test(corpo)
    || /(aggiornato il|pubblicato il|ultimo aggiornamento|scritto da|di\s+[A-Z][a-z]+\s+[A-Z])/i.test(visibile.slice(0, 4000));

  // collegamenti in uscita verso fonti: segnale di contenuto documentato
  // Una citazione è un collegamento a una fonte esterna dentro il contenuto.
  // Non contano i profili social né i recapiti, e non conta il piè di pagina:
  // un link ripetuto su tutte le pagine è arredamento, non una fonte.
  const SOCIAL = /(facebook|instagram|youtube|twitter\.com|x\.com|linkedin|tiktok|pinterest|wa\.me|whatsapp|t\.me|maps\.app\.goo\.gl|google\.[a-z.]+\/maps|mailto:|tel:)/i;
  const contenuto = corpo
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ');
  let citazioni = 0, ancoreVaghe = 0;
  const domini = new Set();
  for (const t of (contenuto.match(/<a\s[^>]*href=["'][^"']+["'][^>]*>/gi) || [])) {
    const href = attr(t, 'href') || '';
    if (!/^https?:\/\//i.test(href)) continue;
    if (dominio && href.startsWith(dominio)) continue;
    if (SOCIAL.test(href)) continue;
    try { domini.add(new URL(href).hostname.replace(/^www\./, '')); } catch (e) {}
  }
  citazioni = domini.size;
  const VAGHE = /^(clicca qui|qui|leggi|leggi di pi\u00f9|scopri|scopri di pi\u00f9|continua|vai|link|read more|click here|more)$/i;
  for (const mm of (corpo.match(/<a\s[^>]*>([\s\S]{0,80}?)<\/a>/gi) || [])) {
    const testoAncora = pulisci(mm.replace(/<a[^>]*>/i, '').replace(/<\/a>/i, ''));
    if (testoAncora && VAGHE.test(testoAncora)) ancoreVaghe++;
  }
  if (ancoreVaghe > 2) segnala('Collegamenti', 'basso',
    ancoreVaghe + ' collegamenti con testo generico tipo "clicca qui": non dicono dove portano');

  // risorse in chiaro dentro una pagina sicura
  const misto = https ? (corpo.match(/(?:src|href)=["']http:\/\/[^"']+["']/gi) || []).length : 0;
  if (misto) segnala('Sicurezza', 'alto',
    misto + ' risorse caricate in HTTP dentro una pagina HTTPS: il browser le blocca o avvisa');

  const favicon = /<link[^>]+rel=["'][^"']*icon/i.test(html);

  // ------------------------------------------------------------ tecnologie
  const tecnologie = [];
  const campione = html.length > 400000 ? html.slice(0, 400000) : html;
  // Le firme si cercano nel codice, non nel testo: un articolo che parla di
  // WooCommerce non significa che il sito lo usi. Si tengono i tag e il
  // contenuto degli script, si butta la prosa.
  const perFirme = campione.length > 180000 ? campione.slice(0, 180000) : campione;
  const marcatura = perFirme.replace(/>[^<]*</g, '><');
  const dentroScript = (perFirme.match(/<script[^>]*>[\s\S]{0,800}?<\/script>/gi) || [])
    .slice(0, 20).join(' ');
  const tecnico = marcatura + ' ' + dentroScript;
  for (const [nome, tipo, prova] of FIRME) {
    if (prova.test(tecnico)) tecnologie.push({ nome, tipo });
    if (tecnologie.length > 40) break;
  }
  for (const [nome, tipo, intestazione, prova] of FIRME_INTESTAZIONI) {
    const v = String(H[intestazione] || '');
    if (v && prova.test(v)) tecnologie.push({ nome, tipo });
  }
  // la versione di PHP, quando il server la dichiara: è un dato di sicurezza
  const php = String(H['x-powered-by'] || '').match(/PHP\/([\d.]+)/i);
  if (php) tecnologie.push({ nome: 'PHP ' + php[1], tipo: 'server' });
  const generatore = (html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i) || [, null])[1];

  // Un sito in HTML scritto a mano si riconosce per assenza: nessun generatore
  // dichiarato, nessuna firma di piattaforma, pochi script. È una deduzione,
  // non una prova, e va detta come tale.
  const piattaformaNota = tecnologie.some(t => t.tipo === 'piattaforma');
  const staticoSemplice = !piattaformaNota && !generatore
    && scriptEsterni <= 3
    && !/wp-content|wp-includes|\/_next\/|__NUXT__|data-reactroot|ng-version/i.test(campione);

  // ------------------------------------------------------------ valori misurati
  // Il numero che ha fatto passare o fallire ciascun controllo su questa pagina.
  // Serve al rapporto per scrivere il difetto con i dati veri invece che con una
  // formula generica. Assente dove il controllo è binario per natura.
  const valori = {
    titleOk: titolo ? titolo.length + ' caratteri' : 'title assente',
    descrizioneOk: descr ? descr.length + ' caratteri' : 'description assente',
    h1unico: h1.length + (h1.length === 1 ? ' titolo principale' : ' titoli principali'),
    haH2: titoli.filter(t => t.livello === 2).length + ' sezioni H2',
    testoSufficiente: parole + ' parole',
    domandeCoperte: domande.length + (domande.length === 1 ? ' domanda nel testo' : ' domande nel testo'),
    collegata: interni + ' collegamenti interni',
    citazioni: citazioni + (citazioni === 1 ? ' fonte esterna citata' : ' fonti esterne citate'),
    ancoreDescrittive: ancoreVaghe + ' collegamenti con testo generico',
    immaginiConAlt: senzaAlt + ' immagini su ' + immagini.length + ' senza testo alternativo',
    immaginiConMisure: senzaMisure + ' immagini su ' + immagini.length + ' senza width e height',
    immaginiLeggere: pesanti + ' immagini su ' + immagini.length + ' in JPG o PNG',
    pesoPagina: Math.round(html.length / 1024) + ' KB',
    scriptNonBloccanti: scriptBloccanti + ' script che bloccano il disegno',
    jsonLd: blocchi + (blocchi === 1 ? ' blocco JSON-LD' : ' blocchi JSON-LD'),
    jsonLdValido: invalidi + ' blocchi non validi su ' + blocchi,
    canonical: canonicalUrl ? 'dichiarato' : 'assente',
    lang: lang ? 'lang="' + lang + '"' : 'non dichiarata',
    hreflangOk: hreflang + ' dichiarazioni hreflang',
    sameAs: sameAs + ' profili esterni dichiarati',
    contenutoSicuro: misto + ' risorse caricate in HTTP',
    titoliOrdinati: primoSalto
      ? 'H' + primoSalto.livello + ' dopo H' + primoSalto.dopo + ' \u2014 "' + primoSalto.testo.slice(0, 60) + '"'
      : 'nessun salto',
  };

  // ------------------------------------------------------------ esiti
  const flag = {
    firmaVisibile: firmaVisibile,
    autoreSchema: autoreSchema,
    dataModifica: dataModifica,
    sameAs: sameAs >= 2,
    // Si citano le fonti in una guida o in un articolo, non in una pagina
    // contatti né in un elenco: il controllo vale solo dove ci sono
    // affermazioni da sostenere.
    citazioni: citazioni >= 1 || parole < 400
      || !tipi.some(t => ['Article', 'BlogPosting', 'NewsArticle', 'FAQPage', 'QAPage', 'HowTo'].includes(t)),
    ancoreDescrittive: ancoreVaghe <= 2,
    contenutoSicuro: misto === 0,
    favicon: favicon,
    h1unico: h1.length === 1,
    titoliOrdinati: !salta,
    haH2: haH2 || parole < 300,
    testoSufficiente: parole >= 300 || noindex,
    domandeCoperte: !(domande.length >= 3 && !tipi.includes('FAQPage')),
    collegata: interni >= 3 || parole <= 300,
    titleOk: !!titolo && titolo.length >= 15 && titolo.length <= 60,
    descrizioneOk: !!descr && descr.length >= 70 && descr.length <= 165,
    openGraph: og,
    twitter: twitter,
    canonical: !!canonicalTag,
    lang: !!lang,
    hreflangOk: hreflang === 0 || hreflang >= 2,
    charset: charset,
    viewport: viewport,
    jsonLd: blocchi > 0,
    jsonLdValido: blocchi > 0 && invalidi === 0,
    schemaEntita: tipi.some(t => ['Organization', 'LocalBusiness', 'ProfessionalService', 'Person', 'Store'].includes(t)),
    entitaCompleta: entitaCompleta !== false,
    schemaSito: tipi.includes('WebSite'),
    schemaContenuto: tipi.some(t => [
      'Article', 'BlogPosting', 'NewsArticle', 'FAQPage', 'QAPage', 'HowTo',
      'Product', 'Recipe', 'Event', 'Service', 'JobPosting',
      'CollectionPage', 'ItemList', 'AboutPage', 'ContactPage', 'ProfilePage', 'WebPage',
    ].includes(t)),
    briciole: tipi.includes('BreadcrumbList'),
    immaginiConAlt: immagini.length === 0 || senzaAlt === 0,
    immaginiConMisure: immagini.length === 0 || senzaMisure <= 2,
    immaginiLeggere: immagini.length === 0 || pesanti <= 2,
    https: https,
    hsts: !conIntestazioni || hsts,
    intestazioniSicurezza: !conIntestazioni || sicurezza >= 3,
    scriptNonBloccanti: scriptBloccanti <= 3,
    pesoPagina: html.length <= 250000,
  };

  return {
    url, titolo, descrizione: descr || '', lang, parole, flag, problemi,
    h1: h1.length, titoliTotali: titoli.length, domande: domande.length,
    immagini: immagini.length, senzaAlt, senzaMisure, pigre,
    linkInterni: interni, linkEsterni: esterni,
    hreflang, canonical: canonicalUrl, noindex,
    blocchiJsonLd: blocchi, jsonLdInvalidi: invalidi,
    tipiSchema: Array.from(new Set(tipi)),
    scriptEsterni, scriptBloccanti, cssEsterni, peso: html.length,
    citazioni, ancoreVaghe, sameAs, nomeAutore, misto,
    // Materiale per il rapporto: non serve ai controlli, serve a far vedere
    // com'è fatta la pagina invece di limitarsi a promuoverla o bocciarla.
    scaletta: titoli.slice(0, 60).map(t => ({ l: t.livello, t: t.testo.slice(0, 110) })),
    domini: [...domini].slice(0, 30),
    og: {
      titolo: prop(html, 'og:title') || null,
      descrizione: prop(html, 'og:description') || null,
      immagine: prop(html, 'og:image') || null,
    },
    // I meta tag così come sono scritti: serve vederli, non solo sapere che ci sono.
    meta: {
      charset: (html.match(/<meta[^>]+charset=["']?([\w-]+)/i) || [, null])[1],
      lang: lang,
      viewport: meta(html, 'viewport') || null,
      robots: meta(html, 'robots') || null,
      canonical: (html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
        || html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i) || [, null])[1],
      autore: meta(html, 'author') || null,
      tema: meta(html, 'theme-color') || null,
      twitter: meta(html, 'twitter:card') || null,
      ogTipo: prop(html, 'og:type') || null,
      ogSito: prop(html, 'og:site_name') || null,
      ogLingua: prop(html, 'og:locale') || null,
      favicon: /<link[^>]+rel=["'][^"']*icon/i.test(html),
      lingue: (html.match(/<link[^>]+hreflang=["']([^"']+)["']/gi) || [])
        .map(t => (t.match(/hreflang=["']([^"']+)["']/i) || [, ''])[1]).slice(0, 12),
    },
    tecnologie, generatore, staticoSemplice, valori,
    intestazioniSicurezza: sicurezza, compresso, hsts,
    contatti,
  };
}
