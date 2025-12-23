
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

  // ---------- Helper ----------
  async function fetchJSON(url, opts = {}) {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

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
  function renderSectors(setores) {
    sectorsListContainer.innerHTML = '';
    if (!setores || setores.length === 0) {
      sectorsListContainer.innerHTML = '<p>Nenhum setor cadastrado.</p>';
      return;
    }

    const rows = setores.map(s => `
      <tr>
        <td>${s.id}</td>
        <td><a href="#" onclick="window.showProductsModal(${s.id}, '${s.name}')">${s.name}</a></td>
        <td>
          <div class="action-buttons-cell">
            <button class="btn-action btn-editar" onclick="window.editSector(${s.id}, '${s.name}')">Editar</button>
            <button class="btn-action btn-excluir" onclick="window.confirmDelete('sector', ${s.id})">Excluir</button>
          </div>
        </td>
      </tr>
    `).join('');

    sectorsListContainer.innerHTML = `
      <table class="admin-list-table">
        <thead><tr><th>ID</th><th>Nome</th><th>Ações</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // ---------- Load Sectors ----------
  async function loadSectors() {
    const setores = await fetchJSON(`${API_URL}/sectors`);
    renderSectors(setores);
  }

  // ---------- Products Modal ----------
  window.showProductsModal = async (sectorId, sectorName) => {
    currentSectorId = sectorId;
    selectedSectorName.textContent = sectorName;
    try {
      const produtos = await fetchJSON(`${API_URL}/admin/products-sector_id?sector_id=${sectorId}`);
      renderProductsInModal(produtos);
      productsModal.style.display = 'block';
    } catch (e) {
      productsListContainer.innerHTML = '<p style="color:red;">Não foi possível carregar os produtos.</p>';
    }
  };

  function renderProductsInModal(produtos) {
    productsListContainer.innerHTML = '';
    if (!produtos || produtos.length === 0) {
      productsListContainer.innerHTML = '<p>Nenhum produto cadastrado para este setor.</p>';
      return;
    }

    const rows = produtos.map(p => `
      <tr>
        <td>${p.id}</td>
        <td>${p.name}</td>
        <td>${p.unit}</td>
        <td>
          <div class="action-buttons-cell">
            <button class="btn-action btn-editar" onclick="window.editProduct(${p.id}, '${p.name}', '${p.unit}')">Editar</button>
            <button class="btn-action btn-excluir" onclick="window.confirmDelete('product', ${p.id})">Excluir</button>
          </div>
        </td>
      </tr>
    `).join('');

    productsListContainer.innerHTML = `
      <table class="admin-list-table">
        <thead><tr><th>ID</th><th>Nome</th><th>Unidade</th><th>Ações</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // ---------- Delete Confirmation ----------
  window.confirmDelete = (type, id) => {
    const item = type === 'sector' ? 'setor' : 'produto';
    showConfirmModal(`Tem certeza que deseja excluir este ${item}?`, async () => {
      try {
        const url = type === 'sector'
          ? `${API_URL}/sectors/${id}`
          : `${API_URL}/admin/products/${id}`;
        await fetchJSON(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
        showSuccessModal(`${item} excluído com sucesso!`, () => {
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
        showSuccessModal(`Erro ao excluir ${item}: ${e.message}`);
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
    if (!name) { showSuccessModal('Nome do setor é obrigatório'); return; }

    try {
      await fetchJSON(`${API_URL}/sectors/${currentSectorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      editSectorModal.style.display = 'none';
      showSuccessModal('Setor salvo com sucesso!', () => {
        loadSectors();
        selectedSectorName.textContent = name;
      });
    } catch (e) {
      showSuccessModal('Erro ao salvar setor: ' + e.message);
    }
  });

  // ---------- Edit Product ----------
  window.editProduct = (id, name, unit) => {
    currentProductId = id;
    editProductNameInput.value = name;
    editProductUnitInput.value = unit;
    editModal.style.display = 'block';
  };

  saveEditBtn.addEventListener('click', async () => {
    const data = {
      name: editProductNameInput.value.trim(),
      unit: editProductUnitInput.value.trim()
    };
    if (!data.name || !data.unit) {
      showSuccessModal('Nome e unidade do produto são obrigatórios');
      return;
    }

    try {
      await fetchJSON(`${API_URL}/admin/products/${currentProductId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, sector_id: currentSectorId })
      });
      editModal.style.display = 'none';
      showSuccessModal('Produto salvo com sucesso!', () => {
        showProductsModal(currentSectorId, selectedSectorName.textContent);
      });
    } catch (e) {
      showSuccessModal('Erro ao salvar produto: ' + e.message);
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