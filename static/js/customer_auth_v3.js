// ==========================================================
// CUSTOMER_AUTH_V3.JS — AUTENTICACIÓN NORMAL DE CLIENTES (ALL LOOK)
// ==========================================================

const CUSTOMER_STORAGE_KEY = 'alllook_customer_user';

function getCurrentCustomer() {
  try {
    const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setCurrentCustomer(cust) {
  if (cust) {
    localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(cust));
  } else {
    localStorage.removeItem(CUSTOMER_STORAGE_KEY);
  }
  renderCustomerAuthNav();
  applyCustomerDataToForms(cust);
}

function logoutCustomer() {
  localStorage.removeItem(CUSTOMER_STORAGE_KEY);
  renderCustomerAuthNav();
}

function renderCustomerAuthNav() {
  const container = document.getElementById('auth-nav-container');
  if (!container) return;

  const cust = getCurrentCustomer();
  if (cust) {
    const esc = (t) => String(t || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    container.innerHTML = `
      <div class="inline-flex items-center gap-3 text-xs">
        <span class="w-8 h-8 bg-[#291C0E] text-[#E1D4C2] flex items-center justify-center text-[11px] font-mono font-semibold">
          ${esc(cust.initials || 'CL')}
        </span>
        <div class="text-left hidden sm:block">
          <p class="font-semibold text-[#291C0E] text-xs leading-tight">${esc(cust.name)}</p>
          <span class="mono-label !text-[9.5px] text-[#A78D78]">Cliente</span>
        </div>
        <button onclick="logoutCustomer()" class="p-1 text-[#A78D78] hover:text-rose-700 transition" title="Cerrar sesión">
          <i data-lucide="log-out" class="w-4 h-4"></i>
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="flex items-center gap-5">
        <button onclick="openCustomerAuthModal('login')" class="nav-link hidden sm:inline-block">
          Ingresar
        </button>
        <button onclick="openCustomerAuthModal('register')" class="btn btn-outline btn-sm">
          Crear cuenta
        </button>
      </div>
    `;
  }
  if (window.lucide) lucide.createIcons();
}

function openCustomerAuthModal(initialTab = 'register') {
  const modal = document.getElementById('modal-customer-auth');
  if (!modal) return;
  modal.classList.remove('hidden');
  switchAuthTab(initialTab);
  const errBox = document.getElementById('auth-error-msg');
  if (errBox) errBox.classList.add('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeCustomerAuthModal() {
  const modal = document.getElementById('modal-customer-auth');
  if (modal) modal.classList.add('hidden');
}

function switchAuthTab(tab) {
  const tabReg = document.getElementById('auth-tab-btn-register');
  const tabLog = document.getElementById('auth-tab-btn-login');
  const formReg = document.getElementById('auth-form-register');
  const formLog = document.getElementById('auth-form-login');
  const errBox = document.getElementById('auth-error-msg');
  if (errBox) errBox.classList.add('hidden');

  if (tab === 'register') {
    tabReg.classList.add('bg-[#6E473B]', 'text-white');
    tabReg.classList.remove('bg-[#FAF7F2]', 'text-[#291C0E]');
    tabLog.classList.remove('bg-[#6E473B]', 'text-white');
    tabLog.classList.add('bg-[#FAF7F2]', 'text-[#291C0E]');
    formReg.classList.remove('hidden');
    formLog.classList.add('hidden');
  } else {
    tabLog.classList.add('bg-[#6E473B]', 'text-white');
    tabLog.classList.remove('bg-[#FAF7F2]', 'text-[#291C0E]');
    tabReg.classList.remove('bg-[#6E473B]', 'text-white');
    tabReg.classList.add('bg-[#FAF7F2]', 'text-[#291C0E]');
    formLog.classList.remove('hidden');
    formReg.classList.add('hidden');
  }
}

function _showAuthError(msg) {
  const errBox = document.getElementById('auth-error-msg');
  if (errBox) {
    errBox.textContent = msg;
    errBox.classList.remove('hidden');
  }
}

async function handleCustomerRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const id_card = document.getElementById('reg-idcard').value.trim();
  const password = document.getElementById('reg-password').value;

  if (password.length < 4) {
    _showAuthError('La contraseña debe tener al menos 4 caracteres.');
    return;
  }

  try {
    const res = await fetch('/api/customer/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, id_card, password })
    });
    const data = await res.json();
    if (!res.ok) {
      _showAuthError(data.detail || 'No se pudo completar el registro.');
      return;
    }
    setCurrentCustomer(data.user);
    closeCustomerAuthModal();
  } catch (err) {
    _showAuthError('Error de conexión con el servidor.');
  }
}

async function handleCustomerLogin(e) {
  e.preventDefault();
  const email = document.getElementById('log-email').value.trim();
  const password = document.getElementById('log-password').value;

  try {
    const res = await fetch('/api/customer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      _showAuthError(data.detail || 'Correo o contraseña incorrectos.');
      return;
    }
    setCurrentCustomer(data.user);
    closeCustomerAuthModal();
  } catch (err) {
    _showAuthError('Error de conexión con el servidor.');
  }
}

function applyCustomerDataToForms(cust) {
  if (!cust) return;
  const mappings = [
    ['piece-req-name', cust.name],
    ['piece-req-phone', cust.phone],
    ['piece-req-idcard', cust.id_card],
    ['med-name', cust.name],
    ['med-phone', cust.phone],
    ['med-idcard', cust.id_card],
    ['alt-name', cust.name],
    ['alt-phone', cust.phone],
  ];
  mappings.forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val && !el.value) {
      el.value = val;
    }
  });
}

function initCustomerAuth() {
  renderCustomerAuthNav();
  const activeCust = getCurrentCustomer();
  if (activeCust) {
    applyCustomerDataToForms(activeCust);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCustomerAuth);
} else {
  initCustomerAuth();
}
