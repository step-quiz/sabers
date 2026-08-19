/* recursos-edit.js — Mode edició de la pàgina "Recursos".
 * Depèn de: utils.js (escHtml, slugify), recursos-render.js (RECURSOS_STATE,
 *           activeRecursCurs, CURS_LABELS_CURT_R, recursosGroupedPerCurs).
 * Exposa (globals): isEditing, startEdit(), stopEdit(), handleEditClick(e),
 *                    handleEditInput(e), downloadData().
 * Mateix patró que sabers-edit.js: array pla (recursos._recursos), cada fila
 * és independent amb el seu propi { codi, curs }; "moure" reordena dins del
 * mateix grup codi+curs (amunt/avall), com sabers.js reordena dins del mateix
 * curs. Afegir un recurs nou el crea dins del grup codi+curs on s'ha premut
 * "+ Afegir", amb codi/curs pre-omplerts i editables igualment. */

let isEditing = false;
let editRecursos = null; // còpia mutable de RECURSOS_STATE.recursos durant l'edició

/* ─── Start / stop ────────────────────────────────────────────────── */
function startEdit() {
  editRecursos = JSON.parse(JSON.stringify(RECURSOS_STATE.recursos));
  isEditing = true;
  document.body.classList.add('is-editing');
  renderMainEdit();
}

function stopEdit() {
  const dirty = JSON.stringify(editRecursos) !== JSON.stringify(RECURSOS_STATE.recursos);
  if (dirty && !confirm("Hi ha canvis que no heu descarregat. Sortir igualment?")) return;
  editRecursos = null;
  isEditing = false;
  document.body.classList.remove('is-editing');
  renderMain();
}

/* ─── Helpers d'accés ─────────────────────────────────────────────── */
function eRecurs(id) {
  return editRecursos.recursos.find(r => r.id === id) || null;
}
function eGroupedPerCurs(curs) {
  const items = editRecursos.recursos.filter(r => r.curs === curs);
  const order = [];
  const byCodi = {};
  for (const r of items) {
    if (!byCodi[r.codi]) { byCodi[r.codi] = []; order.push(r.codi); }
    byCodi[r.codi].push(r);
  }
  return order.map(codi => ({ codi, items: byCodi[codi] }));
}

