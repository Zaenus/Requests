// deposit.js
document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api/admin';
    const activeTbody = document.getElementById('requisitions-table-body');
    const historicTbody = document.getElementById('historic-table-body');
    const requestModal = document.getElementById('request-modal');
    const detailsContainer = document.getElementById('request-details');
    const modalClose = document.getElementById('request-modal-close');
    const modalOk = document.getElementById('request-modal-ok');
    const modalEnd = document.getElementById('request-modal-end');
    const editItemsBtn = document.createElement('button');
    editItemsBtn.className = 'btn btn-primary';
    editItemsBtn.textContent = 'Edit';
    editItemsBtn.style.marginTop = '15px';
    editItemsBtn.style.width = '80px';
    editItemsBtn.style.display = 'none';
    editItemsBtn.style.backgroundColor = '#358a2aff';

    let currentRequestId = null;
    let isEditMode = false;
    let pollingInterval = null;

    // ────── HELPERS ──────
    const formatLocalDate = (utcIso) => {
        const d = new Date(utcIso);                 // JS treats the string as UTC
        return d.toLocaleString('en-GB', {
            day:   '2-digit',
            month: '2-digit',
            year:  'numeric',
            hour:  '2-digit',
            minute:'2-digit'
        });
    };

    // ────── MODALS ──────
    const showModal = (title, message, isError = false) => {
        const modal = document.getElementById('message-modal');
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-message').textContent = message;
        modal.querySelector('.modal-content').className = `modal-content ${isError ? 'modal-error' : 'modal-success'}`;
        modal.style.display = 'flex';

        document.getElementById('modal-close').onclick = () => modal.style.display = 'none';
        document.getElementById('modal-ok-btn').onclick = () => {
            modal.style.display = 'none';
            if (!isError) loadRequests();
        };
        document.getElementById('modal-cancel-btn').onclick = () => modal.style.display = 'none';
    };

    const showConfirmModal = (title, message, onConfirm) => {
        const modal = document.getElementById('message-modal');
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-message').textContent = message;
        modal.querySelector('.modal-content').className = 'modal-content modal-confirm';
        modal.style.display = 'flex';

        const okBtn = document.getElementById('modal-ok-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');

        okBtn.textContent = 'Yes';
        cancelBtn.textContent = 'No';
        okBtn.style.display = 'inline-block';
        cancelBtn.style.display = 'inline-block';

        const cleanup = () => {
            modal.style.display = 'none';
            okBtn.textContent = 'OK';
            cancelBtn.textContent = 'Cancel';
            okBtn.style.display = 'inline-block';
            cancelBtn.style.display = 'none';
            document.getElementById('modal-close').onclick = () => modal.style.display = 'none';
            document.getElementById('modal-ok-btn').onclick = () => {
                modal.style.display = 'none';
                if (!isError) loadRequests();
            };
        };

        okBtn.onclick = async () => {
            cleanup();
            await onConfirm();
        };
        cancelBtn.onclick = cleanup;
        document.getElementById('modal-close').onclick = cleanup;
    };

    // ────── TOGGLE HISTORIC ──────
    window.toggleHistoric = () => {
        const panel = document.getElementById('historic-panel');
        const icon = document.getElementById('historic-toggle-icon');
        if (!panel || !icon) return;
        const isHidden = panel.style.display === 'none' || panel.style.display === '';
        panel.style.display = isHidden ? 'block' : 'none';
        icon.name = isHidden ? 'chevron-up-outline' : 'chevron-down-outline';
    };

    // ────── RENDER ROW ──────
    const renderRow = r => `
        <tr data-id="${r.id}" data-status="${r.status}">
            <td>${r.id}</td>
            <td>${r.sector_name}</td>
            <td>${formatLocalDate(r.created_at)}</td>
            <td>${r.products && r.products.length > 0
                ? r.products.map(p => `${p.name} (${p.quantity} ${p.unit})`).join(', ')
                : 'No items'}</td>
            <td class="actions-cell">
                <button class="btn-action btn-visualizar" data-id="${r.id}" data-action="view">View</button>
                <button class="btn-action btn-imprimir"   data-id="${r.id}" data-action="print">Print</button>
            </td>
        </tr>`;

    // ────── RENDER TABLES ──────
    const renderTables = requests => {
        const active = requests.filter(r => r.status === 'approved');
        const historic = requests.filter(r => ['printed', 'done'].includes(r.status));

        activeTbody.innerHTML = active.length
            ? active.map(renderRow).join('')
            : '<tr><td colspan="5">No active requests.</td></tr>';

        historicTbody.innerHTML = historic.length
            ? historic.map(renderRow).join('')
            : '<tr><td colspan="5">No history.</td></tr>';
    };

    // ────── LOAD REQUESTS ──────
    const loadRequests = async () => {
        try {
            const requests = await fetchJSON(`${API_URL}/requests`);
            renderTables(requests);
        } catch (e) {
            showModal('Error', 'Error loading requests: ' + e.message, true);
        }
    };

    // ────── POLLING ──────
    const startPolling = () => {
        if (pollingInterval) return;
        pollingInterval = setInterval(loadRequests, 10000);
    };

    // ────── RENDER MODAL CONTENT ──────
    const renderModalContent = (request) => {
        requestData = request;
        const productRows = request.products?.length
            ? request.products.map((p) => {
                const { id: productId, name, quantity: qty, unit } = p;
                return `
                    <li data-product-id="${productId}">
                        ${isEditMode
                            ? `<input type="number" class="quantity-input" value="${qty}" min="0" data-product-id="${productId}">
                               <span>${name} (${unit})</span>
                               <button class="btn-delete" data-product-id="${productId}">Delete</button>`
                            : `<strong>${name}:</strong> ${qty} ${unit}`
                        }
                    </li>`;
            }).join('')
            : '<li>No products</li>';

        detailsContainer.innerHTML = `
            <p><strong>ID:</strong> ${request.id}</p>
            <p><strong>Sector:</strong> ${request.sector_name}</p>
            <p><strong>Date/Time:</strong> ${formatLocalDate(request.created_at)}</p>
            <p><strong>Status:</strong> <span class="status ${request.status}">${request.status}</span></p>
            ${request.employee ? `<p><strong>Employee:</strong> ${request.employee}</p>` : ''}
            ${request.supervisor ? `<p><strong>Supervisor:</strong> ${request.supervisor}</p>` : ''}
            ${request.shift ? `<p><strong>Shift:</strong> ${request.shift}</p>` : ''}
            ${request.notes ? `<p><strong>Notes:</strong> ${request.notes}</p>` : ''}
            <hr>
            <h4>Requested Items:</h4>
            <ul id="products-list">${productRows}</ul>
        `;

        // Edit button
        if (request.status === 'approved' && !isEditMode) {
            editItemsBtn.style.display = 'block';
            editItemsBtn.textContent = 'Edit';
            editItemsBtn.onclick = () => {
                isEditMode = true;
                renderModalContent(request);
            };
            detailsContainer.appendChild(editItemsBtn);
        } else if (isEditMode) {
            editItemsBtn.textContent = 'Save';
            editItemsBtn.onclick = () => {
                isEditMode = false;
                saveChanges();
                renderModalContent(request);
            };
            detailsContainer.appendChild(editItemsBtn);
        } else {
            editItemsBtn.style.display = 'none';
        }

        // Attach delete buttons
        if (isEditMode) {
            document.querySelectorAll('.btn-delete').forEach(btn => {
                btn.onclick = () => {
                    const productId = btn.dataset.productId;
                    showConfirmModal(
                        'Confirm Deletion',
                        'Are you sure you want to remove this item?',
                        async () => {
                            try {
                                await fetchJSON(`${API_URL}/request_items/${currentRequestId}/${productId}`, { method: 'DELETE' });
                                showModal('Success', 'Item removed!', false);
                                await showRequestModal(currentRequestId);
                            } catch (e) {
                                showModal('Error', e.message, true);
                            }
                        }
                    );
                };
            });
        }
    };

    // ────── SHOW MODAL ──────
    const showRequestModal = async (id) => {
        try {
            const request = await fetchJSON(`${API_URL}/requests/${id}`);
            currentRequestId = id;
            isEditMode = false;
            renderModalContent(request);
            requestModal.style.display = 'flex';

            // Finalize
            if (request.status === 'approved') {
                modalEnd.style.display = 'inline-block';
                modalEnd.onclick = async () => {
                    showConfirmModal(
                        'Finalize Request',
                        `Finalize request #${id}?`,
                        async () => {
                            await fetchJSON(`${API_URL}/requests/${id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'done' })
                            });
                            showModal('Success', 'Request finalized!', false);
                            closeModal();
                            loadRequests();
                        }
                    );
                };
            } else {
                modalEnd.style.display = 'none';
            }
        } catch (e) {
            showModal('Error', e.message, true);
        }
    };

    // ────── CLOSE MODAL ──────
    const closeModal = () => {
        requestModal.style.display = 'none';
        currentRequestId = null;
        isEditMode = false;
        requestData = null;
    };

    modalClose.onclick = closeModal;
    modalOk.onclick = closeModal;

    // ────── SAVE CHANGES ──────
    window.saveChanges = async () => {
        const updates = [];
        const deletes = [];

        document.querySelectorAll('.quantity-input').forEach(input => {
            const qty = parseInt(input.value);
            const productId = input.dataset.productId;
            if (qty > 0) {
                updates.push({ productId, quantity: qty });
            } else if (qty === 0) {
                deletes.push(productId);
            }
        });

        try {
            for (const { productId, quantity } of updates) {
                await fetchJSON(`${API_URL}/request_items/${currentRequestId}/${productId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ quantity })
                });
            }
            for (const productId of deletes) {
                await fetchJSON(`${API_URL}/request_items/${currentRequestId}/${productId}`, { method: 'DELETE' });
            }

            showModal('Success', 'Items updated!', false);
            isEditMode = false;
            await showRequestModal(currentRequestId);
        } catch (e) {
            showModal('Error', e.message, true);
        }
    };

    // ────── PRINT ──────
    const printRequestModal = async (id) => {
        try {
            const request = await fetchJSON(`${API_URL}/requests/${id}`);
            const win = window.open('', '_blank');
            const rows = request.products.map(p =>
                `<tr><td>${p.name}</td><td>${p.quantity}</td><td>${p.unit}</td></tr>`
            ).join('');

            win.document.write(`
                <html><head><title>Request #${id}</title>
                <style>
                    body{font-family:Arial;padding:20px;}
                    h1{text-align:center;color:#695CFE;}
                    table{width:100%;border-collapse:collapse;margin-top:15px;}
                    th,td{border:1px solid #ddd;padding:8px;text-align:left;}
                    th{background:#f2f2f2;}
                </style>
                </head><body>
                <h1>Request #${id}</h1>
                <p><strong>Sector:</strong> ${request.sector_name}</p>
                <p><strong>Date:</strong> ${new Date(request.created_at).toLocaleString()}</p>
                <h4>Items:</h4>
                <table><thead><tr><th>Product</th><th>Qty</th><th>Unit</th></tr></thead><tbody>${rows}</tbody></table>
                </body></html>`);
            win.document.close();
            win.print();

            if (request.status !== 'printed' && request.status !== 'done') {
                await fetchJSON(`${API_URL}/requests/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'printed' })
                });
                loadRequests();
                showModal('Success', 'Printed!', false);
            }
        } catch (e) {
            showModal('Error', e.message, true);
        }
    };

    // ────── CLICK HANDLER ──────
    const handleClick = async (e) => {
        const btn = e.target.closest('button');
        if (!btn?.dataset?.action) return;
        const id = btn.dataset.id;
        const action = btn.dataset.action;

        if (action === 'view') await showRequestModal(id);
        if (action === 'print') await printRequestModal(id);
    };

    document.querySelectorAll('#requisitions-table-body, #historic-table-body').forEach(tb =>
        tb.addEventListener('click', handleClick)
    );

    // ────── INIT ──────
    loadRequests();
    startPolling();
});
