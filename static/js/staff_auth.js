// ==========================================================
// STAFF_AUTH.JS — AUTENTICACIÓN Y ROLES DEL TALLER (SASTRERÍA ALL LOOK)
// ==========================================================

const STAFF_STORAGE_KEY = 'alllook_staff_active_user';

const STAFF_PROFILES = {
  admin: {
    id: "EMP-ADMIN",
    name: "Administrador General",
    role: "admin",
    role_name: "Administrador General",
    initials: "AD",
    email: "admin@alllook.com",
    badge_color: "#291C0E"
  },
  sastre: {
    id: "EMP-SASTRE",
    name: "Sastre & Patronista",
    role: "sastre",
    role_name: "Sastre & Patronista",
    initials: "SP",
    email: "sastre@alllook.com",
    badge_color: "#6E473B"
  },
  mostrador: {
    id: "EMP-MOSTRADOR",
    name: "Mostrador & Cobros",
    role: "mostrador",
    role_name: "Mostrador & Cobros",
    initials: "MC",
    email: "mostrador@alllook.com",
    badge_color: "#A78D78"
  },
  calidad: {
    id: "EMP-CALIDAD",
    name: "Control de Calidad",
    role: "calidad",
    role_name: "Control de Calidad",
    initials: "QC",
    email: "calidad@alllook.com",
    badge_color: "#6E473B"
  },
  inventario: {
    id: "EMP-INV",
    name: "Analista de Inventario",
    role: "inventario",
    role_name: "Analista de Inventario",
    initials: "AI",
    email: "inventario@alllook.com",
    badge_color: "#291C0E"
  }
};

function getCurrentStaffUser() {
  try {
    const raw = localStorage.getItem(STAFF_STORAGE_KEY);
    return raw ? JSON.parse(raw) : STAFF_PROFILES.admin;
  } catch (e) {
    return STAFF_PROFILES.admin;
  }
}

function setStaffUser(user) {
  if (user) {
    localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STAFF_STORAGE_KEY);
  }
  renderStaffNav();
}

function renderStaffNav() {
  const container = document.getElementById('staff-auth-nav-container');
  if (!container) return;

  const user = getCurrentStaffUser();
  if (user) {
    container.innerHTML = `
      <div class="inline-flex items-center space-x-2 bg-[#FAF7F2] border border-[#BEB5A9] px-3 py-1.5 rounded-xl text-xs shadow-xs">
        <span class="w-7 h-7 rounded-lg bg-[${user.badge_color || '#291C0E'}] text-white font-bold flex items-center justify-center text-[11px] font-mono shadow-xs">
          ${user.initials || 'ST'}
        </span>
        <div class="text-left hidden md:block">
          <p class="font-bold text-[#291C0E] text-xs leading-none">${user.name}</p>
          <span class="text-[10px] text-[#6E473B] font-semibold">${user.role_name}</span>
        </div>
        <button onclick="openLoginModal()" class="text-[10px] font-bold text-[#6E473B] hover:text-[#291C0E] ml-1 px-1.5 py-0.5 rounded border border-[#BEB5A9]/60 hover:bg-[#E1D4C2] transition" title="Cambiar perfil del taller">
          Cambiar
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <button onclick="openLoginModal()" class="px-3 py-1.5 rounded-xl text-xs font-bold border border-[#BEB5A9] bg-[#FAF7F2] hover:bg-[#E1D4C2] text-[#291C0E] transition">
        Seleccionar Perfil
      </button>
    `;
  }
  if (window.lucide) lucide.createIcons();
}

function openLoginModal() {
  const modal = document.getElementById('modal-optional-login');
  if (modal) modal.classList.remove('hidden');
}

function closeLoginModal() {
  const modal = document.getElementById('modal-optional-login');
  if (modal) modal.classList.add('hidden');
}

async function quickLoginRole(roleKey) {
  try {
    const res = await fetch('/api/staff/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_key: roleKey })
    });
    if (res.ok) {
      const data = await res.json();
      setStaffUser(data.user);
    } else {
      setStaffUser(STAFF_PROFILES[roleKey] || STAFF_PROFILES.admin);
    }
  } catch (e) {
    setStaffUser(STAFF_PROFILES[roleKey] || STAFF_PROFILES.admin);
  }
  closeLoginModal();
  const current = getCurrentStaffUser();
  alert(`Sesión de taller activa como:\n${current.name} (${current.role_name})`);
}

function submitManualLogin(e) {
  e.preventDefault();
  const email = (document.getElementById('login-manual-email')?.value || '').trim();
  let found = Object.values(STAFF_PROFILES).find(p => p.email.toLowerCase() === email.toLowerCase());
  if (!found) {
    found = {
      id: "EMP-CUSTOM",
      name: email.split('@')[0] || "Personal Taller",
      role: "admin",
      role_name: "Personal del Taller",
      initials: "PT",
      email: email,
      badge_color: "#291C0E"
    };
  }
  setStaffUser(found);
  closeLoginModal();
  alert(`Sesión iniciada como ${found.name}.`);
}

function logoutAuthUser() {
  localStorage.removeItem(STAFF_STORAGE_KEY);
  setStaffUser(STAFF_PROFILES.admin);
  renderStaffNav();
}

document.addEventListener('DOMContentLoaded', () => {
  renderStaffNav();
});