/* ─── Operacions ──────────────────────────────────────────────────── */
function eRecurs_Move(id, dir) {
  const r = eRecurs(id); if (!r) return;
  const { codi, curs } = r;
  const arr = editRecursos.recursos;
  const sameGroup = arr.filter(x => x.codi === codi && x.curs === curs);
  const i = sameGroup.findIndex(x => x.id === id);
  const ni = i + dir;
  if (ni < 0 || ni >= sameGroup.length) return;
  const gi = arr.findIndex(x => x.id === sameGroup[i].id);
  const gni = arr.findIndex(x => x.id === sameGroup[ni].id);
  [arr[gi], arr[gni]] = [arr[gni], arr[gi]];
  rerenderCurs(curs);
}
function eRecurs_Del(id) {
  const r = eRecurs(id); if (!r) return;
  if (!confirm(`Suprimir el recurs "${r.titol}"?`)) return;
  const curs = r.curs;
  editRecursos.recursos = editRecursos.recursos.filter(x => x.id !== id);
  rerenderCurs(curs);
}
function eRecurs_Add(curs, codi) {
  const usedIds = new Set(editRecursos.recursos.map(r => r.id));
  let base = slugify('nou-recurs-' + codi) || 'nou-recurs';
  let id = base, n = 2;
  while (usedIds.has(id)) { id = `${base}-${n++}`; }
  const nou = {
    id, titol: 'Nou recurs', descripcio: '', url: '', codi, curs, font: '',
  };
  editRecursos.recursos.push(nou);
  rerenderCurs(curs);
  requestAnimationFrame(() => {
    document.getElementById('recurs-edit-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}
function eRecurs_AddGroup(curs) {
  const codi = prompt("Codi curricular del nou bloc (p. ex. NUM.RE):");
  if (!codi || !codi.trim()) return;
  eRecurs_Add(curs, codi.trim());
}
function eRecurs_UpdateField(id, field, value) {
  const r = eRecurs(id); if (!r) return;
  const oldCurs = r.curs;
  r[field] = value;
  // si es canvia codi o curs, el recurs canvia de grup: cal re-renderitzar
  // tant el grup d'origen com el de destí (si el curs també ha canviat).
  rerenderCurs(oldCurs);
  if (field === 'curs' && value !== oldCurs) rerenderCurs(value);
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
  for (const curs of RECURSOS_STATE.recursos._meta.cursOrder) {
    main.appendChild(buildCursViewEdit(curs));
  }
}

function buildCursViewEdit(curs) {
  const div = document.createElement('div');
  div.className = 'cview' + (curs === activeRecursCurs ? ' active' : '');
  div.id = 'cv-' + curs;
  const groups = eGroupedPerCurs(curs);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  div.innerHTML = `
    <div class="cview-header">
      <h2>${escHtml(CURS_LABELS_CURT_R[curs] || curs)} <small style="font-weight:400;color:var(--muted);font-size:15px">· Recursos</small></h2>
      <span class="meta">${total} recurs${total === 1 ? '' : 'os'}</span>
    </div>
    <div id="sl-${curs}">
      ${groups.map(g => buildGroupBlockEdit(curs, g)).join('')}
    </div>
    <button class="edit-add-btn" data-edit="add-group" data-curs="${escHtml(curs)}">+ Afegir bloc curricular nou a ${escHtml(CURS_LABELS_CURT_R[curs] || curs)}</button>
  `;
  return div;
}

function buildGroupBlockEdit(curs, group) {
  return `<div class="recurs-group" data-codi="${escHtml(group.codi)}">
    <div class="recurs-group-head">
      <span class="saber-codi numeric">${escHtml(group.codi)}</span>
      <span class="recurs-group-count">${group.items.length} recurs${group.items.length === 1 ? '' : 'os'}</span>
    </div>
    <div>
      ${group.items.map((r, i) => buildRecursCardEdit(r, i, group.items.length)).join('')}
    </div>
    <button class="edit-add-btn" data-edit="add-recurs" data-curs="${escHtml(curs)}" data-codi="${escHtml(group.codi)}">+ Afegir recurs a ${escHtml(group.codi)}</button>
  </div>`;
}

function buildRecursCardEdit(r, i, total) {
  return `<div class="recurs-card" id="recurs-edit-${escHtml(r.id)}">
    <div class="edit-tema-head">
      <input class="tema-label-inp" style="flex:1" type="text" value="${escHtml(r.titol)}"
        data-edit="field" data-field="titol" data-id="${escHtml(r.id)}" placeholder="Títol del recurs">
      <div class="edit-mini-btns">
        <button class="edit-mini-btn" title="Amunt" data-edit="move-up" data-id="${escHtml(r.id)}" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="edit-mini-btn" title="Avall" data-edit="move-down" data-id="${escHtml(r.id)}" ${i === total - 1 ? 'disabled' : ''}>▼</button>
        <button class="edit-mini-btn del" title="Suprimeix recurs" data-edit="del" data-id="${escHtml(r.id)}">✕</button>
      </div>
    </div>
    <div class="saber-edit-grid">
      <div class="saber-edit-field" style="grid-column:1/-1"><label>URL</label>
        <input type="text" value="${escHtml(r.url)}" data-edit="field" data-field="url" data-id="${escHtml(r.id)}"></div>
      <div class="saber-edit-field"><label>Codi curricular</label>
        <input type="text" value="${escHtml(r.codi)}" data-edit="field" data-field="codi" data-id="${escHtml(r.id)}"></div>
      <div class="saber-edit-field"><label>Curs</label>
        <select data-edit="field" data-field="curs" data-id="${escHtml(r.id)}">
          ${RECURSOS_STATE.recursos._meta.cursOrder.map(c =>
            `<option value="${c}"${c === r.curs ? ' selected' : ''}>${escHtml(CURS_LABELS_CURT_R[c] || c)}</option>`).join('')}
        </select></div>
      <div class="saber-edit-field" style="grid-column:1/-1"><label>Font / atribució</label>
        <input type="text" value="${escHtml(r.font || '')}" data-edit="field" data-field="font" data-id="${escHtml(r.id)}"></div>
      <div class="saber-edit-field" style="grid-column:1/-1"><label>Descripció</label>
        <textarea data-edit="field" data-field="descripcio" data-id="${escHtml(r.id)}">${escHtml(r.descripcio)}</textarea></div>
    </div>
  </div>`;
}

/* ─── Dispatch ─────────────────────────────────────────────────────── */
function handleEditClick(e) {
  const btn = e.target.closest('[data-edit]'); if (!btn) return false;
  const { edit: act, id, curs, codi } = btn.dataset;
  switch (act) {
    case 'move-up':    eRecurs_Move(id, -1);      break;
    case 'move-down':  eRecurs_Move(id, +1);      break;
    case 'del':        eRecurs_Del(id);           break;
    case 'add-recurs': eRecurs_Add(curs, codi);   break;
    case 'add-group':  eRecurs_AddGroup(curs);    break;
    default: return false;
  }
  return true;
}
function handleEditInput(e) {
  const el = e.target; if (!el.dataset.edit) return;
  const { edit: act, id, field } = el.dataset;
  if (act === 'field') eRecurs_UpdateField(id, field, el.value);
}

/* ─── Descàrrega de data-recursos.json ────────────────────────────── */
function downloadData() {
  const out = { _meta: editRecursos._meta, recursos: editRecursos.recursos };
  const json = JSON.stringify(out, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'data-recursos.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
