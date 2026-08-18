/* app-repartiment.js — Bootstrap de repartiment.html.
 * Orquestra: mostrar estat de càrrega -> loadRepartimentData() -> gestionar error
 * si falla -> renderitzar -> connectar events -> obrir un tema si l'URL en demana un.
 * És l'únic fitxer que sap en quin ORDRE han de passar les coses; la resta de
 * mòduls (render, edit, links, utils) no en saben res de seqüència.
 *
 * NOTA CORS: aquesta pàgina carrega les dades amb fetch(), cosa que el navegador
 * bloqueja si s'obre el fitxer directament amb file://. Cal servir-la per HTTP
 * (python3 -m http.server, npx serve, Cloudflare Pages, GitHub Pages...). Si es
 * detecta aquest cas, l'estat d'error ho explica igualment de manera clara. */

function showLoading() {
  document.getElementById('main').innerHTML = `
    <div class="state">
      <div class="spinner"></div>
      <div>Carregant el repartiment de continguts…</div>
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
    await loadRepartimentData();
  } catch (err) {
    showError(err);
    return;
  }

  renderTabs();
  renderMain();
  REPARTIMENT_STATE.repartiment.cursos[activeCurs].blocs.forEach(b =>
    document.getElementById(`ss-${activeCurs}__${b.sentit}`)?.classList.add('open'));

  wireEvents();

  // Deep-link: ?tema=<rid> obre directament el tema indicat (arribant des de sabers.html)
  const params = new URLSearchParams(location.search);
  const rid = params.get('tema');
  if (rid) openTemaDirect(rid);
}

function wireEvents() {
  document.getElementById('tabsBar').addEventListener('click', e => {
    const tab = e.target.closest('.ctab'); if (!tab) return;
    switchCurs(tab.dataset.curs);
  });

  document.getElementById('main').addEventListener('click', e => {
    if (isEditing && handleEditClick(e)) return;

    const header = e.target.closest('.s-header');
    if (header) { toggleSection(header.dataset.sid); return; }

    const tog = e.target.closest('.tema-toggle');
    if (tog) { toggleTema(tog.dataset.rid); return; }
  });

  document.getElementById('main').addEventListener('input', e => {
    if (isEditing) handleEditInput(e);
  });

  document.getElementById('btn-edit-start').onclick = startEdit;
  document.getElementById('btn-edit-stop').onclick = stopEdit;
  document.getElementById('btn-edit-dl').onclick = downloadData;
  document.getElementById('move-confirm-btn').onclick = () => closeMoveModal(true);
  document.getElementById('move-cancel-btn').onclick = () => closeMoveModal(false);
  document.getElementById('move-modal-bg').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeMoveModal(false);
  });
}

init();
