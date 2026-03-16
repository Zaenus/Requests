
document.addEventListener('DOMContentLoaded', async () => {
  const API_URL = '/api';

  // Verify the current user is authenticated before rendering the admin UI.
  // fetchJSON redirects to /login on 401/403, so no extra handling is needed here.
  try {
    const user = await fetchJSON(`${API_URL}/me`);
    const display = document.getElementById('username-display');
    if (display) display.textContent = user.username;
  } catch {
    return;
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
  function populateProductSectorSelect(sectors) {
    const select = document.getElementById('product-sector-select');
    if (!select) return;
    select.innerHTML = '<option value="">Select a sector...</option>' +
      sectors.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  }

  // ---------- Load Sectors ----------
  async function loadSectors() {
    const sectors = await fetchJSON(`${API_URL}/sectors`);
    const container = document.getElementById('sectors-list');
    if (container) renderSectors(sectors, container);
    populateProductSectorSelect(sectors);
  }

  // ---------- Render Sectors (used only on admin page) ----------
  function renderSectors(sectors, container) {
    container.innerHTML = '';
    if (!sectors || sectors.length === 0) {
      container.innerHTML = '<p>No sectors registered.</p>';
      return;
    }

    const rows = sectors.map(s => `
      <tr>
        <td>${s.id}</td>
        <td>${s.name}</td>
        <td>
          <div class="action-buttons-cell">
            <button class="btn-action btn-editar" onclick="editSector(${s.id}, '${s.name}')">Edit</button>
            <button class="btn-action btn-excluir" onclick="confirmDelete('sector', ${s.id})">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    container.innerHTML = `
      <table class="admin-list-table">
        <thead><tr><th>ID</th><th>Name</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // ---------- Admin-page specific ----------
  const isAdminPage = !!document.getElementById('admin-content');

  if (isAdminPage) {
    const saveSectorBtn = document.getElementById('save-sector-btn');
    const saveProductBtn = document.getElementById('save-product-btn');
    const sectorSelect = document.getElementById('product-sector-select');
    const productSelect = document.getElementById('product-select');
    const quantityInput = document.getElementById('product-quantity');

    // ---- Create / Update Sector ----
    saveSectorBtn?.addEventListener('click', async () => {
      const name = document.getElementById('sector-name').value.trim();
      if (!name) { showModal('Error', 'Sector name is required', true); return; }

      try {
        await fetchJSON(`${API_URL}/sectors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        document.getElementById('sector-name').value = '';
        await loadSectors();
        showModal('Success', 'Sector registered successfully!');
      } catch (e) { showModal('Error', e.message, true); }
    });

    // ---- Load products when sector changes ----
    sectorSelect?.addEventListener('change', async () => {
      const sectorId = sectorSelect.value;
      if (!productSelect) return;

      if (!sectorId) {
        productSelect.innerHTML = '<option value="">Select a sector first...</option>';
        productSelect.disabled = true;
        if (quantityInput) quantityInput.disabled = true;
        if (saveProductBtn) saveProductBtn.disabled = true;
        return;
      }

      try {
        const products = await fetchJSON(`${API_URL}/admin/products-sector_id?sector_id=${sectorId}`);
        if (products.length === 0) {
          productSelect.innerHTML = '<option value="">No products in this sector</option>';
          productSelect.disabled = true;
        } else {
          productSelect.innerHTML = '<option value="">Select a product...</option>' +
            products.map(p => `<option value="${p.id}" data-quantity="${p.quantity ?? 0}">${p.name} (${p.unit}) — Stock: ${p.quantity ?? 0}</option>`).join('');
          productSelect.disabled = false;
        }
        if (quantityInput) { quantityInput.value = ''; quantityInput.disabled = true; }
        if (saveProductBtn) saveProductBtn.disabled = true;
      } catch (e) {
        showModal('Error', e.message, true);
      }
    });

    // ---- Enable quantity input when product is selected ----
    productSelect?.addEventListener('change', () => {
      const hasProduct = !!productSelect.value;
      if (quantityInput) { quantityInput.disabled = !hasProduct; if (!hasProduct) quantityInput.value = ''; }
      if (saveProductBtn) saveProductBtn.disabled = !hasProduct;
    });

    // ---- Add quantity to selected product ----
    saveProductBtn?.addEventListener('click', async () => {
      const productId = productSelect?.value;
      const addQty = parseFloat(quantityInput?.value || '0');

      if (!productId) { showModal('Error', 'Please select a product', true); return; }
      if (isNaN(addQty) || addQty <= 0) { showModal('Error', 'Please enter a valid quantity greater than 0', true); return; }

      try {
        // Get current product data
        const allProducts = await fetchJSON(`${API_URL}/admin/products`);
        const product = allProducts.find(p => String(p.id) === String(productId));
        if (!product) { showModal('Error', 'Product not found', true); return; }

        const newQuantity = (product.quantity ?? 0) + addQty;

        await fetchJSON(`${API_URL}/admin/products/${productId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sector_id: product.sector_id,
            name: product.name,
            unit: product.unit,
            quantity: newQuantity,
            cost_per_unit: product.cost_per_unit ?? 0,
            supplier: product.supplier ?? ''
          })
        });

        // Refresh the product dropdown to reflect updated stock
        if (sectorSelect.value) sectorSelect.dispatchEvent(new Event('change'));
        if (quantityInput) quantityInput.value = '';
        showModal('Success', `Added ${addQty} to ${product.name}. New stock: ${newQuantity}.`);
      } catch (e) { showModal('Error', e.message, true); }
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