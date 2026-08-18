/* utils.js — utilitats sense estat, compartides per totes les pàgines.
 * Exposa (globals): escHtml(s), fetchJson(url), debounce(fn, ms), slugify(s).
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
