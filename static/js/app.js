// Estado Global de la Aplicación
let currentView = 'dashboard';
let cachedInventory = [];
let cachedRentalCatalog = [];
let cachedCustomOrders = [];
let cachedInvoices = [];

// Inicialización al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  switchView('dashboard');
  setInterval(refreshDashboardStats, 30000); // Actualización en segundo plano cada 30s
});

// Navegación entre vistas
function switchView(viewName) {
  currentView = viewName;

  // Actualizar Sidebar
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('active', 'bg-[#422F1C]', 'text-white', 'border-l-4', 'border-[#6E473B]');
    el.classList.add('text-[#E1D4C2]/80');
  });

  const activeBtn = document.getElementById(`nav-${viewName}`);
  if (activeBtn) {
    activeBtn.classList.add('active', 'bg-[#422F1C]', 'text-white', 'border-l-4', 'border-[#6E473B]');
    activeBtn.classList.remove('text-[#E1D4C2]/80');
  }

  // Ocultar todas las vistas y mostrar la seleccionada
  document.querySelectorAll('.view-content').forEach(el => el.classList.add('hidden'));
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.remove('hidden');

  // Actualizar Título
  const titles = {
    'dashboard': { title: 'Tablero General del Taller', subtitle: 'Supervisión operativa, control de calidad y reglas del negocio en tiempo real' },
    'custom-orders': { title: 'Confección a la Medida', subtitle: 'Flujo de patronaje, corte, costura, control de calidad y prueba intermedia a 15 días' },
    'ready-sales': { title: 'Venta de Exhibición (Al Detal)', subtitle: 'Catálogo de prendas en mostrador con opción de ajuste rápido' },
    'alterations': { title: 'Arreglos y Ajustes', subtitle: 'Transformaciones y reparaciones sobre prendas traídas por clientes' },
    'rentals': { title: 'Alquiler de Trajes y Vestidos', subtitle: 'Préstamos para ocasiones especiales, depósito de garantía y control de devoluciones' },
    'inventory': { title: 'Insumos & Punto de Reorden (30%)', subtitle: 'Control de existencias de telas, hilos, botones y compras automatizadas a proveedores' },
    'invoices': { title: 'Facturación & Monitoreo de Retiros', subtitle: 'Registro formal de cobros, recibos rastreables y alertas de prendas no retiradas' }
  };

  if (titles[viewName]) {
    document.getElementById('view-title').innerText = titles[viewName].title;
    document.getElementById('view-subtitle').innerText = titles[viewName].subtitle;
  }

  // Cargar datos según la vista
  if (viewName === 'dashboard') loadDashboard();
  if (viewName === 'custom-orders') loadCustomOrders();
  if (viewName === 'ready-sales') loadReadyCatalog();
  if (viewName === 'alterations') loadAlterations();
  if (viewName === 'rentals') loadRentals();
  if (viewName === 'inventory') loadInventory();
  if (viewName === 'invoices') loadInvoices();

  lucide.createIcons();
}

function refreshCurrentView() {
  switchView(currentView);
}

// ==========================================================
// CONTROL DE MODALES
// ==========================================================

function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('hidden');
    lucide.createIcons();
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

// ==========================================================
// VISTA: DASHBOARD
// ==========================================================

async function loadDashboard() {
  try {
    const res = await fetch('/api/dashboard/stats');
    const data = await res.json();

    document.getElementById('kpi-custom-in-progress').innerText = data.custom_in_progress;
    document.getElementById('kpi-custom-ready').innerText = data.custom_ready;
    document.getElementById('kpi-custom-delayed-badge').innerText = `${data.custom_delayed} con retraso > 5 días`;
    document.getElementById('kpi-active-rentals').innerText = data.active_rentals;
    document.getElementById('kpi-low-inventory').innerText = data.low_inventory_count;

    // Badge en sidebar
    const reorderBadge = document.getElementById('nav-badge-reorder');
    if (data.low_inventory_count > 0) {
      reorderBadge.innerText = data.low_inventory_count;
      reorderBadge.classList.remove('hidden');
    } else {
      reorderBadge.classList.add('hidden');
    }

    // Cargar listas breves
    loadDashboardOrders();
    loadDashboardLowStock();
  } catch (err) {
    console.error('Error cargando KPIs de dashboard:', err);
  }
}

async function refreshDashboardStats() {
  if (currentView === 'dashboard') {
    loadDashboard();
  }
}

