/* repartiment-edit.js — Mode edició de la pàgina "Repartiment".
 * Depèn de: utils.js (escHtml), repartiment-render.js (REPARTIMENT_STATE, activeCurs,
 *           horesBloc, horesCurs, renderMain, CURS_LABELS_CURT).
 * Exposa (globals): isEditing, startEdit(), stopEdit(), handleEditClick(e),
 *                    handleEditInput(e), openMoveModal(...), closeMoveModal(...), downloadData().
 * Les hores de bloc NO són editables directament: sempre es recalculen sumant
 * les hores dels temes (vegeu horesBloc a repartiment-render.js), així que aquí
 * només s'edita hores per tema — coherent amb com es LLEGEIX la pàgina. */

/* ─── Estat ───────────────────────────────────────────────────────── */
let editData = null;      // còpia mutable de REPARTIMENT_STATE.repartiment durant l'edició
let isEditing = false;
let _movePending = null;  // { curs, sentit, tid } mentre el modal de "mou tema" està obert

/* ─── Start / stop ────────────────────────────────────────────────── */
function startEdit() {
  editData = JSON.parse(JSON.stringify(REPARTIMENT_STATE.repartiment));
  isEditing = true;
  document.body.classList.add('is-editing');
  renderMainEdit();
}

function stopEdit() {
  const dirty = JSON.stringify(editData) !== JSON.stringify(REPARTIMENT_STATE.repartiment);
  if (dirty && !confirm("Hi ha canvis que no heu descarregat. Sortir igualment?")) return;
  editData = null;
  isEditing = false;
  document.body.classList.remove('is-editing');
  renderMain();
  REPARTIMENT_STATE.repartiment.cursos[activeCurs].blocs.forEach(b =>
    document.getElementById(`ss-${activeCurs}__${b.sentit}`)?.classList.add('open'));
}

/* ─── Helpers d'accés ─────────────────────────────────────────────── */
function eBloc(curs, sentit) {
  return editData.cursos[curs]?.blocs.find(b => b.sentit === sentit) || null;
}
function eTema(curs, sentit, tid) {
  return eBloc(curs, sentit)?.temes.find(t => t.id === tid) || null;
}

/* ─── Operacions sobre continguts ─────────────────────────────────── */
function eCont_Move(curs, sentit, tid, ci, dir) {
  const t = eTema(curs, sentit, tid); if (!t) return;
  const ni = ci + dir;
  if (ni < 0 || ni >= t.continguts.length) return;
  [t.continguts[ci], t.continguts[ni]] = [t.continguts[ni], t.continguts[ci]];
  rerenderCurs(curs);
}
function eCont_Del(curs, sentit, tid, ci) {
  const t = eTema(curs, sentit, tid); if (!t) return;
  if (!confirm(`Suprimir "${t.continguts[ci]}"?`)) return;
  t.continguts.splice(ci, 1);
  rerenderCurs(curs);
}
function eCont_Add(curs, sentit, tid) {
  const t = eTema(curs, sentit, tid); if (!t) return;
  t.continguts.push('Nou contingut');
  rerenderCurs(curs);
}
function eCont_Update(curs, sentit, tid, ci, value) {
  const t = eTema(curs, sentit, tid);
  if (t) t.continguts[ci] = value;
}

