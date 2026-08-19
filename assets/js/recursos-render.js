/* recursos-render.js — Renderització de lectura de la pàgina "Recursos".
 * Depèn de: utils.js (escHtml, fetchJson, debounce), links.js (buildTemaIndex,
 *           buildSaberIndex).
 * Exposa (globals): RECURSOS_STATE, activeRecursCurs, loadRecursosData(),
 *                    renderTabs(), renderMain(), switchCurs(curs), applyFilters(),
 *                    openRecursGroupDirect(codi, curs).
 *
 * A diferència de sabers.html (un array pla d'items), aquí agrupem els
 * recursos per curs → codi (bloc curricular), perquè és així com es van
 * extreure dels PDF TOR: cada recurso ja porta { codi, curs }, sense saber
 * individual (vegeu _meta.descripcio a data-recursos.json). Cada grup enllaça
 * cap als sabers que comparteixen el mateix codi+curs (data-sabers.json
 * sabers[].codi + apareix[curs].present), en lloc d'un rid concret. */

const CURS_LABELS_CURT_R = { '1ESO': '1r ESO', '2ESO': '2n ESO', '3ESO': '3r ESO', '4ESO': '4t ESO' };

let RECURSOS_STATE = null;
let activeRecursCurs = null;
let currentRecursFilters = { text: '' };

/* Carrega repartiment + sabers + recursos (repartiment i sabers calen per als
 * índexs i per poder enllaçar cap enrere, com fan les altres dues pàgines). */
async function loadRecursosData() {
  const [repartiment, sabers, recursos] = await Promise.all([
    fetchJson('assets/data/data-repartiment.json'),
    fetchJson('assets/data/data-sabers.json'),
    fetchJson('assets/data/data-recursos.json'),
  ]);
  const temaIndex = buildTemaIndex(repartiment);
  const saberIndex = buildSaberIndex(sabers);

  RECURSOS_STATE = { repartiment, sabers, recursos, temaIndex, saberIndex };
  activeRecursCurs = recursos._meta.cursOrder[0];
  return RECURSOS_STATE;
}

/* ─── AGRUPACIÓ ───────────────────────────────────────────────────── */

/* Recursos d'un curs concret, agrupats per codi, en l'ordre en què el codi
 * apareix per primer cop dins el fitxer (estable, no alfabètic: reflecteix
 * l'ordre d'extracció dels PDF TOR). */
function recursosGroupedPerCurs(curs) {
  const items = RECURSOS_STATE.recursos.recursos.filter(r => r.curs === curs);
  const order = [];
  const byCodi = {};
  for (const r of items) {
    if (!byCodi[r.codi]) { byCodi[r.codi] = []; order.push(r.codi); }
    byCodi[r.codi].push(r);
  }
  return order.map(codi => ({ codi, items: byCodi[codi] }));
}

/* Bloc(s) i sabers associats a un codi+curs concret, per mostrar la
 * capçalera del grup i els chips "Saber relacionat" (vegeu nota a l'HANDOFF:
 * un codi pot correspondre a més d'un bloc, p.ex. NUM.QU). */
function sabersForCodiCurs(codi, curs) {
  return RECURSOS_STATE.sabers.sabers.filter(s =>
    s.codi === codi && s.apareix[curs] && s.apareix[curs].present);
}
function blocLabelsForCodi(codi) {
  return [...new Set(RECURSOS_STATE.sabers.sabers.filter(s => s.codi === codi).map(s => s.bloc))];
}

/* ─── RENDER ──────────────────────────────────────────────────────── */

function renderTabs() {
  const { repartiment, recursos } = RECURSOS_STATE;
  const order = recursos._meta.cursOrder;
  document.getElementById('tabsBar').innerHTML = order.map(c => {
    const n = RECURSOS_STATE.recursos.recursos.filter(r => r.curs === c).length;
    return `<div class="ctab${c === activeRecursCurs ? ' active' : ''}" data-curs="${c}">
      ${escHtml(CURS_LABELS_CURT_R[c] || (repartiment.cursos[c] && repartiment.cursos[c].label) || c)}
      <span class="h-badge">${n} recurs${n === 1 ? '' : 'os'}</span>
    </div>`;
  }).join('');
}

function renderMain() {
  const main = document.getElementById('main');
  main.innerHTML = '';
  for (const curs of RECURSOS_STATE.recursos._meta.cursOrder) {
    main.appendChild(buildCursView(curs));
  }
  applyFilters();
}

function buildCursView(curs) {
  const div = document.createElement('div');
  div.className = 'cview' + (curs === activeRecursCurs ? ' active' : '');
  div.id = 'cv-' + curs;

  const groups = recursosGroupedPerCurs(curs);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const label = CURS_LABELS_CURT_R[curs] || curs;

  const html = `
    <div class="cview-header">
      <h2>${escHtml(label)} <small style="font-weight:400;color:var(--muted);font-size:15px">· Recursos</small></h2>
      <span class="meta">${total} recurs${total === 1 ? '' : 'os'} en ${groups.length} bloc${groups.length === 1 ? '' : 's'} curricular${groups.length === 1 ? '' : 's'}</span>
    </div>
    <div class="filters-bar" data-curs-filters="${curs}">
      <input type="search" class="filter-search" placeholder="Cerca per títol, descripció, codi o font…" data-filter="text" autocomplete="off">
      <span class="filter-clear" data-action="clear-filters">Neteja filtres</span>
      <span class="filter-count" data-role="count"></span>
    </div>
    <div class="recurs-groups" id="sl-${curs}">
      ${groups.map(g => buildGroupBlock(curs, g)).join('') || '<div class="no-results">Cap recurs extret encara per a aquest curs.</div>'}
    </div>`;
  div.innerHTML = html;
  return div;
}

