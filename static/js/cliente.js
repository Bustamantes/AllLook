// ==========================================================
// CLIENTE.JS — PORTAL PÚBLICO DE CLIENTES (SASTRERÍA ALL LOOK)
// ==========================================================

let readyCatalogItems = [];
let rentalCatalogItems = [];
let activeCategory = 'all';

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();
  loadClientReadyCatalog();
  loadClientRentalCatalog();

  // Escuchar enter en campo de rastreo
  const trackInput = document.getElementById('public-track-input');
  if (trackInput) {
    trackInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchOrderTracking();
    });
  }
});

// ==========================================================
// 1. CATÁLOGO DE VENTA Y EXHIBICIÓN
// ==========================================================

async function loadClientReadyCatalog() {
  try {
    const res = await fetch('/api/catalog/ready');
    readyCatalogItems = await res.json();
    renderClientReadyCatalog();
  } catch (err) {
    console.error('Error cargando catálogo cliente:', err);
  }
}

function filterCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll('.cat-pill').forEach(btn => {
    btn.classList.remove('bg-[#6E473B]', 'text-white', 'border-[#6E473B]');
    btn.classList.add('bg-[#FAF7F2]', 'text-[#291C0E]', 'border-[#BEB5A9]');
  });

  const activeBtn = document.getElementById(`cat-btn-${cat}`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-[#FAF7F2]', 'text-[#291C0E]', 'border-[#BEB5A9]');
    activeBtn.classList.add('bg-[#6E473B]', 'text-white', 'border-[#6E473B]');
  }

  renderClientReadyCatalog();
}