async function loadDashboardOrders() {
  try {
    const res = await fetch('/api/custom-orders?status_filter=En%20Proceso');
    const orders = await res.json();
    const container = document.getElementById('dashboard-custom-orders-list');

    if (orders.length === 0) {
      container.innerHTML = `<div class="p-6 text-center text-xs text-[#A78D78]">No hay órdenes en proceso en este momento.</div>`;
      return;
    }

    container.innerHTML = orders.slice(0, 4).map(o => `
      <div class="p-4 hover:bg-[#FAF7F2] transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#BEB5A9]/30 last:border-b-0">
        <div>
          <div class="flex items-center space-x-2">
            <span class="font-bold text-[#291C0E] text-sm">${o.garment_type}</span>
            <span class="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[#E1D4C2] text-[#291C0E] border border-[#BEB5A9]">${o.stage}</span>
          </div>
          <p class="text-xs text-[#A78D78] mt-1">Cliente: <strong class="text-[#291C0E]">${o.customer_name}</strong> | Entrega: ${o.delivery_date}</p>
          <p class="text-[11px] text-[#6E473B] mt-0.5 font-semibold">Cita prueba 15d: ${o.interim_fitting_date}</p>
        </div>
        <div class="flex items-center space-x-2">
          <button onclick="openStageModal('${o.id}')" class="px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#E1D4C2] text-[#291C0E] border border-[#BEB5A9] rounded-lg text-xs font-bold transition">
            Avanzar Etapa
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error cargando órdenes dashboard:', err);
  }
}

async function loadDashboardLowStock() {
  try {
    const res = await fetch('/api/inventory');
    const items = await res.json();
    const lowItems = items.filter(i => i.is_reorder_needed);
    const container = document.getElementById('dashboard-low-stock-list');

    if (lowItems.length === 0) {
      container.innerHTML = `<div class="p-4 bg-emerald-50 text-emerald-800 text-xs rounded-lg">Todos los insumos superan el 30% del nivel óptimo.</div>`;
      return;
    }

    container.innerHTML = lowItems.slice(0, 5).map(item => `
      <div class="p-3 bg-[#FAF7F2] border border-[#BEB5A9] rounded-xl flex items-center justify-between text-xs">
        <div>
          <p class="font-bold text-[#291C0E]">${item.name}</p>
          <p class="text-[#6E473B] text-[11px] font-semibold">Stock: ${item.current_stock} ${item.unit} (${item.percentage_stock}% de ${item.optimal_stock})</p>
        </div>
        <button onclick="triggerReorder('${item.code}')" class="px-2.5 py-1 bg-[#6E473B] hover:bg-[#543429] text-white rounded-lg text-xs font-bold shadow-sm transition">
          Reordenar
        </button>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error cargando stock crítico:', err);
  }
}

// ==========================================================
// VISTA: CONFECCIÓN A LA MEDIDA
// ==========================================================

async function loadCustomOrders() {
  try {
    const res = await fetch('/api/custom-orders');
    cachedCustomOrders = await res.json();
    const tbody = document.getElementById('custom-orders-table-body');

    if (cachedCustomOrders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-xs text-[#A78D78]">No hay pedidos a la medida registrados.</td></tr>`;
      return;
    }

    tbody.innerHTML = cachedCustomOrders.map(o => {
      let stageColor = "bg-[#FAF7F2] text-[#291C0E] border-[#BEB5A9]";
      if (o.stage === "Control de Calidad") stageColor = "bg-[#E1D4C2] text-[#291C0E] border-[#A78D78]";
      if (o.stage === "Terminado / Listo para Entrega") stageColor = "bg-[#DCFCE7] text-[#166534] border-[#86EFAC]";
      if (o.stage === "Entregado") stageColor = "bg-[#FAF7F2] text-[#6E473B] border-[#BEB5A9]";

      let qcBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] bg-[#FAF7F2] text-[#A78D78] border border-[#BEB5A9]">Pendiente</span>`;
      if (o.qc_status === "Aprobado") qcBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]">✓ Aprobado</span>`;
      if (o.qc_status === "Rechazado_Retorno_Taller") qcBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]">✗ Rechazado</span>`;

      return `
        <tr class="hover:bg-[#FAF7F2] transition border-b border-[#BEB5A9]/30">
          <td class="px-4 py-3">
            <span class="font-mono text-xs font-bold text-[#6E473B]">${o.id}</span>
            <div class="font-semibold text-[#291C0E]">${o.customer_name}</div>
            <div class="text-[11px] text-[#A78D78]">${o.customer_phone} | Céd: ${o.customer_id_card}</div>
          </td>
          <td class="px-4 py-3">
            <div class="font-semibold text-[#291C0E]">${o.garment_type}</div>
            <div class="text-xs text-[#6E473B] font-semibold">Tela: ${o.fabric_selected}</div>
            <div class="text-[11px] text-[#A78D78]">Ocasión: ${o.occasion}</div>
          </td>
          <td class="px-4 py-3 text-xs">
            <div>Entrega: <strong class="text-[#291C0E]">${o.delivery_date}</strong></div>
            <div class="text-[#6E473B] font-semibold mt-0.5">Prueba 15d: <strong>${o.interim_fitting_date}</strong></div>
            <div class="text-[10px] text-[#A78D78]">Ordenado: ${o.order_date}</div>
          </td>
          <td class="px-4 py-3">
            <span class="px-2.5 py-1 text-xs font-semibold rounded-lg border ${stageColor}">
              ${o.stage}
            </span>
            <div class="text-[10px] text-[#A78D78] mt-1">Sastre: ${o.assigned_tailor || 'Taller Central'}</div>
          </td>
          <td class="px-4 py-3">
            ${qcBadge}
            ${o.qc_notes ? `<div class="text-[10px] text-[#A78D78] mt-0.5 truncate max-w-[150px]" title="${o.qc_notes}">${o.qc_notes}</div>` : ''}
          </td>
          <td class="px-4 py-3 text-xs">
            <div>Total: <strong class="text-[#291C0E]">$${o.total_price.toFixed(2)}</strong></div>
            <div class="text-emerald-700 font-medium">Anticipo 50%: $${o.advance_payment.toFixed(2)}</div>
            ${o.remaining_balance > 0
              ? `<div class="text-[#6E473B] font-bold">Saldo: $${o.remaining_balance.toFixed(2)}</div>`
              : `<div class="text-emerald-700 font-bold">Liquidado</div>`
            }
          </td>
          <td class="px-4 py-3 text-right space-y-1">
            <button onclick="openStageModal('${o.id}')" class="px-2.5 py-1 bg-[#FAF7F2] hover:bg-[#E1D4C2] text-[#291C0E] border border-[#BEB5A9] rounded-lg text-xs font-semibold transition block w-full text-center">
              Avanzar Etapa
            </button>
            ${o.stage === 'Terminado / Listo para Entrega' || o.stage === 'Control de Calidad' ? `
              <button onclick="openFinalFittingModal('${o.id}')" class="px-2.5 py-1 bg-[#6E473B] hover:bg-[#543429] text-white rounded-lg text-xs font-bold shadow-sm transition block w-full text-center">
                Prueba Final & Entrega
              </button>
            ` : ''}
            ${o.remaining_balance > 0 ? `
              <button onclick="promptPayBalance('${o.id}', ${o.remaining_balance})" class="px-2.5 py-1 bg-[#A78D78] hover:bg-[#6E473B] text-white rounded-lg text-xs font-bold shadow-sm transition block w-full text-center">
                Cobrar Saldo ($${o.remaining_balance.toFixed(2)})
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');

    lucide.createIcons();
  } catch (err) {
    console.error('Error cargando órdenes a la medida:', err);
  }
}

// Cálculo automático de la fecha intermedia (15 días antes)
function calculateInterimFitting() {
  const deliveryInput = document.getElementById('co-delivery').value;
  if (!deliveryInput) return;

  const deliveryDate = new Date(deliveryInput + 'T00:00:00');
  const interimDate = new Date(deliveryDate);
  interimDate.setDate(interimDate.getDate() - 15);

  const formatted = interimDate.toISOString().split('T')[0];
  document.getElementById('co-interim-display').innerHTML = `
    <strong>${formatted}</strong> (Se notificará al cliente para cita de verificación de medidas antes del armado final).
  `;
}

// Validación de mínimo 50% de anticipo
function updateAdvanceMin() {
  const total = parseFloat(document.getElementById('co-total').value) || 0;
  const min50 = (total * 0.50).toFixed(2);
  const advWarning = document.getElementById('co-advance-warning');
  advWarning.innerText = `Mínimo 50%: $${min50}`;

  const currentAdv = parseFloat(document.getElementById('co-advance').value) || 0;
  if (currentAdv < parseFloat(min50)) {
    advWarning.classList.add('text-rose-600', 'font-bold');
  } else {
    advWarning.classList.remove('text-rose-600', 'font-bold');
  }
}

// Crear Pedido a la Medida
async function submitCustomOrder(e) {
  e.preventDefault();

  const total = parseFloat(document.getElementById('co-total').value);
  const advance = parseFloat(document.getElementById('co-advance').value);
  const minAdvance = total * 0.50;

  if (advance < minAdvance) {
    alert(`Regla de Negocio Incumplida: Se requiere un anticipo mínimo del 50% ($${minAdvance.toFixed(2)}) antes de iniciar corte y costura.`);
    return;
  }

  const measurements = {
    cuello: parseFloat(document.getElementById('m-cuello').value) || 0,
    pecho: parseFloat(document.getElementById('m-pecho').value) || 0,
    cintura: parseFloat(document.getElementById('m-cintura').value) || 0,
    cadera: parseFloat(document.getElementById('m-cadera').value) || 0,
    hombro: parseFloat(document.getElementById('m-hombro').value) || 0,
    manga: parseFloat(document.getElementById('m-manga').value) || 0,
    pantalon: parseFloat(document.getElementById('m-pantalon').value) || 0,
    tiro: parseFloat(document.getElementById('m-tiro').value) || 0
  };

  const payload = {
    customer_name: document.getElementById('co-name').value,
    customer_phone: document.getElementById('co-phone').value,
    customer_id_card: document.getElementById('co-id').value,
    garment_type: document.getElementById('co-garment').value,
    occasion: document.getElementById('co-occasion').value,
    fabric_selected: document.getElementById('co-fabric').value,
    measurements: measurements,
    total_price: total,
    advance_payment: advance,
    delivery_date: document.getElementById('co-delivery').value,
    weight_clause_acknowledged: document.getElementById('co-clause').checked,
    payment_method: document.getElementById('co-payment-method').value
  };

  try {
    const res = await fetch('/api/custom-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      alert(`Error: ${data.detail || 'No se pudo crear el pedido'}`);
      return;
    }

    closeModal('modal-custom-order');
    alert(`¡Pedido registrado exitosamente!\nCódigo: ${data.order_id}\nCita de Verificación (15 días antes): ${data.interim_fitting_date}\nComprobante generado: ${data.invoice_id}`);

    // Mostrar recibo
    viewInvoice(data.invoice_id);
    loadCustomOrders();
  } catch (err) {
    console.error('Error enviando pedido:', err);
    alert('Error al comunicarse con el servidor.');
  }
}

// Modal de Avance de Etapa
function openStageModal(orderId) {
  const order = cachedCustomOrders.find(o => o.id === orderId);
  if (!order) return;

  document.getElementById('stage-order-id').value = order.id;
  document.getElementById('stage-order-desc').innerText = `${order.garment_type} — Cliente: ${order.customer_name}`;
  document.getElementById('stage-current-info').innerText = `Etapa actual: ${order.stage} | Estado Calidad: ${order.qc_status}`;
  document.getElementById('stage-select').value = order.stage;
  document.getElementById('stage-qc-status').value = order.qc_status === 'Aprobado' ? 'Aprobado' : 'Aprobado';
  document.getElementById('stage-qc-notes').value = order.qc_notes || '';

  checkQcRequirement();
  openModal('modal-stage-progress');
}

function checkQcRequirement() {
  const selectedStage = document.getElementById('stage-select').value;
  const qcSection = document.getElementById('qc-section');
  if (selectedStage === 'Terminado / Listo para Entrega' || selectedStage === 'Control de Calidad') {
    qcSection.classList.remove('hidden');
  } else {
    qcSection.classList.add('hidden');
  }
}

async function submitStageProgress(e) {
  e.preventDefault();
  const orderId = document.getElementById('stage-order-id').value;
  const stage = document.getElementById('stage-select').value;
  const qcStatus = document.getElementById('stage-qc-status').value;
  const qcNotes = document.getElementById('stage-qc-notes').value;
  const notes = document.getElementById('stage-notes').value;

  const payload = {
    stage: stage,
    qc_status: qcStatus,
    qc_notes: qcNotes,
    notes: notes
  };

  try {
    const res = await fetch(`/api/custom-orders/${orderId}/stage`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      alert(`Error: ${data.detail}`);
      return;
    }

    closeModal('modal-stage-progress');
    alert(data.message);
    loadCustomOrders();
    loadDashboard();
  } catch (err) {
    console.error('Error actualizando etapa:', err);
  }
}

// Modal de Prueba Final en Probador (Regla 4: Garantía de Calce)
function openFinalFittingModal(orderId) {
  const order = cachedCustomOrders.find(o => o.id === orderId);
  if (!order) return;

  document.getElementById('ff-order-id').value = order.id;
  document.getElementById('ff-customer-name').innerText = `Cliente: ${order.customer_name} (${order.customer_phone})`;
  document.getElementById('ff-garment').innerText = `Prenda: ${order.garment_type} (Tela: ${order.fabric_selected})`;
  document.getElementById('ff-balance').innerText = order.remaining_balance > 0
    ? `Saldo Pendiente Obligatorio por Cobrar: $${order.remaining_balance.toFixed(2)}`
    : `Saldo Totalmente Cancelado ($0.00 pendiente)`;

  document.getElementById('ff-result').value = 'Perfecto';
  toggleFinalFittingUI();
  openModal('modal-final-fitting');
}

function toggleFinalFittingUI() {
  const res = document.getElementById('ff-result').value;
  const reworkBox = document.getElementById('ff-rework-notes');
  const payBox = document.getElementById('ff-pay-box');

  if (res === 'Ajuste_Sin_Costo') {
    reworkBox.classList.remove('hidden');
    payBox.classList.add('hidden');
  } else {
    reworkBox.classList.add('hidden');
    payBox.classList.remove('hidden');
  }
}

async function submitFinalFittingDecision() {
  const orderId = document.getElementById('ff-order-id').value;
  const result = document.getElementById('ff-result').value;
  const order = cachedCustomOrders.find(o => o.id === orderId);

  if (result === 'Ajuste_Sin_Costo') {
    // Regla 4: Regresa a costura sin costo adicional
    const notes = document.getElementById('ff-notes').value || 'Ajuste de calce en prueba final';
    const payload = {
      stage: 'Costura (Costurero)',
      final_fitting_result: 'Ajuste_Sin_Costo',
      notes: notes
    };
    const res = await fetch(`/api/custom-orders/${orderId}/stage`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    closeModal('modal-final-fitting');
    alert(`Garantía de Calce Activada: La prenda ha reingresado a costura para ajuste correctivo SIN COSTO adicional para el cliente.`);
    loadCustomOrders();
  } else {
    // Calce perfecto: Regla 5 requiere pago de saldo antes de entrega
    if (order.remaining_balance > 0) {
      const payMethod = document.getElementById('ff-pay-method').value;
      const payRes = await fetch(`/api/custom-orders/${orderId}/pay-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, amount: order.remaining_balance, payment_method: payMethod })
      });
      const payData = await payRes.json();
      if (!payRes.ok) {
        alert(`Error al liquidar saldo: ${payData.detail}`);
        return;
      }
    }

    // Marcar como Entregado
    const stageRes = await fetch(`/api/custom-orders/${orderId}/stage`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'Entregado', final_fitting_result: 'Perfecto' })
    });

    closeModal('modal-final-fitting');
    alert('¡Prenda entregada con éxito al cliente en su funda protectora con saldo liquidado!');
    loadCustomOrders();
    loadDashboard();
  }
}

async function promptPayBalance(orderId, balance) {
  const amountStr = prompt(`Cobro de Saldo Pendiente:\nIngrese el monto a pagar por el cliente (Saldo actual: $${balance.toFixed(2)}):`, balance.toFixed(2));
  if (!amountStr) return;

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    alert('Monto inválido.');
    return;
  }

  const method = prompt('Método de pago (Efectivo, Tarjeta, Yappy):', 'Efectivo') || 'Efectivo';

  try {
    const res = await fetch(`/api/custom-orders/${orderId}/pay-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, amount: amount, payment_method: method })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(`Error: ${data.detail}`);
      return;
    }

    alert(`Abono registrado con éxito. Comprobante: ${data.invoice_id}`);
    viewInvoice(data.invoice_id);
    loadCustomOrders();
  } catch (err) {
    console.error('Error pagando saldo:', err);
  }
}

// ==========================================================
// VISTA: VENTA AL DETAL (EXHIBICIÓN)
// ==========================================================

async function loadReadyCatalog() {
  try {
    const res = await fetch('/api/catalog/ready');
    const items = await res.json();
    const grid = document.getElementById('ready-catalog-grid');

    if (items.length === 0) {
      grid.innerHTML = `<div class="p-8 text-center text-[#A78D78]">No hay prendas en exhibición.</div>`;
      return;
    }

    grid.innerHTML = items.map(item => {
      const imgUrl = item.image_url || '/static/img/suit_grey.jpg';
      return `
      <div class="catalog-card bg-white rounded-2xl border border-[#BEB5A9] shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-xl transition">
        <div>
          <!-- Contenedor Imagen de la Prenda -->
          <div class="catalog-img-container h-72 w-full relative bg-[#FAF7F2]">
            <img src="${imgUrl}"
                 alt="${item.name}"
                 class="w-full h-full object-cover object-top"
                 loading="lazy"
                 referrerpolicy="no-referrer"
                 onerror="this.onerror=null; this.src='/static/img/suit_grey.jpg';">

            <!-- Stock Badge -->
            <div class="absolute top-3 right-3">
              <span class="px-2.5 py-1 text-xs font-bold rounded-full shadow-md ${item.stock > 0 ? 'bg-emerald-600 text-white' : 'bg-[#6E473B] text-white'}">
                ${item.stock > 0 ? `${item.stock} en stock` : 'Agotado'}
              </span>
            </div>
          </div>

          <!-- Información de la Prenda -->
          <div class="p-5">
            <div class="flex items-center justify-between">
              <span class="px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#E1D4C2] text-[#291C0E] border border-[#BEB5A9]">${item.category}</span>
              <span class="text-xs text-[#A78D78] font-semibold">${item.style}</span>
            </div>
            <h4 class="font-serif-luxury font-bold text-[#291C0E] text-lg mt-2.5 leading-tight">${item.name}</h4>
            <p class="text-xs text-[#6E473B] mt-1.5 leading-relaxed">${item.description || ''}</p>
            
            <div class="mt-4 flex items-center space-x-2 text-xs">
              <span class="bg-[#FAF7F2] text-[#291C0E] px-2.5 py-1 rounded-lg border border-[#BEB5A9]">Talla: <strong>${item.size}</strong></span>
              <span class="bg-[#FAF7F2] text-[#291C0E] px-2.5 py-1 rounded-lg border border-[#BEB5A9]">Color: <strong>${item.color}</strong></span>
            </div>
          </div>
        </div>

        <div class="px-5 pb-5 pt-3.5 border-t border-[#BEB5A9]/50 flex items-center justify-between bg-[#FAF7F2]/40">
          <div>
            <span class="text-[11px] text-[#A78D78] font-medium block">Precio al detal</span>
            <span class="text-2xl font-black text-[#291C0E] font-mono">$${item.price.toFixed(2)}</span>
          </div>
          <button onclick="openReadySaleModal(${item.id}, '${item.name}', '${item.size}', '${item.color}', ${item.price})"
                  class="px-4 py-2 bg-[#6E473B] hover:bg-[#543429] text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition flex items-center space-x-1.5 ${item.stock <= 0 ? 'opacity-50 cursor-not-allowed' : ''}"
                  ${item.stock <= 0 ? 'disabled' : ''}>
            <i data-lucide="shopping-bag" class="w-4 h-4"></i>
            <span>Venta Directa</span>
          </button>
        </div>
      </div>
      `;
    }).join('');

    lucide.createIcons();
  } catch (err) {
    console.error('Error cargando catálogo exhibición:', err);
  }
}

function openReadySaleModal(id, name, size, color, price) {
  document.getElementById('rs-garment-id').value = id;
  document.getElementById('rs-garment-name').innerText = name;
  document.getElementById('rs-garment-specs').innerText = `Talla: ${size} | Color: ${color}`;
  document.getElementById('rs-garment-price').innerText = `Precio Total: $${price.toFixed(2)}`;
  document.getElementById('rs-customer-name').value = '';
  document.getElementById('rs-customer-phone').value = '';
  document.getElementById('rs-customer-id').value = '';
  document.getElementById('rs-quick-alt').checked = false;
  document.getElementById('rs-alt-notes-container').classList.add('hidden');
  document.getElementById('rs-alt-notes').value = '';

  openModal('modal-ready-sale');
}

function toggleQuickAltInput() {
  const chk = document.getElementById('rs-quick-alt').checked;
  const c = document.getElementById('rs-alt-notes-container');
  if (chk) c.classList.remove('hidden');
  else c.classList.add('hidden');
}

async function submitReadySale(e) {
  e.preventDefault();
  const payload = {
    garment_id: parseInt(document.getElementById('rs-garment-id').value),
    customer_name: document.getElementById('rs-customer-name').value,
    customer_phone: document.getElementById('rs-customer-phone').value,
    customer_id_card: document.getElementById('rs-customer-id').value,
    needs_quick_alteration: document.getElementById('rs-quick-alt').checked,
    alteration_notes: document.getElementById('rs-alt-notes').value,
    payment_method: document.getElementById('rs-payment-method').value
  };

  try {
    const res = await fetch('/api/catalog/ready/sale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      alert(`Error: ${data.detail}`);
      return;
    }

    closeModal('modal-ready-sale');
    alert(`¡Venta completada!\nComprobante N°: ${data.invoice_id}`);
    viewInvoice(data.invoice_id);
    loadReadyCatalog();
  } catch (err) {
    console.error('Error procesando venta:', err);
  }
}

// ==========================================================
// VISTA: ARREGLOS Y AJUSTES
// ==========================================================

async function loadAlterations() {
  try {
    const res = await fetch('/api/alterations');
    const items = await res.json();
    const tbody = document.getElementById('alterations-table-body');

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-xs text-[#A78D78]">No hay arreglos registrados en taller.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(alt => `
      <tr class="hover:bg-[#FAF7F2] transition border-b border-[#BEB5A9]/30">
        <td class="px-4 py-3">
          <span class="font-mono text-xs font-bold text-[#6E473B]">${alt.id}</span>
          <div class="font-semibold text-[#291C0E]">${alt.customer_name}</div>
          <div class="text-[11px] text-[#A78D78]">${alt.customer_phone}</div>
        </td>
        <td class="px-4 py-3 font-semibold text-[#291C0E]">${alt.garment_description}</td>
        <td class="px-4 py-3 text-xs text-[#6E473B] max-w-xs">${alt.alteration_details}</td>
        <td class="px-4 py-3 text-xs">
          <div class="font-bold text-[#291C0E] font-mono">$${alt.price.toFixed(2)}</div>
          <div class="${alt.paid ? 'text-emerald-700 font-bold' : 'text-[#6E473B] font-bold'} text-[11px]">
            ${alt.paid ? '✓ Pagado' : 'Pendiente cobro'}
          </div>
        </td>
        <td class="px-4 py-3 text-xs">
          <strong class="text-[#291C0E]">${alt.estimated_delivery}</strong>
          <div class="text-[10px] text-[#A78D78]">Recibido: ${alt.order_date}</div>
        </td>
        <td class="px-4 py-3">
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${alt.stage === 'Listo para Entrega' ? 'bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]' : 'bg-[#E1D4C2] text-[#291C0E] border border-[#BEB5A9]'}">
            ${alt.stage}
          </span>
          <div class="text-[10px] text-[#A78D78] mt-1">Calidad: ${alt.qc_status}</div>
        </td>
        <td class="px-4 py-3 text-right space-y-1">
          ${alt.stage === 'En Taller' ? `
            <button onclick="advanceAlteration('${alt.id}', 'Listo para Entrega')" class="px-2.5 py-1 bg-[#6E473B] hover:bg-[#543429] text-white rounded-lg text-xs font-bold shadow-sm">
              Aprobar Calidad & Listo
            </button>
          ` : ''}
          ${alt.stage === 'Listo para Entrega' ? `
            <button onclick="advanceAlteration('${alt.id}', 'Entregado')" class="px-2.5 py-1 bg-[#291C0E] hover:bg-[#422F1C] text-white rounded-lg text-xs font-bold shadow-sm">
              Entregar a Cliente
            </button>
          ` : ''}
        </td>
      </tr>
    `).join('');

    lucide.createIcons();
  } catch (err) {
    console.error('Error cargando arreglos:', err);
  }
}

async function submitAlteration(e) {
  e.preventDefault();
  const payload = {
    customer_name: document.getElementById('alt-customer').value,
    customer_phone: document.getElementById('alt-phone').value,
    garment_description: document.getElementById('alt-garment').value,
    alteration_details: document.getElementById('alt-details').value,
    price: parseFloat(document.getElementById('alt-price').value),
    estimated_delivery: document.getElementById('alt-date').value,
    paid: document.getElementById('alt-paid').checked
  };

  try {
    const res = await fetch('/api/alterations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      alert(`Error: ${data.detail}`);
      return;
    }

    closeModal('modal-alteration');
    alert('Orden de arreglo registrada en taller.');
    loadAlterations();
  } catch (err) {
    console.error('Error enviando arreglo:', err);
  }
}

async function advanceAlteration(id, targetStage) {
  const payload = {
    stage: targetStage,
    qc_status: 'Aprobado',
    paid: true
  };

  try {
    const res = await fetch(`/api/alterations/${id}/stage`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    alert(data.message);
    loadAlterations();
  } catch (err) {
    console.error('Error actualizando arreglo:', err);
  }
}

// ==========================================================
// VISTA: ALQUILER DE TRAJES Y VESTIDOS
// ==========================================================

async function loadRentals() {
  try {
    // 1. Cargar catálogo de alquiler
    const catRes = await fetch('/api/rentals/catalog');
    cachedRentalCatalog = await catRes.json();
    const catList = document.getElementById('rental-catalog-list');

    catList.innerHTML = cachedRentalCatalog.map(item => `
      <div class="p-3 bg-white border border-[#BEB5A9] rounded-xl flex items-center space-x-3 text-xs shadow-sm hover:border-[#6E473B] transition">
        <img src="${item.image_url || '/static/img/tuxedo_black.jpg'}" alt="${item.name}" class="w-12 h-14 object-cover object-top rounded-lg border border-[#BEB5A9]" referrerpolicy="no-referrer" onerror="this.src='/static/img/tuxedo_black.jpg';">
        <div class="flex-1 min-w-0">
          <div class="flex items-center space-x-1.5">
            <span class="font-bold text-[#291C0E] truncate">${item.name}</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${item.status === 'Disponible' ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#E1D4C2] text-[#291C0E]'}">
              ${item.status}
            </span>
          </div>
          <p class="text-[#A78D78] text-[11px] mt-0.5">Talla: ${item.size} | Color: ${item.color}</p>
          <p class="text-[#6E473B] font-bold mt-1">Tarifa: $${item.rental_price.toFixed(2)} | Depósito: $${item.security_deposit.toFixed(2)}</p>
        </div>
      </div>
    `).join('');

    // Rellenar select del modal de nuevo alquiler
    const rentSelect = document.getElementById('rent-item');
    rentSelect.innerHTML = cachedRentalCatalog.map(i => `
      <option value="${i.id}" ${i.status !== 'Disponible' ? 'disabled' : ''}>
        ${i.name} (${i.size}) — Tarifa: $${i.rental_price} + Depósito: $${i.security_deposit} ${i.status !== 'Disponible' ? '[OCUPADO]' : ''}
      </option>
    `).join('');

    updateRentalPriceNotice();

    // 2. Cargar contratos activos
    const rentRes = await fetch('/api/rentals');
    const rentals = await rentRes.json();
    const tbody = document.getElementById('rentals-table-body');

    if (rentals.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-xs text-[#A78D78]">No hay contratos de alquiler activos.</td></tr>`;
      return;
    }

    tbody.innerHTML = rentals.map(r => `
      <tr class="hover:bg-[#FAF7F2] transition border-b border-[#BEB5A9]/30">
        <td class="px-4 py-3">
          <span class="font-mono text-xs font-bold text-[#6E473B]">${r.id}</span>
          <div class="font-semibold text-[#291C0E]">${r.customer_name}</div>
          <div class="text-[11px] text-[#A78D78]">${r.customer_phone} | Céd: ${r.customer_id_card}</div>
        </td>
        <td class="px-4 py-3 font-medium text-[#291C0E]">${r.garment_name}</td>
        <td class="px-4 py-3 text-xs">
          <div>Evento: <strong>${r.event_date}</strong></div>
          <div class="text-[#6E473B] font-semibold">Devolución: ${r.return_due_date}</div>
        </td>
        <td class="px-4 py-3 text-xs">
          <div>Alquiler: $${r.rental_fee.toFixed(2)}</div>
          <div class="text-[#A78D78] font-medium">Depósito: $${r.security_deposit.toFixed(2)}</div>
          ${r.damage_fee > 0 ? `<div class="text-rose-600 font-bold">Descuento daño: -$${r.damage_fee.toFixed(2)}</div>` : ''}
        </td>
        <td class="px-4 py-3">
          <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${r.status === 'En Uso / Retirado' ? 'bg-[#E1D4C2] text-[#291C0E] border border-[#BEB5A9]' : 'bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]'}">
            ${r.status}
          </span>
          ${r.inspection_notes ? `<div class="text-[10px] text-[#A78D78] mt-1 max-w-[150px] truncate" title="${r.inspection_notes}">${r.inspection_notes}</div>` : ''}
        </td>
        <td class="px-4 py-3 text-right">
          ${r.status === 'En Uso / Retirado' || r.status === 'Reservado' ? `
            <button onclick="openRentalReturnModal('${r.id}', '${r.garment_name}', '${r.customer_name}', ${r.security_deposit})" class="px-2.5 py-1 bg-[#6E473B] hover:bg-[#543429] text-white rounded-lg text-xs font-semibold transition">
              Inspeccionar Devolución
            </button>
          ` : `
            <span class="text-xs text-[#A78D78]">Cerrado</span>
          `}
        </td>
      </tr>
    `).join('');

    lucide.createIcons();
  } catch (err) {
    console.error('Error cargando alquileres:', err);
  }
}

function updateRentalPriceNotice() {
  const itemId = parseInt(document.getElementById('rent-item').value);
  const item = cachedRentalCatalog.find(i => i.id === itemId);
  const box = document.getElementById('rent-price-box');
  if (item) {
    box.innerHTML = `
      <div class="flex justify-between font-bold text-[#291C0E]">
        <span>Tarifa de Alquiler:</span>
        <span>$${item.rental_price.toFixed(2)}</span>
      </div>
      <div class="flex justify-between font-bold text-[#6E473B]">
        <span>Depósito de Garantía (Reembolsable):</span>
        <span>$${item.security_deposit.toFixed(2)}</span>
      </div>
      <div class="border-t border-[#BEB5A9] pt-1 flex justify-between font-bold text-[#291C0E]">
        <span>Total a Cobrar al Retirar:</span>
        <span>$${(item.rental_price + item.security_deposit).toFixed(2)}</span>
      </div>
    `;
  }
}

async function submitRentalBooking(e) {
  e.preventDefault();
  const payload = {
    rental_item_id: parseInt(document.getElementById('rent-item').value),
    customer_name: document.getElementById('rent-name').value,
    customer_phone: document.getElementById('rent-phone').value,
    customer_id_card: document.getElementById('rent-idcard').value,
    pickup_date: document.getElementById('rent-pickup').value,
    event_date: document.getElementById('rent-event').value,
    return_due_date: document.getElementById('rent-return').value,
    fitting_adjustments: document.getElementById('rent-adjustments').value,
    payment_method: 'Tarjeta de Débito/Crédito'
  };

  try {
    const res = await fetch('/api/rentals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      alert(`Error: ${data.detail}`);
      return;
    }

    closeModal('modal-rental-booking');
    alert(`Contrato de alquiler creado con éxito.\nCódigo: ${data.rental_id}\nComprobante: ${data.invoice_id}`);
    viewInvoice(data.invoice_id);
    loadRentals();
  } catch (err) {
    console.error('Error reservando alquiler:', err);
  }
}

function openRentalReturnModal(id, garment, customer, deposit) {
  document.getElementById('ret-rental-id').value = id;
  document.getElementById('ret-deposit-total').value = deposit;
  document.getElementById('ret-info-prenda').innerText = `Prenda: ${garment}`;
  document.getElementById('ret-info-cliente').innerText = `Cliente: ${customer}`;
  document.getElementById('ret-info-deposito').innerText = `Depósito en Custodia: $${deposit.toFixed(2)}`;
  document.getElementById('ret-status').value = 'Optimo';
  document.getElementById('ret-damage-fee').value = '0.00';
  document.getElementById('ret-damage-notes').value = '';
  document.getElementById('ret-notes').value = 'Inspección de devolución conjunta completada sin objeciones.';

  toggleDamageInput();
  openModal('modal-rental-return');
}

function toggleDamageInput() {
  const status = document.getElementById('ret-status').value;
  const damageBox = document.getElementById('ret-damage-box');
  if (status === 'Con_Danos') {
    damageBox.classList.remove('hidden');
  } else {
    damageBox.classList.add('hidden');
  }
}

async function submitRentalReturn(e) {
  e.preventDefault();
  const rentalId = document.getElementById('ret-rental-id').value;
  const status = document.getElementById('ret-status').value;
  const damageFee = parseFloat(document.getElementById('ret-damage-fee').value) || 0;
  const notes = document.getElementById('ret-notes').value;
  const damageNotes = document.getElementById('ret-damage-notes').value;

  const payload = {
    inspection_status: status,
    damage_fee: damageFee,
    inspection_notes: status === 'Con_Danos' ? `${damageNotes} | ${notes}` : notes
  };

  try {
    const res = await fetch(`/api/rentals/${rentalId}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      alert(`Error: ${data.detail}`);
      return;
    }

    closeModal('modal-rental-return');
    alert(`Devolución completada:\nReembolso entregado al cliente: $${data.deposit_refunded.toFixed(2)}\nDescuento por reparación: $${data.damage_deducted.toFixed(2)}`);
    loadRentals();
  } catch (err) {
    console.error('Error procesando devolución:', err);
  }
}

// ==========================================================
// VISTA: INVENTARIO & REORDEN AL 30%
// ==========================================================

async function loadInventory() {
  try {
    const res = await fetch('/api/inventory');
    cachedInventory = await res.json();
    const tbody = document.getElementById('inventory-table-body');

    tbody.innerHTML = cachedInventory.map(item => {
      const isLow = item.is_reorder_needed;
      const pct = Math.min(item.percentage_stock, 100);
      const barColor = isLow ? 'bg-[#6E473B]' : 'bg-[#A78D78]';

      return `
        <tr class="hover:bg-[#FAF7F2] transition border-b border-[#BEB5A9]/30 ${isLow ? 'bg-[#E1D4C2]/20' : ''}">
          <td class="px-4 py-3">
            <span class="font-mono text-xs font-bold text-[#6E473B]">${item.code}</span>
            <div class="font-semibold text-[#291C0E]">${item.name}</div>
          </td>
          <td class="px-4 py-3 text-xs text-[#A78D78]">${item.category}</td>
          <td class="px-4 py-3 text-xs">
            <strong class="text-[#291C0E]">${item.current_stock}</strong> / ${item.optimal_stock} ${item.unit}
          </td>
          <td class="px-4 py-3 text-xs w-48">
            <div class="flex justify-between text-[11px] mb-1">
              <span class="${isLow ? 'text-[#6E473B] font-bold' : 'text-[#291C0E]'}">${item.percentage_stock}%</span>
              <span class="text-[#A78D78]">Punto 30%</span>
            </div>
            <div class="w-full bg-[#BEB5A9]/40 rounded-full h-2.5 overflow-hidden">
              <div class="${barColor} h-2.5 rounded-full" style="width: ${pct}%"></div>
            </div>
          </td>
          <td class="px-4 py-3 text-xs font-mono font-bold text-[#291C0E]">
            ${item.reorder_point} ${item.unit}
            ${isLow ? `<span class="block text-[10px] text-[#6E473B] font-bold uppercase tracking-wider">¡BAJO EL 30%!</span>` : ''}
          </td>
          <td class="px-4 py-3 text-xs text-[#6E473B]">${item.supplier}</td>
          <td class="px-4 py-3 text-right">
            <button onclick="triggerReorder('${item.code}')" class="px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition ${isLow ? 'bg-[#6E473B] hover:bg-[#543429] text-white animate-pulse' : 'bg-[#FAF7F2] hover:bg-[#E1D4C2] text-[#291C0E] border border-[#BEB5A9]'}">
              ${isLow ? 'Reordenar Urgente' : 'Comprar Insumo'}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Cargar órdenes de compra activas
    loadPurchaseOrders();
    lucide.createIcons();
  } catch (err) {
    console.error('Error cargando inventario:', err);
  }
}

async function triggerReorder(itemCode) {
  const item = cachedInventory.find(i => i.code === itemCode);
  if (!item) return;

  const defaultQty = (item.optimal_stock - item.current_stock).toFixed(1);
  const qtyStr = prompt(`Regla de Reorden al 30% activada para: ${item.name}\nProveedor: ${item.supplier}\n\nIngrese la cantidad a ordenar (${item.unit}):`, defaultQty);
  if (!qtyStr) return;

  const qty = parseFloat(qtyStr);
  if (isNaN(qty) || qty <= 0) {
    alert('Cantidad inválida.');
    return;
  }

  try {
    const res = await fetch('/api/inventory/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_code: itemCode, quantity: qty })
    });

    const data = await res.json();
    alert(data.message);
    loadInventory();
    loadDashboard();
  } catch (err) {
    console.error('Error emitiendo orden de reorden:', err);
  }
}

async function loadPurchaseOrders() {
  try {
    const res = await fetch('/api/inventory/purchase-orders');
    const orders = await res.json();
    const tbody = document.getElementById('purchase-orders-table-body');

    if (orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-4 text-center text-xs text-[#A78D78]">No hay órdenes de compra registradas.</td></tr>`;
      return;
    }

    tbody.innerHTML = orders.map(po => `
      <tr class="hover:bg-[#FAF7F2] transition border-b border-[#BEB5A9]/30 text-xs">
        <td class="px-4 py-2 font-mono font-bold text-[#291C0E]">${po.id}</td>
        <td class="px-4 py-2 font-medium text-[#291C0E]">${po.item_name}</td>
        <td class="px-4 py-2 text-[#A78D78]">${po.supplier}</td>
        <td class="px-4 py-2 font-mono text-[#291C0E]">${po.quantity} ${po.unit}</td>
        <td class="px-4 py-2 font-mono font-bold text-[#291C0E]">$${po.estimated_cost.toFixed(2)}</td>
        <td class="px-4 py-2 text-[#A78D78]">${po.date_ordered}</td>
        <td class="px-4 py-2">
          <span class="px-2 py-0.5 rounded text-[11px] font-semibold ${po.status === 'Recibido' ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#E1D4C2] text-[#291C0E]'}">
            ${po.status}
          </span>
        </td>
        <td class="px-4 py-2 text-right">
          ${po.status !== 'Recibido' ? `
            <button onclick="receivePO('${po.id}')" class="px-2.5 py-1 bg-[#6E473B] hover:bg-[#543429] text-white rounded font-bold text-xs shadow-sm">
              Recibir Insumos
            </button>
          ` : `
            <span class="text-[#A78D78]">✓ Ingresado</span>
          `}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error cargando órdenes de compra:', err);
  }
}

async function receivePO(poId) {
  if (!confirm(`¿Confirmar recepción de mercancía para la orden ${poId}? Esto sumará el material al stock en tiempo real.`)) return;

  try {
    const res = await fetch(`/api/inventory/purchase-orders/${poId}/receive`, { method: 'POST' });
    const data = await res.json();
    alert(data.message);
    loadInventory();
    loadDashboard();
  } catch (err) {
    console.error('Error recibiendo orden:', err);
  }
}

// ==========================================================
// VISTA: FACTURACIÓN & RETIROS
// ==========================================================

async function loadInvoices() {
  try {
    // 1. Cargar monitor de prendas terminadas en espera de retiro
    const customRes = await fetch('/api/custom-orders');
    const custom = await customRes.json();
    const readyOrders = custom.filter(o => o.status === 'Listo para Retiro');
    const delayedTable = document.getElementById('delayed-pickups-table-body');

    if (readyOrders.length === 0) {
      delayedTable.innerHTML = `<tr><td colspan="6" class="px-4 py-4 text-center text-xs text-[#A78D78]">No hay prendas acumuladas en espera de retiro en este momento.</td></tr>`;
    } else {
      delayedTable.innerHTML = readyOrders.map(o => {
        let waitBadge = `<span class="px-2 py-0.5 rounded text-xs bg-[#E1D4C2] text-[#291C0E] border border-[#BEB5A9]">${o.days_waiting || 0} días</span>`;
        if (o.days_waiting >= 5) {
          waitBadge = `<span class="px-2 py-0.5 rounded text-xs font-bold bg-[#6E473B] text-white animate-pulse">${o.days_waiting} días (Atraso)</span>`;
        }
        return `
          <tr class="hover:bg-[#FAF7F2] transition border-b border-[#BEB5A9]/30 text-xs">
            <td class="px-4 py-2.5 font-bold text-[#291C0E]">${o.id} - ${o.garment_type}</td>
            <td class="px-4 py-2.5 font-medium text-[#291C0E]">${o.customer_name} (${o.customer_phone})</td>
            <td class="px-4 py-2.5 text-[#A78D78]">${o.completed_date || 'Reciente'}</td>
            <td class="px-4 py-2.5">${waitBadge}</td>
            <td class="px-4 py-2.5 font-mono font-bold ${o.remaining_balance > 0 ? 'text-[#6E473B]' : 'text-emerald-700'}">
              $${o.remaining_balance.toFixed(2)}
            </td>
            <td class="px-4 py-2.5 text-right space-x-1">
              <button onclick="recordReminderCall('${o.id}')" class="px-2.5 py-1 bg-[#A78D78] hover:bg-[#6E473B] text-white rounded-lg font-bold text-[11px] shadow-sm">
                Registrar Llamada
              </button>
              <button onclick="openFinalFittingModal('${o.id}')" class="px-2.5 py-1 bg-[#6E473B] hover:bg-[#543429] text-white rounded-lg font-bold text-[11px] shadow-sm">
                Entregar & Cobrar
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    // 2. Cargar historial de facturas
    const invRes = await fetch('/api/invoices');
    cachedInvoices = await invRes.json();
    renderInvoicesTable(cachedInvoices);
  } catch (err) {
    console.error('Error cargando facturación:', err);
  }
}

function renderInvoicesTable(invoices) {
  const tbody = document.getElementById('invoices-table-body');
  if (invoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-xs text-[#A78D78]">No se encontraron facturas ni recibos.</td></tr>`;
    return;
  }

  tbody.innerHTML = invoices.map(inv => `
    <tr class="hover:bg-[#FAF7F2] transition border-b border-[#BEB5A9]/30 text-xs">
      <td class="px-4 py-3 font-mono font-bold text-[#6E473B]">${inv.id}</td>
      <td class="px-4 py-3 text-[#A78D78]">${inv.date}</td>
      <td class="px-4 py-3">
        <span class="font-bold text-[#291C0E]">${inv.invoice_type}</span>
        <div class="text-[11px] text-[#A78D78] truncate max-w-xs" title="${inv.concept}">${inv.concept}</div>
      </td>
      <td class="px-4 py-3 font-medium text-[#291C0E]">${inv.customer_name}</td>
      <td class="px-4 py-3 text-[#6E473B]">${inv.payment_method}</td>
      <td class="px-4 py-3 font-mono font-bold text-emerald-700">$${inv.amount_paid.toFixed(2)}</td>
      <td class="px-4 py-3 font-mono ${inv.balance_due > 0 ? 'text-[#6E473B] font-bold' : 'text-[#A78D78]'}">
        $${inv.balance_due.toFixed(2)}
      </td>
      <td class="px-4 py-3 text-right">
        <button onclick="viewInvoice('${inv.id}')" class="px-3 py-1 bg-[#FAF7F2] hover:bg-[#E1D4C2] text-[#291C0E] border border-[#BEB5A9] rounded-lg text-xs font-bold transition">
          Ver Recibo
        </button>
      </td>
    </tr>
  `).join('');
}

function filterInvoices() {
  const query = document.getElementById('invoice-search-input').value.toLowerCase();
  const filtered = cachedInvoices.filter(i =>
    i.id.toLowerCase().includes(query) ||
    i.customer_name.toLowerCase().includes(query) ||
    i.concept.toLowerCase().includes(query) ||
    i.order_ref.toLowerCase().includes(query)
  );
  renderInvoicesTable(filtered);
}

async function recordReminderCall(orderId) {
  try {
    const res = await fetch(`/api/custom-orders/${orderId}/record-reminder`, { method: 'POST' });
    const data = await res.json();
    alert('Llamada recordatoria registrada exitosamente en el historial del pedido.');
    loadInvoices();
  } catch (err) {
    console.error('Error registrando llamada:', err);
  }
}

async function viewInvoice(invoiceId) {
  try {
    const res = await fetch(`/api/invoices/${invoiceId}`);
    const inv = await res.json();

    document.getElementById('rec-id').innerText = inv.id;
    document.getElementById('rec-date').innerText = inv.date;
    document.getElementById('rec-ref').innerText = inv.order_ref;
    document.getElementById('rec-customer').innerText = inv.customer_name;
    document.getElementById('rec-cid').innerText = inv.customer_id_card || 'No registrada';
    document.getElementById('rec-phone').innerText = inv.customer_phone || 'No registrado';
    document.getElementById('rec-concept').innerText = inv.concept;
    document.getElementById('rec-notes').innerText = inv.notes || '';
    document.getElementById('rec-subtotal').innerText = `$${inv.subtotal.toFixed(2)}`;
    document.getElementById('rec-tax').innerText = `$${inv.tax.toFixed(2)}`;
    document.getElementById('rec-total').innerText = `$${inv.total.toFixed(2)}`;
    document.getElementById('rec-paid').innerText = `$${inv.amount_paid.toFixed(2)}`;
    document.getElementById('rec-balance').innerText = `$${inv.balance_due.toFixed(2)}`;
    document.getElementById('rec-method').innerText = inv.payment_method;

    openModal('modal-invoice-view');
  } catch (err) {
    console.error('Error cargando recibo:', err);
  }
}