function buildGroupBlock(curs, group) {
  const blocLabels = blocLabelsForCodi(group.codi);
  const blocLabel = blocLabels.length ? blocLabels.join(' / ') : '(bloc no identificat a data-sabers.json)';
  return `<div class="recurs-group" data-codi="${escHtml(group.codi)}">
    <div class="recurs-group-head">
      <span class="saber-codi numeric">${escHtml(group.codi)}</span>
      <span class="recurs-group-bloc">${escHtml(blocLabel)}</span>
      <span class="recurs-group-count">${group.items.length} recurs${group.items.length === 1 ? '' : 'os'}</span>
    </div>
    ${buildSaberChipsForGroup(group.codi, curs)}
    <div class="recurs-list">
      ${group.items.map(r => buildRecursCard(r)).join('')}
    </div>
  </div>`;
}

/* Chips cap a sabers.html pels sabers que comparteixen aquest codi+curs
 * (mateix patró que buildSaberChips a repartiment-render.js, adaptat perquè
 * aquí l'origen és un grup codi+curs, no un rid). */
function buildSaberChipsForGroup(codi, curs) {
  const sabers = sabersForCodiCurs(codi, curs);
  if (!sabers.length) {
    return `<div class="tema-links-empty">Cap saber de data-sabers.json coincideix amb ${escHtml(codi)} a ${escHtml(CURS_LABELS_CURT_R[curs] || curs)}.</div>`;
  }
  const chips = sabers.map(s => `
    <a class="saber-chip" href="sabers.html?saber=${encodeURIComponent(s.id)}" title="${escHtml(s.saber)}">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5l1.6 3.6 3.9.4-2.9 2.7.8 3.8L8 11.1l-3.4 1.9.8-3.8-2.9-2.7 3.9-.4z"/></svg>
      ${escHtml(s.saber)}
    </a>`).join('');
  return `<div class="saber-links">${chips}</div>`;
}

function buildRecursCard(r) {
  return `<div class="recurs-card" id="recurs-${escHtml(r.id)}" data-recurs-id="${escHtml(r.id)}"
      data-search="${escHtml((r.titol + ' ' + r.descripcio + ' ' + r.codi + ' ' + (r.font || '')).toLowerCase())}">
    <div class="recurs-card-title">
      <a href="${escHtml(r.url)}" target="_blank" rel="noopener noreferrer">${escHtml(r.titol)}</a>
      <svg class="recurs-ext-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5h-3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3M9.5 2.5h4v4M13.2 2.8L7.5 8.5"/></svg>
    </div>
    <p class="recurs-desc">${escHtml(r.descripcio)}</p>
    ${r.font ? `<div class="recurs-font"><strong>Font:</strong> ${escHtml(r.font)}</div>` : ''}
  </div>`;
}

/* ─── FILTRES ─────────────────────────────────────────────────────── */

function applyFilters() {
  const curs = activeRecursCurs;
  const bar = document.querySelector(`.filters-bar[data-curs-filters="${curs}"]`);
  if (!bar) return;
  const text = (bar.querySelector('[data-filter="text"]').value || '').trim().toLowerCase();
  currentRecursFilters = { text };

  const list = document.getElementById('sl-' + curs);
  if (!list) return;
  const cards = list.querySelectorAll('.recurs-card');
  let shown = 0;
  cards.forEach(card => {
    const visible = !text || card.dataset.search.includes(text);
    card.style.display = visible ? '' : 'none';
    if (visible) shown++;
  });
  // Amaga grups sencers si cap de les seves targetes és visible amb el filtre actiu.
  list.querySelectorAll('.recurs-group').forEach(group => {
    const anyVisible = [...group.querySelectorAll('.recurs-card')].some(c => c.style.display !== 'none');
    group.style.display = (!text || anyVisible) ? '' : 'none';
  });

  const countEl = bar.querySelector('[data-role="count"]');
  if (countEl) countEl.textContent = `${shown} / ${cards.length}`;

  let emptyMsg = list.querySelector('.no-results.js-filter-empty');
  if (shown === 0 && cards.length > 0) {
    if (!emptyMsg) {
      emptyMsg = document.createElement('div');
      emptyMsg.className = 'no-results js-filter-empty';
      emptyMsg.textContent = 'Cap recurs coincideix amb la cerca.';
      list.appendChild(emptyMsg);
    }
  } else if (emptyMsg) {
    emptyMsg.remove();
  }
}

function clearFilters(curs) {
  const bar = document.querySelector(`.filters-bar[data-curs-filters="${curs}"]`);
  if (!bar) return;
  bar.querySelector('[data-filter="text"]').value = '';
  applyFilters();
}

/* ─── ACTIONS ─────────────────────────────────────────────────────── */

function switchCurs(curs) {
  activeRecursCurs = curs;
  document.querySelectorAll('.ctab').forEach(t => t.classList.toggle('active', t.dataset.curs === curs));
  document.querySelectorAll('.cview').forEach(v => v.classList.toggle('active', v.id === 'cv-' + curs));
  applyFilters();
}

/* Obre directament el grup codi+curs (arribant des de sabers.html amb
 * ?recurs-codi=<codi>&recurs-curs=<curs>, patró equivalent a ?saber=<id>). */
function openRecursGroupDirect(codi, curs) {
  if (!RECURSOS_STATE.recursos._meta.cursOrder.includes(curs)) return false;
  switchCurs(curs);
  clearFilters(curs);
  requestAnimationFrame(() => {
    const group = document.querySelector(`.recurs-group[data-codi="${CSS.escape(codi)}"]`);
    if (group) group.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  return true;
}
