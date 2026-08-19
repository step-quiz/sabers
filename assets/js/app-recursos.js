/* app-recursos.js — Bootstrap de recursos.html.
 * Mateix patró que app-sabers.js: estat de càrrega -> loadRecursosData() ->
 * error si cal -> renderitzar -> connectar events -> obrir un grup si l'URL
 * en demana un (?recurs-codi=<codi>&recurs-curs=<curs>, arribant des de
 * sabers.html). */

function showLoading() {
  document.getElementById('main').innerHTML = `
    <div class="state">
      <div class="spinner"></div>
      <div>Carregant els recursos…</div>
    </div>`;
}

function showError(err) {
  const isFileProtocol = location.protocol === 'file:';
  document.getElementById('main').innerHTML = `
    <div class="state err">
      <div class="state-box">
        <strong>No s'han pogut carregar les dades.</strong><br><br>
        ${escHtml(err.message)}
        ${isFileProtocol ? `<br><br>Sembla que la pàgina s'ha obert directament com a fitxer
          (<code>file://…</code>). Els navegadors bloquegen la lectura de
          <code>assets/data/*.json</code> en aquest mode per motius de seguretat.
          Cal servir la carpeta amb un servidor HTTP local
          (per exemple <code>python3 -m http.server</code> des de l'arrel del projecte)
          o publicar-la a GitHub Pages / Cloudflare Pages.` : ''}
      </div>
    </div>`;
  document.getElementById('tabsBar').innerHTML = '';
}

async function init() {
  showLoading();
  try {
    await loadRecursosData();
  } catch (err) {
    showError(err);
    return;
  }

  renderTabs();
  renderMain();
  wireEvents();

  const params = new URLSearchParams(location.search);
  const codi = params.get('recurs-codi');
  const curs = params.get('recurs-curs');
  if (codi && curs) openRecursGroupDirect(codi, curs);
}

function wireEvents() {
  document.getElementById('tabsBar').addEventListener('click', e => {
    const tab = e.target.closest('.ctab'); if (!tab) return;
    switchCurs(tab.dataset.curs);
  });

  document.getElementById('main').addEventListener('click', e => {
    if (isEditing && handleEditClick(e)) return;

    if (e.target.closest('[data-action="clear-filters"]')) {
      clearFilters(activeRecursCurs);
      return;
    }
  });

  const debouncedFilter = debounce(() => applyFilters(), 120);
  document.getElementById('main').addEventListener('input', e => {
    if (isEditing) { handleEditInput(e); return; }
    if (e.target.matches('[data-filter="text"]')) { debouncedFilter(); return; }
  });

  document.getElementById('btn-edit-start').onclick = startEdit;
  document.getElementById('btn-edit-stop').onclick = stopEdit;
  document.getElementById('btn-edit-dl').onclick = downloadData;
}

init();
