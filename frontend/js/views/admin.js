async function renderAdmin(root) {
  root.innerHTML = `<div class="empty-state">Indlæser…</div>`;
  const [{ database, storage_used_bytes, file_count, user_count, disk, missing_thumbnails }, { logs }] = await Promise.all([
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
        <h3 class="section-title" style="font-size:13px;margin:0;">Eksport</h3>
        <a class="btn btn-ghost btn-sm" href="/api/assets/export/csv">${icon('download', 'icon icon-sm')} Eksportér CSV</a>
      </div>
      <p class="section-sub" style="margin:8px 0 0;">
        Hele asset-oversigten (filnavn, kategori, mappe, tags, uploader, dato) som CSV til rapportering/audit.
      </p>
    </div>

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

    ${missing_thumbnails > 0 ? `
      <div class="panel">
        <div class="row-between">
          <h3 class="section-title" style="font-size:13px;margin:0;">Manglende thumbnails</h3>
          <button class="btn btn-ghost btn-sm" id="gen-thumbnails-btn">${icon('assets', 'icon icon-sm')} Generér ${missing_thumbnails} manglende</button>
        </div>
        <p class="section-sub" style="margin:8px 0 0;">
          ${missing_thumbnails} billede(r)/video(er) mangler en thumbnail (fx importeret før funktionen fandtes).
          Genererer dem uden at røre selve filerne.
        </p>
      </div>
    ` : ''}

    <div class="panel">
      <div class="row-between">
        <h3 class="section-title" style="font-size:13px;margin:0;">SVG-sikkerhed</h3>
        <button class="btn btn-ghost btn-sm" id="resanitize-btn">${icon('check', 'icon icon-sm')} Gensanér alle SVG'er</button>
      </div>
      <p class="section-sub" style="margin:8px 0 0;">
        Engangs-oprydning: kører alle allerede-uploadede SVG'er igennem den nyeste sikkerheds-rensning
        (fjerner evt. script/event-handlers fra filer uploadet før den funktion fandtes).
      </p>
    </div>

    <div class="panel">
      <div class="row-between">
        <h3 class="section-title" style="font-size:13px;margin:0;">Lokale test-brugere</h3>
        <button class="btn btn-ghost btn-sm" id="new-local-user-btn">${icon('plus', 'icon icon-sm')} Opret</button>
      </div>
      <p class="section-sub" style="margin:8px 0 12px;">
        Logger ind uden om Authentik - til test eller nødadgang. Findes under "Log ind med lokal test-bruger" på login-siden.
      </p>
      <div id="local-users-body"><div class="section-sub">Indlæser…</div></div>
    </div>

    <div class="panel">
      <h3 class="section-title" style="font-size:13px;margin:0 0 4px;">Aktive delelinks</h3>
      <p class="section-sub" style="margin:0 0 12px;">Samlet oversigt over alle offentlige delelinks på tværs af assets.</p>
      <div id="share-links-admin-body"><div class="section-sub">Indlæser…</div></div>
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

  document.getElementById('gen-thumbnails-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Genererer…';
    try {
      const result = await api.admin.generateMissingThumbnails();
      toast(`${result.succeeded} thumbnails genereret${result.failed ? `, ${result.failed} fejlede` : ''}`, 'success');
      renderAdmin(document.getElementById('view-root'));
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = `${icon('assets', 'icon icon-sm')} Generér manglende`;
    }
  });

  document.getElementById('resanitize-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Gensanerer…';
    try {
      const result = await api.admin.resanitizeSvgs();
      toast(`${result.changed} af ${result.total} SVG'er blev renset${result.failed ? `, ${result.failed} fejlede` : ''}`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon('check', 'icon icon-sm')} Gensanér alle SVG'er`;
    }
  });

  loadLocalUsers();
  document.getElementById('new-local-user-btn').addEventListener('click', openNewLocalUserModal);
  loadShareLinksAdmin();
}

