
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
    const saveProductBtn = document.getElementById('save-product-btn');
    const sectorSelect = document.getElementById('product-sector-select');
    const productSelect = document.getElementById('product-select');
    const quantityInput = document.getElementById('product-quantity');
    const costInput = document.getElementById('product-cost');
    const supplierInput = document.getElementById('product-supplier');
    const supplierCnpjInput = document.getElementById('product-supplier-cnpj');

    function setProductFieldsDisabled(disabled) {
      if (quantityInput) quantityInput.disabled = disabled;
      if (costInput) costInput.disabled = disabled;
      if (supplierInput) supplierInput.disabled = disabled;
      if (supplierCnpjInput) supplierCnpjInput.disabled = disabled;
      if (saveProductBtn) saveProductBtn.disabled = disabled;
    }

    function clearProductFields() {
      if (quantityInput) quantityInput.value = '';
      if (costInput) costInput.value = '';
      if (supplierInput) supplierInput.value = '';
      if (supplierCnpjInput) supplierCnpjInput.value = '';
    }

    // ---- Load products when sector changes ----
    sectorSelect?.addEventListener('change', async () => {
      const sectorId = sectorSelect.value;
      if (!productSelect) return;

      if (!sectorId) {
        productSelect.innerHTML = '<option value="">Select a sector first...</option>';
        productSelect.disabled = true;
        clearProductFields();
        setProductFieldsDisabled(true);
        return;
      }

      try {
        const products = await fetchJSON(`${API_URL}/admin/products-sector_id?sector_id=${sectorId}`);
        if (products.length === 0) {
          productSelect.innerHTML = '<option value="">No products in this sector</option>';
          productSelect.disabled = true;
        } else {
          productSelect.innerHTML = '<option value="">Select a product...</option>' +
            products.map(p => `<option value="${p.id}" data-quantity="${p.quantity ?? 0}" data-cost="${p.cost_per_unit ?? 0}" data-supplier="${p.supplier ?? ''}" data-supplier-cnpj="${p.supplier_cnpj ?? ''}">${p.name} (${p.unit}) — Stock: ${p.quantity ?? 0}</option>`).join('');
          productSelect.disabled = false;
        }
        clearProductFields();
        setProductFieldsDisabled(true);
      } catch (e) {
        showModal('Error', e.message, true);
      }
    });

    // ---- Pre-fill fields when product is selected ----
    productSelect?.addEventListener('change', () => {
      const selected = productSelect.options[productSelect.selectedIndex];
      const hasProduct = !!productSelect.value;
      if (hasProduct) {
        if (quantityInput) { quantityInput.value = ''; quantityInput.disabled = false; }
        if (costInput) { costInput.value = selected.dataset.cost || ''; costInput.disabled = false; }
        if (supplierInput) { supplierInput.value = selected.dataset.supplier || ''; supplierInput.disabled = false; }
        if (supplierCnpjInput) { supplierCnpjInput.value = selected.dataset.supplierCnpj || ''; supplierCnpjInput.disabled = false; }
        if (saveProductBtn) saveProductBtn.disabled = false;
      } else {
        clearProductFields();
        setProductFieldsDisabled(true);
      }
    });

    // ---- Save product details (quantity add + supplier/cost update) ----
    saveProductBtn?.addEventListener('click', async () => {
      const productId = productSelect?.value;
      const addQty = parseFloat(quantityInput?.value || '0');

      if (!productId) { showModal('Error', 'Please select a product', true); return; }
      if (isNaN(addQty) || addQty < 0) { showModal('Error', 'Please enter a valid quantity (0 or greater)', true); return; }

      try {
        // Get current product data
        const allProducts = await fetchJSON(`${API_URL}/admin/products`);
        const product = allProducts.find(p => String(p.id) === String(productId));
        if (!product) { showModal('Error', 'Product not found', true); return; }

        const newQuantity = (product.quantity ?? 0) + addQty;
        const newCost = costInput?.value !== '' ? parseFloat(costInput?.value || '0') : (product.cost_per_unit ?? 0);
        const newSupplier = supplierInput?.value.trim() ?? (product.supplier ?? '');
        const newSupplierCnpj = supplierCnpjInput?.value.trim() ?? (product.supplier_cnpj ?? '');

        await fetchJSON(`${API_URL}/admin/products/${productId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sector_id: product.sector_id,
            name: product.name,
            unit: product.unit,
            quantity: newQuantity,
            cost_per_unit: newCost,
            supplier: newSupplier,
            supplier_cnpj: newSupplierCnpj
          })
        });

        // Refresh the product dropdown to reflect updated stock
        if (sectorSelect.value) sectorSelect.dispatchEvent(new Event('change'));
        showModal('Success', `Product updated. New stock: ${newQuantity}.`);
      } catch (e) { showModal('Error', e.message, true); }
    });

    // ---- XML import ----
    let parsedXmlItems = [];

    function parseXmlItems(xmlText) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'application/xml');
      const parseError = doc.querySelector('parsererror');
      if (parseError) throw new Error('Invalid XML file: ' + parseError.textContent.split('\n')[0]);

      const items = [];
      doc.querySelectorAll('product').forEach(product => {
        let code, quantity;
        const codeEl     = product.querySelector('code') || product.querySelector('cProd');
        const quantityEl = product.querySelector('quantity') || product.querySelector('qCom');
        if (codeEl && quantityEl) {
          code     = codeEl.textContent.trim();
          quantity = parseFloat(quantityEl.textContent.trim());
        } else {
          code     = product.getAttribute('code') || product.getAttribute('cProd');
          quantity = parseFloat(product.getAttribute('quantity') || product.getAttribute('qCom'));
        }
        if (code && !isNaN(quantity) && quantity >= 0) {
          items.push({ code, quantity });
        }
      });
      return items;
    }

    const xmlUploadBtn      = document.getElementById('xml-upload-btn');
    const xmlImportModal    = document.getElementById('xml-import-modal');
    const xmlModalClose     = document.getElementById('xml-modal-close');
    const xmlModalCancelBtn = document.getElementById('xml-modal-cancel-btn');
    const xmlFileInput      = document.getElementById('xml-file-input');
    const xmlPreview        = document.getElementById('xml-preview');
    const xmlPreviewTitle   = document.getElementById('xml-preview-title');
    const xmlPreviewList    = document.getElementById('xml-preview-list');
    const xmlApplyBtn       = document.getElementById('xml-apply-btn');
    const xmlResultsModal   = document.getElementById('xml-results-modal');
    const xmlResultsClose   = document.getElementById('xml-results-close');
    const xmlResultsContent = document.getElementById('xml-results-content');
    const xmlResultsOkBtn   = document.getElementById('xml-results-ok-btn');

    const closeXmlImportModal  = () => { xmlImportModal.style.display = 'none'; };
    const closeXmlResultsModal = () => { xmlResultsModal.style.display = 'none'; };

    xmlUploadBtn?.addEventListener('click', () => {
      xmlFileInput.value = '';
      xmlPreview.style.display = 'none';
      xmlApplyBtn.disabled = true;
      parsedXmlItems = [];
      xmlImportModal.style.display = 'flex';
    });

    xmlModalClose?.addEventListener('click', closeXmlImportModal);
    xmlModalCancelBtn?.addEventListener('click', closeXmlImportModal);

    xmlFileInput?.addEventListener('change', () => {
      const file = xmlFileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          parsedXmlItems = parseXmlItems(e.target.result);
          if (parsedXmlItems.length === 0) {
            xmlPreviewTitle.textContent = 'No valid products found in the file.';
            xmlPreviewList.innerHTML = '';
            xmlApplyBtn.disabled = true;
          } else {
            xmlPreviewTitle.textContent = `${parsedXmlItems.length} product(s) found:`;
            xmlPreviewList.innerHTML = parsedXmlItems
              .map(i => `<div><strong>${i.code}</strong> → quantity: ${i.quantity}</div>`)
              .join('');
            xmlApplyBtn.disabled = false;
          }
          xmlPreview.style.display = 'block';
        } catch (err) {
          xmlPreviewTitle.textContent = 'Error parsing file:';
          xmlPreviewList.textContent = err.message;
          xmlPreview.style.display = 'block';
          xmlApplyBtn.disabled = true;
        }
      };
      reader.readAsText(file);
    });

    xmlApplyBtn?.addEventListener('click', async () => {
      if (!parsedXmlItems.length) return;
      xmlApplyBtn.disabled = true;
      try {
        const result = await fetchJSON(`${API_URL}/admin/products/xml-quantity`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: parsedXmlItems })
        });

        closeXmlImportModal();

        // Refresh product dropdown if a sector is selected
        if (sectorSelect?.value) sectorSelect.dispatchEvent(new Event('change'));

        let html = '';
        if (result.updated.length > 0) {
          html += `<p><strong>${result.updated.length} product(s) updated:</strong></p>`;
          html += '<ul>' + result.updated.map(u =>
            `<li><strong>${u.code}</strong> — ${u.name}: quantity set to ${u.new_quantity}</li>`
          ).join('') + '</ul>';
        }
        if (result.not_found.length > 0) {
          html += `<p style="margin-top:0.75rem;"><strong>${result.not_found.length} code(s) not found in the system:</strong></p>`;
          html += '<ul>' + result.not_found.map(c => `<li>${c}</li>`).join('') + '</ul>';
        }
        xmlResultsContent.innerHTML = html || '<p>No products were changed.</p>';
        xmlResultsModal.style.display = 'flex';
      } catch (err) {
        xmlApplyBtn.disabled = false;
        showModal('Import Error', err.message, true);
      }
    });

    xmlResultsClose?.addEventListener('click', closeXmlResultsModal);
    xmlResultsOkBtn?.addEventListener('click', closeXmlResultsModal);
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