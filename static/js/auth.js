// ==========================================================
// AUTH.JS — AUTENTICACIÓN NORMAL DE CLIENTES (SASTRERÍA ALL LOOK)
// ==========================================================

const CUSTOMER_STORAGE_KEY = 'alllook_customer_user';

// Obtener cliente activo o null
function getCurrentCustomer() {
  try {
    const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// Guardar cliente
function setCurrentCustomer(cust) {
  if (cust) {
    localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(cust));
  } else {
    localStorage.removeItem(CUSTOMER_STORAGE_KEY);
  }
  renderCustomerAuthNav();
  applyCustomerDataToForms(cust);
}

// Cerrar sesión
function logoutCustomer() {
  localStorage.removeItem(CUSTOMER_STORAGE_KEY);
  renderCustomerAuthNav();
  alert('Ha cerrado sesión exitosamente.');
}

// Renderizar botones en la barra de navegación del cliente
function renderCustomerAuthNav() {
  const container = document.getElementById('auth-nav-container');
  if (!container) return;

  const cust = getCurrentCustomer();

  if (cust) {
    container.innerHTML = `
      <div class="inline-flex items-center space-x-2.5 bg-white border border-[#BEB5A9] px-3.5 py-1.5 rounded-xl text-xs shadow-xs">
        <span class="w-7 h-7 rounded-lg bg-[#6E473B] text-white font-bold flex items-center justify-center text-[11px] font-mono shadow-inner">
          ${cust.initials || 'CL'}
        </span>
        <div class="text-left hidden sm:block">
          <p class="font-bold text-[#291C0E] text-xs leading-tight">${cust.name}</p>
          <span class="text-[10px] text-[#6E473B] font-semibold">${cust.role_name || 'Cliente Registrado'}</span>
        </div>
        <button onclick="logoutCustomer()" class="p-1 text-[#A78D78] hover:text-rose-600 transition" title="Cerrar sesión">
          <i data-lucide="log-out" class="w-4 h-4"></i>
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="flex items-center space-x-2">
        <button onclick="openCustomerAuthModal('register')"
                class="px-4 py-2 rounded-xl text-xs font-bold bg-[#6E473B] hover:bg-[#291C0E] text-white shadow-sm hover:shadow transition">
          Crear Cuenta
        </button>
        <button onclick="openCustomerAuthModal('login')"
                class="px-3.5 py-2 rounded-xl text-xs font-bold border border-[#BEB5A9] bg-[#FAF7F2] text-[#291C0E] hover:bg-[#E1D4C2] transition shadow-xs">
          Iniciar Sesión
        </button>
      </div>
    `;
  }

  if (window.lucide) lucide.createIcons();
}

// Modal de autenticación del cliente
function openCustomerAuthModal(initialTab = 'register') {
  const modal = document.getElementById('modal-customer-auth');
  if (!modal) return;
  modal.classList.remove('hidden');
  switchAuthTab(initialTab);
  if (window.lucide) lucide.createIcons();
}

function closeCustomerAuthModal() {
  const modal = document.getElementById('modal-customer-auth');
  if (modal) modal.classList.add('hidden');
}

// Alternar entre pestaña "Crear Cuenta" e "Iniciar Sesión"
function switchAuthTab(tab) {
  const tabReg = document.getElementById('auth-tab-btn-register');
  const tabLog = document.getElementById('auth-tab-btn-login');
  const formReg = document.getElementById('auth-form-register');
  const formLog = document.getElementById('auth-form-login');

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

// Manejar registro normal de cliente
async function handleCustomerRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const id_card = document.getElementById('reg-idcard').value.trim();
  const password = document.getElementById('reg-password').value;

  if (password.length < 4) {
    alert('La contraseña debe tener al menos 4 caracteres.');
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
      alert(`Error en el registro: ${data.detail}`);
      return;
    }

    setCurrentCustomer(data.user);
    closeCustomerAuthModal();
    alert(`¡Cuenta creada con éxito!\nBienvenido(a), ${data.user.name}.`);
  } catch (err) {
    console.error('Error registrando cliente:', err);
    alert('Hubo un error al comunicarse con el servidor.');
  }
}

// Manejar login normal de cliente
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
      alert(`Error al iniciar sesión: ${data.detail}`);
      return;
    }

    setCurrentCustomer(data.user);
    closeCustomerAuthModal();
    alert(`¡Sesión iniciada con éxito!\nBienvenido(a), ${data.user.name}.`);
  } catch (err) {
    console.error('Error iniciando sesión:', err);
    alert('Hubo un error al comunicarse con el servidor.');
  }
}

// Autocompletar formularios con los datos del cliente
function applyCustomerDataToForms(cust) {
  if (!cust) return;

  // Formulario a la medida
  const bName = document.getElementById('bespoke-name');
  const bPhone = document.getElementById('bespoke-phone');
  const bId = document.getElementById('bespoke-id');
  if (bName) bName.value = cust.name;
  if (bPhone && cust.phone) bPhone.value = cust.phone;
  if (bId && cust.id_card) bId.value = cust.id_card;

  // Formulario de compra
  const cName = document.getElementById('cb-customer-name');
  const cPhone = document.getElementById('cb-customer-phone');
  const cId = document.getElementById('cb-customer-id');
  if (cName) cName.value = cust.name;
  if (cPhone && cust.phone) cPhone.value = cust.phone;
  if (cId && cust.id_card) cId.value = cust.id_card;

  // Formulario de alquiler
  const rName = document.getElementById('cr-name');
  const rPhone = document.getElementById('cr-phone');
  const rId = document.getElementById('cr-id');
  if (rName) rName.value = cust.name;
  if (rPhone && cust.phone) rPhone.value = cust.phone;
  if (rId && cust.id_card) rId.value = cust.id_card;

  // Formulario de rastreo
  const trackInp = document.getElementById('public-track-input');
  if (trackInp && cust.phone) {
    trackInp.value = cust.phone;
    if (window.searchOrderTracking) {
      window.searchOrderTracking();
    }
  }
}

// Iniciar al cargar
document.addEventListener('DOMContentLoaded', () => {
  renderCustomerAuthNav();
  const activeCust = getCurrentCustomer();
  if (activeCust) {
    applyCustomerDataToForms(activeCust);
  }
});
