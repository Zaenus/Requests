document.addEventListener('DOMContentLoaded', () => {
  const API_URL = '/api';

  // ─── Form elements ───────────────────────────────────────────────────────────
  const productIdInput       = document.getElementById('product-id');
  const sectorSelect         = document.getElementById('product-sector-select');
  const nameInput            = document.getElementById('product-name');
  const unitInput            = document.getElementById('product-unit');
  const codeInput            = document.getElementById('product-code');
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

  // ─── XML import elements ─────────────────────────────────────────────────────
  const xmlUploadBtn         = document.getElementById('xml-upload-btn');
  const xmlImportModal       = document.getElementById('xml-import-modal');
  const xmlModalClose        = document.getElementById('xml-modal-close');
  const xmlModalCancelBtn    = document.getElementById('xml-modal-cancel-btn');
  const xmlFileInput         = document.getElementById('xml-file-input');
  const xmlPreview           = document.getElementById('xml-preview');
  const xmlPreviewTitle      = document.getElementById('xml-preview-title');
  const xmlPreviewList       = document.getElementById('xml-preview-list');
  const xmlApplyBtn          = document.getElementById('xml-apply-btn');
  const xmlResultsModal      = document.getElementById('xml-results-modal');
  const xmlResultsClose      = document.getElementById('xml-results-close');
  const xmlResultsContent    = document.getElementById('xml-results-content');
  const xmlResultsOkBtn      = document.getElementById('xml-results-ok-btn');

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
        <td>${p.code || ''}</td>
        <td>${p.quantity ?? 0}</td>
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
    codeInput.value       = '';
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
    codeInput.value       = '';
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
    codeInput.value       = p.code || '';
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
    const code      = codeInput.value.trim();

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
            code,
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
          body: JSON.stringify({ sector_id, name, unit, code })
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

  // ─── XML import ───────────────────────────────────────────────────────────────
  let parsedXmlItems = [];

  function parseXmlItems(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) throw new Error('Invalid XML file: ' + parseError.textContent.split('\n')[0]);

    const items = [];
    doc.querySelectorAll('product, prod').forEach(product => {
      let code, quantity, cost_per_unit;
      const codeEl        = product.querySelector('code') || product.querySelector('cProd');
      const quantityEl    = product.querySelector('quantity') || product.querySelector('qCom');
      const costEl        = product.querySelector('cost_per_unit') || product.querySelector('vUnCom');
      if (codeEl && quantityEl) {
        code          = codeEl.textContent.trim();
        quantity      = parseFloat(quantityEl.textContent.trim());
        cost_per_unit = costEl ? parseFloat(costEl.textContent.trim()) : undefined;
      } else {
        code          = product.getAttribute('code') || product.getAttribute('cProd');
        quantity      = parseFloat(product.getAttribute('quantity') || product.getAttribute('qCom'));
        const costAttr = product.getAttribute('cost_per_unit') || product.getAttribute('vUnCom');
        cost_per_unit = costAttr !== null && costAttr !== undefined ? parseFloat(costAttr) : undefined;
      }
      if (code && !isNaN(quantity) && quantity >= 0) {
        const item = { code, quantity };
        if (cost_per_unit !== undefined && !isNaN(cost_per_unit) && cost_per_unit >= 0) {
          item.cost_per_unit = cost_per_unit;
        }
        items.push(item);
      }
    });
    return items;
  }

  xmlUploadBtn.addEventListener('click', () => {
    xmlFileInput.value = '';
    xmlPreview.style.display = 'none';
    xmlApplyBtn.disabled = true;
    parsedXmlItems = [];
    xmlImportModal.style.display = 'flex';
  });

  const closeXmlImportModal = () => { xmlImportModal.style.display = 'none'; };
  xmlModalClose.addEventListener('click', closeXmlImportModal);
  xmlModalCancelBtn.addEventListener('click', closeXmlImportModal);

  xmlFileInput.addEventListener('change', () => {
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
            .map(i => {
              let text = `<strong>${i.code}</strong> → quantity: ${i.quantity}`;
              if (i.cost_per_unit !== undefined) text += `, cost/unit: ${i.cost_per_unit}`;
              return `<div>${text}</div>`;
            })
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

  xmlApplyBtn.addEventListener('click', async () => {
    if (!parsedXmlItems.length) return;
    xmlApplyBtn.disabled = true;
    try {
      const result = await fetchJSON(`${API_URL}/admin/products/xml-quantity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: parsedXmlItems })
      });

      closeXmlImportModal();
      await loadProducts();

      let html = '';
      if (result.updated.length > 0) {
        html += `<p><strong>${result.updated.length} product(s) updated:</strong></p>`;
        html += '<ul>' + result.updated.map(u => {
          let text = `<strong>${u.code}</strong> — ${u.name}: quantity set to ${u.new_quantity}`;
          if (u.new_cost_per_unit !== undefined) text += `, cost/unit set to ${u.new_cost_per_unit}`;
          return `<li>${text}</li>`;
        }).join('') + '</ul>';
      }
      if (result.not_found.length > 0) {
        html += `<p style="margin-top:0.75rem;"><strong>${result.not_found.length} code(s) not found in the system:</strong></p>`;
        html += '<ul>' + result.not_found.map(c => `<li>${c}</li>`).join('') + '</ul>';
      }
      xmlResultsContent.innerHTML = html || '<p>No products were changed.</p>';
      xmlResultsModal.style.display = 'flex';
    } catch (err) {
      xmlApplyBtn.disabled = false;
      showMessage('Import Error', err.message, true);
    }
  });

  const closeXmlResultsModal = () => { xmlResultsModal.style.display = 'none'; };
  xmlResultsClose.addEventListener('click', closeXmlResultsModal);
  xmlResultsOkBtn.addEventListener('click', closeXmlResultsModal);

  // ─── Init ─────────────────────────────────────────────────────────────────────
  loadSectors();
  loadProducts();
});
