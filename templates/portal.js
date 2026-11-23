// ==========================================================
// PORTAL.JS — SISTEMA INTERNO DE TALLER (SASTRERÍA ALL LOOK)
// ==========================================================

let currentStaffUser = null;
let viewsCatalog = [];
let activeWsView = null;
let adminPreviewWorkerId = '';
let cachedWorkersList = [];

let cachedMostradorData = { tickets: [], catalog_items: [], fabrics: [] };
let cachedSastreData = { tickets: [], fabric_requests: [], materials: [] };
let cachedInventarioData = { fabric_requests: [], inventory: [], purchase_orders: [] };
let cachedCalidadData = { pending: [], recent: [] };
let cachedFacturacionData = { ready_to_bill: [], invoices: [], total_collected: 0, pending_receivable: 0 };
let cachedCatalogItems = [];

const STAGE_LABELS = {
  SOLICITUD_WEB: { text: 'Solicitud Web (Por Confirmar)', cls: 'bg-[#E1D4C2] text-[#291C0E] border-[#BEB5A9]' },
  EN_PATRONAJE_MEDIDAS: { text: 'En Patronaje & Medidas', cls: 'bg-[#FAF7F2] text-[#6E473B] border-[#6E473B]' },
  ESPERANDO_TELAS: { text: 'Esperando Telas de Inventario', cls: 'bg-amber-50 text-amber-800 border-amber-300' },
  EN_CONFECCION: { text: 'En Confección (Con Telas)', cls: 'bg-[#E1D4C2] text-[#291C0E] border-[#6E473B]' },
  DEVUELTO_POR_CALIDAD: { text: 'Devuelto por Control de Calidad', cls: 'bg-rose-50 text-rose-800 border-rose-300' },
  EN_CONTROL_DE_CALIDAD: { text: 'En Control de Calidad', cls: 'bg-[#6E473B] text-white border-[#6E473B]' },
  LISTO_PARA_CONTACTAR: { text: 'Aprobado QC — Contactar Cliente', cls: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  CLIENTE_CONTACTADO: { text: 'Cliente Contactado / En Prueba', cls: 'bg-emerald-100 text-emerald-900 border-emerald-400' },
  EN_AJUSTE_POST_PRUEBA: { text: 'Arreglo Menor Sin Costo', cls: 'bg-amber-50 text-amber-900 border-amber-400' },
  FACTURADO_ENTREGADO: { text: 'Facturado y Entregado', cls: 'bg-[#291C0E] text-white border-[#291C0E]' },
};

function esc(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stageBadge(stage) {
  const s = STAGE_LABELS[stage] || { text: stage, cls: 'bg-[#FAF7F2] text-[#291C0E] border-[#BEB5A9]' };
  return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${s.cls}">${esc(s.text)}</span>`;
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    showLoginScreen();
    throw new Error('Sesión expirada.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `Error ${res.status}`);
  }
  return data;
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

// ==========================================================
// INICIALIZACIÓN Y AUTENTICACIÓN
// ==========================================================

async function initStaffPortal() {
  if (window.lucide) lucide.createIcons();
  await checkExistingStaffSession();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStaffPortal);
} else {
  initStaffPortal();
}

async function checkExistingStaffSession() {
  try {
    const res = await fetch('/api/internal/auth/me');
    if (!res.ok) {
      showLoginScreen();
      return;
    }
    const data = await res.json();
    enterWorkspace(data.user, data.views_catalog);
  } catch (e) {
    showLoginScreen();
  }
}

function showLoginScreen() {
  currentStaffUser = null;
  document.getElementById('staff-workspace').classList.add('hidden');
  document.getElementById('staff-login-screen').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

async function handleStaffLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('staff-login-error');
  errEl.classList.add('hidden');

  try {
    const res = await fetch('/api/internal/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.detail || 'Credenciales inválidas.';
      errEl.classList.remove('hidden');
      return;
    }
    document.getElementById('login-password').value = '';
    enterWorkspace(data.user, data.views_catalog);
  } catch (err) {
    errEl.textContent = 'No se pudo conectar con el servidor.';
    errEl.classList.remove('hidden');
  }
}

async function handleStaffLogout() {
  await fetch('/api/internal/auth/logout', { method: 'POST' });
  adminPreviewWorkerId = '';
  showLoginScreen();
}

async function enterWorkspace(user, catalog) {
  currentStaffUser = user;
  viewsCatalog = catalog || [];
  adminPreviewWorkerId = '';

  document.getElementById('staff-login-screen').classList.add('hidden');
  document.getElementById('staff-workspace').classList.remove('hidden');
  document.getElementById('sidebar-role-label').textContent = user.role_label;

  const isAdmin = user.allowed_views.includes('admin_usuarios');
  const previewBar = document.getElementById('admin-preview-bar');
  if (isAdmin) {
    previewBar.classList.remove('hidden');
    await refreshAdminPreviewDropdown();
  } else {
    previewBar.classList.add('hidden');
  }

  renderSidebarAndOpenDefault();
}

async function refreshAdminPreviewDropdown() {
  try {
    const data = await apiFetch('/api/internal/admin/workers');
    cachedWorkersList = data.workers || [];
    const sel = document.getElementById('admin-preview-select');
    if (!sel) return;
    const prevVal = sel.value;
    sel.innerHTML = `<option value="">Mi vista completa (Admin)</option>` +
      cachedWorkersList.map(w => `<option value="${esc(w.id)}">${esc(w.role_label)} (${esc(w.username)})</option>`).join('');
    sel.value = prevVal;
  } catch (e) {
    // ignorar si no es admin
  }
}

function getEffectiveAllowedViews() {
  if (!currentStaffUser) return [];
  if (adminPreviewWorkerId) {
    const target = cachedWorkersList.find(w => w.id === adminPreviewWorkerId);
    if (target) return target.allowed_views || [];
  }
  return currentStaffUser.allowed_views || [];
}

function renderSidebarAndOpenDefault() {
  const allowed = getEffectiveAllowedViews();
  const nav = document.getElementById('staff-sidebar-nav');

  const allowedObjs = viewsCatalog.filter(v => allowed.includes(v.key));
  if (allowedObjs.length === 0) {
    nav.innerHTML = `<div class="p-3 text-xs text-[#BEB5A9]">Este trabajador no tiene vistas asignadas actualmente.</div>`;
    document.querySelectorAll('.ws-view').forEach(el => el.classList.add('hidden'));
    document.getElementById('ws-view-title').textContent = 'Sin Vistas Asignadas';
    document.getElementById('ws-view-subtitle').textContent = 'El Administrador debe asignar al menos una vista.';
    return;
  }

  nav.innerHTML = allowedObjs.map(v => `
    <button onclick="switchWsView('${v.key}')" id="ws-nav-${v.key}"
            class="ws-nav-btn w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition text-[#E1D4C2]/80 hover:bg-[#422F1C] hover:text-white">
      <i data-lucide="${v.icon || 'circle'}" class="w-4 h-4 shrink-0"></i>
      <span class="truncate">${esc(v.label)}</span>
    </button>
  `).join('');

  if (window.lucide) lucide.createIcons();

  const initial = (activeWsView && allowed.includes(activeWsView)) ? activeWsView : allowedObjs[0].key;
  switchWsView(initial);
}

function changeAdminPreviewRole() {
  adminPreviewWorkerId = document.getElementById('admin-preview-select').value;
  const warn = document.getElementById('preview-warning-banner');
  if (adminPreviewWorkerId) {
    const w = cachedWorkersList.find(x => x.id === adminPreviewWorkerId);
    document.getElementById('preview-warning-text').textContent =
      `Previsualizando la interfaz exactamente como la ve el trabajador: ${w ? w.role_label : adminPreviewWorkerId}`;
    warn.classList.remove('hidden');
  } else {
    warn.classList.add('hidden');
  }
  renderSidebarAndOpenDefault();
}

function resetAdminPreview() {
  adminPreviewWorkerId = '';
  document.getElementById('admin-preview-select').value = '';
  document.getElementById('preview-warning-banner').classList.add('hidden');
  renderSidebarAndOpenDefault();
}

function previewSpecificWorker(workerId) {
  adminPreviewWorkerId = workerId;
  const sel = document.getElementById('admin-preview-select');
  if (sel) sel.value = workerId;
  changeAdminPreviewRole();
}

function switchWsView(viewKey) {
  const allowed = getEffectiveAllowedViews();
  if (!allowed.includes(viewKey)) return;

  activeWsView = viewKey;
  document.querySelectorAll('.ws-nav-btn').forEach(btn => {
    btn.classList.remove('bg-[#422F1C]', 'text-white', 'border-l-4', 'border-[#6E473B]');
    btn.classList.add('text-[#E1D4C2]/80');
  });
  const activeBtn = document.getElementById(`ws-nav-${viewKey}`);
  if (activeBtn) {
    activeBtn.classList.add('bg-[#422F1C]', 'text-white', 'border-l-4', 'border-[#6E473B]');
    activeBtn.classList.remove('text-[#E1D4C2]/80');
  }

  document.querySelectorAll('.ws-view').forEach(el => el.classList.add('hidden'));
  const targetSection = document.getElementById(`view-${viewKey}`);
  if (targetSection) targetSection.classList.remove('hidden');

  const meta = viewsCatalog.find(v => v.key === viewKey);
  if (meta) {
    document.getElementById('ws-view-title').textContent = meta.label;
    document.getElementById('ws-view-subtitle').textContent = meta.description;
  }

  reloadActiveView();
}

function reloadActiveView() {
  if (!activeWsView) return;
  if (activeWsView === 'mostrador') loadMostradorView();
  else if (activeWsView === 'sastre') loadSastreView();
  else if (activeWsView === 'inventario') loadInventarioView();
  else if (activeWsView === 'calidad') loadCalidadView();
  else if (activeWsView === 'facturacion') loadFacturacionView();
  else if (activeWsView === 'catalogo_piezas') loadCatalogoAdminView();
  else if (activeWsView === 'admin_usuarios') loadAdminWorkersView();
}

// ==========================================================
// VISTA 1: MOSTRADOR / CAJA
// ==========================================================

function switchMostradorTab(tab) {
  document.querySelectorAll('.m-tab').forEach(b => {
    b.classList.remove('bg-[#6E473B]', 'text-white');
    b.classList.add('bg-white', 'border', 'border-[#BEB5A9]', 'text-[#291C0E]');
  });
  const activeBtn = document.getElementById(`m-tab-${tab}`);
  if (activeBtn) {
    activeBtn.classList.add('bg-[#6E473B]', 'text-white');
    activeBtn.classList.remove('bg-white', 'border', 'border-[#BEB5A9]', 'text-[#291C0E]');
  }
  document.querySelectorAll('.m-panel').forEach(p => p.classList.add('hidden'));
  const panel = document.getElementById(`m-panel-${tab}`);
  if (panel) panel.classList.remove('hidden');
}

async function loadMostradorView() {
  try {
    const data = await apiFetch('/api/internal/mostrador/tickets');
    cachedMostradorData = data;
    populateMostradorSelects();
    renderMostradorPanels();
  } catch (err) {
    alert(err.message);
  }
}

function populateMostradorSelects() {
  const catSel = document.getElementById('mn-catalog-item');
  if (catSel) {
    const cur = catSel.value;
    catSel.innerHTML = `<option value="">-- Ninguna / Producto Personalizado --</option>` +
      cachedMostradorData.catalog_items.map(i =>
        `<option value="${i.id}" data-price="${i.price}" data-name="${esc(i.name)} (${esc(i.size)})">${esc(i.name)} (${esc(i.size)}) — $${Number(i.price).toFixed(2)} (${i.stock} disp.)</option>`
      ).join('');
    catSel.value = cur;
  }
  const fabSel = document.getElementById('mn-fabric');
  if (fabSel) {
    const curF = fabSel.value;
    fabSel.innerHTML = `<option value="">Por definir con Sastre Patronista</option>` +
      cachedMostradorData.fabrics.map(f => `<option value="${esc(f.name)}">${esc(f.name)}</option>`).join('');
    fabSel.value = curF;
  }
  updateMostradorNewRules();
}

function prefillFromCatalogItem() {
  const sel = document.getElementById('mn-catalog-item');
  const opt = sel.options[sel.selectedIndex];
  if (opt && opt.value) {
    document.getElementById('mn-desc').value = opt.getAttribute('data-name') || '';
    document.getElementById('mn-total').value = opt.getAttribute('data-price') || '100';
    document.getElementById('mn-type').value = 'Pieza de Exhibición';
    updateMostradorNewRules();
  }
}

function updateMostradorNewRules() {
  const type = document.getElementById('mn-type').value;
  const total = parseFloat(document.getElementById('mn-total').value) || 0;
  const delVal = document.getElementById('mn-delivery').value;
  const hint = document.getElementById('mn-advance-hint');
  const intHint = document.getElementById('mn-interim-hint');
  const clauseWrap = document.getElementById('mn-clause-wrap');

  if (type === 'Confección a la Medida') {
    const minAdv = (total * 0.5).toFixed(2);
    hint.textContent = `Regla 50%: Mínimo $${minAdv}`;
    clauseWrap.classList.remove('hidden');
  } else {
    hint.textContent = `Opcional hasta $${total.toFixed(2)}`;
    clauseWrap.classList.add('hidden');
  }

  if (delVal) {
    const dt = new Date(delVal + 'T00:00:00');
    dt.setDate(dt.getDate() - 15);
    intHint.textContent = `Cita 15 días antes: ${dt.toISOString().slice(0, 10)}`;
  } else {
    intHint.textContent = 'Cita 15 días antes: -';
  }
}

function renderMostradorPanels() {
  const tickets = cachedMostradorData.tickets || [];
  const webReqs = tickets.filter(t => t.stage === 'SOLICITUD_WEB');
  const readyList = tickets.filter(t => t.stage === 'LISTO_PARA_CONTACTAR' || t.stage === 'CLIENTE_CONTACTADO');
  const inProgress = tickets.filter(t => ['EN_PATRONAJE_MEDIDAS', 'ESPERANDO_TELAS', 'EN_CONFECCION', 'DEVUELTO_POR_CALIDAD', 'EN_CONTROL_DE_CALIDAD', 'EN_AJUSTE_POST_PRUEBA'].includes(t.stage));

  document.getElementById('m-count-web').textContent = webReqs.length;
  document.getElementById('m-count-listas').textContent = readyList.length;
  document.getElementById('m-count-proceso').textContent = inProgress.length;

  // Panel 1: Solicitudes Web
  const webEl = document.getElementById('m-panel-web');
  if (webReqs.length === 0) {
    webEl.innerHTML = `<div class="bg-white rounded-2xl border border-[#BEB5A9] p-10 text-center text-xs text-[#A78D78]">No hay solicitudes web pendientes de confirmación.</div>`;
  } else {
    webEl.innerHTML = webReqs.map(t => `
      <div class="bg-white rounded-2xl border border-[#BEB5A9] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div class="space-y-1.5 text-xs">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-mono font-bold text-[#291C0E]">${esc(t.id)}</span>
            ${stageBadge(t.stage)}
            <span class="px-2 py-0.5 rounded bg-[#FAF7F2] border border-[#BEB5A9] font-semibold">${esc(t.order_type)}</span>
          </div>
          <h4 class="font-serif-luxury text-lg font-bold text-[#291C0E]">${esc(t.garment_description)}</h4>
          <p class="text-[#6E473B]">Cliente: <strong>${esc(t.customer_name)}</strong> | Tel: <strong>${esc(t.customer_phone)}</strong> ${t.fabric_preference ? `| Tela: ${esc(t.fabric_preference)}` : ''}</p>
          ${t.tailor_notes ? `<p class="text-[#A78D78]">Nota cliente: ${esc(t.tailor_notes)}</p>` : ''}
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button onclick="openConfirmWebModal('${esc(t.id)}')" class="px-5 py-2.5 rounded-xl bg-[#6E473B] hover:bg-[#291C0E] text-white text-xs font-bold">
            Confirmar & Cobrar Anticipo
          </button>
        </div>
      </div>
    `).join('');
  }

  // Panel 3: Listas para Contactar y Ajustes
  const listasEl = document.getElementById('m-panel-listas');
  if (readyList.length === 0) {
    listasEl.innerHTML = `<div class="bg-white rounded-2xl border border-[#BEB5A9] p-10 text-center text-xs text-[#A78D78]">No hay piezas aprobadas por Control de Calidad pendientes de entrega.</div>`;
  } else {
    listasEl.innerHTML = readyList.map(t => `
      <div class="bg-white rounded-2xl border ${t.days_waiting >= 5 ? 'border-amber-400' : 'border-[#BEB5A9]'} p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div class="space-y-1.5 text-xs">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-mono font-bold text-[#291C0E]">${esc(t.id)}</span>
            ${stageBadge(t.stage)}
            ${t.days_waiting > 0 ? `<span class="px-2 py-0.5 rounded-full font-bold ${t.days_waiting >= 5 ? 'bg-amber-100 text-amber-900' : 'bg-[#FAF7F2] text-[#6E473B]'}">${t.days_waiting} días esperando retiro</span>` : ''}
            ${t.adjustment_count > 0 ? `<span class="px-2 py-0.5 rounded-full bg-[#E1D4C2] text-[#291C0E] font-bold">Ajustes realizados: ${t.adjustment_count}</span>` : ''}
          </div>
          <h4 class="font-serif-luxury text-lg font-bold text-[#291C0E]">${esc(t.garment_description)}</h4>
          <p class="text-[#6E473B]">Cliente: <strong>${esc(t.customer_name)}</strong> | Tel: <strong>${esc(t.customer_phone)}</strong></p>
          <p class="text-[#291C0E]">Total: <strong class="font-mono">$${Number(t.total_price).toFixed(2)}</strong> | Saldo Pendiente: <strong class="font-mono text-[#6E473B]">$${Number(t.remaining_balance).toFixed(2)}</strong></p>
          ${t.qc_notes ? `<p class="text-[11px] text-emerald-800">QC: ${esc(t.qc_notes)}</p>` : ''}
        </div>
        <div class="flex flex-wrap items-center gap-2 shrink-0">
          ${t.stage === 'LISTO_PARA_CONTACTAR' ? `
            <button onclick="contactCustomer('${esc(t.id)}')" class="px-4 py-2 rounded-xl bg-[#291C0E] hover:bg-[#6E473B] text-white text-xs font-bold">
              Marcar Cliente Contactado
            </button>` : `<span class="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">Contactado: ${esc(t.customer_contacted_at || 'Sí')}</span>`}
          <button onclick="openReturnTailorModal('${esc(t.id)}')" class="px-4 py-2 rounded-xl border border-[#6E473B] text-[#6E473B] hover:bg-[#6E473B] hover:text-white text-xs font-bold">
            Reenviar a Sastre (Arreglo sin Costo)
          </button>
          <button onclick="openTicketHistory('${esc(t.id)}', 'mostrador')" class="px-3 py-2 rounded-xl border border-[#BEB5A9] text-xs font-bold">Historial</button>
        </div>
      </div>
    `).join('');
  }

  // Panel 4: En proceso
  const procEl = document.getElementById('m-panel-proceso');
  if (inProgress.length === 0) {
    procEl.innerHTML = `<div class="bg-white rounded-2xl border border-[#BEB5A9] p-10 text-center text-xs text-[#A78D78]">No hay órdenes activas en taller en este momento.</div>`;
  } else {
    procEl.innerHTML = inProgress.map(t => `
      <div class="bg-white rounded-2xl border border-[#BEB5A9] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-mono font-bold text-[#291C0E]">${esc(t.id)}</span>
            ${stageBadge(t.stage)}
          </div>
          <h4 class="font-bold text-sm text-[#291C0E]">${esc(t.garment_description)} — ${esc(t.customer_name)}</h4>
          <p class="text-[#6E473B]">Entrega: ${esc(t.delivery_date || 'Por definir')} ${t.interim_fitting_date ? `| Cita 15d: <strong>${esc(t.interim_fitting_date)}</strong>` : ''} | Saldo: $${Number(t.remaining_balance).toFixed(2)}</p>
        </div>
        <button onclick="openTicketHistory('${esc(t.id)}', 'mostrador')" class="px-4 py-2 rounded-xl border border-[#BEB5A9] bg-[#FAF7F2] font-bold shrink-0">Ver Trazabilidad</button>
      </div>
    `).join('');
  }
}

async function submitMostradorNewTicket(e) {
  e.preventDefault();
  const catVal = document.getElementById('mn-catalog-item').value;
  const payload = {
    order_type: document.getElementById('mn-type').value,
    catalog_item_id: catVal ? parseInt(catVal, 10) : null,
    fabric_preference: document.getElementById('mn-fabric').value,
    customer_name: document.getElementById('mn-name').value.trim(),
    customer_phone: document.getElementById('mn-phone').value.trim(),
    customer_id_card: document.getElementById('mn-idcard').value.trim(),
    garment_description: document.getElementById('mn-desc').value.trim(),
    occasion: document.getElementById('mn-notes').value.trim(),
    total_price: parseFloat(document.getElementById('mn-total').value),
    advance_payment: parseFloat(document.getElementById('mn-advance').value || '0'),
    delivery_date: document.getElementById('mn-delivery').value,
    weight_clause_accepted: document.getElementById('mn-clause').checked,
    payment_method: document.getElementById('mn-payment').value,
    notes: document.getElementById('mn-notes').value.trim()
  };

  try {
    const data = await apiFetch('/api/internal/mostrador/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    alert(data.message);
    document.getElementById('form-mostrador-new').reset();
    await loadMostradorView();
    switchMostradorTab('proceso');
  } catch (err) {
    alert(err.message);
  }
}

function openConfirmWebModal(ticketId) {
  const t = cachedMostradorData.tickets.find(x => x.id === ticketId);
  if (!t) return;
  document.getElementById('cw-ticket-id').value = t.id;
  document.getElementById('cw-order-type').value = t.order_type;
  document.getElementById('cw-summary').innerHTML = `
    <p class="font-bold text-[#291C0E]">${esc(t.id)} — ${esc(t.garment_description)}</p>
    <p class="text-[#6E473B]">Cliente: ${esc(t.customer_name)} (${esc(t.customer_phone)}) | Tipo: ${esc(t.order_type)}</p>
  `;
  const defaultTotal = t.total_price > 0 ? t.total_price : (t.order_type === 'Confección a la Medida' ? 350 : 25);
  document.getElementById('cw-total').value = defaultTotal.toFixed(2);
  document.getElementById('cw-advance').value = (t.order_type === 'Confección a la Medida' ? defaultTotal * 0.5 : defaultTotal).toFixed(2);
  document.getElementById('cw-delivery').value = t.delivery_date || '';
  updateConfirmWebHint();
  openModal('modal-confirm-web');
}

function updateConfirmWebHint() {
  const type = document.getElementById('cw-order-type').value;
  const total = parseFloat(document.getElementById('cw-total').value) || 0;
  const delVal = document.getElementById('cw-delivery').value;
  document.getElementById('cw-advance-hint').textContent =
    type === 'Confección a la Medida' ? `Mínimo 50%: $${(total * 0.5).toFixed(2)}` : '';
  if (delVal) {
    const dt = new Date(delVal + 'T00:00:00');
    dt.setDate(dt.getDate() - 15);
    document.getElementById('cw-interim-hint').textContent = `Cita 15d: ${dt.toISOString().slice(0, 10)}`;
  } else {
    document.getElementById('cw-interim-hint').textContent = '';
  }
}

async function submitConfirmWeb(e) {
  e.preventDefault();
  const ticketId = document.getElementById('cw-ticket-id').value;
  const payload = {
    total_price: parseFloat(document.getElementById('cw-total').value),
    advance_payment: parseFloat(document.getElementById('cw-advance').value || '0'),
    delivery_date: document.getElementById('cw-delivery').value,
    payment_method: document.getElementById('cw-payment').value,
    send_to_tailor: document.getElementById('cw-send-tailor').checked,
    weight_clause_accepted: document.getElementById('cw-clause').checked,
    notes: document.getElementById('cw-notes').value.trim()
  };

  try {
    const data = await apiFetch(`/api/internal/mostrador/tickets/${encodeURIComponent(ticketId)}/confirm-web`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    closeModal('modal-confirm-web');
    alert(data.message);
    await loadMostradorView();
  } catch (err) {
    alert(err.message);
  }
}

async function contactCustomer(ticketId) {
  try {
    const data = await apiFetch(`/api/internal/mostrador/tickets/${encodeURIComponent(ticketId)}/contact-customer`, {
      method: 'POST'
    });
    alert(data.message);
    await loadMostradorView();
  } catch (err) {
    alert(err.message);
  }
}

function openReturnTailorModal(ticketId) {
  document.getElementById('rt-ticket-id').value = ticketId;
  document.getElementById('rt-notes').value = '';
  openModal('modal-return-tailor');
}

async function submitReturnToTailor(e) {
  e.preventDefault();
  const ticketId = document.getElementById('rt-ticket-id').value;
  const notes = document.getElementById('rt-notes').value.trim();
  try {
    const data = await apiFetch(`/api/internal/mostrador/tickets/${encodeURIComponent(ticketId)}/return-to-tailor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adjustment_notes: notes })
    });
    closeModal('modal-return-tailor');
    alert(data.message);
    await loadMostradorView();
  } catch (err) {
    alert(err.message);
  }
}

function openTicketHistory(ticketId, source) {
  const list = source === 'mostrador' ? cachedMostradorData.tickets : cachedSastreData.tickets;
  const t = list.find(x => x.id === ticketId);
  if (!t) return;
  document.getElementById('hist-ticket-id').textContent = t.id;
  document.getElementById('hist-entries').innerHTML = (t.history || []).map(h => `
    <div class="p-3 rounded-xl bg-[#FAF7F2] border border-[#BEB5A9]/50">
      <div class="flex items-center justify-between text-[11px] text-[#A78D78]">
        <strong>${esc(h.rol)}</strong>
        <span class="font-mono">${esc(h.fecha)}</span>
      </div>
      <p class="font-bold text-[#291C0E] mt-0.5">${esc(h.accion)}</p>
      ${h.nota ? `<p class="text-[#6E473B] mt-0.5">${esc(h.nota)}</p>` : ''}
    </div>
  `).join('');
  openModal('modal-ticket-history');
}

// ==========================================================
// VISTA 2: SASTRE PATRONISTA
// ==========================================================

async function loadSastreView() {
  try {
    cachedSastreData = await apiFetch('/api/internal/sastre/queue');
    renderSastreQueue();
  } catch (err) {
    alert(err.message);
  }
}

function renderSastreQueue() {
  const list = cachedSastreData.tickets || [];
  document.getElementById('sastre-count-badge').textContent = `${list.length} órdenes en cola`;
  const container = document.getElementById('sastre-queue-list');

  if (list.length === 0) {
    container.innerHTML = `<div class="bg-white rounded-2xl border border-[#BEB5A9] p-12 text-center text-xs text-[#A78D78]">No hay órdenes pendientes para el Sastre Patronista.</div>`;
    return;
  }

  container.innerHTML = list.map(t => {
    const measEntries = Object.entries(t.measurements || {});
    const pendingReqs = (t.fabric_requests || []).filter(r => r.status === 'Pendiente');
    const borderCls = t.stage === 'DEVUELTO_POR_CALIDAD'
      ? 'border-2 border-rose-400'
      : (t.stage === 'EN_AJUSTE_POST_PRUEBA' ? 'border-2 border-amber-400' : 'border border-[#BEB5A9]');

    return `
      <div class="bg-white rounded-2xl ${borderCls} p-6 space-y-4 shadow-xs">
        <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div class="space-y-1.5 text-xs">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-mono font-bold text-[#291C0E]">${esc(t.id)}</span>
              ${stageBadge(t.stage)}
              <span class="px-2 py-0.5 rounded bg-[#FAF7F2] border border-[#BEB5A9]">${esc(t.order_type)}</span>
            </div>
            <h4 class="font-serif-luxury text-xl font-bold text-[#291C0E]">${esc(t.garment_description)}</h4>
            <p class="text-[#6E473B]">Cliente: <strong>${esc(t.customer_name)}</strong> | Tela preferida: <strong>${esc(t.fabric_preference || 'Por definir')}</strong> | Entrega: <strong>${esc(t.delivery_date || 'N/A')}</strong></p>
            ${t.qc_status === 'Rechazado' && t.qc_notes ? `<div class="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900"><strong>Observación Control de Calidad:</strong> ${esc(t.qc_notes)}</div>` : ''}
            ${t.adjustment_notes ? `<div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900"><strong>Arreglo Menor Solicitado (Sin Costo):</strong> ${esc(t.adjustment_notes)}</div>` : ''}
            ${t.tailor_notes ? `<p class="text-[#A78D78]">Notas de patronaje: ${esc(t.tailor_notes)}</p>` : ''}
          </div>

          <div class="flex flex-wrap gap-2 shrink-0">
            <button onclick="openSastreMeasurements('${esc(t.id)}')" class="px-4 py-2 rounded-xl bg-[#FAF7F2] border border-[#6E473B] text-[#6E473B] hover:bg-[#6E473B] hover:text-white text-xs font-bold">
              Medidas Exactas (${measEntries.length})
            </button>
            <button onclick="openSastreFabricModal('${esc(t.id)}')" class="px-4 py-2 rounded-xl bg-[#FAF7F2] border border-[#BEB5A9] hover:bg-[#E1D4C2] text-[#291C0E] text-xs font-bold">
              Solicitar Telas
            </button>
            <button onclick="sendTicketToQC('${esc(t.id)}')" ${pendingReqs.length > 0 ? 'disabled title="Esperando despacho de telas"' : ''}
                    class="px-4 py-2 rounded-xl bg-[#291C0E] hover:bg-[#6E473B] text-white text-xs font-bold ${pendingReqs.length > 0 ? 'opacity-40 cursor-not-allowed' : ''}">
              Enviar a Control de Calidad
            </button>
          </div>
        </div>

        ${measEntries.length > 0 ? `
          <div class="flex flex-wrap gap-2 pt-2 border-t border-[#BEB5A9]/30 text-[11px]">
            ${measEntries.map(([k, v]) => `<span class="px-2.5 py-1 rounded-lg bg-[#FAF7F2] border border-[#BEB5A9]/60 font-mono"><strong>${esc(k)}:</strong> ${esc(v)} cm</span>`).join('')}
          </div>` : `<div class="text-[11px] text-amber-800 pt-2 border-t border-[#BEB5A9]/30">Aún no se han registrado medidas exactas en esta ficha.</div>`}

        ${(t.fabric_requests && t.fabric_requests.length > 0) ? `
          <div class="space-y-1.5 pt-2 border-t border-[#BEB5A9]/30 text-[11px]">
            <strong class="text-[#6E473B] uppercase">Solicitudes de Tela Asociadas:</strong>
            <div class="flex flex-wrap gap-2">
              ${t.fabric_requests.map(fr => `
                <span class="px-2.5 py-1 rounded-lg border ${fr.status === 'Despachada' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : (fr.status === 'Pendiente' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-rose-50 border-rose-200 text-rose-800')}">
                  ${esc(fr.item_name)} (${fr.quantity_requested} ${esc(fr.unit)}) — <strong>${esc(fr.status)}</strong>
                </span>
              `).join('')}
            </div>
          </div>` : ''}
      </div>
    `;
  }).join('');
}

function openSastreMeasurements(ticketId) {
  const t = cachedSastreData.tickets.find(x => x.id === ticketId);
  if (!t) return;
  document.getElementById('sm-ticket-id').value = t.id;
  document.getElementById('sm-ticket-label').textContent = t.id;
  const m = t.measurements || {};
  ['cuello', 'pecho', 'cintura', 'cadera', 'hombro_a_hombro', 'largo_manga', 'largo_pantalon', 'tiro'].forEach(k => {
    const inp = document.getElementById(`sm-${k}`);
    if (inp) inp.value = m[k] !== undefined ? m[k] : '';
  });
  document.getElementById('sm-notes').value = t.tailor_notes || '';
  document.getElementById('sm-validated').checked = Boolean(t.interim_fitting_validated);
  openModal('modal-sastre-measurements');
}

async function submitSastreMeasurements(e) {
  e.preventDefault();
  const ticketId = document.getElementById('sm-ticket-id').value;
  const measurements = {};
  ['cuello', 'pecho', 'cintura', 'cadera', 'hombro_a_hombro', 'largo_manga', 'largo_pantalon', 'tiro'].forEach(k => {
    const val = document.getElementById(`sm-${k}`).value;
    if (val !== '') measurements[k] = parseFloat(val);
  });

  try {
    const data = await apiFetch(`/api/internal/sastre/tickets/${encodeURIComponent(ticketId)}/measurements`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        measurements,
        tailor_notes: document.getElementById('sm-notes').value.trim(),
        interim_fitting_validated: document.getElementById('sm-validated').checked
      })
    });
    closeModal('modal-sastre-measurements');
    alert(data.message);
    await loadSastreView();
  } catch (err) {
    alert(err.message);
  }
}

function openSastreFabricModal(ticketId) {
  document.getElementById('sf-ticket-id').value = ticketId;
  const sel = document.getElementById('sf-code');
  sel.innerHTML = (cachedSastreData.materials || []).map(m =>
    `<option value="${esc(m.code)}">[${esc(m.category)}] ${esc(m.name)} (Stock actual: ${m.current_stock} ${esc(m.unit)})</option>`
  ).join('');
  openModal('modal-sastre-fabric');
}

async function submitFabricRequest(e) {
  e.preventDefault();
  const ticketId = document.getElementById('sf-ticket-id').value;
  try {
    const data = await apiFetch(`/api/internal/sastre/tickets/${encodeURIComponent(ticketId)}/fabric-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inventory_code: document.getElementById('sf-code').value,
        quantity_requested: parseFloat(document.getElementById('sf-qty').value),
        notes: document.getElementById('sf-notes').value.trim()
      })
    });
    closeModal('modal-sastre-fabric');
    alert(data.message);
    await loadSastreView();
  } catch (err) {
    alert(err.message);
  }
}

async function sendTicketToQC(ticketId) {
  const t = cachedSastreData.tickets.find(x => x.id === ticketId);
  try {
    const data = await apiFetch(`/api/internal/sastre/tickets/${encodeURIComponent(ticketId)}/send-to-qc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tailor_notes: t ? t.tailor_notes : null })
    });
    alert(data.message);
    await loadSastreView();
  } catch (err) {
    alert(err.message);
  }
}

// ==========================================================
// VISTA 3: ANALISTA DE INVENTARIO
// ==========================================================

async function loadInventarioView() {
  try {
    cachedInventarioData = await apiFetch('/api/internal/inventario/overview');
    renderInventarioView();
  } catch (err) {
    alert(err.message);
  }
}

function renderInventarioView() {
  const reqs = cachedInventarioData.fabric_requests || [];
  const pendingCount = reqs.filter(r => r.status === 'Pendiente').length;
  document.getElementById('inv-req-pending-count').textContent = `${pendingCount} pendientes`;

  const reqEl = document.getElementById('inv-fabric-requests-list');
  if (reqs.length === 0) {
    reqEl.innerHTML = `<div class="p-6 text-center text-xs text-[#A78D78]">Sin solicitudes de tela registradas.</div>`;
  } else {
    reqEl.innerHTML = reqs.map(fr => `
      <div class="p-4 rounded-xl border ${fr.status === 'Pendiente' ? 'border-[#6E473B] bg-[#FAF7F2]' : 'border-[#BEB5A9]/50 bg-white'} flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-mono font-bold text-[#291C0E]">${esc(fr.id)}</span>
            <span class="px-2 py-0.5 rounded-full font-bold ${fr.status === 'Pendiente' ? 'bg-amber-100 text-amber-900' : (fr.status === 'Despachada' ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900')}">${esc(fr.status)}</span>
            <span class="text-[#A78D78]">Orden: <strong class="font-mono text-[#291C0E]">${esc(fr.ticket_id)}</strong> (${esc(fr.customer_name || '')})</span>
          </div>
          <p class="font-bold text-sm text-[#291C0E]">${esc(fr.item_name)} — <span class="font-mono">${fr.quantity_requested} ${esc(fr.unit)}</span></p>
          ${fr.notes ? `<p class="text-[#6E473B]">${esc(fr.notes)}</p>` : ''}
        </div>
        ${fr.status === 'Pendiente' ? `
          <div class="flex items-center gap-2 shrink-0">
            <button onclick="dispatchFabricRequest('${esc(fr.id)}')" class="px-4 py-2 rounded-xl bg-[#6E473B] hover:bg-[#291C0E] text-white font-bold">Despachar a Sastre</button>
            <button onclick="rejectFabricRequest('${esc(fr.id)}')" class="px-3 py-2 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold">Rechazar</button>
          </div>` : `<span class="text-[11px] text-[#A78D78]">${esc(fr.resolved_at || '')}</span>`}
      </div>
    `).join('');
  }

  const invGrid = document.getElementById('inv-stock-grid');
  invGrid.innerHTML = (cachedInventarioData.inventory || []).map(item => `
    <div class="p-4 rounded-2xl border ${item.is_reorder_needed ? 'border-rose-400 bg-rose-50/40' : 'border-[#BEB5A9]/60 bg-[#FAF7F2]'} space-y-2.5 text-xs">
      <div class="flex items-center justify-between">
        <span class="font-mono font-bold text-[#6E473B]">${esc(item.code)} • ${esc(item.category)}</span>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${item.is_reorder_needed ? 'bg-rose-600 text-white' : 'bg-emerald-100 text-emerald-800'}">
          ${item.percentage_stock}% ${item.is_reorder_needed ? '• REORDEN ≤30%' : ''}
        </span>
      </div>
      <h4 class="font-bold text-sm text-[#291C0E]">${esc(item.name)}</h4>
      <div class="w-full h-2 rounded-full bg-[#E1D4C2] overflow-hidden">
        <div class="h-full ${item.is_reorder_needed ? 'bg-rose-600' : 'bg-[#6E473B]'}" style="width: ${Math.min(item.percentage_stock, 100)}%"></div>
      </div>
      <div class="flex justify-between text-[11px] text-[#6E473B]">
        <span>Stock: <strong>${item.current_stock} ${esc(item.unit)}</strong></span>
        <span>Óptimo: ${item.optimal_stock} (Mín 30%: ${item.reorder_point})</span>
      </div>
      <button onclick="createPurchaseOrder('${esc(item.code)}', ${item.optimal_stock - item.current_stock})"
              ${item.is_reorder_needed ? '' : 'disabled'}
              class="w-full py-2 rounded-xl font-bold transition ${item.is_reorder_needed ? 'bg-[#291C0E] hover:bg-[#6E473B] text-white' : 'bg-[#E1D4C2]/60 text-[#A78D78] cursor-not-allowed'}">
        ${item.is_reorder_needed ? 'Ordenar Reabastecimiento a Proveedor' : 'Por encima del 30% (No requiere compra)'}
      </button>
    </div>
  `).join('');

  const poEl = document.getElementById('inv-po-list');
  const pos = cachedInventarioData.purchase_orders || [];
  poEl.innerHTML = pos.length === 0
    ? `<p class="text-xs text-[#A78D78]">No hay órdenes de compra registradas.</p>`
    : pos.map(po => `
      <div class="p-3.5 rounded-xl border border-[#BEB5A9]/50 bg-[#FAF7F2] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div>
          <span class="font-mono font-bold text-[#291C0E]">${esc(po.id)}</span> — <strong>${esc(po.item_name)}</strong> (${po.quantity} ${esc(po.unit)})
          <span class="text-[#6E473B] block">Proveedor: ${esc(po.supplier)} | Costo est: $${Number(po.estimated_cost).toFixed(2)} | Fecha: ${esc(po.date_ordered)}</span>
        </div>
        ${po.status === 'En Camino'
          ? `<button onclick="receivePurchaseOrder('${esc(po.id)}')" class="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shrink-0">Recibir en Stock</button>`
          : `<span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold">${esc(po.status)}</span>`}
      </div>
    `).join('');
}

async function dispatchFabricRequest(reqId) {
  try {
    const data = await apiFetch(`/api/internal/inventario/fabric-requests/${encodeURIComponent(reqId)}/dispatch`, { method: 'POST' });
    alert(data.message);
    await loadInventarioView();
  } catch (err) {
    alert(err.message);
  }
}

async function rejectFabricRequest(reqId) {
  const notes = prompt('Indique el motivo de rechazo (ej. sin existencia, pedir reorden):');
  if (!notes) return;
  try {
    const data = await apiFetch(`/api/internal/inventario/fabric-requests/${encodeURIComponent(reqId)}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes })
    });
    alert(data.message);
    await loadInventarioView();
  } catch (err) {
    alert(err.message);
  }
}

