const assetsState = {
  folderId: null,
  category: null,
  tag: null,
  q: '',
  sort: 'created_at',
  dir: 'desc',
  view: 'grid',
  folders: [],
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
      loadFolderTree();
      loadAssetResults();
      updateBreadcrumb();
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

  if (assetsState.view === 'grid') {
    container.innerHTML = `<div class="asset-grid">${assets.map(assetCardHtml).join('')}</div>`;
  } else {
    container.innerHTML = `
      <div class="table-scroll">
      <table class="asset-table">
        <thead><tr>
          <th>Navn</th><th>Type</th><th>Størrelse</th><th>Kategori</th><th>Tags</th><th>Upload dato</th><th></th>
        </tr></thead>
        <tbody>
          ${assets.map((a) => `
            <tr data-id="${a.id}">
              <td class="name-cell">${fileIcon(a.category)} ${escapeHtml(a.original_name)}</td>
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
  }

  container.querySelectorAll('[data-id]').forEach((el) => {
    el.addEventListener('click', () => openAssetDetail(parseInt(el.dataset.id, 10)));
  });

  container.querySelectorAll('[data-copy-id]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const url = `${window.location.origin}/api/assets/${btn.dataset.copyId}/preview`;
      const success = await copyToClipboard(url);
      toast(success ? 'URL kopieret' : 'Kunne ikke kopiere URL', success ? 'success' : 'error');
    });
  });
}

function assetCardHtml(a) {
  const isImage = a.mime.startsWith('image/');
  return `
    <div class="asset-card" data-id="${a.id}">
      <div class="asset-thumb">${isImage ? `<img src="/api/assets/${a.id}/preview" loading="lazy" />` : fileIcon(a.category)}</div>
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
    await api.assets.upload(formData, (pct) => {
      row.querySelector('.mono').textContent = `${pct}%`;
      row.querySelector('.upload-progress-fill').style.width = `${pct}%`;
    });
    toast(`${files.length} fil(er) uploadet`, 'success');
    loadAssetResults();
    loadFolderTree();
    loadCategoryFilters();
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ---------- Import fra selfhosted-katalog ----------
async function openImportSelfhostedModal() {
  openModal(`
    <div class="modal-header"><h3>${icon('download')} Importér fra selfhosted</h3><button class="modal-close">${icon('close')}</button></div>
    <div class="modal-body" id="import-modal-body">
      <div class="empty-state">Indlæser katalog…</div>
    </div>
    <div class="modal-footer" id="import-modal-footer"></div>
  `, { wide: true });

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
      Henter ${data.total} officielle app-ikoner fra <a href="https://selfh.st/icons" target="_blank" rel="noopener">selfh.st/icons</a>
      (${data.license}) og opretter dem som assets i mappen <strong>App-ikoner</strong>, sorteret i undermapper pr. kategori og tagget "selfhosted".
      Allerede importerede ikoner springes automatisk over.
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
      document.getElementById('import-modal-body').innerHTML = `
        <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);">
          <div class="stat-card stat-accent"><div class="stat-label">Importeret</div><div class="stat-value">${result.importedCount}</div></div>
          <div class="stat-card"><div class="stat-label">Sprunget over</div><div class="stat-value">${result.skippedCount}</div></div>
          <div class="stat-card"><div class="stat-label">Ikke fundet</div><div class="stat-value">${result.failedCount}</div></div>
        </div>
        ${result.failed.length ? `
          <p class="section-sub"><strong>Ikke fundet i kataloget</strong> (kan evt. slås op manuelt på selfh.st/icons):</p>
          <p class="section-sub">${result.failed.map(escapeHtml).join(', ')}</p>
        ` : ''}
      `;
      document.getElementById('import-modal-footer').innerHTML = `<button class="btn btn-primary modal-close">Luk</button>`;
      document.getElementById('import-modal-footer').querySelector('.modal-close').addEventListener('click', closeModal);
      toast(`${result.importedCount} ikoner importeret`, 'success');
      loadAssetResults();
      loadFolderTree();
      loadCategoryFilters();
      loadTagFilters();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = `Start import (${data.total} ikoner)`;
    }
  });
}

// ---------- Asset detail modal ----------
async function openAssetDetail(id) {
  const { asset } = await api.assets.get(id);
  const canEdit = ['editor', 'admin'].includes(currentUser.role);
  const isImage = asset.mime.startsWith('image/');
  const isVideo = asset.mime.startsWith('video/');
  const isAudio = asset.mime.startsWith('audio/');
  const isPdf = asset.mime === 'application/pdf';

  let previewHtml = `<span>${fileIcon(asset.category)}</span>`;
  if (isImage) previewHtml = `<img src="/api/assets/${asset.id}/preview" />`;
  else if (isVideo) previewHtml = `<video src="/api/assets/${asset.id}/preview" controls></video>`;
  else if (isAudio) previewHtml = `<audio src="/api/assets/${asset.id}/preview" controls style="width:90%"></audio>`;
  else if (isPdf) previewHtml = `<iframe src="/api/assets/${asset.id}/preview" style="width:100%;height:100%;border:none;"></iframe>`;

  openModal(`
    <div class="modal-header"><h3>${escapeHtml(asset.original_name)}</h3><button class="modal-close">${icon('close')}</button></div>
    <div class="modal-body">
      <div class="detail-grid">
        <div class="detail-preview">${previewHtml}</div>
        <div>
          <div class="meta-table">
            <div class="meta-row"><span class="meta-key">Størrelse</span><span class="meta-val">${formatBytes(asset.size)}</span></div>
            <div class="meta-row"><span class="meta-key">MIME-type</span><span class="meta-val">${asset.mime}</span></div>
            <div class="meta-row"><span class="meta-key">Kategori</span><span class="meta-val">${asset.category}</span></div>
            <div class="meta-row"><span class="meta-key">SHA256</span><span class="meta-val" style="font-size:10px;">${asset.sha256}</span></div>
            <div class="meta-row"><span class="meta-key">Upload dato</span><span class="meta-val">${formatDate(asset.created_at)}</span></div>
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
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="copy-url-btn">${icon('copy')} Kopiér URL</button>
      <a class="btn btn-ghost" href="/api/assets/${asset.id}/download">${icon('download')} Download</a>
      ${canEdit ? `<button class="btn btn-primary" id="save-meta-btn">${icon('check')} Gem ændringer</button>` : ''}
      ${canEdit ? `<button class="btn btn-danger" id="delete-asset-btn">${icon('trash')} Slet</button>` : ''}
    </div>
  `, { wide: true });

  document.getElementById('copy-url-btn').addEventListener('click', async () => {
    const url = `${window.location.origin}/api/assets/${asset.id}/preview`;
    const success = await copyToClipboard(url);
    toast(success ? 'URL kopieret' : 'Kunne ikke kopiere URL', success ? 'success' : 'error');
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
