async function renderDashboard(root) {
  root.innerHTML = `<div class="empty-state">Indlæser…</div>`;
  let data;
  try {
    data = await api.dashboard();
  } catch (e) {
    root.innerHTML = `<div class="empty-state">Kunne ikke hente dashboard-data.</div>`;
    return;
  }

  const maxCat = Math.max(1, ...data.assets_by_category.map((c) => c.count));

  root.innerHTML = `
    <h2 class="section-title">Dashboard</h2>
    <p class="section-sub">Overblik over jeres filarkiv</p>

    <div class="stat-grid">
      <div class="stat-card stat-accent">
        <div class="stat-label">Antal assets</div>
        <div class="stat-value">${data.total_assets}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Lagerforbrug</div>
        <div class="stat-value">${formatBytes(data.storage_used_bytes)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Kategorier i brug</div>
        <div class="stat-value">${data.assets_by_category.length}</div>
      </div>
      <div class="stat-card">
        <button class="btn btn-primary btn-block" id="dash-upload-btn">${icon('upload')} Upload filer</button>
      </div>
    </div>

    <div class="detail-grid">
      <div class="panel">
        <h3 class="section-title" style="font-size:13px;">Assets pr. kategori</h3>
        <div class="category-bars">
          ${data.assets_by_category.map((c) => `
            <div class="category-bar-row">
              <span>${c.category}</span>
              <div class="category-bar-track"><div class="category-bar-fill" style="width:${(c.count / maxCat) * 100}%"></div></div>
              <span class="category-bar-count">${c.count}</span>
            </div>
          `).join('') || '<p class="section-sub">Ingen assets endnu.</p>'}
        </div>
      </div>

      <div class="panel">
        <h3 class="section-title" style="font-size:13px;">Seneste uploads</h3>
        <div class="upload-list">
          ${data.recent_uploads.map((a) => `
            <div class="upload-row">
              <span class="filetype-chip cat-${a.category}">${extOf(a.original_name)}</span>
              <span class="upload-name">${escapeHtml(a.original_name)}</span>
              <span class="upload-meta">${formatBytes(a.size)} · ${formatDate(a.created_at)}</span>
            </div>
          `).join('') || '<p class="section-sub">Ingen uploads endnu.</p>'}
        </div>
      </div>
    </div>
  `;

  document.getElementById('dash-upload-btn').addEventListener('click', () => {
    navigateTo('assets');
    setTimeout(() => document.getElementById('open-upload-btn')?.click(), 50);
  });
}
