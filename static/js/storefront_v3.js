// ==========================================================
// STOREFRONT_V3.JS — TIENDA MULTI-PÁGINA (SASTRERÍA ALL LOOK)
// ==========================================================

let publicCatalogItems = [];
let activeCategory = 'all';

function initStorefront() {
  if (window.lucide) lucide.createIcons();

  if (document.getElementById('client-catalog-grid')) {
    loadPublicCatalog();
  }
  if (document.getElementById('piece-detail-content')) {
    loadPieceDetail();
  }
  if (document.getElementById('sol-panel-medida')) {
    initSolicitarPage();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStorefront);
} else {
  initStorefront();
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ==========================================================
// 1. GALERÍA PRINCIPAL (index.html)
// ==========================================================

async function loadPublicCatalog() {
  const grid = document.getElementById('client-catalog-grid');
  try {
    const res = await fetch('/api/public/catalog');
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) {
      throw new Error(data.detail || 'No se pudo cargar la colección de piezas.');
    }
    publicCatalogItems = data;
    renderPublicCatalog();
  } catch (err) {
    console.error('Error cargando catálogo:', err);
    if (grid) {
      grid.innerHTML = `
        <div class="col-span-full p-10 rounded-2xl bg-white border border-[#BEB5A9] text-center space-y-3">
          <p class="text-sm font-bold text-[#291C0E]">No pudimos cargar las piezas en este momento.</p>
          <p class="text-xs text-[#6E473B]">${escapeHtml(err.message || 'Error de conexión')}</p>
          <button onclick="loadPublicCatalog()" class="px-5 py-2.5 rounded-xl bg-[#6E473B] hover:bg-[#291C0E] text-white text-xs font-bold transition">
            Reintentar
          </button>
        </div>
      `;
    }
  }
}

function filterCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll('.cat-pill').forEach(btn => {
    btn.classList.remove('bg-[#6E473B]', 'text-white', 'border-[#6E473B]');
    btn.classList.add('bg-[#FAF7F2]', 'text-[#291C0E]', 'border-[#BEB5A9]', 'hover:bg-[#E1D4C2]');
    btn.style.backgroundColor = '';
    btn.style.color = '';
  });
  const activeBtn = document.getElementById(`cat-btn-${cat}`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-[#FAF7F2]', 'text-[#291C0E]', 'border-[#BEB5A9]', 'hover:bg-[#E1D4C2]');
    activeBtn.classList.add('bg-[#6E473B]', 'text-white', 'border-[#6E473B]');
    activeBtn.style.backgroundColor = '#6E473B';
    activeBtn.style.color = '#FFFFFF';
  }
  renderPublicCatalog();
}