async function loadLocalUsers() {
  const body = document.getElementById('local-users-body');
  if (!body) return;
  const { users } = await api.localUsers.list();
  if (!users.length) {
    body.innerHTML = `<p class="section-sub" style="margin:0;">Ingen lokale test-brugere oprettet endnu.</p>`;
    return;
  }
  body.innerHTML = `
    <table class="asset-table">
      <thead><tr><th>Navn</th><th>Email</th><th>Rolle</th><th>Sidst logget ind</th><th></th></tr></thead>
      <tbody>
        ${users.map((u) => `
          <tr style="cursor:default;">
            <td>${escapeHtml(u.name)}</td>
            <td class="mono">${escapeHtml(u.email)}</td>
            <td><span class="badge badge-${u.role}">${u.role}</span></td>
            <td class="mono">${u.last_login_at ? formatDate(u.last_login_at) : '—'}</td>
            <td>
              <button class="icon-btn-copy" data-reset-id="${u.id}" title="Nulstil password">${icon('edit', 'icon icon-sm')}</button>
              <button class="icon-btn-copy" data-delete-id="${u.id}" title="Slet">${icon('trash', 'icon icon-sm')}</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  body.querySelectorAll('[data-delete-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Slet denne lokale test-bruger?')) return;
      try {
        await api.localUsers.remove(btn.dataset.deleteId);
        toast('Bruger slettet', 'success');
        loadLocalUsers();
      } catch (e) { toast(e.message, 'error'); }
    });
  });

  body.querySelectorAll('[data-reset-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const newPassword = prompt('Nyt password (mindst 8 tegn):');
      if (!newPassword) return;
      try {
        await api.localUsers.update(btn.dataset.resetId, { password: newPassword });
        toast('Password nulstillet', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
  });
}

async function loadShareLinksAdmin() {
  const body = document.getElementById('share-links-admin-body');
  if (!body) return;
  const { links } = await api.admin.shareLinks();
  if (!links.length) {
    body.innerHTML = `<p class="section-sub" style="margin:0;">Ingen aktive delelinks lige nu.</p>`;
    return;
  }
  body.innerHTML = `
    <table class="asset-table">
      <thead><tr><th>Asset</th><th>Oprettet af</th><th>Oprettet</th><th>Udløber</th><th></th></tr></thead>
      <tbody>
        ${links.map((l) => `
          <tr data-open-asset="${l.asset_id}">
            <td class="name-cell">${escapeHtml(l.asset_name)}</td>
            <td>${escapeHtml(l.created_by_name || '—')}</td>
            <td class="mono">${formatDate(l.created_at)}</td>
            <td class="mono">${l.expires_at ? formatDate(l.expires_at) : 'Aldrig'}</td>
            <td>
              <button class="icon-btn-copy" data-copy-link="${window.location.origin}/api/share/${l.token}" title="Kopiér link">${icon('copy', 'icon icon-sm')}</button>
              <button class="icon-btn-copy" data-revoke-link="${l.id}" title="Tilbagekald">${icon('trash', 'icon icon-sm')}</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  body.querySelectorAll('[data-open-asset]').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      navigateTo('assets');
      setTimeout(() => openAssetDetail(parseInt(row.dataset.openAsset, 10)), 300);
    });
  });
  body.querySelectorAll('[data-copy-link]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const success = await copyToClipboard(btn.dataset.copyLink);
      toast(success ? 'Link kopieret' : 'Kunne ikke kopiere', success ? 'success' : 'error');
    });
  });
  body.querySelectorAll('[data-revoke-link]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Tilbagekald dette link? Det holder op med at virke med det samme.')) return;
      try {
        await api.admin.revokeShareLink(btn.dataset.revokeLink);
        toast('Link tilbagekaldt', 'success');
        loadShareLinksAdmin();
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

function openNewLocalUserModal() {
  openModal(`
    <div class="modal-header"><h3>Opret lokal test-bruger</h3><button class="modal-close">${icon('close')}</button></div>
    <div class="modal-body">
      <div class="field"><label>Navn</label><input type="text" id="lu-name" /></div>
      <div class="field"><label>Email</label><input type="email" id="lu-email" /></div>
      <div class="field"><label>Password (mindst 8 tegn)</label><input type="password" id="lu-password" /></div>
      <div class="field">
        <label>Rolle</label>
        <select id="lu-role" class="select-inline" style="width:100%;">
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost modal-close">Annuller</button>
      <button class="btn btn-primary" id="create-local-user-btn">Opret</button>
    </div>
  `);
  document.getElementById('create-local-user-btn').addEventListener('click', async () => {
    const name = document.getElementById('lu-name').value.trim();
    const email = document.getElementById('lu-email').value.trim();
    const password = document.getElementById('lu-password').value;
    const role = document.getElementById('lu-role').value;
    if (!name || !email || !password) return toast('Udfyld alle felter', 'error');
    try {
      await api.localUsers.create({ name, email, password, role });
      toast('Lokal test-bruger oprettet', 'success');
      closeModal();
      loadLocalUsers();
    } catch (e) { toast(e.message, 'error'); }
  });
}
