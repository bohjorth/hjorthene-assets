const API_BASE = ''; // samme origin, nginx proxyer /api og /auth til backend

async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    credentials: 'include',
    headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 401) {
    window.location.reload();
    throw new Error('Ikke logget ind');
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    throw new Error((data && data.error) || `Fejl (${res.status})`);
  }
  return data;
}

const api = {
  me: () => apiFetch('/auth/me'),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
  localLogin: (email, password) => apiFetch('/auth/local-login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  localUsers: {
    list: () => apiFetch('/api/admin/local-users'),
    create: (body) => apiFetch('/api/admin/local-users', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => apiFetch(`/api/admin/local-users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id) => apiFetch(`/api/admin/local-users/${id}`, { method: 'DELETE' }),
  },

  dashboard: () => apiFetch('/api/dashboard'),

  assets: {
    list: (params = {}) => apiFetch('/api/assets?' + new URLSearchParams(params)),
    get: (id) => apiFetch(`/api/assets/${id}`),
    upload: (formData, onProgress) => uploadWithProgress('/api/assets/upload', formData, onProgress),
    update: (id, body) => apiFetch(`/api/assets/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id) => apiFetch(`/api/assets/${id}`, { method: 'DELETE' }),
    bulkMove: (ids, folder_id) => apiFetch('/api/assets/bulk/move', { method: 'POST', body: JSON.stringify({ ids, folder_id }) }),
    bulkTag: (ids, tags) => apiFetch('/api/assets/bulk/tag', { method: 'POST', body: JSON.stringify({ ids, tags }) }),
    bulkDelete: (ids) => apiFetch('/api/assets/bulk/delete', { method: 'POST', body: JSON.stringify({ ids }) }),
    bulkRestore: (ids) => apiFetch('/api/assets/bulk/restore', { method: 'POST', body: JSON.stringify({ ids }) }),
    zipUrl: (ids) => `/api/assets/zip?ids=${ids.join(',')}`,
    versions: (id) => apiFetch(`/api/assets/${id}/versions`),
    uploadVersion: (id, formData, onProgress) => uploadWithProgress(`/api/assets/${id}/versions`, formData, onProgress),
    trash: () => apiFetch('/api/assets/trash'),
    restore: (id) => apiFetch(`/api/assets/${id}/restore`, { method: 'POST' }),
    permanentDelete: (id) => apiFetch(`/api/assets/${id}/permanent`, { method: 'DELETE' }),
    emptyTrash: () => apiFetch('/api/assets/trash/empty', { method: 'POST' }),
    listShares: (id) => apiFetch(`/api/assets/${id}/share`),
    createShare: (id, expiresIn) => apiFetch(`/api/assets/${id}/share`, { method: 'POST', body: JSON.stringify({ expires_in: expiresIn }) }),
    revokeShare: (id, linkId) => apiFetch(`/api/assets/${id}/share/${linkId}`, { method: 'DELETE' }),
  },

  folders: {
    list: () => apiFetch('/api/folders'),
    create: (body) => apiFetch('/api/folders', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => apiFetch(`/api/folders/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id) => apiFetch(`/api/folders/${id}`, { method: 'DELETE' }),
  },

  tags: {
    list: () => apiFetch('/api/tags'),
    create: (name) => apiFetch('/api/tags', { method: 'POST', body: JSON.stringify({ name }) }),
    remove: (id) => apiFetch(`/api/tags/${id}`, { method: 'DELETE' }),
  },

  categories: {
    list: () => apiFetch('/api/categories'),
  },

  collections: {
    list: () => apiFetch('/api/collections'),
    get: (id) => apiFetch(`/api/collections/${id}`),
    create: (body) => apiFetch('/api/collections', { method: 'POST', body: JSON.stringify(body) }),
    remove: (id) => apiFetch(`/api/collections/${id}`, { method: 'DELETE' }),
    addAsset: (id, assetId) => apiFetch(`/api/collections/${id}/assets`, { method: 'POST', body: JSON.stringify({ asset_id: assetId }) }),
    removeAsset: (id, assetId) => apiFetch(`/api/collections/${id}/assets/${assetId}`, { method: 'DELETE' }),
  },

  settings: {
    get: () => apiFetch('/api/settings'),
    update: (body) => apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
  },

  admin: {
    status: () => apiFetch('/api/admin/status'),
    backup: () => apiFetch('/api/admin/backup', { method: 'POST' }),
    generateMissingThumbnails: () => apiFetch('/api/admin/generate-missing-thumbnails', { method: 'POST' }),
    shareLinks: () => apiFetch('/api/admin/share-links'),
    revokeShareLink: (id) => apiFetch(`/api/admin/share-links/${id}`, { method: 'DELETE' }),
    resanitizeSvgs: () => apiFetch('/api/admin/resanitize-svgs', { method: 'POST' }),
  },

  logs: {
    list: (params = {}) => apiFetch('/api/logs?' + new URLSearchParams(params)),
  },

  importSelfhosted: {
    catalog: () => apiFetch('/api/import/selfhosted/catalog'),
    run: () => apiFetch('/api/import/selfhosted', { method: 'POST' }),
    search: (q) => apiFetch('/api/import/selfhosted/search?q=' + encodeURIComponent(q)),
    importIcons: (icons) => apiFetch('/api/import/selfhosted/icons', { method: 'POST', body: JSON.stringify({ icons }) }),
  },
};

function uploadWithProgress(path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', API_BASE + path);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || 'Upload fejlede'));
      } catch (e) {
        reject(new Error('Upload fejlede'));
      }
    };
    xhr.onerror = () => reject(new Error('Netværksfejl under upload'));
    xhr.send(formData);
  });
}
