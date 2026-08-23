// Prove del motore robots.txt. Nessuna libreria: si esegue con
//
//     node prove/robots.mjs
//
// Ogni prova nasce da un caso che il motore sbagliava davvero. Quando aggiungi
// un controllo, aggiungi prima la prova che fallisce: è l'unico modo per sapere
// che il controllo serve a qualcosa.

import { leggiRobots, permesso, giudizio, percorsiLimitati, conteggio } from '../src/lib/robots.js';

let passate = 0;
let fallite = 0;

function prova(nome, atteso, ottenuto) {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (ok) { passate++; console.log('  ok   ' + nome); }
  else {
    fallite++;
    console.log('  NO   ' + nome);
    console.log('       atteso:  ' + JSON.stringify(atteso));
    console.log('       ottenuto: ' + JSON.stringify(ottenuto));
  }
}

console.log('\nLettura del file');

prova('un file con la sola Sitemap è valido',
  false,
  giudizio(leggiRobots('Sitemap: https://esempio.it/sitemap.xml'))
    .some(r => r.che.includes('nessuna direttiva valida')));

prova('un file vuoto non produce rilievi di sintassi',
  false,
  giudizio(leggiRobots('')).some(r => r.che.includes('nessuna direttiva valida')));

prova('riga senza due punti segnalata',
  true,
  leggiRobots('User-agent: *\nDisallow /admin').problemi.some(p => p.riga === 2));

prova('sitemap relativa segnalata',
  true,
  leggiRobots('Sitemap: /sitemap.xml').problemi.some(p => p.gravita === 'alto'));

console.log('\nScelta del blocco');

const soloGooglebot = leggiRobots('User-agent: Googlebot\nDisallow: /');

prova('Googlebot bloccato', false, permesso(soloGooglebot, 'Googlebot').ammesso);
prova('Googlebot-Image eredita il blocco di Googlebot',
  false, permesso(soloGooglebot, 'Googlebot-Image').ammesso);
prova('Bingbot non è toccato', true, permesso(soloGooglebot, 'Bingbot').ammesso);

const misto = leggiRobots(
  'User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /\n');

prova('il blocco specifico batte quello generico',
  true, permesso(misto, 'Googlebot').ammesso);
prova('gli altri restano sotto il generico',
  false, permesso(misto, 'GPTBot').ammesso);
prova('e viene segnalato come generico',
  true, permesso(misto, 'GPTBot').generico);

const dueAgenti = leggiRobots('User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /');
prova('due User-agent di fila valgono per lo stesso blocco',
  [false, false],
  [permesso(dueAgenti, 'GPTBot').ammesso, permesso(dueAgenti, 'ClaudeBot').ammesso]);

console.log('\nCorrispondenza dei percorsi');

const jolly = leggiRobots('User-agent: *\nDisallow: /*.pdf$');
prova('l\u2019asterisco in mezzo funziona',
  false, permesso(jolly, 'GPTBot', '/documenti/listino.pdf').ammesso);
prova('il dollaro ancora alla fine',
  true, permesso(jolly, 'GPTBot', '/listino.pdf.html').ammesso);
prova('le altre pagine restano ammesse',
  true, permesso(jolly, 'GPTBot', '/chi-siamo/').ammesso);

const piuLungo = leggiRobots('User-agent: *\nDisallow: /area\nAllow: /area/pubblica');
prova('vince il percorso più lungo, non il primo',
  true, permesso(piuLungo, 'GPTBot', '/area/pubblica/doc').ammesso);
prova('e il divieto resta dove non è scavalcato',
  false, permesso(piuLungo, 'GPTBot', '/area/riservata').ammesso);

const pari = leggiRobots('User-agent: *\nDisallow: /doc\nAllow: /doc');
prova('a parità di lunghezza vince Allow',
  true, permesso(pari, 'GPTBot', '/doc').ammesso);

const vuoto = leggiRobots('User-agent: *\nDisallow:');
prova('Disallow senza valore non vieta niente',
  true, permesso(vuoto, 'GPTBot', '/qualsiasi').ammesso);

console.log('\nGiudizio');

prova('Googlebot bloccato produce un rilievo critico',
  true, giudizio(soloGooglebot).some(r => r.gravita === 'critico'));

prova('mancanza di sitemap segnalata',
  true, giudizio(leggiRobots('User-agent: *\nDisallow:'))
    .some(r => r.che.includes('sitemap')));

console.log('\nRegole per percorso');

const limiti = leggiRobots(
  'User-agent: *\nDisallow: /\nDisallow: /area/\nAllow: /area/pubblica\nDisallow: /*.pdf$');

prova('il divieto sull\u2019intero sito non finisce fra i percorsi',
  false, percorsiLimitati(limiti).some(r => r.percorso === '/'));

prova('gli altri tre ci sono',
  3, percorsiLimitati(limiti).length);

prova('le regole con jolly sono marcate',
  1, percorsiLimitati(limiti).filter(r => r.jolly).length);

prova('la riga viene conservata',
  true, percorsiLimitati(limiti).every(r => r.riga > 0));

prova('Disallow vuoto non produce un limite',
  0, percorsiLimitati(leggiRobots('User-agent: *\nDisallow:')).length);

prova('un rilievo avvisa dei percorsi limitati',
  true, giudizio(limiti).some(r => r.che.includes('percorsi specifici')));

console.log('\nConteggio');

prova('senza regole entrano tutti',
  true, conteggio(leggiRobots('User-agent: *\nDisallow:')).fuori === 0);

prova('con Disallow generale non entra nessuno',
  true, conteggio(leggiRobots('User-agent: *\nDisallow: /')).dentro === 0);

console.log('\n' + passate + ' passate, ' + fallite + ' fallite\n');
process.exit(fallite ? 1 : 0);