async function createPurchaseOrder(code, suggestedQty) {
  const qtyStr = prompt(`Cantidad a ordenar para ${code}:`, String(Math.max(Math.round(suggestedQty), 10)));
  if (!qtyStr) return;
  const quantity = parseFloat(qtyStr);
  try {
    const data = await apiFetch('/api/internal/inventario/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_code: code, quantity })
    });
    alert(data.message);
    await loadInventarioView();
  } catch (err) {
    alert(err.message);
  }
}

async function receivePurchaseOrder(poId) {
  try {
    const data = await apiFetch(`/api/internal/inventario/purchase-orders/${encodeURIComponent(poId)}/receive`, { method: 'POST' });
    alert(data.message);
    await loadInventarioView();
  } catch (err) {
    alert(err.message);
  }
}

// ==========================================================
// VISTA 4: CONTROL DE CALIDAD
// ==========================================================

async function loadCalidadView() {
  try {
    cachedCalidadData = await apiFetch('/api/internal/calidad/queue');
    renderCalidadView();
  } catch (err) {
    alert(err.message);
  }
}

function renderCalidadView() {
  const pending = cachedCalidadData.pending || [];
  document.getElementById('calidad-count-badge').textContent = `${pending.length} por revisar`;

  const pendingEl = document.getElementById('calidad-pending-list');
  if (pending.length === 0) {
    pendingEl.innerHTML = `<div class="bg-white rounded-2xl border border-[#BEB5A9] p-12 text-center text-xs text-[#A78D78]">No hay piezas esperando inspección de Control de Calidad.</div>`;
  } else {
    pendingEl.innerHTML = pending.map(t => {
      const meas = Object.entries(t.measurements || {}).map(([k, v]) => `${k}: ${v}cm`).join(' • ');
      return `
        <div class="bg-white rounded-2xl border border-[#BEB5A9] p-6 space-y-4 text-xs shadow-xs">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="font-mono font-bold text-[#291C0E]">${esc(t.id)}</span>
              ${stageBadge(t.stage)}
            </div>
            <span class="text-[#6E473B]">Entrega pactada: <strong>${esc(t.delivery_date || 'N/A')}</strong></span>
          </div>
          <div>
            <h4 class="font-serif-luxury text-xl font-bold text-[#291C0E]">${esc(t.garment_description)}</h4>
            <p class="text-[#6E473B]">Cliente: <strong>${esc(t.customer_name)}</strong> | Ajustes previos: ${t.adjustment_count || 0}</p>
          </div>
          ${meas ? `<div class="p-3 rounded-xl bg-[#FAF7F2] border border-[#BEB5A9]/50 font-mono text-[11px]"><strong>Medidas Acordadas:</strong> ${esc(meas)}</div>` : ''}
          ${t.tailor_notes ? `<p class="text-[#6E473B]">Notas del taller: ${esc(t.tailor_notes)}</p>` : ''}

          <div class="p-4 rounded-xl bg-[#FAF7F2] border border-[#BEB5A9]/60 space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label class="flex items-center space-x-2"><input type="checkbox" checked class="h-4 w-4 text-[#6E473B]"><span>Costuras parejas</span></label>
              <label class="flex items-center space-x-2"><input type="checkbox" checked class="h-4 w-4 text-[#6E473B]"><span>Sin hilos sueltos</span></label>
              <label class="flex items-center space-x-2"><input type="checkbox" checked class="h-4 w-4 text-[#6E473B]"><span>Medidas exactas verificadas</span></label>
            </div>
            <div>
              <label class="block font-bold text-[#291C0E] mb-1">Observaciones de Control de Calidad</label>
              <input type="text" id="qc-notes-${esc(t.id)}" placeholder="Anotaciones de aprobación o motivo de devolución al Sastre..." class="w-full px-3 py-2 rounded-xl border border-[#BEB5A9] bg-white">
            </div>
            <div class="flex flex-wrap gap-2 justify-end">
              <button onclick="reviewQualityTicket('${esc(t.id)}', 'Rechazado')" class="px-4 py-2 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold">
                Rechazar y Devolver a Sastre
              </button>
              <button onclick="reviewQualityTicket('${esc(t.id)}', 'Aprobado')" class="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold">
                Aprobar y Enviar a Mostrador
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  const recentEl = document.getElementById('calidad-recent-list');
  recentEl.innerHTML = (cachedCalidadData.recent || []).length === 0
    ? `<p class="text-xs text-[#A78D78]">Sin inspecciones previas.</p>`
    : cachedCalidadData.recent.map(t => `
      <div class="p-3 rounded-xl bg-[#FAF7F2] border border-[#BEB5A9]/40 flex items-center justify-between text-xs">
        <div>
          <span class="font-mono font-bold">${esc(t.id)}</span> — ${esc(t.garment_description)} (${esc(t.customer_name)})
          <span class="block text-[11px] text-[#6E473B]">${esc(t.qc_notes || '')}</span>
        </div>
        <span class="px-2.5 py-0.5 rounded-full font-bold ${t.qc_status === 'Aprobado' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">${esc(t.qc_status)}</span>
      </div>
    `).join('');
}

async function reviewQualityTicket(ticketId, decision) {
  const notes = (document.getElementById(`qc-notes-${ticketId}`)?.value || '').trim();
  try {
    const data = await apiFetch(`/api/internal/calidad/tickets/${encodeURIComponent(ticketId)}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, qc_notes: notes })
    });
    alert(data.message);
    await loadCalidadView();
  } catch (err) {
    alert(err.message);
  }
}

