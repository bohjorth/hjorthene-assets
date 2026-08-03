const assetsState = {
  folderId: null,
  category: null,
  tag: null,
  q: '',
  sort: 'created_at',
  dir: 'desc',
  view: 'grid',
  folders: [],
  selected: new Set(),
};

async function renderAssets(root, presetQuery = '') {
  assetsState.q = presetQuery;
  root.innerHTML = `
    <div class="assets-layout">
      <div class="assets-sidebar" id="assets-filters">
        <div>
          <div class="row-between" style="margin-bottom:8px;">
            <p class="filter-group-title" style="margin:0;">Mapper</p>
            <button class="btn btn-ghost btn-sm" id="new-folder-btn" title="Ny mappe">${icon('plus')}</button>
          </div>
          <div class="folder-tree" id="folder-tree"></div>
        </div>
        <div>
          <p class="filter-group-title">Kategorier</p>
          <div class="category-filter-list" id="category-filter-list"></div>
        </div>
        <div>
          <p class="filter-group-title">Tags</p>
          <div class="tag-filter-list" id="tag-filter-list"></div>
        </div>
      </div>

      <div class="assets-main">
        <div class="assets-toolbar">
          <div class="assets-toolbar-left">
            <button class="btn btn-primary" id="open-upload-btn">${icon('upload')} Upload</button>
            ${['editor', 'admin'].includes(currentUser.role) ? `<button class="btn btn-ghost" id="import-selfhosted-btn">${icon('download')} Importér fra selfhosted</button>` : ''}
            <select class="select-inline" id="sort-select">
              <option value="created_at">Nyeste først</option>
              <option value="name">Navn (A-Å)</option>
              <option value="size">Størrelse</option>
              <option value="category">Kategori</option>
            </select>
          </div>
          <div class="view-toggle">
            <button data-view="grid" class="active">${icon('view-grid')} Grid</button>
            <button data-view="list">${icon('view-list')} Liste</button>
          </div>
          <button class="btn btn-ghost mobile-filter-toggle" id="mobile-filter-toggle">${icon('filter')} Filtre</button>
        </div>
        <div id="bulk-toolbar"></div>
        <div id="asset-results"></div>
      </div>
    </div>
  `;

  document.getElementById('open-upload-btn').addEventListener('click', openUploadModal);
  document.getElementById('import-selfhosted-btn')?.addEventListener('click', openImportSelfhostedModal);
  document.getElementById('mobile-filter-toggle')?.addEventListener('click', () => {
    document.getElementById('assets-filters').classList.toggle('mobile-open');
  });
  document.getElementById('new-folder-btn').addEventListener('click', () => openFolderModal());
  document.getElementById('sort-select').addEventListener('change', (e) => {
    assetsState.sort = e.target.value;
    loadAssetResults();
  });
  document.querySelectorAll('.view-toggle button').forEach((btn) => {
    btn.addEventListener('click', () => {
      assetsState.view = btn.dataset.view;
      document.querySelectorAll('.view-toggle button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      loadAssetResults();
    });
  });

  await Promise.all([loadFolderTree(), loadCategoryFilters(), loadTagFilters()]);
  await loadAssetResults();
  updateBreadcrumb();
}

async function loadFolderTree() {
  const { folders } = await api.folders.list();
  assetsState.folders = folders;
  const byParent = {};
  folders.forEach((f) => { (byParent[f.parent_id] = byParent[f.parent_id] || []).push(f); });

  function renderLevel(parentId, depth) {
    return (byParent[parentId] || []).map((f) => `
      <div class="folder-tree-item ${assetsState.folderId === f.id ? 'active' : ''}" data-folder-id="${f.id}" style="padding-left:${8 + depth * 14}px">
        <span class="fname">${icon('folder')} ${escapeHtml(f.name)}</span>
        <div class="folder-actions">
          <button data-action="rename" data-id="${f.id}" title="Omdøb">${icon('edit', 'icon icon-sm')}</button>
          <button data-action="delete" data-id="${f.id}" title="Slet">${icon('trash', 'icon icon-sm')}</button>
        </div>
      </div>
      ${renderLevel(f.id, depth + 1)}
    `).join('');
  }

  const tree = document.getElementById('folder-tree');
  tree.innerHTML = `
    <div class="folder-tree-item ${assetsState.folderId === null ? 'active' : ''}" data-folder-id="">
      <span class="fname">${icon('assets')} Alle assets</span>
    </div>
    ${renderLevel(null, 0)}
  `;

  tree.querySelectorAll('.folder-tree-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.folder-actions')) return;
      const id = item.dataset.folderId;
      assetsState.folderId = id ? parseInt(id, 10) : null;
      assetsState.selected.clear();
      loadFolderTree();
      loadAssetResults();
      updateBreadcrumb();
    });

    // Drop-target: træk asset-kort/rækker herhen for at flytte dem
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      item.classList.add('drag-over-target');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over-target'));
    item.addEventListener('drop', async (e) => {
      e.preventDefault();
      item.classList.remove('drag-over-target');
      let ids;
      try {
        ids = JSON.parse(e.dataTransfer.getData('text/plain'));
      } catch (err) {
        return;
      }
      if (!Array.isArray(ids) || !ids.length) return;
      const folderId = item.dataset.folderId ? parseInt(item.dataset.folderId, 10) : null;
      try {
        await api.assets.bulkMove(ids, folderId);
        toast(`${ids.length} asset(s) flyttet`, 'success');
        assetsState.selected.clear();
        loadAssetResults();
        loadFolderTree();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });
  tree.querySelectorAll('[data-action="rename"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const folder = folders.find((f) => f.id === parseInt(btn.dataset.id, 10));
      openFolderModal(folder);
    });
  });
  tree.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Slet denne mappe? Undermapper og indhold flyttes til rod.')) return;
      try {
        await api.folders.remove(btn.dataset.id);
        toast('Mappe slettet', 'success');
        loadFolderTree();
        loadAssetResults();
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

async function loadCategoryFilters() {
  const { categories } = await api.categories.list();
  const list = document.getElementById('category-filter-list');
  list.innerHTML = `
    <div class="category-filter-item ${!assetsState.category ? 'active' : ''}" data-cat="">
      <span>Alle</span><span class="mono">${categories.reduce((s, c) => s + c.count, 0)}</span>
    </div>
    ${categories.filter((c) => c.count > 0).map((c) => `
      <div class="category-filter-item ${assetsState.category === c.name ? 'active' : ''}" data-cat="${c.name}">
        <span>${c.name}</span><span class="mono">${c.count}</span>
      </div>
    `).join('')}
  `;
  list.querySelectorAll('.category-filter-item').forEach((item) => {
    item.addEventListener('click', () => {
      assetsState.category = item.dataset.cat || null;
      assetsState.selected.clear();
      loadCategoryFilters();
      loadAssetResults();
    });
  });
}

async function loadTagFilters() {
  const { tags } = await api.tags.list();
  const list = document.getElementById('tag-filter-list');
  list.innerHTML = tags.map((t) => `
    <span class="tag-pill ${assetsState.tag === t.name ? 'active' : ''}" data-tag="${escapeHtml(t.name)}">${escapeHtml(t.name)} · ${t.asset_count}</span>
  `).join('') || '<span class="section-sub" style="font-size:11.5px;">Ingen tags endnu</span>';
  list.querySelectorAll('.tag-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      assetsState.tag = assetsState.tag === pill.dataset.tag ? null : pill.dataset.tag;
      assetsState.selected.clear();
      loadTagFilters();
      loadAssetResults();
    });
  });
}

