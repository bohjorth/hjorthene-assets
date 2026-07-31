async function renderCollections(root) {
  root.innerHTML = `<div class="empty-state">Indlæser…</div>`;
  const { collections } = await api.collections.list();
  const canEdit = ['editor', 'admin'].includes(currentUser.role);

  root.innerHTML = `
    <div class="row-between">
      <div>
        <h2 class="section-title">Collections</h2>
        <p class="section-sub">Virtuelle samlinger — filer ligger kun ét sted, men kan indgå i flere collections</p>
      </div>
      ${canEdit ? `<button class="btn btn-primary" id="new-collection-btn">+ Ny collection</button>` : ''}
    </div>
    ${collections.length ? `
      <div class="collection-grid">
        ${collections.map((c) => `
          <div class="collection-card" data-id="${c.id}">
            <h4>✦ ${escapeHtml(c.name)}</h4>
            <p>${c.asset_count} asset(s)${c.description ? ' · ' + escapeHtml(c.description) : ''}</p>
          </div>
        `).join('')}
      </div>
    ` : `<div class="empty-state"><div class="empty-state-icon">✦</div>Ingen collections endnu.</div>`}
  `;

  document.getElementById('new-collection-btn')?.addEventListener('click', () => {
    openModal(`
      <div class="modal-header"><h3>Ny collection</h3><button class="modal-close">✕</button></div>
      <div class="modal-body">
        <div class="field"><label>Navn</label><input type="text" id="coll-name" placeholder="fx Kampagne 2027" /></div>
        <div class="field"><label>Beskrivelse (valgfri)</label><textarea id="coll-desc" rows="3"></textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost modal-close">Annuller</button>
        <button class="btn btn-primary" id="coll-save-btn">Opret</button>
      </div>
    `);
    document.getElementById('coll-save-btn').addEventListener('click', async () => {
      const name = document.getElementById('coll-name').value.trim();
      if (!name) return;
      const description = document.getElementById('coll-desc').value.trim();
      try {
        await api.collections.create({ name, description });
        toast('Collection oprettet', 'success');
        closeModal();
        renderCollections(document.getElementById('view-root'));
      } catch (e) { toast(e.message, 'error'); }
    });
  });

  root.querySelectorAll('.collection-card').forEach((card) => {
    card.addEventListener('click', () => openCollectionDetail(parseInt(card.dataset.id, 10)));
  });
}

async function openCollectionDetail(id) {
  const { collection } = await api.collections.get(id);
  const canEdit = ['editor', 'admin'].includes(currentUser.role);

  openModal(`
    <div class="modal-header"><h3>✦ ${escapeHtml(collection.name)}</h3><button class="modal-close">✕</button></div>
    <div class="modal-body">
      ${collection.description ? `<p class="section-sub">${escapeHtml(collection.description)}</p>` : ''}
      ${collection.assets.length ? `
        <div class="asset-grid">${collection.assets.map((a) => `
          <div class="asset-card" data-id="${a.id}">
            <div class="asset-thumb">${a.mime.startsWith('image/') ? `<img src="/api/assets/${a.id}/preview" />` : fileIcon(a.category)}</div>
            <div class="asset-card-body">
              <div class="asset-card-name">${escapeHtml(a.original_name)}</div>
              <div class="asset-card-meta">
                <span class="filetype-chip cat-${a.category}">${extOf(a.original_name)}</span>
                ${canEdit ? `<button class="btn btn-ghost btn-sm" data-remove="${a.id}">Fjern</button>` : ''}
              </div>
            </div>
          </div>
        `).join('')}</div>
      ` : `<div class="empty-state">Ingen assets i denne collection endnu.</div>`}
    </div>
    <div class="modal-footer">
      ${canEdit ? `<button class="btn btn-danger" id="delete-coll-btn">Slet collection</button>` : ''}
    </div>
  `, { wide: true });

  document.getElementById('delete-coll-btn')?.addEventListener('click', async () => {
    if (!confirm(`Slet collectionen "${collection.name}"?`)) return;
    await api.collections.remove(collection.id);
    toast('Collection slettet', 'success');
    closeModal();
    renderCollections(document.getElementById('view-root'));
  });

  document.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await api.collections.removeAsset(collection.id, btn.dataset.remove);
      openCollectionDetail(collection.id);
    });
  });
}
