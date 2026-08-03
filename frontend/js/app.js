let currentUser = null;
let currentView = 'dashboard';

const VIEW_RENDERERS = {
  dashboard: renderDashboard,
  assets: renderAssets,
  collections: renderCollections,
  settings: renderSettings,
  admin: renderAdmin,
};

async function boot() {
  try {
    const { user } = await api.me();
    if (!user) return showLoginScreen();
    currentUser = user;
    showApp();
  } catch (e) {
    showLoginScreen();
  }
}

function showLoginScreen() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-btn').addEventListener('click', () => {
    window.location.href = '/auth/login';
  });

  document.getElementById('local-login-toggle').addEventListener('click', () => {
    document.getElementById('local-login-form').classList.toggle('hidden');
  });

  document.getElementById('local-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('local-login-email').value.trim();
    const password = document.getElementById('local-login-password').value;
    const errorEl = document.getElementById('local-login-error');
    errorEl.classList.add('hidden');
    try {
      await api.localLogin(email, password);
      window.location.reload();
    } catch (err) {
      errorEl.textContent = err.message || 'Login fejlede';
      errorEl.classList.remove('hidden');
    }
  });
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  document.getElementById('user-name').textContent = currentUser.name;
  document.getElementById('user-avatar').textContent = (currentUser.name || '?').charAt(0).toUpperCase();
  const roleEl = document.getElementById('user-role');
  roleEl.innerHTML = `<span class="badge badge-${currentUser.role}">${currentUser.role}</span>`;

  if (currentUser.role !== 'admin') {
    document.querySelectorAll('.admin-only').forEach((el) => el.classList.add('hidden'));
  }

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.view);
      closeMobileMenu();
    });
  });

  document.getElementById('menu-toggle-btn').addEventListener('click', openMobileMenu);
  document.getElementById('sidebar-close-btn').addEventListener('click', closeMobileMenu);
  document.getElementById('sidebar-backdrop').addEventListener('click', closeMobileMenu);

  document.getElementById('logout-btn').addEventListener('click', async () => {
    const { logoutUrl } = await api.logout();
    window.location.href = logoutUrl;
  });

  document.getElementById('global-search').addEventListener('input', debounce((e) => {
    navigateTo('assets', e.target.value);
  }, 350));

  navigateTo('dashboard');
}

function openMobileMenu() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-backdrop').classList.add('visible');
}

function closeMobileMenu() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-backdrop').classList.remove('visible');
}

function navigateTo(view, searchQuery) {
  currentView = view;
  document.querySelectorAll('.nav-item').forEach((btn) => btn.classList.toggle('active', btn.dataset.view === view));
  const root = document.getElementById('view-root');
  const bc = document.getElementById('breadcrumb');
  if (view !== 'assets') {
    bc.innerHTML = `<span class="crumb">${labelFor(view)}</span>`;
  }
  VIEW_RENDERERS[view](root, searchQuery);
}

function labelFor(view) {
  return { dashboard: 'Dashboard', assets: 'Assets', collections: 'Collections', settings: 'Indstillinger', admin: 'Administration' }[view] || view;
}

boot();
