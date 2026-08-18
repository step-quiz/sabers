/* repartiment-render.js — Renderització de lectura de la pàgina "Repartiment".
 * Depèn de: utils.js (escHtml, fetchJson), links.js (buildTemaIndex, buildSaberIndex,
 *           buildReverseLinks, findSabersForTema, linksSanityCheck).
 * Exposa (globals): REPARTIMENT_STATE (dades + índexs un cop carregades),
 *                    loadRepartimentData(), renderTabs(), renderMain(),
 *                    switchCurs(curs), horesBloc(bloc), horesCurs(cdata).
 * No fa cap crida de xarxa pròpia més enllà de loadRepartimentData(); qui
 * inicialitza la pàgina (app-repartiment.js) decideix quan cridar-la. */

const CURS_LABELS_CURT = { '1ESO': '1r ESO', '2ESO': '2n ESO', '3ESO': '3r ESO', '4ESO': '4t ESO' };

/* Estat carregat un cop les 3 fonts de dades han arribat. Es deixa com a global
 * (en lloc d'un mòdul ES) perquè repartiment-edit.js el llegeixi i el muti
 * directament, seguint el mateix patró senzill "script global" que la resta
 * del projecte (sense build ni bundler). */
let REPARTIMENT_STATE = null;
let activeCurs = null;

/* Suma les hores de tots els temes d'un bloc — mai es llegeix una hora fixa
 * emmagatzemada al bloc, perquè es calcula sempre a partir dels temes reals
 * (així un canvi a data-repartiment.json mai queda desactualitzat). */
function horesBloc(bloc) {
  return bloc.temes.reduce((sum, t) => sum + (Number(t.hores) || 0), 0);
}

/* Suma les hores de tots els blocs d'un curs. */
function horesCurs(cdata) {
  return cdata.blocs.reduce((sum, b) => sum + horesBloc(b), 0);
}

/* Carrega data-repartiment.json, data-sabers.json i data-links.json en paral·lel
 * i construeix els índexs necessaris per decorar cada tema amb els seus sabers. */
async function loadRepartimentData() {
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

  REPARTIMENT_STATE = { repartiment, sabers, links, temaIndex, saberIndex, linkIndex };
  activeCurs = repartiment._meta.cursOrder[0];
  return REPARTIMENT_STATE;
}

/* ─── RENDER ──────────────────────────────────────────────────────── */

function renderTabs() {
  const { repartiment } = REPARTIMENT_STATE;
  document.getElementById('tabsBar').innerHTML = repartiment._meta.cursOrder.map(c => {
    const d = repartiment.cursos[c];
    return `<div class="ctab${c === activeCurs ? ' active' : ''}" data-curs="${c}">
      ${escHtml(CURS_LABELS_CURT[c] || c)}
      <span class="h-badge">${horesCurs(d)}h</span>
    </div>`;
  }).join('');
}

function renderMain() {
  const main = document.getElementById('main');
  main.innerHTML = '';
  for (const curs of REPARTIMENT_STATE.repartiment._meta.cursOrder) {
    main.appendChild(buildCursView(curs));
  }
}

function buildCursView(curs) {
  const { repartiment } = REPARTIMENT_STATE;
  const d = repartiment.cursos[curs];
  const div = document.createElement('div');
  div.className = 'cview' + (curs === activeCurs ? ' active' : '');
  div.id = 'cv-' + curs;

  let html = `<div class="cview-header">
    <h2>${escHtml(d.label)}</h2>
    <span class="meta">${horesCurs(d)}h anuals &mdash; ${escHtml(d.horesInfo)}</span>
  </div>`;

  for (const bloc of d.blocs) {
    const sm = repartiment.sentits[bloc.sentit];
    const sid = `${curs}__${bloc.sentit}`;
    html += `<div class="s-section ${bloc.sentit}" id="ss-${sid}">
      <div class="s-header ${bloc.sentit}" data-sid="${sid}">
        <div class="s-dot"></div>
        <div class="s-label">${escHtml(sm ? sm.label : bloc.sentit)}</div>
        <div class="s-hores">${horesBloc(bloc)}h</div>
        <span class="s-chevron">▶</span>
      </div>
      <div class="s-body">
        <table class="tema-table">
          <colgroup><col/><col/></colgroup>
          <thead><tr><th>Tema</th><th style="text-align:right">Hores</th></tr></thead>
          <tbody>
          ${bloc.temes.map(t => buildTemaRow(curs, bloc.sentit, t)).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  div.innerHTML = html;
  return div;
}

/* Els chips "Saber relacionat" enllacen a sabers.html filtrant per saber concret
 * (?saber=<id>), perquè un clic obri directament la targeta corresponent oberta. */
function buildSaberChips(rid) {
  const { linkIndex } = REPARTIMENT_STATE;
  const sabers = findSabersForTema(rid, linkIndex, REPARTIMENT_STATE.saberIndex);
  if (!sabers.length) return '';
  const chips = sabers.map(s => `
    <a class="saber-chip" href="sabers.html?saber=${encodeURIComponent(s.id)}" title="${escHtml(s.saber)}">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5l1.6 3.6 3.9.4-2.9 2.7.8 3.8L8 11.1l-3.4 1.9.8-3.8-2.9-2.7 3.9-.4z"/></svg>
      ${escHtml(s.codi)}
    </a>`).join('');
  return `<div class="saber-links">${chips}</div>`;
}

function buildTemaRow(curs, sentit, t) {
  const rid = `${curs}__${sentit}__${t.id}`;
  const items = t.continguts.map((c, i) =>
    `<li><span class="cont-num">${i + 1}.</span><span>${escHtml(c)}</span></li>`
  ).join('');
  return `<tr class="tema-row">
    <td>
      <div class="tema-toggle" data-rid="${rid}">
        <span class="tema-caret">▶</span>
        <span class="tema-name">${escHtml(t.label)}</span>
      </div>
      <ul class="cont-list" id="cl-${rid}">${items}</ul>
      ${buildSaberChips(rid)}
    </td>
    <td class="hores-td">${t.hores}h</td>
  </tr>`;
}

/* ─── ACTIONS ─────────────────────────────────────────────────────── */

function switchCurs(curs) {
  activeCurs = curs;
  document.querySelectorAll('.ctab').forEach(t => t.classList.toggle('active', t.dataset.curs === curs));
  document.querySelectorAll('.cview').forEach(v => v.classList.toggle('active', v.id === 'cv-' + curs));
}

function toggleSection(sid) {
  document.getElementById('ss-' + sid).classList.toggle('open');
}

function toggleTema(rid) {
  const tog = document.querySelector(`.tema-toggle[data-rid="${rid}"]`);
  const list = document.getElementById('cl-' + rid);
  const open = tog.classList.toggle('open');
  list.classList.toggle('open', open);
}

/* Obre directament un tema concret (curs + secció + tema), fent-lo visible i
 * desplegat. Es fa servir quan s'arriba des d'un ?tema=<rid> (enllaç des de sabers.html). */
function openTemaDirect(rid) {
  const [curs, sentit, temaId] = rid.split('__');
  if (!curs || !REPARTIMENT_STATE.repartiment.cursos[curs]) return false;
  switchCurs(curs);
  const sec = document.getElementById(`ss-${curs}__${sentit}`);
  if (sec) sec.classList.add('open');
  const tog = document.querySelector(`.tema-toggle[data-rid="${rid}"]`);
  const list = document.getElementById('cl-' + rid);
  if (tog && list) { tog.classList.add('open'); list.classList.add('open'); tog.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  return true;
}