function renderClientReadyCatalog() {
  const grid = document.getElementById('client-catalog-grid');
  if (!grid) return;

  let items = readyCatalogItems;
  if (activeCategory !== 'all') {
    items = items.filter(i => i.category.toLowerCase().includes(activeCategory.toLowerCase()));
  }

  if (items.length === 0) {
    grid.innerHTML = `<div class="col-span-full p-12 text-center text-[#A78D78]">No hay prendas disponibles en esta categoría actualmente.</div>`;
    return;
  }

  grid.innerHTML = items.map(item => {
    const imgUrl = item.image_url || '/static/img/suit_grey.jpg';
    return `
      <div class="catalog-card bg-white rounded-2xl border border-[#BEB5A9]/50 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-xl transition group">
        <div>
          <!-- Contenedor Imagen de la Prenda -->
          <div class="catalog-img-container h-80 w-full relative bg-[#FAF7F2]">
            <img src="${imgUrl}"
                 alt="${item.name}"
                 class="w-full h-full object-cover object-top group-hover:scale-105 transition duration-500"
                 loading="lazy"
                 referrerpolicy="no-referrer"
                 onerror="this.onerror=null; this.src='/static/img/suit_grey.jpg';">

            <!-- Stock Pill -->
            <div class="absolute top-3 right-3">
              <span class="px-2.5 py-1 text-xs font-bold rounded-full shadow-md ${item.stock > 0 ? 'bg-emerald-600 text-white' : 'bg-[#6E473B] text-white'}">
                ${item.stock > 0 ? `${item.stock} disponibles` : 'Agotado'}
              </span>
            </div>
          </div>

          <!-- Información -->
          <div class="p-5">
            <div class="flex items-center justify-between">
              <span class="px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#E1D4C2] text-[#291C0E] border border-[#BEB5A9]">${item.category}</span>
              <span class="text-xs text-[#A78D78] font-semibold">${item.style}</span>
            </div>
            <h4 class="font-serif-luxury font-bold text-[#291C0E] text-lg mt-2.5 leading-tight">${item.name}</h4>
            <p class="text-xs text-[#6E473B] mt-1.5 leading-relaxed line-clamp-2">${item.description || ''}</p>
            
            <div class="mt-4 flex items-center space-x-2 text-xs">
              <span class="bg-[#FAF7F2] text-[#291C0E] px-2.5 py-1 rounded-lg border border-[#BEB5A9]">Talla: <strong>${item.size}</strong></span>
              <span class="bg-[#FAF7F2] text-[#291C0E] px-2.5 py-1 rounded-lg border border-[#BEB5A9]">Color: <strong>${item.color}</strong></span>
            </div>
          </div>
        </div>

        <!-- Footer Card -->
        <div class="px-5 pb-5 pt-3.5 border-t border-[#BEB5A9]/30 flex items-center justify-between bg-[#FAF7F2]/40">
          <div>
            <span class="text-[11px] text-[#A78D78] font-medium block">Precio de venta</span>
            <span class="text-2xl font-black text-[#291C0E] font-mono">$${item.price.toFixed(2)}</span>
          </div>
          <button onclick="openClientBuyModal(${item.id}, '${item.name}', '${item.size}', '${item.color}', ${item.price})"
                  class="px-4 py-2.5 bg-[#6E473B] hover:bg-[#291C0E] text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition flex items-center space-x-1.5 ${item.stock <= 0 ? 'opacity-50 cursor-not-allowed' : ''}"
                  ${item.stock <= 0 ? 'disabled' : ''}>
            <i data-lucide="shopping-bag" class="w-4 h-4"></i>
            <span>Comprar con Ajuste</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function openClientBuyModal(id, name, size, color, price) {
  document.getElementById('cb-garment-id').value = id;
  document.getElementById('cb-garment-name').innerText = name;
  document.getElementById('cb-garment-specs').innerText = `Talla: ${size} | Color: ${color}`;
  document.getElementById('cb-garment-price').innerText = `$${price.toFixed(2)}`;
  document.getElementById('cb-customer-name').value = '';
  document.getElementById('cb-customer-phone').value = '';
  document.getElementById('cb-customer-id').value = '';
  document.getElementById('cb-quick-alt').checked = false;
  document.getElementById('cb-alt-notes-box').classList.add('hidden');
  document.getElementById('cb-alt-notes').value = '';

  openClientModal('modal-client-buy');
}

function toggleClientQuickAlt() {
  const chk = document.getElementById('cb-quick-alt').checked;
  const c = document.getElementById('cb-alt-notes-box');
  if (chk) c.classList.remove('hidden');
  else c.classList.add('hidden');
}

async function submitClientBuy(e) {
  e.preventDefault();
  const payload = {
    garment_id: parseInt(document.getElementById('cb-garment-id').value),
    customer_name: document.getElementById('cb-customer-name').value,
    customer_phone: document.getElementById('cb-customer-phone').value,
    customer_id_card: document.getElementById('cb-customer-id').value,
    needs_quick_alteration: document.getElementById('cb-quick-alt').checked,
    alteration_notes: document.getElementById('cb-alt-notes').value,
    payment_method: document.getElementById('cb-payment-method').value
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

    closeClientModal('modal-client-buy');
    alert(`¡Gracias por su compra en All Look!\nComprobante N°: ${data.invoice_id}\n\nSi solicitó ajuste express, nuestro sastre lo preparará para entrega inmediata.`);
    loadClientReadyCatalog();
    viewInvoiceVoucher(data.invoice_id);
  } catch (err) {
    console.error('Error enviando compra:', err);
  }
}

// ==========================================================
// 2. CATÁLOGO DE ALQUILER PARA EVENTOS
// ==========================================================

async function loadClientRentalCatalog() {
  try {
    const res = await fetch('/api/rentals/catalog');
    rentalCatalogItems = await res.json();
    renderClientRentalCatalog();
  } catch (err) {
    console.error('Error cargando alquileres cliente:', err);
  }
}

function renderClientRentalCatalog() {
  const container = document.getElementById('client-rental-grid');
  if (!container) return;

  container.innerHTML = rentalCatalogItems.map(item => {
    const imgUrl = item.image_url || '/static/img/tuxedo_black.jpg';
    return `
      <div class="bg-white rounded-2xl border border-[#BEB5A9]/50 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-lg transition">
        <div class="relative h-64 bg-[#FAF7F2] overflow-hidden">
          <img src="${imgUrl}" alt="${item.name}" class="w-full h-full object-cover object-top hover:scale-105 transition duration-500" referrerpolicy="no-referrer" onerror="this.src='/static/img/tuxedo_black.jpg';">
          <span class="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold shadow-md ${item.status === 'Disponible' ? 'bg-emerald-600 text-white' : 'bg-[#6E473B] text-white'}">
            ${item.status}
          </span>
        </div>
        <div class="p-5 flex-1 flex flex-col justify-between">
          <div>
            <h4 class="font-serif-luxury font-bold text-lg text-[#291C0E]">${item.name}</h4>
            <p class="text-xs text-[#A78D78] mt-1">Talla: <strong>${item.size}</strong> | Color: <strong>${item.color}</strong></p>
            <div class="mt-3 p-3 bg-[#FAF7F2] rounded-xl border border-[#BEB5A9]/30 text-xs space-y-1">
              <div class="flex justify-between text-[#291C0E]">
                <span>Tarifa de Alquiler:</span>
                <strong class="font-mono text-sm">$${item.rental_price.toFixed(2)}</strong>
              </div>
              <div class="flex justify-between text-[#6E473B]">
                <span>Depósito Reembolsable:</span>
                <strong class="font-mono">$${item.security_deposit.toFixed(2)}</strong>
              </div>
            </div>
          </div>
          <button onclick="openClientRentalModal(${item.id}, '${item.name}', ${item.rental_price}, ${item.security_deposit})"
                  class="mt-4 w-full py-2.5 bg-[#6E473B] hover:bg-[#291C0E] text-white rounded-xl text-xs font-bold transition shadow-sm ${item.status !== 'Disponible' ? 'opacity-50 cursor-not-allowed' : ''}"
                  ${item.status !== 'Disponible' ? 'disabled' : ''}>
            ${item.status === 'Disponible' ? 'Reservar para mi Ocasión' : 'Prenda en Alquiler Actualmente'}
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function openClientRentalModal(id, name, fee, deposit) {
  document.getElementById('cr-item-id').value = id;
  document.getElementById('cr-garment-name').innerText = name;
  document.getElementById('cr-fee').innerText = `$${fee.toFixed(2)}`;
  document.getElementById('cr-deposit').innerText = `$${deposit.toFixed(2)}`;
  document.getElementById('cr-total').innerText = `$${(fee + deposit).toFixed(2)}`;

  // Default dates
  const today = new Date();
  const event = new Date(today);
  event.setDate(event.getDate() + 7);
  const ret = new Date(event);
  ret.setDate(ret.getDate() + 2);

  document.getElementById('cr-pickup').value = today.toISOString().split('T')[0];
  document.getElementById('cr-event').value = event.toISOString().split('T')[0];
  document.getElementById('cr-return').value = ret.toISOString().split('T')[0];

  openClientModal('modal-client-rental');
}

async function submitClientRental(e) {
  e.preventDefault();
  const payload = {
    rental_item_id: parseInt(document.getElementById('cr-item-id').value),
    customer_name: document.getElementById('cr-name').value,
    customer_phone: document.getElementById('cr-phone').value,
    customer_id_card: document.getElementById('cr-id').value,
    pickup_date: document.getElementById('cr-pickup').value,
    event_date: document.getElementById('cr-event').value,
    return_due_date: document.getElementById('cr-return').value,
    fitting_adjustments: document.getElementById('cr-notes').value || 'Ajuste de mangas y basta a medida',
    payment_method: document.getElementById('cr-payment-method').value
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

    closeClientModal('modal-client-rental');
    alert(`¡Reserva de Alquiler Confirmada!\nContrato N°: ${data.rental_id}\nComprobante: ${data.invoice_id}\n\nNuestro personal le espera para la prueba de entalle antes del evento.`);
    loadClientRentalCatalog();
    viewInvoiceVoucher(data.invoice_id);
  } catch (err) {
    console.error('Error enviando reserva:', err);
  }
}

// ==========================================================
// 3. CONFECCIÓN A LA MEDIDA (BESPOKE)
// ==========================================================

function updateBespokeInterim() {
  const delivery = document.getElementById('bespoke-delivery').value;
  if (!delivery) return;

  const delDate = new Date(delivery + 'T00:00:00');
  const interimDate = new Date(delDate);
  interimDate.setDate(interimDate.getDate() - 15);

  const formatted = interimDate.toISOString().split('T')[0];
  document.getElementById('bespoke-interim-badge').innerText = formatted;
}

function updateBespokeAdvance() {
  const price = parseFloat(document.getElementById('bespoke-total').value) || 0;
  const min50 = (price * 0.50).toFixed(2);
  document.getElementById('bespoke-advance-min-text').innerText = `Mínimo 50%: $${min50}`;
  document.getElementById('bespoke-advance').min = min50;
  document.getElementById('bespoke-advance').value = min50;
}

async function submitClientBespoke(e) {
  e.preventDefault();
  const total = parseFloat(document.getElementById('bespoke-total').value) || 0;
  const advance = parseFloat(document.getElementById('bespoke-advance').value) || 0;
  const minAdvance = total * 0.50;

  if (advance < minAdvance) {
    alert(`Regla del Taller: Se requiere un anticipo del 50% ($${minAdvance.toFixed(2)}) para apartar los insumos y comenzar el patronaje.`);
    return;
  }

  if (!document.getElementById('bespoke-clause').checked) {
    alert('Debe aceptar la cláusula de variación de peso para formalizar su cita a la medida.');
    return;
  }

  const measurements = {
    cuello: parseFloat(document.getElementById('bm-cuello').value) || 0,
    pecho: parseFloat(document.getElementById('bm-pecho').value) || 0,
    cintura: parseFloat(document.getElementById('bm-cintura').value) || 0,
    cadera: parseFloat(document.getElementById('bm-cadera').value) || 0,
    hombro: parseFloat(document.getElementById('bm-hombro').value) || 0,
    manga: parseFloat(document.getElementById('bm-manga').value) || 0,
    pantalon: parseFloat(document.getElementById('bm-pantalon').value) || 0,
    tiro: parseFloat(document.getElementById('bm-tiro').value) || 0
  };

  const payload = {
    customer_name: document.getElementById('bespoke-name').value,
    customer_phone: document.getElementById('bespoke-phone').value,
    customer_id_card: document.getElementById('bespoke-id').value,
    garment_type: document.getElementById('bespoke-garment').value,
    occasion: document.getElementById('bespoke-occasion').value,
    fabric_selected: document.getElementById('bespoke-fabric').value,
    measurements: measurements,
    total_price: total,
    advance_payment: advance,
    delivery_date: document.getElementById('bespoke-delivery').value,
    weight_clause_acknowledged: true,
    payment_method: document.getElementById('bespoke-payment-method').value
  };

  try {
    const res = await fetch('/api/custom-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      alert(`Error: ${data.detail || 'No se pudo crear la orden'}`);
      return;
    }

    alert(`¡Orden de Confección a la Medida Registrada!\nCódigo de Pedido: ${data.order_id}\n\n● Cita de Verificación Intermedia: ${data.interim_fitting_date}\n(Le notificaremos 15 días antes para revalidar medidas antes del armado final).\n● Comprobante emitido: ${data.invoice_id}`);
    viewInvoiceVoucher(data.invoice_id);

    // Limpiar formulario
    document.getElementById('client-bespoke-form').reset();
    const trackInp = document.getElementById('public-track-input');
    if (trackInp) {
      trackInp.value = data.order_id;
      searchOrderTracking();
    }
  } catch (err) {
    console.error('Error registrando confección:', err);
  }
}

// ==========================================================
// 4. SOLICITUD DE ARREGLO EXPRESS
// ==========================================================

async function submitClientAlteration(e) {
  e.preventDefault();
  const payload = {
    customer_name: document.getElementById('calt-name').value,
    customer_phone: document.getElementById('calt-phone').value,
    garment_description: document.getElementById('calt-garment').value,
    alteration_details: document.getElementById('calt-details').value,
    price: parseFloat(document.getElementById('calt-price').value),
    estimated_delivery: document.getElementById('calt-date').value,
    paid: document.getElementById('calt-paid').checked,
    payment_method: 'Efectivo / Mostrador'
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

    alert(`¡Ticket de Arreglo Emitido!\nCódigo: ${data.alteration_id}\nFecha de Entrega Estimada: ${payload.estimated_delivery}\n\nPresente este código en mostrador al entregar su prenda.`);
    document.getElementById('client-alteration-form').reset();
    const trackInp = document.getElementById('public-track-input');
    if (trackInp) {
      trackInp.value = data.alteration_id;
      searchOrderTracking();
    }
  } catch (err) {
    console.error('Error creando arreglo:', err);
  }
}

// ==========================================================
// 5. RASTREO EN VIVO PARA CLIENTES ("RASTREAR MI PRENDA")
// ==========================================================

async function searchOrderTracking() {
  const trackInp = document.getElementById('public-track-input');
  const container = document.getElementById('track-results-container');
  if (!trackInp || !container) return;
  const query = trackInp.value.trim();
  if (!query) {
    alert('Por favor ingrese su código de orden, cédula o teléfono.');
    return;
  }

  container.innerHTML = `<div class="p-8 text-center text-[#6E473B] animate-pulse">Buscando estado en el taller central...</div>`;

  try {
    const res = await fetch(`/api/public/track?q=${encodeURIComponent(query)}`);
    const results = await res.json();

    if (results.length === 0) {
      container.innerHTML = `
        <div class="p-8 bg-[#FAF7F2] border border-[#BEB5A9] rounded-2xl text-center space-y-2">
          <i data-lucide="search-x" class="w-8 h-8 mx-auto text-[#A78D78]"></i>
          <h4 class="font-bold text-[#291C0E] text-base">No encontramos pedidos asociados a "${query}"</h4>
          <p class="text-xs text-[#6E473B]">Verifique el código de orden (ejemplo: CONF-2026-001) o consulte con el mostrador al +507 6234-8891.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    container.innerHTML = results.map(item => {
      let stageText = item.stage || item.status || 'En Proceso';
      let isReady = stageText.includes('Listo') || stageText === 'Terminado / Listo para Entrega';
      let isDelivered = stageText === 'Entregado' || stageText === 'Devuelto / Concluido';

      // Stepper de progreso visual
      let steps = [
        { label: 'Recepción', active: true, done: true },
        { label: 'Taller / Patronaje', active: !isReady && !isDelivered, done: isReady || isDelivered },
        { label: 'Control Calidad', active: item.qc_status === 'Aprobado' || item.qc_status === 'Pendiente', done: isReady || isDelivered },
        { label: 'Listo en Mostrador', active: isReady, done: isDelivered },
        { label: 'Entregado', active: isDelivered, done: isDelivered }
      ];

      return `
        <div class="bg-white rounded-2xl border border-[#BEB5A9] p-6 shadow-md space-y-5">
          <!-- Encabezado de la Tarjeta -->
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#BEB5A9]/30 pb-4">
            <div>
              <span class="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E1D4C2] text-[#291C0E] border border-[#BEB5A9]">
                <i data-lucide="${item.icon || 'scissors'}" class="w-3.5 h-3.5 text-[#6E473B]"></i>
                <span>${item.service_type}</span>
              </span>
              <h3 class="font-serif-luxury text-xl font-bold text-[#291C0E] mt-2">${item.garment_type || item.garment_name || item.garment_description}</h3>
              <p class="text-xs text-[#A78D78]">Cliente: <strong class="text-[#291C0E]">${item.customer_name}</strong> | Cód: <span class="font-mono text-[#6E473B] font-bold">${item.id}</span></p>
            </div>

            <div class="text-right">
              <span class="px-3 py-1 rounded-full text-xs font-bold ${isReady ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-[#E1D4C2] text-[#291C0E] border border-[#BEB5A9]'}">
                ${stageText}
              </span>
              <p class="text-[11px] text-[#A78D78] mt-1">Calidad: <strong>${item.qc_status || 'En Revisión'}</strong></p>
            </div>
          </div>

          <!-- Stepper Visual -->
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
            ${steps.map((st, idx) => `
              <div class="p-2 rounded-xl border ${st.done ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#166534]' : st.active ? 'bg-[#E1D4C2] border-[#6E473B] text-[#291C0E] font-bold shadow-xs' : 'bg-[#FAF7F2] border-[#BEB5A9]/40 text-[#A78D78]'}">
                <div class="text-[10px] uppercase font-bold opacity-75">Paso ${idx + 1}</div>
                <div class="truncate text-[11px] mt-0.5">${st.label}</div>
              </div>
            `).join('')}
          </div>

          <!-- Detalles Clave del Pedido -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-[#FAF7F2] rounded-xl border border-[#BEB5A9]/40 text-xs">
            <div>
              <span class="text-[#A78D78] block">Fecha de Entrega Prometida:</span>
              <strong class="text-[#291C0E] text-sm">${item.delivery_date || item.estimated_delivery || item.return_due_date || 'A convenir'}</strong>
            </div>
            ${item.interim_fitting_date ? `
              <div>
                <span class="text-[#6E473B] font-bold block">Cita de Verificación (15 días):</span>
                <strong class="text-[#6E473B] text-sm">${item.interim_fitting_date}</strong>
                <span class="text-[10px] text-[#A78D78] block">(Prueba intermedia de calce)</span>
              </div>
            ` : `
              <div>
                <span class="text-[#A78D78] block">Tela Seleccionada:</span>
                <strong class="text-[#291C0E]">${item.fabric_selected || 'Proporcionada por cliente'}</strong>
              </div>
            `}
            <div>
              <span class="text-[#A78D78] block">Estado de Cuenta:</span>
              ${item.remaining_balance !== undefined ? `
                <div class="${item.remaining_balance > 0 ? 'text-[#6E473B] font-bold' : 'text-emerald-700 font-bold'}">
                  ${item.remaining_balance > 0 ? `Saldo Pendiente: $${item.remaining_balance.toFixed(2)}` : '✓ Pagado en su Totalidad'}
                </div>
                <div class="text-[10px] text-[#A78D78]">Total Prenda: $${(item.total_price || 0).toFixed(2)}</div>
              ` : `
                <span class="font-bold text-[#291C0E]">$${(item.price || item.rental_fee || 0).toFixed(2)}</span>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Error buscando rastreo:', err);
    container.innerHTML = `<div class="p-6 text-center text-rose-600 text-xs font-bold">Error de conexión al consultar el rastreador.</div>`;
  }
}

// ==========================================================
// 6. MODALES Y UTILIDADES
// ==========================================================

function openClientModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }
}

function closeClientModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

async function viewInvoiceVoucher(invoiceId) {
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

    openClientModal('modal-invoice-view');
  } catch (err) {
    console.error('Error cargando recibo:', err);
  }
}
