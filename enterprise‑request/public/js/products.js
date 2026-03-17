document.addEventListener('DOMContentLoaded', () => {
  const API_URL = '/api';

  // ---------- Elements ----------
  const sectorsListContainer = document.getElementById('sectors-list');
  const productsListContainer = document.getElementById('products-list');
  const productsModal = document.getElementById('products-modal');
  const editSectorModal = document.getElementById('edit-sector-modal');
  const confirmModal = document.getElementById('confirm-modal');
  const successModal = document.getElementById('success-modal');
  const selectedSectorName = document.getElementById('selected-sector-name');
  const confirmMessage = document.getElementById('confirm-message');
  const successMessage = document.getElementById('success-message');
  const editSectorNameInput = document.getElementById('edit-sector-name');
  const saveSectorEditBtn = document.getElementById('save-sector-edit-btn');
  const confirmActionBtn = document.getElementById('confirm-action-btn');
  const cancelActionBtn = document.getElementById('cancel-action-btn');
  const successOkBtn = document.getElementById('success-ok-btn');
  const newSectorNameInput = document.getElementById('new-sector-name');
  const createSectorBtn = document.getElementById('create-sector-btn');

  let currentSectorId = null;

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
      editSectorModal.style.display = 'none';
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
        <td><a href="#" onclick="window.showProductsModal(${s.id}, '${s.name.replace(/'/g, "\\'")}')">${s.name}</a></td>
        <td>
          <div class="action-buttons-cell">
            <button class="btn-action btn-editar" onclick="window.editSector(${s.id}, '${s.name.replace(/'/g, "\\'")}')">Edit</button>
            <button class="btn-action btn-excluir" onclick="window.confirmDelete(${s.id})">Delete</button>
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

  // ---------- Create Sector ----------
  createSectorBtn.addEventListener('click', async () => {
    const name = newSectorNameInput.value.trim();
    if (!name) { showSuccessModal('Sector name is required'); return; }

    try {
      await fetchJSON(`${API_URL}/sectors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      newSectorNameInput.value = '';
      showSuccessModal('Sector created successfully!', loadSectors);
    } catch (e) {
      showSuccessModal('Error creating sector: ' + e.message);
    }
  });

  newSectorNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createSectorBtn.click();
  });

  // ---------- Products Modal (read-only view) ----------
  window.showProductsModal = async (sectorId, sectorName) => {
    currentSectorId = sectorId;
    selectedSectorName.textContent = sectorName;
    try {
      const products = await fetchJSON(`${API_URL}/admin/products-sector_id?sector_id=${sectorId}`);
      renderProductsInModal(products);
      productsModal.style.display = 'block';
    } catch (e) {
      productsListContainer.innerHTML = '<p style="color:red;">Could not load products.</p>';
      productsModal.style.display = 'block';
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
        <td>${p.cost_per_unit > 0 ? parseFloat(p.cost_per_unit).toFixed(2) : '—'}</td>
        <td>${p.supplier || '—'}</td>
      </tr>
    `).join('');

    productsListContainer.innerHTML = `
      <table class="admin-list-table">
        <thead><tr><th>ID</th><th>Name</th><th>Unit</th><th>Qty</th><th>Cost/Unit</th><th>Supplier</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top: 1rem; font-size: 0.9em; color: #666;">
        To manage products, go to the <a href="/product-entry">Products</a> page.
      </p>
    `;
  }

  // ---------- Delete Sector ----------
  window.confirmDelete = (sectorId) => {
    showConfirmModal('Are you sure you want to delete this sector?', async () => {
      try {
        await fetchJSON(`${API_URL}/sectors/${sectorId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        showSuccessModal('Sector deleted successfully!', () => {
          if (currentSectorId === sectorId) {
            productsModal.style.display = 'none';
            currentSectorId = null;
          }
          loadSectors();
        });
      } catch (e) {
        showSuccessModal('Error deleting sector: ' + e.message);
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
