/* utils.js — utilitats sense estat, compartides per totes les pàgines.
 * Exposa (globals): escHtml(s), fetchJson(url), debounce(fn, ms), slugify(s),
 * slashParts(s), codiMatches(a, b).
 * No depèn de cap altre fitxer. Ha de carregar-se abans que qualsevol altre script. */

/* Escapa text per inserir-lo de manera segura dins de HTML. */
function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* Llegeix i parseja un fitxer JSON. Retorna l'objecte parsejat.
 * Llança un Error explicatiu si la petició falla o el JSON és invàlid,
 * perquè qui truca pugui mostrar un estat d'error clar (vegeu <div class="state err">
 * a cada pàgina) en lloc de fallar en silenci. */
async function fetchJson(url) {
  let res;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch (err) {
    throw new Error(`No s'ha pogut contactar amb ${url}: ${err.message}`);
  }
  if (!res.ok) {
    throw new Error(`${url} ha respost ${res.status} ${res.statusText}`);
  }
  try {
    return await res.json();
  } catch (err) {
    throw new Error(`${url} no conté un JSON vàlid: ${err.message}`);
  }
}

/* Retarda l'execució de fn fins que passin ms sense noves crides. Útil per a cerques en viu. */
function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/* Converteix un text lliure en un identificador curt apte per a URL/DOM (sense accents,
 * minúscules, guions). Només es fa servir al mode edició quan cal generar un id nou
 * (p. ex. en afegir un tema); les dades font ja porten els seus ids. */
function slugify(s) {
  const from = 'àáäâèéëêìíïîòóöôùúüûçñ·\'’';
  const to   = 'aaaaeeeeiiiioooouuuucn';
  let out = String(s ?? '').toLowerCase().trim();
  for (let i = 0; i < from.length; i++) {
    out = out.replaceAll(from[i], to[i] ?? '');
  }
  return out.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/* ─── Codis curriculars combinats ─────────────────────────────────────
 * A data-sabers.json un saber pot portar un codi combinat quan cobreix dos
 * blocs alhora ("NUM.QU / NUM.RP", "ALG.MM / ALG.VA"), i llavors el camp bloc
 * també ve combinat i aparellat per posició ("Quantitat / Raonament
 * proporcional"). Els recursos, en canvi, sempre porten un codi únic: el del
 * PDF TOR d'on s'han extret. Per això la comparació saber↔recurs s'ha de fer
 * per conjunts de parts i no per igualtat de cadena — amb igualtat exacta,
 * un saber de codi combinat no s'enllaça mai amb cap recurs. */

/* Parteix un camp combinat ("A / B") en les seves parts, sense espais buits.
 * Serveix tant per a codi com per a bloc, que van aparellats. */
function slashParts(s) {
  return String(s ?? '').split('/').map(p => p.trim()).filter(Boolean);
}

/* Cert si dos camps codi comparteixen com a mínim una part.
 * codiMatches('NUM.QU / NUM.RP', 'NUM.RP') → true. */
function codiMatches(a, b) {
  const partsB = slashParts(b);
  return slashParts(a).some(p => partsB.includes(p));
}