/* ─── Operacions sobre temes ──────────────────────────────────────── */
function eTema_Move(curs, sentit, tid, dir) {
  const bloc = eBloc(curs, sentit); if (!bloc) return;
  const i = bloc.temes.findIndex(t => t.id === tid);
  const ni = i + dir;
  if (ni < 0 || ni >= bloc.temes.length) return;
  [bloc.temes[i], bloc.temes[ni]] = [bloc.temes[ni], bloc.temes[i]];
  rerenderCurs(curs);
}
function eTema_Del(curs, sentit, tid) {
  const bloc = eBloc(curs, sentit); if (!bloc) return;
  const i = bloc.temes.findIndex(t => t.id === tid); if (i < 0) return;
  if (!confirm(`Suprimir el tema "${bloc.temes[i].label}" i tots els seus continguts?\n\nAtenció: si hi ha sabers enllaçats a aquest tema a data-links.json, l'enllaç quedarà trencat i caldrà revisar-lo manualment.`)) return;
  bloc.temes.splice(i, 1);
  rerenderCurs(curs);
}
function eTema_Add(curs, sentit) {
  const bloc = eBloc(curs, sentit); if (!bloc) return;
  bloc.temes.push({ id: 'tema-' + Date.now(), label: 'Tema nou', hores: 0, continguts: ['Contingut 1'] });
  rerenderCurs(curs);
}
function eTema_UpdateLabel(curs, sentit, tid, value) {
  const t = eTema(curs, sentit, tid); if (t) t.label = value;
}
function eTema_UpdateHores(curs, sentit, tid, value) {
  const t = eTema(curs, sentit, tid); if (t) t.hores = parseInt(value) || 0;
  // recalcula i mostra l'hora del bloc en viu (element purament visual, no es guarda)
  const blocHoresEl = document.querySelector(`.s-hores-live[data-curs="${curs}"][data-sentit="${sentit}"]`);
  const bloc = eBloc(curs, sentit);
  if (blocHoresEl && bloc) blocHoresEl.textContent = horesBloc(bloc) + 'h';
}
function eTema_MoveTo(srcCurs, srcSentit, tid, dstCurs, dstSentit) {
  if (srcCurs === dstCurs && srcSentit === dstSentit) return;
  const srcBloc = eBloc(srcCurs, srcSentit);
  const dstBloc = eBloc(dstCurs, dstSentit);
  if (!dstBloc) { alert(`No existeix el sentit "${dstSentit}" a ${dstCurs}.`); return; }
  const i = srcBloc.temes.findIndex(t => t.id === tid); if (i < 0) return;
  const [tema] = srcBloc.temes.splice(i, 1);
  dstBloc.temes.push(tema);
  rerenderCurs(srcCurs);
  if (dstCurs !== srcCurs) rerenderCurs(dstCurs);
}

/* ─── Re-renderitzar un curs (preservant la pestanya activa) ──────── */
function rerenderCurs(curs) {
  const el = document.getElementById('cv-' + curs); if (!el) return;
  const newEl = buildCursViewEdit(curs);
  newEl.className = el.className;
  el.replaceWith(newEl);
  editData.cursos[curs].blocs.forEach(b =>
    document.getElementById(`ss-${curs}__${b.sentit}`)?.classList.add('open'));
}

/* ─── Render principal (mode edició) ──────────────────────────────── */
function renderMainEdit() {
  const main = document.getElementById('main');
  main.innerHTML = '';
  for (const curs of editData._meta.cursOrder) main.appendChild(buildCursViewEdit(curs));
  editData.cursos[activeCurs].blocs.forEach(b =>
    document.getElementById(`ss-${activeCurs}__${b.sentit}`)?.classList.add('open'));
}

function buildCursViewEdit(curs) {
  const d = editData.cursos[curs];
  const div = document.createElement('div');
  div.className = 'cview' + (curs === activeCurs ? ' active' : '');
  div.id = 'cv-' + curs;

  let html = `<div class="cview-header">
    <h2>${escHtml(d.label)}</h2>
    <span class="meta">${horesCurs(d)}h anuals &mdash; ${escHtml(d.horesInfo)}</span>
  </div>`;

  for (const bloc of d.blocs) {
    const sm = editData.sentits[bloc.sentit];
    const sid = `${curs}__${bloc.sentit}`;
    html += `
    <div class="s-section ${escHtml(bloc.sentit)}" id="ss-${sid}">
      <div class="s-header ${escHtml(bloc.sentit)}" data-sid="${sid}">
        <div class="s-dot"></div>
        <div class="s-label">${escHtml(sm ? sm.label : bloc.sentit)}</div>
        <span class="s-hores s-hores-live" data-curs="${escHtml(curs)}" data-sentit="${escHtml(bloc.sentit)}"
          title="Es calcula sumant les hores de cada tema">${horesBloc(bloc)}h</span>
        <span class="s-chevron">▶</span>
      </div>
      <div class="s-body">
        <table class="tema-table">
          <colgroup><col/><col style="width:82px"/></colgroup>
          <thead><tr><th>Tema</th><th style="text-align:right">Hores</th></tr></thead>
          <tbody>
          ${bloc.temes.map((t, ti) => buildTemaRowEdit(curs, bloc.sentit, t, ti, bloc.temes.length)).join('')}
          </tbody>
        </table>
        <button class="edit-add-btn" data-edit="add-tema" data-curs="${escHtml(curs)}" data-sentit="${escHtml(bloc.sentit)}">
          + Afegir tema
        </button>
      </div>
    </div>`;
  }
  div.innerHTML = html;
  return div;
}