async function loadAssetResults() {
  const container = document.getElementById('asset-results');
  container.innerHTML = `<div class="empty-state">Indlæser…</div>`;

  const params = { sort: assetsState.sort === 'name' ? 'name' : assetsState.sort, dir: assetsState.dir };
  if (assetsState.folderId) params.folder_id = assetsState.folderId;
  if (assetsState.category) params.category = assetsState.category;
  if (assetsState.tag) params.tag = assetsState.tag;
  if (assetsState.q) params.q = assetsState.q;

  let assets;
  try {
    ({ assets } = await api.assets.list(params));
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Kunne ikke hente assets.</div>`;
    return;
  }

  if (!assets.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${icon('assets', 'icon-xl')}</div>Ingen assets fundet. Prøv et andet filter, eller <a href="#" id="empty-upload-link">upload en fil</a>.</div>`;
    document.getElementById('empty-upload-link')?.addEventListener('click', (e) => { e.preventDefault(); openUploadModal(); });
    return;
  }

  assetsState.lastResults = assets; // bruges til pil-frem/tilbage i detaljevisningen (lightbox)

  if (assetsState.view === 'grid') {
    container.innerHTML = `<div class="asset-grid">${assets.map(assetCardHtml).join('')}</div>`;
  } else {
    container.innerHTML = `
      <div class="table-scroll">
      <table class="asset-table">
        <thead><tr>
          <th style="width:32px;"><input type="checkbox" id="select-all-checkbox" /></th>
          <th>Navn</th><th>Type</th><th>Størrelse</th><th>Kategori</th><th>Tags</th><th>Upload dato</th><th></th>
        </tr></thead>
        <tbody>
          ${assets.map((a) => `
            <tr data-id="${a.id}" draggable="true">
              <td><input type="checkbox" class="select-checkbox" data-select-id="${a.id}" ${assetsState.selected.has(a.id) ? 'checked' : ''} /></td>
              <td class="name-cell">${fileIcon(a.category)} ${escapeHtml(a.original_name)}${a.processing ? `<span class="processing-badge">${icon('more', 'icon icon-sm')} Analyserer…</span>` : ''}</td>
              <td><span class="filetype-chip cat-${a.category}">${extOf(a.original_name)}</span></td>
              <td class="mono">${formatBytes(a.size)}</td>
              <td>${a.category}</td>
              <td><div class="tag-list-inline">${a.tags.map((t) => `<span class="tag-chip-mini">${escapeHtml(t.name)}</span>`).join('')}</div></td>
              <td class="mono">${formatDate(a.created_at)}</td>
              <td><button class="icon-btn-copy" data-copy-id="${a.id}" title="Kopiér URL">${icon('copy', 'icon icon-sm')}</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      </div>
    `;
    document.getElementById('select-all-checkbox').addEventListener('change', (e) => {
      assets.forEach((a) => (e.target.checked ? assetsState.selected.add(a.id) : assetsState.selected.delete(a.id)));
      loadAssetResults();
    });
  }

  container.querySelectorAll('.asset-card-checkbox').forEach((label) => {
    label.addEventListener('click', (e) => e.stopPropagation());
  });

  container.querySelectorAll('.select-checkbox').forEach((cb) => {
    cb.addEventListener('click', (e) => e.stopPropagation());
    cb.addEventListener('change', (e) => {
      const id = parseInt(e.target.dataset.selectId, 10);
      if (e.target.checked) assetsState.selected.add(id);
      else assetsState.selected.delete(id);
      renderBulkToolbar();
      // Opdater kortets "selected"-styling uden at genindlæse hele listen
      const card = container.querySelector(`.asset-card[data-id="${id}"]`);
      if (card) card.classList.toggle('selected', e.target.checked);
    });
  });

  renderBulkToolbar();

  // Træk-og-slip: gør markerede (eller enkeltstående) assets trækbare til mappetræet
  container.querySelectorAll('[data-id]').forEach((el) => {
    el.addEventListener('dragstart', (e) => {
      const id = parseInt(el.dataset.id, 10);
      const ids = assetsState.selected.has(id) ? Array.from(assetsState.selected) : [id];
      e.dataTransfer.setData('text/plain', JSON.stringify(ids));
      e.dataTransfer.effectAllowed = 'move';
    });
  });

  container.querySelectorAll('[data-id]').forEach((el) => {
    el.addEventListener('click', () => openAssetDetail(parseInt(el.dataset.id, 10), assetsState.lastResults));
  });

  container.querySelectorAll('[data-copy-id]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const url = `${window.location.origin}/api/assets/${btn.dataset.copyId}/preview`;
      const success = await copyToClipboard(url);
      toast(success ? 'URL kopieret' : 'Kunne ikke kopiere URL', success ? 'success' : 'error');
    });
  });

  // Let baggrunds-polling: hvis noget stadig "analyserer", tjek igen om lidt,
  // så badgen forsvinder automatisk uden at brugeren skal genindlæse siden.
  clearTimeout(assetsState._pollTimer);
  if (assets.some((a) => a.processing)) {
    assetsState._pollTimer = setTimeout(() => {
      if (document.getElementById('asset-results')) loadAssetResults();
    }, 4000);
  }
}

function renderBulkToolbar() {
  const bar = document.getElementById('bulk-toolbar');
  if (!bar) return;
  const n = assetsState.selected.size;
  const canEdit = ['editor', 'admin'].includes(currentUser.role);

  if (!n) {
    bar.innerHTML = '';
    return;
  }

  bar.innerHTML = `
    <div class="bulk-bar">
      <span class="bulk-bar-count">${n} valgt</span>
      <button class="btn btn-ghost btn-sm" id="bulk-zip-btn">${icon('download', 'icon icon-sm')} Download som ZIP</button>
      ${canEdit ? `<button class="btn btn-ghost btn-sm" id="bulk-move-btn">${icon('folder', 'icon icon-sm')} Flyt til mappe</button>` : ''}
      ${canEdit ? `<button class="btn btn-ghost btn-sm" id="bulk-tag-btn">${icon('tag', 'icon icon-sm')} Tilføj tag</button>` : ''}
      ${canEdit ? `<button class="btn btn-danger btn-sm" id="bulk-delete-btn">${icon('trash', 'icon icon-sm')} Slet</button>` : ''}
      <button class="btn btn-ghost btn-sm" id="bulk-clear-btn">${icon('close', 'icon icon-sm')} Fravælg alle</button>
    </div>
  `;

  document.getElementById('bulk-zip-btn').addEventListener('click', () => {
    window.location.href = api.assets.zipUrl(Array.from(assetsState.selected));
  });

  document.getElementById('bulk-clear-btn').addEventListener('click', () => {
    assetsState.selected.clear();
    loadAssetResults();
  });

  document.getElementById('bulk-move-btn')?.addEventListener('click', () => {
    const options = [`<option value="">🗂 Alle assets (rod)</option>`]
      .concat(assetsState.folders.map((f) => `<option value="${f.id}">${escapeHtml(f.name)}</option>`));
    openModal(`
      <div class="modal-header"><h3>Flyt ${n} asset(s)</h3><button class="modal-close">${icon('close')}</button></div>
      <div class="modal-body">
        <div class="field">
          <label>Vælg mappe</label>
          <select id="bulk-move-folder" class="select-inline" style="width:100%;">${options.join('')}</select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost modal-close">Annuller</button>
        <button class="btn btn-primary" id="bulk-move-confirm-btn">Flyt</button>
      </div>
    `);
    document.getElementById('bulk-move-confirm-btn').addEventListener('click', async () => {
      const folderId = document.getElementById('bulk-move-folder').value || null;
      try {
        await api.assets.bulkMove(Array.from(assetsState.selected), folderId);
        toast(`${n} asset(s) flyttet`, 'success');
        assetsState.selected.clear();
        closeModal();
        loadAssetResults();
        loadFolderTree();
      } catch (err) { toast(err.message, 'error'); }
    });
  });

  document.getElementById('bulk-tag-btn')?.addEventListener('click', () => {
    openModal(`
      <div class="modal-header"><h3>Tilføj tag til ${n} asset(s)</h3><button class="modal-close">${icon('close')}</button></div>
      <div class="modal-body">
        <div class="field">
          <label>Tags (kommasepareret)</label>
          <input type="text" id="bulk-tag-input" placeholder="fx marketing, 2027" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost modal-close">Annuller</button>
        <button class="btn btn-primary" id="bulk-tag-confirm-btn">Tilføj</button>
      </div>
    `);
    document.getElementById('bulk-tag-input').focus();
    document.getElementById('bulk-tag-confirm-btn').addEventListener('click', async () => {
      const tags = document.getElementById('bulk-tag-input').value.split(',').map((s) => s.trim()).filter(Boolean);
      if (!tags.length) return;
      try {
        await api.assets.bulkTag(Array.from(assetsState.selected), tags);
        toast(`Tags tilføjet til ${n} asset(s)`, 'success');
        assetsState.selected.clear();
        closeModal();
        loadAssetResults();
        loadTagFilters();
      } catch (err) { toast(err.message, 'error'); }
    });
  });

  document.getElementById('bulk-delete-btn')?.addEventListener('click', async () => {
    if (!confirm(`Slet ${n} asset(s)? Dette kan ikke fortrydes.`)) return;
    try {
      await api.assets.bulkDelete(Array.from(assetsState.selected));
      toast(`${n} asset(s) slettet`, 'success');
      assetsState.selected.clear();
      loadAssetResults();
      loadFolderTree();
      loadCategoryFilters();
    } catch (err) { toast(err.message, 'error'); }
  });
}

function assetCardHtml(a) {
  const isImage = a.mime.startsWith('image/');
  const showThumb = a.has_thumbnail && (isImage || a.mime.startsWith('video/'));
  const isSelected = assetsState.selected.has(a.id);
  return `
    <div class="asset-card ${isSelected ? 'selected' : ''}" data-id="${a.id}" draggable="true">
      <label class="asset-card-checkbox" title="Vælg">
        <input type="checkbox" class="select-checkbox" data-select-id="${a.id}" ${isSelected ? 'checked' : ''} />
      </label>
      ${a.processing ? `<span class="processing-badge processing-badge-card">${icon('more', 'icon icon-sm')} Analyserer…</span>` : ''}
      <div class="asset-thumb">${showThumb ? `<img src="/api/assets/${a.id}/thumbnail" loading="lazy" />` : fileIcon(a.category)}</div>
      <div class="asset-card-body">
        <div class="asset-card-name" title="${escapeHtml(a.original_name)}">${escapeHtml(a.original_name)}</div>
        <div class="asset-card-meta">
          <span class="filetype-chip cat-${a.category}">${extOf(a.original_name)}</span>
          <span class="asset-size">${formatBytes(a.size)}</span>
          <button class="icon-btn-copy" data-copy-id="${a.id}" title="Kopiér URL">${icon('copy', 'icon icon-sm')}</button>
        </div>
      </div>
    </div>
  `;
}

function updateBreadcrumb() {
  const bc = document.getElementById('breadcrumb');
  if (!bc) return;
  const chain = [];
  let current = assetsState.folders.find((f) => f.id === assetsState.folderId);
  while (current) {
    chain.unshift(current);
    current = assetsState.folders.find((f) => f.id === current.parent_id);
  }
  bc.innerHTML = `<span class="crumb" data-folder="">Assets</span>` +
    chain.map((f) => `<span class="sep">/</span><span class="crumb" data-folder="${f.id}">${escapeHtml(f.name)}</span>`).join('');
  bc.querySelectorAll('.crumb').forEach((c) => {
    c.addEventListener('click', () => {
      assetsState.folderId = c.dataset.folder ? parseInt(c.dataset.folder, 10) : null;
      loadFolderTree(); loadAssetResults(); updateBreadcrumb();
    });
  });
}

// ---------- Folder create/rename modal ----------
function openFolderModal(folder = null) {
  const overlay = openModal(`
    <div class="modal-header"><h3>${folder ? 'Omdøb mappe' : 'Ny mappe'}</h3><button class="modal-close">${icon('close')}</button></div>
    <div class="modal-body">
      <div class="field"><label>Navn</label><input type="text" id="folder-name-input" value="${folder ? escapeHtml(folder.name) : ''}" placeholder="fx Marketing" /></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost modal-close">Annuller</button>
      <button class="btn btn-primary" id="folder-save-btn">${folder ? 'Gem' : 'Opret'}</button>
    </div>
  `);
  document.getElementById('folder-name-input').focus();
  document.getElementById('folder-save-btn').addEventListener('click', async () => {
    const name = document.getElementById('folder-name-input').value.trim();
    if (!name) return;
    try {
      if (folder) await api.folders.update(folder.id, { name });
      else await api.folders.create({ name, parent_id: assetsState.folderId });
      toast(folder ? 'Mappe omdøbt' : 'Mappe oprettet', 'success');
      closeModal();
      loadFolderTree();
    } catch (e) { toast(e.message, 'error'); }
  });
}

// ---------- Upload modal ----------
function openUploadModal() {
  openModal(`
    <div class="modal-header"><h3>Upload filer</h3><button class="modal-close">${icon('close')}</button></div>
    <div class="modal-body">
      <div class="dropzone" id="dropzone">
        <strong>Slip filer her</strong> eller klik for at vælge<br />
        <input type="file" id="file-input" multiple style="display:none" />
      </div>
      <div class="upload-progress-list" id="upload-progress-list"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost modal-close">Luk</button>
    </div>
  `);

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => handleUploadFiles(fileInput.files));
  ['dragenter', 'dragover'].forEach((evt) => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); }));
  ['dragleave', 'drop'].forEach((evt) => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('drag-over'); }));
  dropzone.addEventListener('drop', (e) => handleUploadFiles(e.dataTransfer.files));
}

async function handleUploadFiles(fileList) {
  const files = Array.from(fileList);
  if (!files.length) return;
  const listEl = document.getElementById('upload-progress-list');
  const rowId = `up-${Date.now()}`;
  listEl.insertAdjacentHTML('beforeend', `
    <div class="upload-progress-row" id="${rowId}">
      <div>${files.length} fil(er) — <span class="mono">0%</span></div>
      <div class="upload-progress-track"><div class="upload-progress-fill" style="width:0%"></div></div>
    </div>
  `);
  const row = document.getElementById(rowId);
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));
  if (assetsState.folderId) formData.append('folder_id', assetsState.folderId);

  try {
    const result = await api.assets.upload(formData, (pct) => {
      row.querySelector('.mono').textContent = `${pct}%`;
      row.querySelector('.upload-progress-fill').style.width = `${pct}%`;
    });
    const uploadedCount = result.assets.length;
    const dupCount = result.duplicates?.length || 0;
    const nearDupNames = result.assets.filter((a) => a.similar?.length).map((a) => a.original_name);

    if (uploadedCount) toast(`${uploadedCount} fil(er) uploadet`, 'success');
    if (dupCount) {
      const names = result.duplicates.map((d) => d.name).join(', ');
      toast(`${dupCount} fil(er) sprunget over - findes allerede: ${names}`, 'error');
    }
    if (nearDupNames.length) {
      toast(`Bemærk: ${nearDupNames.join(', ')} ligner eksisterende billeder - tjek "Ligner også" i detaljevisningen`, 'default');
    }
    loadAssetResults();
    loadFolderTree();
    loadCategoryFilters();
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ---------- Import fra selfhosted-katalog ----------
const importState = { selected: new Map() }; // name -> label

async function openImportSelfhostedModal() {
  importState.selected.clear();

  openModal(`
    <div class="modal-header"><h3>${icon('download')} Importér ikoner</h3><button class="modal-close">${icon('close')}</button></div>
    <div class="import-tabs">
      <button class="import-tab active" data-tab="search">Søg i hele biblioteket</button>
      <button class="import-tab" data-tab="catalog">Kuraret pakke (75 stk.)</button>
    </div>
    <div class="modal-body" id="import-modal-body"></div>
    <div class="modal-footer" id="import-modal-footer"></div>
  `, { wide: true });

  document.querySelectorAll('.import-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.import-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.tab === 'search') renderImportSearchTab();
      else renderImportCatalogTab();
    });
  });

  renderImportSearchTab();
}

function renderImportSearchTab() {
  importState.selected.clear();
  document.getElementById('import-modal-body').innerHTML = `
    <p class="section-sub">
      Søg blandt 7000+ officielle app-ikoner fra <a href="https://selfh.st/icons" target="_blank" rel="noopener">selfh.st/icons</a> (CC BY 4.0).
      Vælg dem du vil have, og importér dem samlet ind i mappen <strong>App-ikoner</strong>.
    </p>
    <div class="field" style="margin-bottom:8px;">
      <input type="text" id="icon-search-input" placeholder="Søg fx 'plex', 'kubernetes', 'wireguard'…" autofocus />
    </div>
    <div id="icon-search-results" class="icon-search-grid"></div>
  `;
  updateImportFooterForSearch();

  const input = document.getElementById('icon-search-input');
  input.addEventListener('input', debounce(async () => {
    const q = input.value.trim();
    const results = document.getElementById('icon-search-results');
    if (!q) { results.innerHTML = ''; return; }
    results.innerHTML = `<div class="empty-state" style="padding:30px;">Søger…</div>`;
    try {
      const { icons } = await api.importSelfhosted.search(q);
      if (!icons.length) {
        results.innerHTML = `<div class="empty-state" style="padding:30px;">Ingen ikoner matchede "${escapeHtml(q)}".</div>`;
        return;
      }
      results.innerHTML = icons.map((i) => `
        <button class="icon-pick ${importState.selected.has(i.name) ? 'selected' : ''}" data-name="${escapeHtml(i.name)}" data-label="${escapeHtml(i.label)}" title="${escapeHtml(i.label)}">
          <img src="https://api.iconify.design/selfhst/${i.name}.svg" loading="lazy" alt="" />
          <span>${escapeHtml(i.label)}</span>
          <span class="icon-pick-check">${icon('check', 'icon icon-sm')}</span>
        </button>
      `).join('');
      results.querySelectorAll('.icon-pick').forEach((btn) => {
        btn.addEventListener('click', () => {
          const { name, label } = btn.dataset;
          if (importState.selected.has(name)) importState.selected.delete(name);
          else importState.selected.set(name, label);
          btn.classList.toggle('selected');
          updateImportFooterForSearch();
        });
      });
    } catch (e) {
      results.innerHTML = `<div class="empty-state" style="padding:30px;">Søgningen fejlede: ${escapeHtml(e.message || 'ukendt fejl')}</div>`;
    }
  }, 400));
}

function updateImportFooterForSearch() {
  const n = importState.selected.size;
  document.getElementById('import-modal-footer').innerHTML = `
    <button class="btn btn-ghost modal-close">Annuller</button>
    <button class="btn btn-primary" id="run-search-import-btn" ${n ? '' : 'disabled'}>Importér valgte (${n})</button>
  `;
  document.getElementById('run-search-import-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const icons = Array.from(importState.selected.entries()).map(([name, label]) => ({ name, label }));
    btn.disabled = true;
    btn.textContent = 'Importerer…';
    try {
      const result = await api.importSelfhosted.importIcons(icons);
      showImportResult(result);
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = `Importér valgte (${n})`;
    }
  });
}

async function renderImportCatalogTab() {
  document.getElementById('import-modal-body').innerHTML = `<div class="empty-state">Indlæser katalog…</div>`;
  let data;
  try {
    data = await api.importSelfhosted.catalog();
  } catch (e) {
    document.getElementById('import-modal-body').innerHTML = `<div class="empty-state">Kunne ikke hente kataloget.</div>`;
    return;
  }

  const categoryList = Object.entries(data.categories)
    .map(([cat, apps]) => `
      <div class="field">
        <label>${escapeHtml(cat)} <span class="mono" style="font-weight:400;">(${apps.length})</span></label>
        <div class="section-sub" style="margin:0;">${apps.map(escapeHtml).join(', ')}</div>
      </div>
    `)
    .join('');

  document.getElementById('import-modal-body').innerHTML = `
    <p class="section-sub">
      Henter et fast, forhåndsvalgt udpluk af ${data.total} populære app-ikoner på én gang og opretter dem i
      <strong>App-ikoner/&lt;kategori&gt;</strong>. Allerede importerede ikoner springes automatisk over.
    </p>
    <div style="max-height:340px; overflow-y:auto; display:flex; flex-direction:column; gap:12px;">
      ${categoryList}
    </div>
  `;
  document.getElementById('import-modal-footer').innerHTML = `
    <button class="btn btn-ghost modal-close">Annuller</button>
    <button class="btn btn-primary" id="run-import-btn">Start import (${data.total} ikoner)</button>
  `;

  document.getElementById('run-import-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Importerer… (kan tage et minuts tid)';
    try {
      const result = await api.importSelfhosted.run();
      showImportResult(result);
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = `Start import (${data.total} ikoner)`;
    }
  });
}

function showImportResult(result) {
  document.getElementById('import-modal-body').innerHTML = `
    <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);">
      <div class="stat-card stat-accent"><div class="stat-label">Importeret</div><div class="stat-value">${result.importedCount}</div></div>
      <div class="stat-card"><div class="stat-label">Sprunget over</div><div class="stat-value">${result.skippedCount}</div></div>
      <div class="stat-card"><div class="stat-label">Ikke fundet</div><div class="stat-value">${result.failedCount}</div></div>
    </div>
    ${result.failed.length ? `
      <p class="section-sub"><strong>Ikke fundet</strong> (prøv evt. et andet søgeord på selfh.st/icons):</p>
      <p class="section-sub">${result.failed.map(escapeHtml).join(', ')}</p>
    ` : ''}
  `;
  document.getElementById('import-modal-footer').innerHTML = `<button class="btn btn-primary modal-close">Luk</button>`;
  document.getElementById('import-modal-footer').querySelector('.modal-close').addEventListener('click', closeModal);
  document.querySelector('.import-tabs')?.remove();
  toast(`${result.importedCount} ikoner importeret`, 'success');
  loadAssetResults();
  loadFolderTree();
  loadCategoryFilters();
  loadTagFilters();
}

// ---------- Asset detail modal ----------
async function openAssetDetail(id, contextList) {
  const { asset } = await api.assets.get(id);
  const canEdit = ['editor', 'admin'].includes(currentUser.role);
  const isImage = asset.mime.startsWith('image/');
  const isVideo = asset.mime.startsWith('video/');
  const isAudio = asset.mime.startsWith('audio/');
  const isPdf = asset.mime === 'application/pdf';

  // Lightbox-navigation: find nabo-billeder i den aktuelt viste liste (kun billeder)
  const imageList = (contextList || []).filter((a) => a.mime.startsWith('image/'));
  const currentIndex = imageList.findIndex((a) => a.id === asset.id);
  const hasPrev = isImage && currentIndex > 0;
  const hasNext = isImage && currentIndex >= 0 && currentIndex < imageList.length - 1;

  let previewHtml = `<span>${fileIcon(asset.category)}</span>`;
  if (isImage) previewHtml = `<img src="/api/assets/${asset.id}/preview" />`;
  else if (isVideo) previewHtml = `<video src="/api/assets/${asset.id}/preview" controls></video>`;
  else if (isAudio) previewHtml = `<audio src="/api/assets/${asset.id}/preview" controls style="width:90%"></audio>`;
  else if (isPdf) previewHtml = `<iframe src="/api/assets/${asset.id}/preview" style="width:100%;height:100%;border:none;"></iframe>`;

  const exifRows = [];
  if (asset.exif?.camera_make || asset.exif?.camera_model) {
    exifRows.push(`<div class="meta-row"><span class="meta-key">Kamera</span><span class="meta-val">${escapeHtml([asset.exif.camera_make, asset.exif.camera_model].filter(Boolean).join(' '))}</span></div>`);
  }
  if (asset.exif?.date_taken) {
    exifRows.push(`<div class="meta-row"><span class="meta-key">Taget den</span><span class="meta-val">${formatDate(asset.exif.date_taken)}</span></div>`);
  }
  if (asset.exif?.gps) {
    const { lat, lon } = asset.exif.gps;
    exifRows.push(`<div class="meta-row"><span class="meta-key">GPS</span><span class="meta-val"><a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}" target="_blank" rel="noopener">${lat.toFixed(5)}, ${lon.toFixed(5)}</a></span></div>`);
  }

  const ocrSection = asset.ocr_text ? `
    <details class="ocr-details">
      <summary>Udtrukket tekst (${asset.mime === 'application/pdf' ? 'fra PDF' : 'OCR'})</summary>
      <pre class="ocr-text">${escapeHtml(asset.ocr_text)}</pre>
    </details>
  ` : '';

  const similarSection = asset.similar?.length ? `
    <details class="ocr-details" open>
      <summary>Ligner også (${asset.similar.length})</summary>
      <div class="similar-grid">
        ${asset.similar.map((s) => `
          <div class="similar-item" data-similar-id="${s.id}">
            <img src="/api/assets/${s.id}/thumbnail" loading="lazy" />
            <div class="similar-label">${escapeHtml(s.name)}</div>
          </div>
        `).join('')}
      </div>
    </details>
  ` : '';

  openModal(`
    <div class="modal-header"><h3>${escapeHtml(asset.original_name)}</h3><button class="modal-close">${icon('close')}</button></div>
    <div class="modal-body">
      <div class="detail-grid">
        <div class="detail-preview" style="position:relative;">
          ${previewHtml}
          ${hasPrev ? `<button class="lightbox-nav prev" id="lightbox-prev">${icon('chevron-right', 'icon')}</button>` : ''}
          ${hasNext ? `<button class="lightbox-nav next" id="lightbox-next">${icon('chevron-right', 'icon')}</button>` : ''}
        </div>
        <div>
          <div class="meta-table">
            <div class="meta-row"><span class="meta-key">Størrelse</span><span class="meta-val">${formatBytes(asset.size)}</span></div>
            <div class="meta-row"><span class="meta-key">MIME-type</span><span class="meta-val">${asset.mime}</span></div>
            <div class="meta-row"><span class="meta-key">Kategori</span><span class="meta-val">${asset.category}</span></div>
            <div class="meta-row"><span class="meta-key">SHA256</span><span class="meta-val" style="font-size:10px;">${asset.sha256}</span></div>
            <div class="meta-row"><span class="meta-key">Upload dato</span><span class="meta-val">${formatDate(asset.created_at)}</span></div>
            ${exifRows.join('')}
          </div>
          ${canEdit ? `
            <div class="field" style="margin-top:16px;">
              <label>Filnavn</label>
              <input type="text" id="edit-name" value="${escapeHtml(asset.original_name)}" />
            </div>
            <div class="field">
              <label>Tags (kommasepareret)</label>
              <input type="text" id="edit-tags" value="${asset.tags.map((t) => t.name).join(', ')}" />
            </div>
          ` : ''}
        </div>
      </div>
      ${ocrSection}
      ${similarSection}
      <details class="ocr-details" id="versions-details">
        <summary>Versionshistorik</summary>
        <div id="versions-body"><div class="section-sub">Indlæser…</div></div>
        ${canEdit ? `
          <div style="margin-top:10px;">
            <input type="file" id="new-version-input" style="display:none;" />
            <button class="btn btn-ghost btn-sm" id="upload-version-btn">${icon('upload', 'icon icon-sm')} Upload ny version</button>
          </div>
        ` : ''}
      </details>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="copy-url-btn">${icon('copy')} Kopiér URL</button>
      <a class="btn btn-ghost" href="/api/assets/${asset.id}/download">${icon('download')} Download</a>
      ${canEdit ? `<button class="btn btn-primary" id="save-meta-btn">${icon('check')} Gem ændringer</button>` : ''}
      ${canEdit ? `<button class="btn btn-danger" id="delete-asset-btn">${icon('trash')} Slet</button>` : ''}
    </div>
  `, { wide: true });

  document.getElementById('lightbox-prev')?.addEventListener('click', () => openAssetDetail(imageList[currentIndex - 1].id, contextList));
  document.getElementById('lightbox-next')?.addEventListener('click', () => openAssetDetail(imageList[currentIndex + 1].id, contextList));

  // Fjern en evt. tidligere lightbox-tastatur-lytter FØRST - ellers hober de
  // sig op for hver gang man navigerer (næste/forrige), og et enkelt
  // piletast-tryk ville trigge alle de gamle lyttere på én gang.
  if (window._lightboxKeyHandler) {
    document.removeEventListener('keydown', window._lightboxKeyHandler);
  }
  const keyHandler = (e) => {
    if (e.key === 'ArrowLeft' && hasPrev) openAssetDetail(imageList[currentIndex - 1].id, contextList);
    else if (e.key === 'ArrowRight' && hasNext) openAssetDetail(imageList[currentIndex + 1].id, contextList);
    else if (e.key === 'Escape') closeModal();
  };
  window._lightboxKeyHandler = keyHandler;
  document.addEventListener('keydown', keyHandler);
  const cleanupKeyHandler = () => {
    document.removeEventListener('keydown', keyHandler);
    if (window._lightboxKeyHandler === keyHandler) window._lightboxKeyHandler = null;
  };
  document.querySelectorAll('.modal-close').forEach((btn) => btn.addEventListener('click', cleanupKeyHandler, { once: true }));
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') cleanupKeyHandler();
  }, { once: true });

  document.querySelectorAll('[data-similar-id]').forEach((el) => {
    el.addEventListener('click', () => openAssetDetail(parseInt(el.dataset.similarId, 10), contextList));
  });

  document.getElementById('copy-url-btn').addEventListener('click', async () => {
    const url = `${window.location.origin}/api/assets/${asset.id}/preview`;
    const success = await copyToClipboard(url);
    toast(success ? 'URL kopieret' : 'Kunne ikke kopiere URL', success ? 'success' : 'error');
  });

  // Versionshistorik indlæses separat (ikke nødvendigt for de fleste assets,
  // så vi undgår at gøre selve detalje-visningen langsommere).
  api.assets.versions(asset.id).then(({ versions }) => {
    const body = document.getElementById('versions-body');
    if (!body) return;
    if (!versions.length) {
      body.innerHTML = `<p class="section-sub" style="margin:0;">Ingen tidligere versioner - dette er den eneste version.</p>`;
      return;
    }
    body.innerHTML = versions.map((v) => `
      <div class="version-row">
        <span>v${v.version_number} · ${escapeHtml(v.original_name)} · ${formatBytes(v.size)} · ${formatDate(v.created_at)}${v.uploader_name ? ' · ' + escapeHtml(v.uploader_name) : ''}</span>
        <a class="btn btn-ghost btn-sm" href="/api/assets/${asset.id}/versions/${v.id}/download">${icon('download', 'icon icon-sm')}</a>
      </div>
    `).join('');
  }).catch(() => {});

  document.getElementById('upload-version-btn')?.addEventListener('click', () => {
    document.getElementById('new-version-input').click();
  });
  document.getElementById('new-version-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const btn = document.getElementById('upload-version-btn');
    btn.disabled = true;
    btn.textContent = 'Uploader ny version…';
    try {
      await api.assets.uploadVersion(asset.id, formData);
      toast('Ny version uploadet', 'success');
      closeModal();
      openAssetDetail(asset.id, contextList);
      loadAssetResults();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = `${icon('upload', 'icon icon-sm')} Upload ny version`;
    }
  });

  document.getElementById('save-meta-btn')?.addEventListener('click', async () => {
    const original_name = document.getElementById('edit-name').value.trim();
    const tags = document.getElementById('edit-tags').value.split(',').map((s) => s.trim()).filter(Boolean);
    try {
      await api.assets.update(asset.id, { original_name, tags });
      toast('Metadata opdateret', 'success');
      closeModal();
      loadAssetResults();
      loadTagFilters();
    } catch (e) { toast(e.message, 'error'); }
  });

  document.getElementById('delete-asset-btn')?.addEventListener('click', async () => {
    if (!confirm(`Slet "${asset.original_name}"? Dette kan ikke fortrydes.`)) return;
    try {
      await api.assets.remove(asset.id);
      toast('Asset slettet', 'success');
      closeModal();
      loadAssetResults();
      loadFolderTree();
    } catch (e) { toast(e.message, 'error'); }
  });
}
