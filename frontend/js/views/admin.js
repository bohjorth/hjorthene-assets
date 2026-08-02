async function renderAdmin(root) {
  root.innerHTML = `<div class="empty-state">Indlæser…</div>`;
  const [{ database, storage_used_bytes, file_count, user_count, disk }, { logs }] = await Promise.all([
    api.admin.status(),
    api.logs.list({ limit: 50 }),
  ]);

  let diskPanel = '';
  if (disk) {
    const pct = disk.used_percent;
    const fillClass = pct >= 90 ? 'critical' : pct >= 75 ? 'warn' : '';
    diskPanel = `
      <div class="panel">
        <div class="row-between">
          <h3 class="section-title" style="font-size:13px;margin:0;">Diskplads</h3>
          <span class="mono" style="font-size:12px;">${formatBytes(disk.used_bytes)} / ${formatBytes(disk.total_bytes)} (${pct}%)</span>
        </div>
        <div class="disk-usage-track"><div class="disk-usage-fill ${fillClass}" style="width:${pct}%"></div></div>
        ${pct >= 90 ? `<p class="section-sub" style="color:var(--danger); margin:6px 0 0;">⚠ Disken er ved at være fuld - overvej at rydde op eller udvide lagerplads.</p>` : ''}
        ${pct >= 75 && pct < 90 ? `<p class="section-sub" style="margin:6px 0 0;">Diskforbruget nærmer sig grænsen - hold øje med det.</p>` : ''}
      </div>
    `;
  }

  root.innerHTML = `
    <h2 class="section-title">Administration</h2>
    <p class="section-sub">Systemstatus og aktivitetslog</p>

    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Database</div><div class="stat-value" style="font-size:15px;">${database.ok ? 'OK' : 'Fejl'} · ${formatBytes(database.size_bytes)}</div></div>
      <div class="stat-card"><div class="stat-label">Lagerforbrug (uploads)</div><div class="stat-value">${formatBytes(storage_used_bytes)}</div></div>
      <div class="stat-card"><div class="stat-label">Antal filer</div><div class="stat-value">${file_count}</div></div>
      <div class="stat-card"><div class="stat-label">Brugere</div><div class="stat-value">${user_count}</div></div>
    </div>

    ${diskPanel}

    <div class="panel">
      <div class="row-between">
        <h3 class="section-title" style="font-size:13px;margin:0;">Backup</h3>
        <button class="btn btn-ghost btn-sm" id="backup-btn">${icon('download')} Tag database-backup nu</button>
      </div>
      <p class="section-sub" style="margin:8px 0 0;">
        Kopierer SQLite-databasen til data/backups/ på serveren. Der kører desuden en automatisk daglig backup
        (database + uploads) kl. 03:00 via en systemd-timer på serveren, se scripts/backup.sh.
      </p>
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
