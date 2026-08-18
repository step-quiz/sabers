/* sabers-render.js — Renderització de lectura de la pàgina "Sabers".
 * Depèn de: utils.js (escHtml, fetchJson, debounce), links.js (buildTemaIndex,
 *           buildSaberIndex, buildReverseLinks, findTemesForSaber, linksSanityCheck).
 * Exposa (globals): SABERS_STATE, activeSaberCurs, loadSabersData(), renderTabs(),
 *                    renderMain(), switchCurs(curs), applyFilters(), openSaberDirect(id).
 * S'agrupa per curs (cursImpartir), com la pàgina de repartiment, i dins de cada
 * curs es filtra en viu per sentit/bloc/text. */

const CURS_LABELS_CURT_S = { '1ESO': '1r ESO', '2ESO': '2n ESO', '3ESO': '3r ESO', '4ESO': '4t ESO' };
const CURS_DOT_KEYS = ['1ESO', '2ESO', '3ESO', '4ESO'];

let SABERS_STATE = null;
let activeSaberCurs = null;
let currentFilters = { sentit: '', text: '' };

/* Carrega les 3 fonts de dades i construeix els índexs (mateix patró que repartiment-render.js,
 * de manera que totes dues pàgines vegin exactament les mateixes relacions). */
async function loadSabersData() {
  const [repartiment, sabers, links] = await Promise.all([
    fetchJson('assets/data/data-repartiment.json'),
    fetchJson('assets/data/data-sabers.json'),
    fetchJson('assets/data/data-links.json'),
  ]);
  const temaIndex = buildTemaIndex(repartiment);
  const saberIndex = buildSaberIndex(sabers);
  const linkIndex = buildReverseLinks(links, temaIndex, saberIndex);

  const problems = linksSanityCheck(links, temaIndex, saberIndex);
  if (problems.length) {
    console.warn('[data-links.json] problemes d\'integritat detectats:\n' + problems.join('\n'));
  }

  SABERS_STATE = { repartiment, sabers, links, temaIndex, saberIndex, linkIndex };
  activeSaberCurs = repartiment._meta.cursOrder[0];
  return SABERS_STATE;
}

/* ─── RENDER ──────────────────────────────────────────────────────── */

function sabersPerCurs(curs) {
  return SABERS_STATE.sabers.sabers.filter(s => s.cursImpartir === curs);
}

function renderTabs() {
  const { repartiment } = SABERS_STATE;
  document.getElementById('tabsBar').innerHTML = repartiment._meta.cursOrder.map(c => {
    const n = sabersPerCurs(c).length;
    return `<div class="ctab${c === activeSaberCurs ? ' active' : ''}" data-curs="${c}">
      ${escHtml(CURS_LABELS_CURT_S[c] || c)}
      <span class="h-badge">${n} saber${n === 1 ? '' : 's'}</span>
    </div>`;
  }).join('');
}

function renderMain() {
  const main = document.getElementById('main');
  main.innerHTML = '';
  for (const curs of SABERS_STATE.repartiment._meta.cursOrder) {
    main.appendChild(buildCursView(curs));
  }
  renderFilterOptions();
  applyFilters();
}

function buildCursView(curs) {
  const { repartiment } = SABERS_STATE;
  const d = repartiment.cursos[curs];
  const div = document.createElement('div');
  div.className = 'cview' + (curs === activeSaberCurs ? ' active' : '');
  div.id = 'cv-' + curs;

  const list = sabersPerCurs(curs);
  const html = `
    <div class="cview-header">
      <h2>${escHtml(d.label)} <small style="font-weight:400;color:var(--muted);font-size:15px">· Sabers</small></h2>
      <span class="meta">${list.length} saber${list.length === 1 ? '' : 's'} amb curs d'impartició assignat a ${escHtml(CURS_LABELS_CURT_S[curs] || curs)}</span>
    </div>
    <div class="filters-bar" data-curs-filters="${curs}">
      <input type="search" class="filter-search" placeholder="Cerca per text, codi o bloc…" data-filter="text" autocomplete="off">
      <select class="filter-select" data-filter="sentit"><option value="">Tots els sentits</option></select>
      <span class="filter-clear" data-action="clear-filters">Neteja filtres</span>
      <span class="filter-count" data-role="count"></span>
    </div>
    <div class="saber-list" id="sl-${curs}">
      ${list.map(s => buildSaberCard(s)).join('') || '<div class="no-results">Cap saber assignat a aquest curs.</div>'}
    </div>`;
  div.innerHTML = html;
  return div;
}