// ==========================================================
// VISTA 5: FACTURACIÓN Y COBROS
// ==========================================================

async function loadFacturacionView() {
  const q = (document.getElementById('fac-search-input')?.value || '').trim();
  const url = q ? `/api/internal/facturacion/overview?q=${encodeURIComponent(q)}` : '/api/internal/facturacion/overview';
  try {
    cachedFacturacionData = await apiFetch(url);
    renderFacturacionView();
  } catch (err) {
    alert(err.message);
  }
}

function renderFacturacionView() {
  document.getElementById('fac-total-collected').textContent = `$${Number(cachedFacturacionData.total_collected || 0).toFixed(2)}`;
  document.getElementById('fac-total-pending').textContent = `$${Number(cachedFacturacionData.pending_receivable || 0).toFixed(2)}`;

  const readyList = cachedFacturacionData.ready_to_bill || [];
  const readyEl = document.getElementById('fac-ready-list');
  readyEl.innerHTML = readyList.length === 0
    ? `<p class="text-xs text-[#A78D78]">No hay pedidos listos pendientes de cobro final.</p>`
    : readyList.map(t => `
      <div class="p-4 rounded-xl border border-[#BEB5A9] bg-[#FAF7F2] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="font-mono font-bold text-[#291C0E]">${esc(t.id)}</span>
            ${stageBadge(t.stage)}
          </div>
          <p class="font-bold text-sm text-[#291C0E]">${esc(t.garment_description)} — ${esc(t.customer_name)}</p>
          <p class="text-[#6E473B]">Total: $${Number(t.total_price).toFixed(2)} | Anticipo: $${Number(t.advance_payment).toFixed(2)} | <strong class="text-[#291C0E]">Saldo por Cobrar: $${Number(t.remaining_balance).toFixed(2)}</strong></p>
        </div>
        <button onclick="openPayInvoiceModal('${esc(t.id)}')" class="px-5 py-2.5 rounded-xl bg-[#291C0E] hover:bg-[#6E473B] text-white font-bold shrink-0">
          Cobrar Saldo y Facturar
        </button>
      </div>
    `).join('');

  const invEl = document.getElementById('fac-invoices-list');
  const invs = cachedFacturacionData.invoices || [];
  invEl.innerHTML = invs.length === 0
    ? `<p class="text-xs text-[#A78D78]">No se encontraron comprobantes.</p>`
    : invs.map(inv => `
      <div class="p-3.5 rounded-xl border border-[#BEB5A9]/50 bg-[#FAF7F2] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div>
          <span class="font-mono font-bold text-[#291C0E]">${esc(inv.id)}</span> • <span class="text-[#6E473B] font-semibold">${esc(inv.invoice_type)}</span>
          <p class="font-bold text-[#291C0E]">${esc(inv.customer_name)} — Orden ${esc(inv.order_ref)}</p>
          <p class="text-[11px] text-[#A78D78]">${esc(inv.date)} | ${esc(inv.payment_method)} | Cobrado: $${Number(inv.amount_paid).toFixed(2)} | Saldo: $${Number(inv.balance_due).toFixed(2)}</p>
        </div>
        <button onclick="viewInternalInvoice('${esc(inv.id)}')" class="px-4 py-2 rounded-xl border border-[#BEB5A9] bg-white hover:bg-[#E1D4C2] font-bold shrink-0">
          Ver Comprobante
        </button>
      </div>
    `).join('');
}

