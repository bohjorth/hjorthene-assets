function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('da-DK', { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
}

function extOf(name) {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().toUpperCase() : '—';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function toast(message, type = 'default') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function openModal(html, { wide = false } = {}) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal ${wide ? 'modal-wide' : ''}">${html}</div></div>`;
  const overlay = document.getElementById('modal-overlay');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.querySelectorAll('.modal-close').forEach((btn) => btn.addEventListener('click', closeModal));
  return overlay;
}

function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
}

function fileIcon(category) {
  const icons = {
    Billeder: '🖼', Video: '🎬', Audio: '🎵', PDF: '📕',
    Office: '📄', ZIP: '🗜', CAD: '📐', '3D': '⬡', Dokumenter: '📃', Andet: '📦',
  };
  return icons[category] || '📦';
}

function debounce(fn, wait = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}
