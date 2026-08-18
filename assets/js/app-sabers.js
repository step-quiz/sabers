/* app-sabers.js — Bootstrap de sabers.html.
 * Mateix patró que app-repartiment.js: estat de càrrega -> loadSabersData() ->
 * error si cal -> renderitzar -> connectar events -> obrir un saber si l'URL en
 * demana un (?saber=<id>, arribant des de repartiment.html). */

function showLoading() {
  document.getElementById('main').innerHTML = `
    <div class="state">
      <div class="spinner"></div>
      <div>Carregant els sabers…</div>
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
    await loadSabersData();
  } catch (err) {
    showError(err);
    return;
  }

  renderTabs();
  renderMain();
  wireEvents();

  const params = new URLSearchParams(location.search);
  const saberId = params.get('saber');
  if (saberId) openSaberDirect(saberId);
}

function wireEvents() {
  document.getElementById('tabsBar').addEventListener('click', e => {
    const tab = e.target.closest('.ctab'); if (!tab) return;
    switchCurs(tab.dataset.curs);
  });

  document.getElementById('main').addEventListener('click', e => {
    if (isEditing && handleEditClick(e)) return;

    if (e.target.closest('[data-action="clear-filters"]')) {
      clearFilters(activeSaberCurs);
      return;
    }

    const head = e.target.closest('.saber-head');
    if (head) { toggleSaber(head.dataset.toggle); return; }
  });

  const debouncedFilter = debounce(() => applyFilters(), 120);
  document.getElementById('main').addEventListener('input', e => {
    if (isEditing) { handleEditInput(e); return; }
    if (e.target.matches('[data-filter="text"]')) { debouncedFilter(); return; }
  });
  document.getElementById('main').addEventListener('change', e => {
    if (!isEditing && e.target.matches('[data-filter="sentit"]')) applyFilters();
  });

  document.getElementById('btn-edit-start').onclick = startEdit;
  document.getElementById('btn-edit-stop').onclick = stopEdit;
  document.getElementById('btn-edit-dl').onclick = downloadData;
}

init();
