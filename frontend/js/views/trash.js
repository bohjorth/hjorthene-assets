async function renderTrash(root) {
  root.innerHTML = `<div class="empty-state">Indlæser…</div>`;
  const canEdit = ['editor', 'admin'].includes(currentUser.role);
  const isAdmin = currentUser.role === 'admin';

  let assets;
  try {
    ({ assets } = await api.assets.trash());
  } catch (e) {
    root.innerHTML = `<div class="empty-state">Kunne ikke hente papirkurven.</div>`;
    return;
  }

  root.innerHTML = `
    <div class="row-between">
      <div>
        <h2 class="section-title">Papirkurv</h2>
        <p class="section-sub">Slettede assets bliver automatisk fjernet permanent efter 30 dage.</p>
      </div>
      ${isAdmin && assets.length ? `<button class="btn btn-danger btn-sm" id="empty-trash-btn">${icon('trash', 'icon icon-sm')} Tøm papirkurv</button>` : ''}
    </div>
    ${assets.length ? `
      <div class="asset-grid" id="trash-grid">
        ${assets.map((a) => `
          <div class="asset-card" data-id="${a.id}">
            <div class="asset-thumb">${a.has_thumbnail ? `<img src="/api/assets/${a.id}/thumbnail" loading="lazy" />` : fileIcon(a.category)}</div>
            <div class="asset-card-body">
              <div class="asset-card-name" title="${escapeHtml(a.original_name)}">${escapeHtml(a.original_name)}</div>
              <div class="asset-card-meta">
                <span class="filetype-chip cat-${a.category}">${extOf(a.original_name)}</span>
                <span class="asset-size">${formatBytes(a.size)}</span>
              </div>
              <p class="section-sub" style="margin:6px 0 0;font-size:10.5px;">Slettet ${formatDate(a.deleted_at)}</p>
              <div style="display:flex; gap:6px; margin-top:8px;">
                ${canEdit ? `<button class="btn btn-ghost btn-sm" data-restore-id="${a.id}" style="flex:1;">${icon('check', 'icon icon-sm')} Gendan</button>` : ''}
                ${isAdmin ? `<button class="btn btn-danger btn-sm" data-permanent-id="${a.id}">${icon('trash', 'icon icon-sm')}</button>` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    ` : `<div class="empty-state"><div class="empty-state-icon">${icon('trash', 'icon-xl')}</div>Papirkurven er tom.</div>`}
  `;

  root.querySelectorAll('[data-restore-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await api.assets.restore(btn.dataset.restoreId);
        toast('Asset gendannet', 'success');
        renderTrash(document.getElementById('view-root'));
      } catch (e) { toast(e.message, 'error'); }
    });
  });

  root.querySelectorAll('[data-permanent-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Slet dette asset PERMANENT? Dette kan ikke fortrydes.')) return;
      try {
        await api.assets.permanentDelete(btn.dataset.permanentId);
        toast('Slettet permanent', 'success');
        renderTrash(document.getElementById('view-root'));
      } catch (e) { toast(e.message, 'error'); }
    });
  });

  document.getElementById('empty-trash-btn')?.addEventListener('click', async () => {
    if (!confirm(`Slet alle ${assets.length} assets i papirkurven PERMANENT? Dette kan ikke fortrydes.`)) return;
    try {
      const result = await api.assets.emptyTrash();
      toast(`${result.count} assets slettet permanent`, 'success');
      renderTrash(document.getElementById('view-root'));
    } catch (e) { toast(e.message, 'error'); }
  });
}