function renderPublicCatalog() {
  const grid = document.getElementById('client-catalog-grid');
  if (!grid) return;

  let items = Array.isArray(publicCatalogItems) ? publicCatalogItems : [];
  if (activeCategory !== 'all') {
    items = items.filter(i => (i.category || '').toLowerCase().includes(activeCategory.toLowerCase()));
  }

  if (items.length === 0) {
    grid.innerHTML = `<div class="col-span-full p-12 text-center text-[#A78D78]">No hay piezas disponibles en esta categoría actualmente.</div>`;
    return;
  }

  grid.innerHTML = items.map(item => `
    <article class="catalog-card bg-white rounded-2xl border border-[#BEB5A9]/60 shadow-sm overflow-hidden flex flex-col justify-between group">
      <div>
        <a href="/pieza/${item.id}" class="block catalog-img-container h-80 w-full relative bg-[#FAF7F2]">
          <img src="${escapeHtml(item.image_url || '/static/img/suit_grey.jpg')}"
               alt="${escapeHtml(item.name)}"
               class="w-full h-full object-cover object-top"
               loading="lazy"
               onerror="this.onerror=null; this.src='/static/img/suit_grey.jpg';">
          <div class="absolute top-3 right-3">
            <span class="px-2.5 py-1 text-xs font-bold rounded-full shadow-sm ${item.stock > 0 ? 'bg-emerald-700 text-white' : 'bg-[#6E473B] text-white'}">
              ${item.stock > 0 ? `${item.stock} disponibles` : 'Bajo Pedido'}
            </span>
          </div>
        </a>

        <div class="p-5 space-y-2.5">
          <div class="flex items-center justify-between text-xs">
            <span class="px-2.5 py-0.5 font-bold rounded-full bg-[#E1D4C2] text-[#291C0E] border border-[#BEB5A9]">${escapeHtml(item.category)}</span>
            <span class="text-[#A78D78] font-semibold">${escapeHtml(item.style)}</span>
          </div>
          <h3 class="font-serif-luxury font-bold text-[#291C0E] text-lg leading-snug">
            <a href="/pieza/${item.id}" class="hover:text-[#6E473B] transition">${escapeHtml(item.name)}</a>
          </h3>
          <p class="text-xs text-[#6E473B] line-clamp-2 leading-relaxed">${escapeHtml(item.description || '')}</p>
          <div class="pt-1 flex items-center space-x-2 text-xs">
            <span class="bg-[#FAF7F2] text-[#291C0E] px-2.5 py-1 rounded-lg border border-[#BEB5A9]/70">Talla: <strong>${escapeHtml(item.size)}</strong></span>
            <span class="bg-[#FAF7F2] text-[#291C0E] px-2.5 py-1 rounded-lg border border-[#BEB5A9]/70">Color: <strong>${escapeHtml(item.color)}</strong></span>
          </div>
        </div>
      </div>

      <div class="px-5 pb-5 pt-3.5 border-t border-[#BEB5A9]/30 flex items-center justify-between bg-[#FAF7F2]/50">
        <div>
          <span class="text-[11px] text-[#A78D78] font-medium block">Precio</span>
          <span class="text-2xl font-black text-[#291C0E] font-mono">$${Number(item.price).toFixed(2)}</span>
        </div>
        <a href="/pieza/${item.id}"
           class="px-4 py-2.5 bg-[#6E473B] hover:bg-[#291C0E] text-white rounded-xl text-xs font-bold transition inline-flex items-center space-x-1.5">
          <span>Ver Desglose y Solicitar</span>
          <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </a>
      </div>
    </article>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

// ==========================================================
// 2. SUBPÁGINA DE DESGLOSE DE PIEZA (pieza.html)
// ==========================================================

async function loadPieceDetail() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const itemId = parts[parts.length - 1];
  const loadingEl = document.getElementById('piece-detail-loading');
  const errorEl = document.getElementById('piece-detail-error');
  const contentEl = document.getElementById('piece-detail-content');

  try {
    const res = await fetch(`/api/public/catalog/${encodeURIComponent(itemId)}`);
    if (!res.ok) {
      loadingEl.classList.add('hidden');
      errorEl.classList.remove('hidden');
      return;
    }
    const data = await res.json();
    const item = data.item;

    document.title = `${item.name} — Sastrería All Look`;
    document.getElementById('pd-image').src = item.image_url || '/static/img/suit_grey.jpg';
    document.getElementById('pd-image').alt = item.name;
    document.getElementById('pd-category').textContent = item.category;
    document.getElementById('pd-name').textContent = item.name;
    document.getElementById('pd-description').textContent = item.description || '';
    document.getElementById('pd-price').textContent = `$${Number(item.price).toFixed(2)}`;
    document.getElementById('pd-size').textContent = item.size;
    document.getElementById('pd-color').textContent = item.color;
    document.getElementById('pd-style').textContent = item.style;
    document.getElementById('pd-delivery').textContent = item.delivery_time || 'Entrega inmediata en mostrador';
    document.getElementById('pd-fabric').textContent = item.fabric || 'Tejido de alta sastrería';
    document.getElementById('pd-care').textContent = item.care_instructions || 'Lavado en seco especializado.';
    document.getElementById('piece-req-item-id').value = item.id;
    document.getElementById('piece-bespoke-link').href = `/solicitar?tipo=medida&ref=${item.id}`;

    const stockBadge = document.getElementById('pd-stock-badge');
    if (item.stock > 0) {
      stockBadge.textContent = `${item.stock} disponibles en tienda`;
      stockBadge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-700 text-white';
    } else {
      stockBadge.textContent = 'Disponible bajo pedido';
      stockBadge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-[#6E473B] text-white';
    }

    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    if (data.related && data.related.length > 0) {
      const relSection = document.getElementById('related-section');
      const relGrid = document.getElementById('related-catalog-grid');
      relGrid.innerHTML = data.related.map(r => `
        <a href="/pieza/${r.id}" class="catalog-card bg-white rounded-2xl border border-[#BEB5A9]/60 overflow-hidden flex flex-col">
          <div class="h-56 bg-[#FAF7F2] overflow-hidden">
            <img src="${escapeHtml(r.image_url || '/static/img/suit_grey.jpg')}" alt="${escapeHtml(r.name)}" class="w-full h-full object-cover object-top">
          </div>
          <div class="p-4 flex items-center justify-between gap-2">
            <div>
              <span class="text-[10px] font-bold text-[#6E473B] uppercase">${escapeHtml(r.category)}</span>
              <h4 class="font-serif-luxury font-bold text-[#291C0E] text-sm">${escapeHtml(r.name)}</h4>
            </div>
            <span class="font-mono font-bold text-[#291C0E] text-sm">$${Number(r.price).toFixed(2)}</span>
          </div>
        </a>
      `).join('');
      relSection.classList.remove('hidden');
    }

    if (window.applyCustomerDataToForms && window.getCurrentCustomer) {
      const cust = window.getCurrentCustomer();
      if (cust) window.applyCustomerDataToForms(cust);
    }
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Error cargando detalle:', err);
    loadingEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
  }
}

async function submitPieceRequest(e) {
  e.preventDefault();
  const payload = {
    request_type: 'Pieza de Exhibición',
    catalog_item_id: parseInt(document.getElementById('piece-req-item-id').value, 10),
    customer_name: document.getElementById('piece-req-name').value.trim(),
    customer_phone: document.getElementById('piece-req-phone').value.trim(),
    customer_id_card: document.getElementById('piece-req-idcard').value.trim(),
    garment_description: document.getElementById('pd-name').textContent.trim(),
    desired_date: document.getElementById('piece-req-date').value,
    needs_quick_adjustment: document.getElementById('piece-req-adjust').checked,
    notes: document.getElementById('piece-req-notes').value.trim()
  };

  try {
    const res = await fetch('/api/public/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.detail || 'No se pudo enviar su solicitud.');
      return;
    }

    document.getElementById('pd-success-code').textContent = data.ticket_id;
    document.getElementById('pd-success-msg').textContent = data.message;
    document.getElementById('pd-request-success').classList.remove('hidden');
    document.getElementById('piece-request-form').reset();
    document.getElementById('piece-req-item-id').value = payload.catalog_item_id;
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    alert('Error de comunicación con el servidor.');
  }
}

// ==========================================================
// 3. SUBPÁGINA DE SOLICITUDES E INFORMACIÓN (solicitar.html)
// ==========================================================

async function initSolicitarPage() {
  const params = new URLSearchParams(window.location.search);
  const tipo = params.get('tipo') || 'medida';
  const refId = params.get('ref');

  switchSolicitarTab(tipo);

  // Cargar telas disponibles del inventario
  try {
    const res = await fetch('/api/public/fabrics');
    if (res.ok) {
      const fabrics = await res.json();
      const sel = document.getElementById('med-fabric');
      if (sel) {
        fabrics.forEach(f => {
          const opt = document.createElement('option');
          opt.value = f.name;
          opt.textContent = f.name;
          sel.appendChild(opt);
        });
      }
    }
  } catch (e) {
    console.warn('No se pudieron cargar las telas:', e);
  }

  // Si viene referenciado desde una pieza, prellenar nota
  if (refId) {
    try {
      const res = await fetch(`/api/public/catalog/${encodeURIComponent(refId)}`);
      if (res.ok) {
        const data = await res.json();
        const notesEl = document.getElementById('med-notes');
        if (notesEl && data.item) {
          notesEl.value = `Referencia basada en la pieza "${data.item.name}" (${data.item.color}), solicitada a mi medida.`;
        }
      }
    } catch (e) {
      // ignorar si no existe
    }
  }

  if (window.applyCustomerDataToForms && window.getCurrentCustomer) {
    const cust = window.getCurrentCustomer();
    if (cust) window.applyCustomerDataToForms(cust);
  }
}

function switchSolicitarTab(tab) {
  const valid = ['medida', 'arreglo', 'reglas'];
  const active = valid.includes(tab) ? tab : 'medida';

  valid.forEach(t => {
    const btn = document.getElementById(`sol-tab-${t}`);
    const panel = document.getElementById(`sol-panel-${t}`);
    if (btn && panel) {
      if (t === active) {
        btn.classList.add('bg-[#6E473B]', 'text-white');
        btn.classList.remove('bg-[#FAF7F2]', 'text-[#291C0E]', 'hover:bg-[#E1D4C2]');
        btn.style.backgroundColor = '#6E473B';
        btn.style.color = '#FFFFFF';
        panel.classList.remove('hidden');
      } else {
        btn.classList.remove('bg-[#6E473B]', 'text-white');
        btn.classList.add('bg-[#FAF7F2]', 'text-[#291C0E]', 'hover:bg-[#E1D4C2]');
        btn.style.backgroundColor = '';
        btn.style.color = '';
        panel.classList.add('hidden');
      }
    }
  });
}

function _showSolicitarSuccess(ticketId, msg) {
  document.getElementById('sol-success-code').textContent = ticketId;
  document.getElementById('sol-success-msg').textContent = msg;
  const banner = document.getElementById('sol-success-banner');
  banner.classList.remove('hidden');
  banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (window.lucide) lucide.createIcons();
}

async function submitSolicitarMedida(e) {
  e.preventDefault();
  const payload = {
    request_type: 'Confección a la Medida',
    customer_name: document.getElementById('med-name').value.trim(),
    customer_phone: document.getElementById('med-phone').value.trim(),
    customer_id_card: document.getElementById('med-idcard').value.trim(),
    garment_description: document.getElementById('med-garment').value,
    occasion: document.getElementById('med-occasion').value.trim(),
    fabric_preference: document.getElementById('med-fabric').value,
    desired_date: document.getElementById('med-date').value,
    needs_quick_adjustment: false,
    notes: document.getElementById('med-notes').value.trim()
  };

  try {
    const res = await fetch('/api/public/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.detail || 'No se pudo enviar la solicitud.');
      return;
    }
    document.getElementById('form-solicitar-medida').reset();
    _showSolicitarSuccess(data.ticket_id, data.message);
  } catch (err) {
    alert('Error de conexión con el servidor.');
  }
}

async function submitSolicitarArreglo(e) {
  e.preventDefault();
  const payload = {
    request_type: 'Arreglo Menor',
    customer_name: document.getElementById('alt-name').value.trim(),
    customer_phone: document.getElementById('alt-phone').value.trim(),
    customer_id_card: '',
    garment_description: document.getElementById('alt-garment').value.trim(),
    desired_date: document.getElementById('alt-date').value,
    needs_quick_adjustment: false,
    notes: document.getElementById('alt-details').value.trim()
  };

  try {
    const res = await fetch('/api/public/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.detail || 'No se pudo registrar el arreglo.');
      return;
    }
    document.getElementById('form-solicitar-arreglo').reset();
    _showSolicitarSuccess(data.ticket_id, data.message);
  } catch (err) {
    alert('Error de conexión con el servidor.');
  }
}
