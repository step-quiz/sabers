/* sabers-edit.js — Mode edició de la pàgina "Sabers".
 * Depèn de: utils.js (escHtml, slugify), sabers-render.js (SABERS_STATE, activeSaberCurs,
 *           CURS_LABELS_CURT_S, sabersPerCurs, applyFilters).
 * Exposa (globals): isEditing, startEdit(), stopEdit(), handleEditClick(e),
 *                    handleEditInput(e), downloadData().
 * A diferència del repartiment (jerarquia curs→sentit→tema), els sabers són un
 * array pla: cada saber és una fila independent amb el seu propi cursImpartir,
 * per això aquí "moure" un saber vol dir canviar-li el select cursImpartir/sentit,
 * no arrossegar-lo entre contenidors — més senzill i sense modal. */

let editSabers = null;   // còpia mutable de SABERS_STATE.sabers durant l'edició

/* ─── Start / stop ────────────────────────────────────────────────── */
function startEdit() {
  editSabers = JSON.parse(JSON.stringify(SABERS_STATE.sabers));
  isEditing = true;
  document.body.classList.add('is-editing');
  renderMainEdit();
}

function stopEdit() {
  const dirty = JSON.stringify(editSabers) !== JSON.stringify(SABERS_STATE.sabers);
  if (dirty && !confirm("Hi ha canvis que no heu descarregat. Sortir igualment?")) return;
  editSabers = null;
  isEditing = false;
  document.body.classList.remove('is-editing');
  renderMain();
}

/* ─── Helpers d'accés ─────────────────────────────────────────────── */
function eSaber(id) {
  return editSabers.sabers.find(s => s.id === id) || null;
}
function eSabersPerCurs(curs) {
  return editSabers.sabers.filter(s => s.cursImpartir === curs);
}

