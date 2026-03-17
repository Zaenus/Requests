document.addEventListener('DOMContentLoaded', () => {
  const API_URL = '/api';

  // ─── Form elements ───────────────────────────────────────────────────────────
  const productIdInput       = document.getElementById('product-id');
  const sectorSelect         = document.getElementById('product-sector-select');
  const nameInput            = document.getElementById('product-name');
  const unitInput            = document.getElementById('product-unit');
  const saveBtn              = document.getElementById('save-product-btn');
  const clearBtn             = document.getElementById('clear-form-btn');
  const newProductBtn        = document.getElementById('new-product-btn');
  const formTitle            = document.getElementById('form-title');

  // ─── List elements ───────────────────────────────────────────────────────────
  const filterSector         = document.getElementById('filter-sector');
  const filterSearch         = document.getElementById('filter-search');
  const tbody                = document.getElementById('products-tbody');
  const noProductsMsg        = document.getElementById('no-products-msg');

  // ─── Modal elements ──────────────────────────────────────────────────────────
  const confirmModal         = document.getElementById('confirm-modal');
  const confirmDeleteBtn     = document.getElementById('confirm-delete-btn');
  const cancelDeleteBtn      = document.getElementById('cancel-delete-btn');
  const messageModal         = document.getElementById('message-modal');
  const modalTitle           = document.getElementById('modal-title');
  const modalMessage         = document.getElementById('modal-message');
  const modalClose           = document.getElementById('modal-close');
  const modalOkBtn           = document.getElementById('modal-ok-btn');

  let allProducts = [];
  let pendingDeleteId = null;

  // ─── Modal helpers ───────────────────────────────────────────────────────────
  function showMessage(title, message, isError = false, callback) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    const content = messageModal.querySelector('.modal-content');
    content.classList.remove('modal-success', 'modal-error');
    content.classList.add(isError ? 'modal-error' : 'modal-success');
    messageModal.style.display = 'flex';

    const close = () => {
      messageModal.style.display = 'none';
      if (callback) callback();
    };
    modalClose.onclick = close;
    modalOkBtn.onclick = close;
  }

  // ─── Sector loaders ──────────────────────────────────────────────────────────
  async function loadSectors() {
    const sectors = await fetchJSON(`${API_URL}/sectors`);
    const options = '<option value="">Select a sector...</option>' +
      sectors.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    sectorSelect.innerHTML = options;

    const filterOptions = '<option value="">All sectors</option>' +
      sectors.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    filterSector.innerHTML = filterOptions;
  }

  // ─── Product loaders ─────────────────────────────────────────────────────────
  async function loadProducts() {
    allProducts = await fetchJSON(`${API_URL}/admin/products`);
    renderProducts();
  }

  function renderProducts() {
    const sectorFilter = filterSector.value;
    const searchTerm   = filterSearch.value.trim().toLowerCase();

    const filtered = allProducts.filter(p => {
      const matchSector = !sectorFilter || String(p.sector_id) === sectorFilter;
      const matchSearch = !searchTerm  || p.name.toLowerCase().includes(searchTerm);
      return matchSector && matchSearch;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      noProductsMsg.style.display = 'block';
      document.getElementById('products-table').style.display = 'none';
      return;
    }

    noProductsMsg.style.display = 'none';
    document.getElementById('products-table').style.display = '';

    tbody.innerHTML = filtered.map(p => `
      <tr>
        <td>${p.id}</td>
        <td>${p.sector_name || ''}</td>
        <td>${p.name}</td>
        <td>${p.unit}</td>
        <td>
          <div class="action-buttons-cell">
            <button class="btn-action btn-editar" data-id="${p.id}">Edit</button>
            <button class="btn-action btn-excluir" data-id="${p.id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    // Attach event listeners
    tbody.querySelectorAll('.btn-editar').forEach(btn => {
      btn.addEventListener('click', () => loadProductForEdit(Number(btn.dataset.id)));
    });
    tbody.querySelectorAll('.btn-excluir').forEach(btn => {
      btn.addEventListener('click', () => confirmDelete(Number(btn.dataset.id)));
    });
  }

  // ─── Form hint element ───────────────────────────────────────────────────────
  const formHint = document.getElementById('form-hint');

  // ─── Form helpers ────────────────────────────────────────────────────────────
  function clearForm() {
    productIdInput.value  = '';
    sectorSelect.value    = '';
    nameInput.value       = '';
    unitInput.value       = '';
    formTitle.textContent = 'Edit Product';
    saveBtn.textContent   = 'Update Product';
    saveBtn.disabled      = true;
    if (formHint) formHint.style.display = '';
  }

  function enterNewProductMode() {
    productIdInput.value  = '';
    sectorSelect.value    = '';
    nameInput.value       = '';
    unitInput.value       = '';
    formTitle.textContent = 'New Product';
    saveBtn.textContent   = 'Create Product';
    saveBtn.disabled      = false;
    if (formHint) formHint.style.display = 'none';
    sectorSelect.focus();
  }

  function loadProductForEdit(id) {
    const p = allProducts.find(x => x.id === id);
    if (!p) return;

    productIdInput.value  = p.id;
    sectorSelect.value    = p.sector_id;
    nameInput.value       = p.name;
    unitInput.value       = p.unit;
    formTitle.textContent = 'Edit Product';
    saveBtn.textContent   = 'Update Product';
    saveBtn.disabled      = false;
    if (formHint) formHint.style.display = 'none';

    // Scroll to form
    document.querySelector('.content-section').scrollIntoView({ behavior: 'smooth' });
  }

  // ─── New Product button ───────────────────────────────────────────────────────
  newProductBtn.addEventListener('click', enterNewProductMode);

  // ─── Save product (create or update) ─────────────────────────────────────────
  saveBtn.addEventListener('click', async () => {
    const id        = productIdInput.value;
    const sector_id = sectorSelect.value;
    const name      = nameInput.value.trim();
    const unit      = unitInput.value.trim();

    if (!sector_id || !name || !unit) {
      showMessage('Validation Error', 'Sector, name and unit are required.', true);
      return;
    }

    try {
      if (id) {
        // Update existing product — preserve existing stock/supplier fields
        const existing = allProducts.find(p => String(p.id) === String(id));
        await fetchJSON(`${API_URL}/admin/products/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sector_id,
            name,
            unit,
            quantity: existing ? (existing.quantity ?? 0) : 0,
            cost_per_unit: existing ? (existing.cost_per_unit ?? 0) : 0,
            supplier: existing ? (existing.supplier ?? '') : '',
            supplier_cnpj: existing ? (existing.supplier_cnpj ?? '') : ''
          })
        });
        clearForm();
        await loadProducts();
        showMessage('Success', 'Product updated successfully!');
      } else {
        // Create new product
        await fetchJSON(`${API_URL}/admin/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sector_id, name, unit })
        });
        clearForm();
        await loadProducts();
        showMessage('Success', 'Product created successfully!');
      }
    } catch (e) {
      showMessage('Error', e.message, true);
    }
  });

  clearBtn.addEventListener('click', clearForm);

  // ─── Delete product ──────────────────────────────────────────────────────────
  function confirmDelete(id) {
    pendingDeleteId = id;
    confirmModal.style.display = 'flex';
  }

  cancelDeleteBtn.addEventListener('click', () => {
    confirmModal.style.display = 'none';
    pendingDeleteId = null;
  });

  confirmDeleteBtn.addEventListener('click', async () => {
    confirmModal.style.display = 'none';
    if (!pendingDeleteId) return;
    try {
      await fetchJSON(`${API_URL}/admin/products/${pendingDeleteId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      pendingDeleteId = null;
      await loadProducts();
      showMessage('Success', 'Product deleted successfully!');
    } catch (e) {
      showMessage('Error', e.message, true);
    }
  });

  // ─── Filters ─────────────────────────────────────────────────────────────────
  filterSector.addEventListener('change', renderProducts);
  filterSearch.addEventListener('input', renderProducts);

  // ─── Init ─────────────────────────────────────────────────────────────────────
  loadSectors();
  loadProducts();
});