function renderFilterOptions() {
  const { repartiment } = SABERS_STATE;
  const opts = Object.entries(repartiment.sentits)
    .filter(([k]) => k !== 'comprensio') // comprensió lectora no aplica als sabers curriculars
    .map(([, v]) => v.label);
  // sabers.json fa servir 'espacial-mesura' com a sentit combinat, no els sentits per separat del repartiment
  const sentitsSabers = [...new Set(SABERS_STATE.sabers.sabers.map(s => s.sentit))];
  const labelOverride = { 'espacial-mesura': 'Espacial / Mesura', numeric: 'Numèric', algebraic: 'Algebraic', estocastic: 'Estocàstic' };
  document.querySelectorAll('.filter-select[data-filter="sentit"]').forEach(sel => {
    const current = sel.value;
    sel.innerHTML = '<option value="">Tots els sentits</option>' +
      sentitsSabers.map(s => `<option value="${escHtml(s)}">${escHtml(labelOverride[s] || s)}</option>`).join('');
    sel.value = current;
  });
}

function apareixDots(saber) {
  const dots = CURS_DOT_KEYS.map(c => {
    const info = saber.apareix[c] || { present: false, nota: null };
    const isPrincipal = c === saber.cursImpartir;
    let cls = 'apareix-dot';
    if (info.present) cls += isPrincipal ? ' present principal' : (info.nota === 'puntual' ? ' puntual' : ' present');
    const label = CURS_LABELS_CURT_S[c].slice(0, 2);
    const title = info.present
      ? `${CURS_LABELS_CURT_S[c]}${isPrincipal ? ' (curs d\'impartició)' : ''}${info.nota && info.nota !== 'puntual' ? ' — ' + info.nota : ''}`
      : `${CURS_LABELS_CURT_S[c]} — no apareix`;
    return `<span class="${cls}" title="${escHtml(title)}">${label}</span>`;
  }).join('');
  const notes = CURS_DOT_KEYS
    .map(c => saber.apareix[c])
    .filter(info => info && info.present && info.nota && info.nota !== 'puntual');
  return `<div class="apareix-row"><div class="apareix-dot-group">${dots}</div></div>`;
}

function buildTemaChips(saberId) {
  const temes = findTemesForSaber(saberId, SABERS_STATE.linkIndex, SABERS_STATE.temaIndex);
  if (!temes.length) {
    return `<div class="tema-links-empty">Saber transversal: no lligat a un únic tema del repartiment.</div>`;
  }
  const chips = temes.map(({ rid, curs, tema }) => `
    <a class="tema-chip" href="repartiment.html?tema=${encodeURIComponent(rid)}" title="Veure al repartiment de ${escHtml(CURS_LABELS_CURT_S[curs] || curs)}">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M5 6h6M5 9h4M5 12h3"/></svg>
      ${escHtml(CURS_LABELS_CURT_S[curs] || curs)} · ${escHtml(tema.label)}
    </a>`).join('');
  return `<div class="tema-links">${chips}</div>`;
}

