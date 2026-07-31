async function renderAdmin(root) {
  root.innerHTML = `<div class="empty-state">Indlæser…</div>`;
  const [{ database, storage_used_bytes, file_count, user_count }, { logs }] = await Promise.all([
    api.admin.status(),
    api.logs.list({ limit: 50 }),
  ]);

  root.innerHTML = `
    <h2 class="section-title">Administration</h2>
    <p class="section-sub">Systemstatus og aktivitetslog</p>

    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Database</div><div class="stat-value" style="font-size:15px;">${database.ok ? 'OK' : 'Fejl'} · ${formatBytes(database.size_bytes)}</div></div>
      <div class="stat-card"><div class="stat-label">Lagerforbrug</div><div class="stat-value">${formatBytes(storage_used_bytes)}</div></div>
      <div class="stat-card"><div class="stat-label">Antal filer</div><div class="stat-value">${file_count}</div></div>
      <div class="stat-card"><div class="stat-label">Brugere</div><div class="stat-value">${user_count}</div></div>
    </div>

    <div class="panel">
      <div class="row-between">
        <h3 class="section-title" style="font-size:13px;margin:0;">Backup</h3>
        <button class="btn btn-ghost btn-sm" id="backup-btn">Tag database-backup</button>
      </div>
      <p class="section-sub" style="margin:8px 0 0;">Kopierer SQLite-databasen til data/backups/ på serveren.</p>
    </div>

    <div class="panel">
      <h3 class="section-title" style="font-size:13px;">Log</h3>
      <table class="asset-table">
        <thead><tr><th>Tidspunkt</th><th>Type</th><th>Bruger</th><th>Besked</th></tr></thead>
        <tbody>
          ${logs.map((l) => `
            <tr style="cursor:default;">
              <td class="mono">${formatDate(l.created_at)}</td>
              <td><span class="filetype-chip">${l.type}</span></td>
              <td>${escapeHtml(l.user_name || '—')}</td>
              <td>${escapeHtml(l.message)}</td>
            </tr>
          `).join('') || '<tr><td colspan="4" class="section-sub">Ingen log-events endnu.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('backup-btn').addEventListener('click', async () => {
    try {
      await api.admin.backup();
      toast('Backup gennemført', 'success');
    } catch (e) { toast(e.message, 'error'); }
  });
}
