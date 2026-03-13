
document.addEventListener('DOMContentLoaded', () => {
  const API_URL = '/api';

  // ---------- Elements ----------
  const sectorsListContainer = document.getElementById('sectors-list');
  const productsListContainer = document.getElementById('products-list');
  const productsModal = document.getElementById('products-modal');
  const editModal = document.getElementById('edit-modal');
  const editSectorModal = document.getElementById('edit-sector-modal');
  const confirmModal = document.getElementById('confirm-modal');
  const successModal = document.getElementById('success-modal');
  const selectedSectorName = document.getElementById('selected-sector-name');
  const confirmMessage = document.getElementById('confirm-message');
  const successMessage = document.getElementById('success-message');
  const editProductNameInput = document.getElementById('edit-product-name');
  const editProductUnitInput = document.getElementById('edit-product-unit');
  const editSectorNameInput = document.getElementById('edit-sector-name');
  const saveEditBtn = document.getElementById('save-edit-btn');
  const saveSectorEditBtn = document.getElementById('save-sector-edit-btn');
  const confirmActionBtn = document.getElementById('confirm-action-btn');
  const cancelActionBtn = document.getElementById('cancel-action-btn');
  const successOkBtn = document.getElementById('success-ok-btn');

  let currentSectorId = null;
  let currentProductId = null;

  // ---------- Modals ----------
  function showSuccessModal(message, callback) {
    successMessage.textContent = message;
    successModal.style.display = 'block';
    successOkBtn.onclick = () => {
      successModal.style.display = 'none';
      if (callback) callback();
    };
  }

  function showConfirmModal(message, onConfirm) {
    confirmMessage.textContent = message;
    confirmModal.style.display = 'block';
    confirmActionBtn.onclick = async () => {
      confirmModal.style.display = 'none';
      await onConfirm();
    };
    cancelActionBtn.onclick = () => confirmModal.style.display = 'none';
  }

  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      productsModal.style.display = 'none';
      editModal.style.display = 'none';
      editSectorModal.style.display = 'none';
      confirmModal.style.display = 'none';
    });
  });

  // ---------- Render Sectors ----------
  function renderSectors(sectors) {
    sectorsListContainer.innerHTML = '';
    if (!sectors || sectors.length === 0) {
      sectorsListContainer.innerHTML = '<p>No sectors registered.</p>';
      return;
    }

    const rows = sectors.map(s => `
      <tr>
        <td>${s.id}</td>
        <td><a href="#" onclick="window.showProductsModal(${s.id}, '${s.name}')">${s.name}</a></td>
        <td>
          <div class="action-buttons-cell">
            <button class="btn-action btn-editar" onclick="window.editSector(${s.id}, '${s.name}')">Edit</button>
            <button class="btn-action btn-excluir" onclick="window.confirmDelete('sector', ${s.id})">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    sectorsListContainer.innerHTML = `
      <table class="admin-list-table">
        <thead><tr><th>ID</th><th>Name</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // ---------- Load Sectors ----------
  async function loadSectors() {
    const sectors = await fetchJSON(`${API_URL}/sectors`);
    renderSectors(sectors);
  }

  // ---------- Products Modal ----------
  window.showProductsModal = async (sectorId, sectorName) => {
    currentSectorId = sectorId;
    selectedSectorName.textContent = sectorName;
    try {
      const products = await fetchJSON(`${API_URL}/admin/products-sector_id?sector_id=${sectorId}`);
      renderProductsInModal(products);
      productsModal.style.display = 'block';
    } catch (e) {
      productsListContainer.innerHTML = '<p style="color:red;">Could not load products.</p>';
    }
  };

  function renderProductsInModal(products) {
    productsListContainer.innerHTML = '';
    if (!products || products.length === 0) {
      productsListContainer.innerHTML = '<p>No products registered for this sector.</p>';
      return;
    }

    const rows = products.map(p => `
      <tr>
        <td>${p.id}</td>
        <td>${p.name}</td>
        <td>${p.unit}</td>
        <td>${p.quantity ?? 0}</td>
        <td>${p.inventory ?? 0}</td>
        <td>${p.cost_per_unit > 0 ? parseFloat(p.cost_per_unit).toFixed(2) : '—'}</td>
        <td>${p.supplier || '—'}</td>
        <td>
          <div class="action-buttons-cell">
            <button class="btn-action btn-editar" onclick="window.editProduct(${p.id}, '${p.name}', '${p.unit}', ${p.quantity ?? 0}, ${p.inventory ?? 0}, ${p.cost_per_unit ?? 0}, '${(p.supplier || '').replace(/'/g, "\\'")}')">Edit</button>
            <button class="btn-action btn-excluir" onclick="window.confirmDelete('product', ${p.id})">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    productsListContainer.innerHTML = `
      <table class="admin-list-table">
        <thead><tr><th>ID</th><th>Name</th><th>Unit</th><th>Qty</th><th>Inventory</th><th>Cost/Unit</th><th>Supplier</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // ---------- Delete Confirmation ----------
  window.confirmDelete = (type, id) => {
    const item = type === 'sector' ? 'sector' : 'product';
    showConfirmModal(`Are you sure you want to delete this ${item}?`, async () => {
      try {
        const url = type === 'sector'
          ? `${API_URL}/sectors/${id}`
          : `${API_URL}/admin/products/${id}`;
        await fetchJSON(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
        showSuccessModal(`${item.charAt(0).toUpperCase() + item.slice(1)} deleted successfully!`, () => {
          if (type === 'sector') {
            loadSectors();
            if (currentSectorId === id) {
              productsModal.style.display = 'none';
              currentSectorId = null;
            }
          } else {
            showProductsModal(currentSectorId, selectedSectorName.textContent);
          }
        });
      } catch (e) {
        showSuccessModal(`Error deleting ${item}: ${e.message}`);
      }
    });
  };

  // ---------- Edit Sector ----------
  window.editSector = (id, name) => {
    currentSectorId = id;
    editSectorNameInput.value = name;
    editSectorModal.style.display = 'block';
  };

  saveSectorEditBtn.addEventListener('click', async () => {
    const name = editSectorNameInput.value.trim();
    if (!name) { showSuccessModal('Sector name is required'); return; }

    try {
      await fetchJSON(`${API_URL}/sectors/${currentSectorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      editSectorModal.style.display = 'none';
      showSuccessModal('Sector saved successfully!', () => {
        loadSectors();
        selectedSectorName.textContent = name;
      });
    } catch (e) {
      showSuccessModal('Error saving sector: ' + e.message);
    }
  });

  // ---------- Edit Product ----------
  window.editProduct = (id, name, unit, quantity, inventory, cost_per_unit, supplier) => {
    currentProductId = id;
    editProductNameInput.value = name;
    editProductUnitInput.value = unit;
    document.getElementById('edit-product-quantity').value = quantity ?? 0;
    document.getElementById('edit-product-inventory').value = inventory ?? 0;
    document.getElementById('edit-product-cost').value = cost_per_unit ?? 0;
    document.getElementById('edit-product-supplier').value = supplier || '';
    editModal.style.display = 'block';
  };

  saveEditBtn.addEventListener('click', async () => {
    const data = {
      name: editProductNameInput.value.trim(),
      unit: editProductUnitInput.value.trim(),
      quantity: parseFloat(document.getElementById('edit-product-quantity').value) || 0,
      inventory: parseFloat(document.getElementById('edit-product-inventory').value) || 0,
      cost_per_unit: parseFloat(document.getElementById('edit-product-cost').value) || 0,
      supplier: document.getElementById('edit-product-supplier').value.trim()
    };
    if (!data.name || !data.unit) {
      showSuccessModal('Product name and unit are required');
      return;
    }

    try {
      await fetchJSON(`${API_URL}/admin/products/${currentProductId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, sector_id: currentSectorId })
      });
      editModal.style.display = 'none';
      showSuccessModal('Product saved successfully!', () => {
        showProductsModal(currentSectorId, selectedSectorName.textContent);
      });
    } catch (e) {
      showSuccessModal('Error saving product: ' + e.message);
    }
  });

  // ---------- Navigation ----------
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const href = item.parentElement.getAttribute('href');
      if (href) location.href = href;
    });
  });

  // ---------- Initial load ----------
  loadSectors();
});