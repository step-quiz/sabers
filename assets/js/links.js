/* links.js — resolució de relacions Saber ↔ Tema del repartiment.
 * Mòdul pur: no toca el DOM, no té estat propi més enllà del que se li passa.
 * Depèn només de les dades carregades (REPARTIMENT.cursos, SABERS.sabers, LINKS.links).
 * Es fa servir des de repartiment-render.js i sabers-render.js per decorar cada
 * tema/saber amb els seus enllaços mutus.
 *
 * Format d'un "rid" (identificador de tema dins el repartiment):
 *   "<curs>__<sentit>__<temaId>"   p. ex. "2ESO__algebraic__equacio-de-1r-grau"
 */

/* Construeix un índex ràpid rid -> { curs, sentit, tema } a partir de REPARTIMENT.cursos. */
function buildTemaIndex(repartimentData) {
  const idx = {};
  for (const [curs, cdata] of Object.entries(repartimentData.cursos)) {
    for (const bloc of cdata.blocs) {
      for (const tema of bloc.temes) {
        const rid = `${curs}__${bloc.sentit}__${tema.id}`;
        idx[rid] = { rid, curs, sentit: bloc.sentit, tema };
      }
    }
  }
  return idx;
}

/* Construeix un índex ràpid saberId -> saber a partir de SABERS.sabers. */
function buildSaberIndex(sabersData) {
  const idx = {};
  for (const s of sabersData.sabers) idx[s.id] = s;
  return idx;
}

/* A partir de LINKS.links ({ saberId: [rid,...] }), construeix també la relació inversa
 * rid -> [saberId,...], perquè el repartiment pugui trobar els seus sabers sense recórrer
 * tota la llista cada vegada. Referències trencades (rid o saberId inexistents) s'ignoren
 * en silenci aquí: linksSanityCheck() és qui les reporta explícitament. */
function buildReverseLinks(linksData, temaIndex, saberIndex) {
  const bySaber = linksData.links || {};
  const byTema = {};
  for (const [saberId, rids] of Object.entries(bySaber)) {
    if (!saberIndex[saberId]) continue;
    for (const rid of rids) {
      if (!temaIndex[rid]) continue;
      (byTema[rid] = byTema[rid] || []).push(saberId);
    }
  }
  return { bySaber, byTema };
}

/* Sabers enllaçats a un tema concret (array de saber objects, buit si cap). */
function findSabersForTema(rid, linkIndex, saberIndex) {
  const ids = linkIndex.byTema[rid] || [];
  return ids.map(id => saberIndex[id]).filter(Boolean);
}

/* Temes enllaçats a un saber concret (array de { rid, curs, sentit, tema }, buit si cap). */
function findTemesForSaber(saberId, linkIndex, temaIndex) {
  const rids = linkIndex.bySaber[saberId] || [];
  return rids.map(rid => temaIndex[rid]).filter(Boolean);
}

/* Comprova la integritat de LINKS contra REPARTIMENT i SABERS carregats en aquest moment.
 * Retorna un array de missatges (buit si tot és correcte). Es fa servir per avisar
 * discretament a la consola si algú edita les dades i trenca una referència. */
function linksSanityCheck(linksData, temaIndex, saberIndex) {
  const problems = [];
  for (const [saberId, rids] of Object.entries(linksData.links || {})) {
    if (!saberIndex[saberId]) {
      problems.push(`data-links.json: saber "${saberId}" no existeix a data-sabers.json`);
      continue;
    }
    for (const rid of rids) {
      if (!temaIndex[rid]) {
        problems.push(`data-links.json: el saber "${saberId}" apunta a un tema inexistent "${rid}"`);
      }
    }
  }
  return problems;
}