/* ─── Operacions ──────────────────────────────────────────────────── */
function eSaber_Move(id, dir) {
  const s = eSaber(id); if (!s) return;
  const curs = s.cursImpartir;
  const arr = editSabers.sabers;
  const sameC = arr.filter(x => x.cursImpartir === curs);
  const i = sameC.findIndex(x => x.id === id);
  const ni = i + dir;
  if (ni < 0 || ni >= sameC.length) return;
  // intercanvia les posicions ABSOLUTES dins editSabers.sabers dels dos elements implicats
  const gi = arr.findIndex(x => x.id === sameC[i].id);
  const gni = arr.findIndex(x => x.id === sameC[ni].id);
  [arr[gi], arr[gni]] = [arr[gni], arr[gi]];
  rerenderCurs(curs);
}
function eSaber_Del(id) {
  const s = eSaber(id); if (!s) return;
  if (!confirm(`Suprimir el saber "${s.saber}"?\n\nAtenció: si data-links.json l'enllaça a algun tema, l'enllaç quedarà trencat i caldrà revisar-lo manualment.`)) return;
  const curs = s.cursImpartir;
  editSabers.sabers = editSabers.sabers.filter(x => x.id !== id);
  rerenderCurs(curs);
}
function eSaber_Add(curs) {
  const usedIds = new Set(editSabers.sabers.map(s => s.id));
  let id = 'saber-nou-' + Date.now();
  const nou = {
    id, codi: '', sentit: 'numeric', bloc: '', saber: 'Nou saber',
    cursImpartir: curs,
    apareix: {
      '1ESO': { present: false, nota: null }, '2ESO': { present: false, nota: null },
      '3ESO': { present: false, nota: null }, '4ESO': { present: false, nota: null },
    },
    ampEss: 'ESS', connexions: [], fontOficial: '', fontInterna: '',
  };
  nou.apareix[curs] = { present: true, nota: null };
  editSabers.sabers.push(nou);
  rerenderCurs(curs);
  requestAnimationFrame(() => {
    document.getElementById('saber-edit-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}
function eSaber_UpdateField(id, field, value) {
  const s = eSaber(id); if (!s) return;
  if (field === 'connexions') {
    s.connexions = value.split(',').map(v => v.trim()).filter(Boolean);
  } else {
    s[field] = value;
  }
}
function eSaber_UpdateApareix(id, curs, kind, value) {
  const s = eSaber(id); if (!s) return;
  if (kind === 'present') s.apareix[curs].present = value;
  if (kind === 'nota') s.apareix[curs].nota = value.trim() || null;
}
function eSaber_UpdateCurs(id, newCurs) {
  const s = eSaber(id); if (!s) return;
  const oldCurs = s.cursImpartir;
  s.cursImpartir = newCurs;
  rerenderCurs(oldCurs);
  if (newCurs !== oldCurs) rerenderCurs(newCurs);
}

/* ─── Re-render ───────────────────────────────────────────────────── */
function rerenderCurs(curs) {
  const el = document.getElementById('cv-' + curs); if (!el) return;
  const newEl = buildCursViewEdit(curs);
  newEl.className = el.className;
  el.replaceWith(newEl);
}

function renderMainEdit() {
  const main = document.getElementById('main');
  main.innerHTML = '';
  for (const curs of editSabers._metaCursOrder || SABERS_STATE.repartiment._meta.cursOrder) {
    main.appendChild(buildCursViewEdit(curs));
  }
}

function buildCursViewEdit(curs) {
  const d = SABERS_STATE.repartiment.cursos[curs];
  const div = document.createElement('div');
  div.className = 'cview' + (curs === activeSaberCurs ? ' active' : '');
  div.id = 'cv-' + curs;
  const list = eSabersPerCurs(curs);
  div.innerHTML = `
    <div class="cview-header">
      <h2>${escHtml(d.label)} <small style="font-weight:400;color:var(--muted);font-size:15px">· Sabers</small></h2>
      <span class="meta">${list.length} saber${list.length === 1 ? '' : 's'}</span>
    </div>
    <div id="sl-${curs}">
      ${list.map((s, i) => buildSaberCardEdit(s, i, list.length)).join('')}
    </div>
    <button class="edit-add-btn" data-edit="add-saber" data-curs="${escHtml(curs)}">+ Afegir saber a ${escHtml(CURS_LABELS_CURT_S[curs] || curs)}</button>
  `;
  return div;
}

function apareixEditRow(s) {
  return CURS_DOT_KEYS.map(c => {
    const info = s.apareix[c] || { present: false, nota: null };
    return `<div class="apareix-edit-cell">
      <span class="curs-lbl">${CURS_LABELS_CURT_S[c]}</span>
      <label class="chk">
        <input type="checkbox" data-edit="apareix-present" data-id="${escHtml(s.id)}" data-curs="${c}" ${info.present ? 'checked' : ''}>
        apareix
      </label>
      <input type="text" placeholder="nota (opcional)" value="${escHtml(info.nota || '')}"
        data-edit="apareix-nota" data-id="${escHtml(s.id)}" data-curs="${c}">
    </div>`;
  }).join('');
}

function buildSaberCardEdit(s, i, total) {
  const cursOpts = SABERS_STATE.repartiment._meta.cursOrder.map(c =>
    `<option value="${c}"${c === s.cursImpartir ? ' selected' : ''}>${escHtml(CURS_LABELS_CURT_S[c] || c)}</option>`).join('');
  const sentitOpts = ['numeric', 'espacial-mesura', 'algebraic', 'estocastic'].map(v =>
    `<option value="${v}"${v === s.sentit ? ' selected' : ''}>${escHtml(v)}</option>`).join('');
  return `<div class="saber-card" id="saber-edit-${escHtml(s.id)}">
    <div style="padding:12px 14px">
      <div class="edit-tema-head">
        <input class="tema-label-inp" style="flex:1" type="text" value="${escHtml(s.saber)}"
          data-edit="field" data-field="saber" data-id="${escHtml(s.id)}" placeholder="Descripció del saber">
        <div class="edit-mini-btns">
          <button class="edit-mini-btn" title="Amunt" data-edit="move-up" data-id="${escHtml(s.id)}" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button class="edit-mini-btn" title="Avall" data-edit="move-down" data-id="${escHtml(s.id)}" ${i === total - 1 ? 'disabled' : ''}>▼</button>
          <button class="edit-mini-btn del" title="Suprimeix saber" data-edit="del" data-id="${escHtml(s.id)}">✕</button>
        </div>
      </div>
      <div class="saber-edit-grid">
        <div class="saber-edit-field"><label>Codi</label>
          <input type="text" value="${escHtml(s.codi)}" data-edit="field" data-field="codi" data-id="${escHtml(s.id)}"></div>
        <div class="saber-edit-field"><label>Bloc</label>
          <input type="text" value="${escHtml(s.bloc)}" data-edit="field" data-field="bloc" data-id="${escHtml(s.id)}"></div>
        <div class="saber-edit-field"><label>Sentit</label>
          <select data-edit="field" data-field="sentit" data-id="${escHtml(s.id)}">${sentitOpts}</select></div>
        <div class="saber-edit-field"><label>Curs d'impartició</label>
          <select data-edit="curs" data-id="${escHtml(s.id)}">${cursOpts}</select></div>
        <div class="saber-edit-field"><label>Connexions (separades per coma)</label>
          <input type="text" value="${escHtml(s.connexions.join(', '))}" data-edit="field" data-field="connexions" data-id="${escHtml(s.id)}"></div>
        <div class="saber-edit-field"><label>AMP / ESS</label>
          <input type="text" value="${escHtml(s.ampEss)}" data-edit="field" data-field="ampEss" data-id="${escHtml(s.id)}"></div>
        <div class="saber-edit-field" style="grid-column:1/-1"><label>Font: currículum oficial</label>
          <textarea data-edit="field" data-field="fontOficial" data-id="${escHtml(s.id)}">${escHtml(s.fontOficial)}</textarea></div>
        <div class="saber-edit-field" style="grid-column:1/-1"><label>Font: redacció interna</label>
          <textarea data-edit="field" data-field="fontInterna" data-id="${escHtml(s.id)}">${escHtml(s.fontInterna)}</textarea></div>
      </div>
      <label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--hint);margin:12px 0 4px">On apareix (a banda del curs d'impartició)</label>
      <div class="apareix-edit-row">${apareixEditRow(s)}</div>
    </div>
  </div>`;
}

/* ─── Dispatch ─────────────────────────────────────────────────────── */
function handleEditClick(e) {
  const btn = e.target.closest('[data-edit]'); if (!btn) return false;
  const { edit: act, id, curs } = btn.dataset;
  switch (act) {
    case 'move-up':   eSaber_Move(id, -1); break;
    case 'move-down': eSaber_Move(id, +1); break;
    case 'del':       eSaber_Del(id);      break;
    case 'add-saber': eSaber_Add(curs);    break;
    default: return false;
  }
  return true;
}
function handleEditInput(e) {
  const el = e.target; if (!el.dataset.edit) return;
  const { edit: act, id, field, curs } = el.dataset;
  switch (act) {
    case 'field':
      eSaber_UpdateField(id, field, el.value);
      break;
    case 'curs':
      eSaber_UpdateCurs(id, el.value);
      break;
    case 'apareix-present':
      eSaber_UpdateApareix(id, curs, 'present', el.checked);
      break;
    case 'apareix-nota':
      eSaber_UpdateApareix(id, curs, 'nota', el.value);
      break;
  }
}

/* ─── Descàrrega de data-sabers.json ────────────────────────────────── */
function downloadData() {
  const out = { _meta: editSabers._meta, sabers: editSabers.sabers };
  const json = JSON.stringify(out, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'data-sabers.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