function buildTemaRowEdit(curs, sentit, t, ti, total) {
  const rid = `${escHtml(curs)}__${escHtml(sentit)}__${escHtml(t.id)}`;
  const first = ti === 0, last = ti === total - 1;

  const contItems = t.continguts.map((c, ci) => `
    <li>
      <div class="edit-cont-row">
        <span class="cont-num">${ci + 1}.</span>
        <input class="cont-inp" type="text" value="${escHtml(c)}"
          data-edit="cont" data-curs="${escHtml(curs)}" data-sentit="${escHtml(sentit)}"
          data-tid="${escHtml(t.id)}" data-ci="${ci}">
        <div class="edit-mini-btns">
          <button class="edit-mini-btn" title="Amunt"
            data-edit="cont-up" data-curs="${escHtml(curs)}" data-sentit="${escHtml(sentit)}"
            data-tid="${escHtml(t.id)}" data-ci="${ci}" ${ci === 0 ? 'disabled' : ''}>▲</button>
          <button class="edit-mini-btn" title="Avall"
            data-edit="cont-down" data-curs="${escHtml(curs)}" data-sentit="${escHtml(sentit)}"
            data-tid="${escHtml(t.id)}" data-ci="${ci}" ${ci === t.continguts.length - 1 ? 'disabled' : ''}>▼</button>
          <button class="edit-mini-btn del" title="Suprimeix contingut"
            data-edit="cont-del" data-curs="${escHtml(curs)}" data-sentit="${escHtml(sentit)}"
            data-tid="${escHtml(t.id)}" data-ci="${ci}">✕</button>
        </div>
      </div>
    </li>`).join('');

  return `
  <tr class="tema-row">
    <td>
      <div class="edit-tema-head">
        <span class="tema-caret">▶</span>
        <input class="tema-label-inp" type="text" value="${escHtml(t.label)}"
          data-edit="tema-label" data-curs="${escHtml(curs)}" data-sentit="${escHtml(sentit)}" data-tid="${escHtml(t.id)}">
        <div class="edit-mini-btns">
          <button class="edit-mini-btn" title="Amunt dins del bloc"
            data-edit="tema-up" data-curs="${escHtml(curs)}" data-sentit="${escHtml(sentit)}" data-tid="${escHtml(t.id)}" ${first ? 'disabled' : ''}>▲</button>
          <button class="edit-mini-btn" title="Avall dins del bloc"
            data-edit="tema-down" data-curs="${escHtml(curs)}" data-sentit="${escHtml(sentit)}" data-tid="${escHtml(t.id)}" ${last ? 'disabled' : ''}>▼</button>
          <button class="edit-mini-btn move" title="Mou a un altre curs o sentit"
            data-edit="tema-move" data-curs="${escHtml(curs)}" data-sentit="${escHtml(sentit)}" data-tid="${escHtml(t.id)}">↔</button>
          <button class="edit-mini-btn del" title="Suprimeix tema"
            data-edit="tema-del" data-curs="${escHtml(curs)}" data-sentit="${escHtml(sentit)}" data-tid="${escHtml(t.id)}">✕</button>
        </div>
      </div>
      <ul class="cont-list open" id="cl-${rid}">
        ${contItems}
        <li style="list-style:none">
          <button class="edit-add-btn" data-edit="add-cont" data-curs="${escHtml(curs)}" data-sentit="${escHtml(sentit)}" data-tid="${escHtml(t.id)}">+ Afegir contingut</button>
        </li>
      </ul>
    </td>
    <td class="hores-td" style="vertical-align:top;padding-top:9px">
      <input class="hores-inp" type="number" min="0" max="999" value="${t.hores}"
        data-edit="tema-hores" data-curs="${escHtml(curs)}" data-sentit="${escHtml(sentit)}" data-tid="${escHtml(t.id)}">h
    </td>
  </tr>`;
}