function openPayInvoiceModal(ticketId) {
  const t = cachedFacturacionData.ready_to_bill.find(x => x.id === ticketId);
  if (!t) return;
  document.getElementById('pi-ticket-id').value = t.id;
  document.getElementById('pi-summary').innerHTML = `
    <p class="font-bold text-[#291C0E]">${esc(t.id)} — ${esc(t.garment_description)}</p>
    <p>Cliente: ${esc(t.customer_name)}</p>
    <p>Total: $${Number(t.total_price).toFixed(2)} | Pagado previo: $${Number(t.advance_payment).toFixed(2)}</p>
    <p class="text-[#6E473B] font-bold">Saldo pendiente obligatorio: $${Number(t.remaining_balance).toFixed(2)}</p>
  `;
  document.getElementById('pi-amount').value = Number(t.remaining_balance).toFixed(2);
  openModal('modal-pay-invoice');
}

async function submitFinalPayment(e) {
  e.preventDefault();
  const ticketId = document.getElementById('pi-ticket-id').value;
  try {
    const data = await apiFetch(`/api/internal/facturacion/tickets/${encodeURIComponent(ticketId)}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: parseFloat(document.getElementById('pi-amount').value),
        payment_method: document.getElementById('pi-method').value,
        notes: document.getElementById('pi-notes').value.trim()
      })
    });
    closeModal('modal-pay-invoice');
    await loadFacturacionView();
    if (data.invoice_id) {
      await viewInternalInvoice(data.invoice_id);
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert(err.message);
  }
}

async function viewInternalInvoice(invoiceId) {
  try {
    const inv = await apiFetch(`/api/internal/facturacion/invoices/${encodeURIComponent(invoiceId)}`);
    document.getElementById('receipt-body').innerHTML = `
      <div class="text-center space-y-1 border-b border-[#BEB5A9]/50 pb-3">
        <h2 class="font-serif-luxury text-xl font-bold text-[#291C0E]">SASTRERÍA ALL LOOK</h2>
        <p class="text-[10px] text-[#6E473B]">COMPROBANTE OFICIAL DE PAGO Y ENTREGA</p>
        <p class="font-bold text-[#291C0E]">${esc(inv.id)}</p>
      </div>
      <div class="space-y-1">
        <p>Fecha: ${esc(inv.date)}</p>
        <p>Referencia de Orden: <strong>${esc(inv.order_ref)}</strong></p>
        <p>Tipo: ${esc(inv.invoice_type)}</p>
        <p>Cliente: <strong>${esc(inv.customer_name)}</strong></p>
        <p>Cédula: ${esc(inv.customer_id_card || 'N/A')} | Tel: ${esc(inv.customer_phone || 'N/A')}</p>
      </div>
      <div class="border-y border-[#BEB5A9]/50 py-2">
        <p class="font-bold">CONCEPTO:</p>
        <p>${esc(inv.concept)}</p>
        ${inv.notes ? `<p class="text-[10px] text-[#6E473B] mt-1">${esc(inv.notes)}</p>` : ''}
      </div>
      <div class="space-y-1 text-right">
        <p>Subtotal: $${Number(inv.subtotal).toFixed(2)}</p>
        <p>ITBMS (7%): $${Number(inv.tax).toFixed(2)}</p>
        <p class="text-sm font-bold text-[#291C0E]">MONTO ABONADO: $${Number(inv.amount_paid).toFixed(2)}</p>
        <p class="font-bold text-[#6E473B]">SALDO PENDIENTE: $${Number(inv.balance_due).toFixed(2)}</p>
        <p class="text-[10px]">Forma de Pago: ${esc(inv.payment_method)}</p>
      </div>
    `;
    openModal('modal-invoice-receipt');
  } catch (err) {
    alert(err.message);
  }
}

// ==========================================================
// VISTA 6: CATÁLOGO DE PIEZAS WEB
// ==========================================================

async function loadCatalogoAdminView() {
  try {
    cachedCatalogItems = await apiFetch('/api/internal/catalogo/items');
    const grid = document.getElementById('admin-catalog-grid');
    grid.innerHTML = cachedCatalogItems.map(item => `
      <div class="bg-white rounded-2xl border border-[#BEB5A9] overflow-hidden flex flex-col justify-between text-xs">
        <div>
          <div class="h-44 bg-[#FAF7F2] overflow-hidden">
            <img src="${esc(item.image_url || '/static/img/suit_grey.jpg')}" alt="${esc(item.name)}" class="w-full h-full object-cover object-top">
          </div>
          <div class="p-4 space-y-1.5">
            <div class="flex justify-between font-bold text-[#6E473B]">
              <span>${esc(item.category)} • ${esc(item.size)}</span>
              <span>Stock: ${item.stock}</span>
            </div>
            <h4 class="font-serif-luxury text-base font-bold text-[#291C0E]">${esc(item.name)}</h4>
            <p class="text-[#A78D78] line-clamp-2">${esc(item.fabric || item.description || '')}</p>
            <div class="font-mono font-bold text-lg text-[#291C0E]">$${Number(item.price).toFixed(2)}</div>
          </div>
        </div>
        <div class="p-3 bg-[#FAF7F2] border-t border-[#BEB5A9]/40 flex justify-end gap-2">
          <button onclick="editCatalogItem(${item.id})" class="px-3 py-1.5 rounded-lg border border-[#BEB5A9] bg-white font-bold">Editar</button>
          <button onclick="deleteCatalogItem(${item.id})" class="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 font-bold">Eliminar</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    alert(err.message);
  }
}

function openCatalogModal() {
  document.getElementById('cat-modal-title').textContent = 'Nueva Pieza de Colección';
  ['ci-id', 'ci-name', 'ci-category', 'ci-style', 'ci-size', 'ci-color', 'ci-price', 'ci-stock', 'ci-fabric', 'ci-delivery', 'ci-care', 'ci-description'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('ci-stock').value = '3';
  openModal('modal-catalog-item');
}

function editCatalogItem(id) {
  const item = cachedCatalogItems.find(x => x.id === id);
  if (!item) return;
  document.getElementById('cat-modal-title').textContent = `Editar: ${item.name}`;
  document.getElementById('ci-id').value = item.id;
  document.getElementById('ci-name').value = item.name;
  document.getElementById('ci-category').value = item.category;
  document.getElementById('ci-style').value = item.style;
  document.getElementById('ci-size').value = item.size;
  document.getElementById('ci-color').value = item.color;
  document.getElementById('ci-price').value = item.price;
  document.getElementById('ci-stock').value = item.stock;
  document.getElementById('ci-image').value = item.image_url || '/static/img/suit_grey.jpg';
  document.getElementById('ci-fabric').value = item.fabric || '';
  document.getElementById('ci-delivery').value = item.delivery_time || '';
  document.getElementById('ci-care').value = item.care_instructions || '';
  document.getElementById('ci-description').value = item.description || '';
  openModal('modal-catalog-item');
}

async function submitCatalogItem(e) {
  e.preventDefault();
  const id = document.getElementById('ci-id').value;
  const payload = {
    name: document.getElementById('ci-name').value.trim(),
    category: document.getElementById('ci-category').value.trim(),
    style: document.getElementById('ci-style').value.trim(),
    size: document.getElementById('ci-size').value.trim(),
    color: document.getElementById('ci-color').value.trim(),
    price: parseFloat(document.getElementById('ci-price').value),
    stock: parseInt(document.getElementById('ci-stock').value, 10),
    image_url: document.getElementById('ci-image').value,
    fabric: document.getElementById('ci-fabric').value.trim(),
    delivery_time: document.getElementById('ci-delivery').value.trim(),
    care_instructions: document.getElementById('ci-care').value.trim(),
    description: document.getElementById('ci-description').value.trim()
  };

  try {
    if (id) {
      await apiFetch(`/api/internal/catalogo/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      await apiFetch('/api/internal/catalogo/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    closeModal('modal-catalog-item');
    await loadCatalogoAdminView();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteCatalogItem(id) {
  if (!confirm('¿Eliminar esta pieza del catálogo web?')) return;
  try {
    await apiFetch(`/api/internal/catalogo/items/${id}`, { method: 'DELETE' });
    await loadCatalogoAdminView();
  } catch (err) {
    alert(err.message);
  }
}

// ==========================================================
// VISTA 7: ADMINISTRACIÓN DE TRABAJADORES Y PERMISOS
// ==========================================================

async function loadAdminWorkersView() {
  try {
    const data = await apiFetch('/api/internal/admin/workers');
    cachedWorkersList = data.workers || [];
    if (data.views_catalog) viewsCatalog = data.views_catalog;
    await refreshAdminPreviewDropdown();
    renderAdminWorkers();
  } catch (err) {
    alert(err.message);
  }
}

function renderAdminWorkers() {
  const container = document.getElementById('admin-workers-list');
  container.innerHTML = cachedWorkersList.map(w => `
    <div class="bg-white rounded-2xl border ${w.is_active ? 'border-[#BEB5A9]' : 'border-rose-300 bg-rose-50/20'} p-6 space-y-4 text-xs">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#BEB5A9]/40 pb-4">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="font-mono font-bold text-[#6E473B]">${esc(w.username)}</span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${w.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
              ${w.is_active ? 'Activo' : 'Suspendido'}
            </span>
          </div>
          <h4 class="font-serif-luxury text-lg font-bold text-[#291C0E]">${esc(w.role_label)}</h4>
        </div>

        <div class="flex flex-wrap gap-2">
          <button onclick="previewSpecificWorker('${esc(w.id)}')" class="px-3 py-1.5 rounded-xl border border-[#BEB5A9] bg-[#FAF7F2] hover:bg-[#E1D4C2] font-bold">
            Previsualizar Vistas
          </button>
          <button onclick="resetWorkerPassword('${esc(w.id)}', '${esc(w.username)}')" class="px-3 py-1.5 rounded-xl border border-[#BEB5A9] font-bold">
            Cambiar Clave
          </button>
          <button onclick="toggleWorkerActive('${esc(w.id)}', ${w.is_active ? 'false' : 'true'})" class="px-3 py-1.5 rounded-xl border border-[#BEB5A9] font-bold">
            ${w.is_active ? 'Suspender' : 'Activar'}
          </button>
          <button onclick="deleteWorker('${esc(w.id)}', '${esc(w.username)}')" class="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 font-bold">
            Eliminar
          </button>
        </div>
      </div>

      <div class="space-y-2.5">
        <span class="font-bold text-[#6E473B] uppercase text-[10px] tracking-wider block">Vistas habilitadas para este trabajador:</span>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          ${viewsCatalog.map(v => {
            const checked = (w.allowed_views || []).includes(v.key) ? 'checked' : '';
            return `
              <label class="flex items-center space-x-2 p-2.5 rounded-xl bg-[#FAF7F2] border border-[#BEB5A9]/60 cursor-pointer hover:bg-[#E1D4C2]/40">
                <input type="checkbox" class="worker-perm-cb-${esc(w.id)} h-4 w-4 text-[#6E473B]" value="${esc(v.key)}" ${checked}>
                <span class="font-semibold text-[#291C0E]">${esc(v.short_label || v.label)}</span>
              </label>
            `;
          }).join('')}
        </div>
        <div class="flex justify-end pt-1">
          <button onclick="saveWorkerPermissions('${esc(w.id)}')" class="px-5 py-2 rounded-xl bg-[#6E473B] hover:bg-[#291C0E] text-white font-bold">
            Guardar Permisos de Vista
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

async function saveWorkerPermissions(workerId) {
  const cbs = document.querySelectorAll(`.worker-perm-cb-${workerId}`);
  const allowed_views = Array.from(cbs).filter(c => c.checked).map(c => c.value);
  try {
    const data = await apiFetch(`/api/internal/admin/workers/${encodeURIComponent(workerId)}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowed_views })
    });
    alert(data.message);
    await loadAdminWorkersView();
  } catch (err) {
    alert(err.message);
    await loadAdminWorkersView();
  }
}

async function toggleWorkerActive(workerId, newState) {
  try {
    await apiFetch(`/api/internal/admin/workers/${encodeURIComponent(workerId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: newState })
    });
    await loadAdminWorkersView();
  } catch (err) {
    alert(err.message);
  }
}

async function resetWorkerPassword(workerId, username) {
  const newPass = prompt(`Nueva contraseña para el trabajador '${username}' (mínimo 4 caracteres):`);
  if (!newPass) return;
  try {
    await apiFetch(`/api/internal/admin/workers/${encodeURIComponent(workerId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPass })
    });
    alert('Contraseña actualizada.');
  } catch (err) {
    alert(err.message);
  }
}

async function deleteWorker(workerId, username) {
  if (!confirm(`¿Eliminar permanentemente la cuenta de trabajador '${username}'?`)) return;
  try {
    await apiFetch(`/api/internal/admin/workers/${encodeURIComponent(workerId)}`, { method: 'DELETE' });
    await loadAdminWorkersView();
  } catch (err) {
    alert(err.message);
  }
}

function openCreateWorkerModal() {
  document.getElementById('wf-username').value = '';
  document.getElementById('wf-password').value = '';
  document.getElementById('wf-role-label').value = '';
  const box = document.getElementById('wf-views-checkboxes');
  box.innerHTML = viewsCatalog.map(v => `
    <label class="flex items-center space-x-2 p-2.5 rounded-xl bg-[#FAF7F2] border border-[#BEB5A9]/60 cursor-pointer">
      <input type="checkbox" class="wf-perm-cb h-4 w-4 text-[#6E473B]" value="${esc(v.key)}">
      <span class="font-semibold">${esc(v.label)}</span>
    </label>
  `).join('');
  openModal('modal-worker-form');
}

async function submitCreateWorker(e) {
  e.preventDefault();
  const allowed_views = Array.from(document.querySelectorAll('.wf-perm-cb')).filter(c => c.checked).map(c => c.value);
  try {
    const data = await apiFetch('/api/internal/admin/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('wf-username').value.trim(),
        password: document.getElementById('wf-password').value,
        role_label: document.getElementById('wf-role-label').value.trim(),
        role_type: document.getElementById('wf-role-type').value,
        allowed_views,
        is_active: true
      })
    });
    closeModal('modal-worker-form');
    alert(data.message);
    await loadAdminWorkersView();
  } catch (err) {
    alert(err.message);
  }
}