function buildSaberCard(s) {
  return `<div class="saber-card" id="saber-${escHtml(s.id)}" data-saber-id="${escHtml(s.id)}"
      data-search="${escHtml((s.saber + ' ' + s.codi + ' ' + s.bloc + ' ' + s.fontOficial + ' ' + s.fontInterna).toLowerCase())}"
      data-sentit="${escHtml(s.sentit)}">
    <div class="saber-head" data-toggle="${escHtml(s.id)}">
      <span class="saber-caret">▶</span>
      <div class="saber-main">
        <div class="saber-title-row">
          <span class="saber-title">${escHtml(s.saber)}</span>
          <span class="saber-codi ${escHtml(s.sentit)}">${escHtml(s.codi)}</span>
        </div>
        <div class="saber-bloc">${escHtml(s.bloc)}</div>
        ${apareixDots(s)}
      </div>
    </div>
    <div class="saber-body">
      <div class="saber-fonts">
        <div class="font-box"><h4>Currículum oficial</h4><p>${escHtml(s.fontOficial)}</p></div>
        <div class="font-box"><h4>Redacció interna</h4><p>${escHtml(s.fontInterna)}</p></div>
      </div>
      <div class="saber-meta-row">
        ${s.connexions.length ? `<span><strong>Connexions:</strong> ${s.connexions.map(c => `<span class="connexio-chip">${escHtml(c)}</span>`).join('')}</span>` : ''}
        <span><strong>AMP/ESS:</strong> ${escHtml(s.ampEss)}</span>
      </div>
      ${buildTemaChips(s.id)}
    </div>
  </div>`;
}

/* ─── FILTRES ─────────────────────────────────────────────────────── */

function applyFilters() {
  const curs = activeSaberCurs;
  const bar = document.querySelector(`.filters-bar[data-curs-filters="${curs}"]`);
  if (!bar) return;
  const text = (bar.querySelector('[data-filter="text"]').value || '').trim().toLowerCase();
  const sentit = bar.querySelector('[data-filter="sentit"]').value;
  currentFilters = { text, sentit };

  const list = document.getElementById('sl-' + curs);
  if (!list) return;
  const cards = list.querySelectorAll('.saber-card');
  let shown = 0;
  cards.forEach(card => {
    const matchText = !text || card.dataset.search.includes(text);
    const matchSentit = !sentit || card.dataset.sentit === sentit;
    const visible = matchText && matchSentit;
    card.style.display = visible ? '' : 'none';
    if (visible) shown++;
  });
  const countEl = bar.querySelector('[data-role="count"]');
  if (countEl) countEl.textContent = `${shown} / ${cards.length}`;

  let emptyMsg = list.querySelector('.no-results.js-filter-empty');
  if (shown === 0 && cards.length > 0) {
    if (!emptyMsg) {
      emptyMsg = document.createElement('div');
      emptyMsg.className = 'no-results js-filter-empty';
      emptyMsg.textContent = 'Cap saber coincideix amb els filtres.';
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
  bar.querySelector('[data-filter="sentit"]').value = '';
  applyFilters();
}

/* ─── ACTIONS ─────────────────────────────────────────────────────── */

function switchCurs(curs) {
  activeSaberCurs = curs;
  document.querySelectorAll('.ctab').forEach(t => t.classList.toggle('active', t.dataset.curs === curs));
  document.querySelectorAll('.cview').forEach(v => v.classList.toggle('active', v.id === 'cv-' + curs));
  applyFilters();
}

function toggleSaber(id) {
  const head = document.querySelector(`.saber-head[data-toggle="${id}"]`);
  if (head) head.classList.toggle('open');
}

/* Obre directament un saber concret (canvia de curs si cal, desplega la targeta
 * i hi fa scroll). Es fa servir quan s'arriba des de ?saber=<id> (enllaç des de repartiment.html). */
function openSaberDirect(saberId) {
  const saber = SABERS_STATE.saberIndex[saberId];
  if (!saber) return false;
  switchCurs(saber.cursImpartir);
  clearFilters(saber.cursImpartir);
  requestAnimationFrame(() => {
    const card = document.getElementById('saber-' + saberId);
    const head = document.querySelector(`.saber-head[data-toggle="${saberId}"]`);
    if (head) head.classList.add('open');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  return true;
}