/* ─── Dispatch de clics en mode edició ─────────────────────────────── */
function handleEditClick(e) {
  const btn = e.target.closest('[data-edit]'); if (!btn) return false;
  const { edit: act, curs, sentit, tid, ci } = btn.dataset;
  const idx = parseInt(ci ?? '0');
  switch (act) {
    case 'cont-up':   eCont_Move(curs, sentit, tid, idx, -1); break;
    case 'cont-down': eCont_Move(curs, sentit, tid, idx, +1); break;
    case 'cont-del':  eCont_Del(curs, sentit, tid, idx);      break;
    case 'add-cont':  eCont_Add(curs, sentit, tid);           break;
    case 'tema-up':   eTema_Move(curs, sentit, tid, -1);      break;
    case 'tema-down': eTema_Move(curs, sentit, tid, +1);      break;
    case 'tema-del':  eTema_Del(curs, sentit, tid);           break;
    case 'add-tema':  eTema_Add(curs, sentit);                break;
    case 'tema-move': openMoveModal(curs, sentit, tid);       break;
    default: return false;
  }
  return true;
}

/* ─── Dispatch d'inputs en mode edició ─────────────────────────────── */
function handleEditInput(e) {
  const el = e.target; if (!el.dataset.edit) return;
  const { edit: act, curs, sentit, tid, ci } = el.dataset;
  switch (act) {
    case 'cont':       eCont_Update(curs, sentit, tid, parseInt(ci), el.value); break;
    case 'tema-label': eTema_UpdateLabel(curs, sentit, tid, el.value);          break;
    case 'tema-hores': eTema_UpdateHores(curs, sentit, tid, el.value);          break;
  }
}

/* ─── Modal: moure tema ────────────────────────────────────────────── */
function openMoveModal(curs, sentit, tid) {
  const tema = eTema(curs, sentit, tid); if (!tema) return;
  _movePending = { curs, sentit, tid };
  const cursOpts = editData._meta.cursOrder.map(c =>
    `<option value="${c}"${c === curs ? ' selected' : ''}>${escHtml(CURS_LABELS_CURT[c] || c)}</option>`).join('');
  const sentitOpts = Object.entries(editData.sentits).map(([k, v]) =>
    `<option value="${k}"${k === sentit ? ' selected' : ''}>${escHtml(v.label)}</option>`).join('');
  document.getElementById('move-modal-body').innerHTML = `
    <p class="move-sub">Tema: <strong>${escHtml(tema.label)}</strong></p>
    <label>Curs destí</label>
    <select id="move-dst-curs">${cursOpts}</select>
    <label>Sentit destí</label>
    <select id="move-dst-sentit">${sentitOpts}</select>`;
  document.getElementById('move-modal-bg').hidden = false;
}
function closeMoveModal(confirmed) {
  if (confirmed && _movePending) {
    eTema_MoveTo(
      _movePending.curs, _movePending.sentit, _movePending.tid,
      document.getElementById('move-dst-curs').value,
      document.getElementById('move-dst-sentit').value
    );
  }
  document.getElementById('move-modal-bg').hidden = true;
  _movePending = null;
}

/* ─── Descàrrega de data-repartiment.json ──────────────────────────── */
function downloadData() {
  // desa exactament el mateix esquema que es va llegir (_meta, sentits, cursos),
  // amb _meta preservat tal qual perquè el fitxer resultant sigui vàlid per rellegir.
  const out = {
    _meta: editData._meta,
    sentits: editData.sentits,
    cursos: editData.cursos,
  };
  const json = JSON.stringify(out, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'data-repartiment.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
