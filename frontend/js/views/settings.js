async function renderSettings(root) {
  root.innerHTML = `<div class="empty-state">Indlæser…</div>`;
  const { settings } = await api.settings.get();

  root.innerHTML = `
    <h2 class="section-title">Indstillinger</h2>
    <p class="section-sub">Kun synlig for administratorer</p>
    <div class="panel" style="max-width:480px;">
      <div class="field">
        <label>Upload path</label>
        <input type="text" id="s-upload-path" value="${escapeHtml(settings.upload_path || '')}" />
      </div>
      <div class="field">
        <label>Tilladte filtyper (kommasepareret, * for alle)</label>
        <input type="text" id="s-allowed-types" value="${escapeHtml(settings.allowed_file_types || '*')}" />
      </div>
      <div class="field">
        <label>Maks upload størrelse (MB)</label>
        <input type="number" id="s-max-size" value="${escapeHtml(settings.max_upload_size_mb || '500')}" />
      </div>
      <div class="field">
        <label>Branding-navn</label>
        <input type="text" id="s-branding" value="${escapeHtml(settings.branding_name || '')}" />
      </div>
      <button class="btn btn-primary" id="save-settings-btn">Gem indstillinger</button>
    </div>
  `;

  document.getElementById('save-settings-btn').addEventListener('click', async () => {
    try {
      await api.settings.update({
        upload_path: document.getElementById('s-upload-path').value,
        allowed_file_types: document.getElementById('s-allowed-types').value,
        max_upload_size_mb: document.getElementById('s-max-size').value,
        branding_name: document.getElementById('s-branding').value,
      });
      toast('Indstillinger gemt', 'success');
    } catch (e) { toast(e.message, 'error'); }
  });
}
