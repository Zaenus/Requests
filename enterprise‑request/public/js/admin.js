
document.addEventListener('DOMContentLoaded', () => {
  const API_URL = '/api';

  // ---------- Helper ----------
  async function fetchJSON(url, opts = {}) {
    opts.credentials = 'include';
    const res = await fetch(url, opts);
    if (res.status === 401 || res.status === 403) {
      window.location.href = '/autorizacao';
      throw new Error('Não autenticado');
    }
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  // ---------- Simple Message Modal ----------
  function showModal(title, message, isError = false) {
    const modal = document.getElementById('message-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalContent = document.querySelector('#message-modal .modal-content');

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalContent.classList.remove('modal-error', 'modal-success');
    modalContent.classList.add(isError ? 'modal-error' : 'modal-success');
    modal.style.display = 'flex';

    document.getElementById('modal-close').onclick =
      document.getElementById('modal-ok-btn').onclick = () => {
        modal.style.display = 'none';
        if (!isError) location.reload();   // refresh after success
      };
  }

  // ---------- Populate Sector Select ----------
  function populateProductSectorSelect(setores) {
    const select = document.getElementById('product-sector-select');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione um setor...</option>' +
      setores.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  }

  // ---------- Load Sectors ----------
  async function loadSectors() {
    const setores = await fetchJSON(`${API_URL}/sectors`);
    const container = document.getElementById('sectors-list');
    if (container) renderSectors(setores, container);
    populateProductSectorSelect(setores);
  }

  // ---------- Render Sectors (used only on admin page) ----------
  function renderSectors(setores, container) {
    container.innerHTML = '';
    if (!setores || setores.length === 0) {
      container.innerHTML = '<p>Nenhum setor cadastrado.</p>';
      return;
    }

    const rows = setores.map(s => `
      <tr>
        <td>${s.id}</td>
        <td>${s.name}</td>
        <td>
          <div class="action-buttons-cell">
            <button class="btn-action btn-editar" onclick="editSector(${s.id}, '${s.name}')">Editar</button>
            <button class="btn-action btn-excluir" onclick="confirmDelete('sector', ${s.id})">Excluir</button>
          </div>
        </td>
      </tr>
    `).join('');

    container.innerHTML = `
      <table class="admin-list-table">
        <thead><tr><th>ID</th><th>Nome</th><th>Ações</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // ---------- Admin-page specific ----------
  const isAdminPage = !!document.getElementById('admin-content');

  if (isAdminPage) {
    const saveSectorBtn = document.getElementById('save-sector-btn');
    const saveProductBtn = document.getElementById('save-product-btn');

    // ---- Create / Update Sector ----
    saveSectorBtn?.addEventListener('click', async () => {
      const name = document.getElementById('sector-name').value.trim();
      if (!name) { showModal('Erro', 'Nome do setor é obrigatório', true); return; }

      try {
        await fetchJSON(`${API_URL}/sectors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        document.getElementById('sector-name').value = '';
        await loadSectors();
        showModal('Sucesso', 'Setor cadastrado com sucesso!');
      } catch (e) { showModal('Erro', e.message, true); }
    });

    // ---- Create / Update Product ----
    saveProductBtn?.addEventListener('click', async () => {
      const id = document.getElementById('product-id')?.value;
      const sector_id = document.getElementById('product-sector-select').value;
      const name = document.getElementById('product-name').value.trim();
      const unit = document.getElementById('product-unit').value.trim();
      const category = document.getElementById('product-category').value.trim();

      if (!sector_id || !name || !unit) {
        showModal('Erro', 'Setor, nome e unidade são obrigatórios', true);
        return;
      }

      const url = id ? `${API_URL}/admin/products/${id}` : `${API_URL}/admin/products`;
      const method = id ? 'PUT' : 'POST';

      try {
        await fetchJSON(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sector_id, name, unit, category })
        });
        document.getElementById('product-form')?.reset();
        await loadSectors();
        showModal('Sucesso', `Produto ${id ? 'atualizado' : 'cadastrado'} com sucesso!`);
      } catch (e) { showModal('Erro', e.message, true); }
    });
  }

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