document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api';
    const authorizationTableBody = document.getElementById('authorization-table-body');
    const detailsModal = document.getElementById('request-details-modal');
    const detailsContainer = document.getElementById('requisition-details-container');
    const idTitle = document.getElementById('requisition-id-title');
    const approveBtn = document.getElementById('approve-btn-modal');
    const rejectBtn = document.getElementById('reject-btn-modal');
    const editItemsBtn = document.getElementById('edit-items-btn');
    const loginModal = document.getElementById('login-modal');
    const loginUsernameInput = document.getElementById('login-username');
    const loginPasswordInput = document.getElementById('login-password');
    const loginBtn = document.getElementById('login-btn');
    const usernameDisplay = document.getElementById('username-display');

    let currentRequestId = null;
    let pollingInterval = null;
    let isEditMode = false;
    let requestData = null;

    // Helper function for API calls.
    // Credentials are included so the HttpOnly auth cookie is sent automatically.
    // Error responses are expected to be JSON { error: 'message' }; the error
    // message is extracted and thrown so callers receive a clean string.
    // Note: unlike the shared fetchJSON in api.js, this version does NOT redirect
    // on 401/403 — authentication is handled locally via the login modal.
    async function fetchJSON(url, opts = {}) {
        opts.credentials = 'include';
        opts.headers = {
            'Content-Type': 'application/json',
            ...opts.headers
        };
        const res = await fetch(url, opts);
        if (!res.ok) {
            let msg;
            try {
                const body = await res.json();
                msg = body.error || res.statusText;
            } catch {
                msg = res.statusText;
            }
            throw new Error(msg);
        }
        return res.json();
    }

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

    // Function to show success/error modal
    function showModal(title, message, isError = false) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content ${isError ? 'modal-error' : 'modal-success'}">
                <span class="modal-close">&times;</span>
                <h3>${title}</h3>
                <p>${message}</p>
                <button class="btn btn-primary modal-ok-btn">OK</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.style.display = 'flex';

        modal.querySelector('.modal-close').onclick = () => modal.remove();
        modal.querySelector('.modal-ok-btn').onclick = () => {
            modal.remove();
            if (!isError) loadPendingRequests();
        };
    }

    // Check authentication status by calling a protected endpoint.
    // If the HttpOnly cookie is present and valid, the request will succeed.
    async function checkAuth() {
        try {
            const user = await fetchJSON(`${API_URL}/me`);
            if (usernameDisplay) usernameDisplay.textContent = user.username;
            startPolling();
            return true;
        } catch (error) {
            loginModal.style.display = 'flex';
            stopPolling();
            return false;
        }
    }

    // Start polling for new requests
    function startPolling() {
        if (pollingInterval) return;
        pollingInterval = setInterval(loadPendingRequests, 10000);
    }

    // Stop polling
    function stopPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }

    // Login handler
    loginBtn.addEventListener('click', async () => {
        const username = loginUsernameInput.value;
        const password = loginPasswordInput.value;
        try {
            const response = await fetch(`${API_URL}/authentication/login`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            // The server sets an HttpOnly cookie — no token stored in JS.
            if (usernameDisplay) usernameDisplay.textContent = data.username;
            closeLoginModal();
            loadPendingRequests();
            startPolling();
        } catch (error) {
            showModal('Error', 'Login error: ' + error.message, true);
        }
    });

    // Load pending requests
    async function loadPendingRequests() {
        try {
            const requests = await fetchJSON(`${API_URL}/admin/requests`);
            const pendingRequests = requests.filter(r => r.status === 'pending');

            const existingIds = new Set(
                Array.from(authorizationTableBody.querySelectorAll('tr'))
                    .map(row => parseInt(row.dataset.id))
                    .filter(id => !isNaN(id))
            );

            pendingRequests.forEach(req => {
                if (!existingIds.has(req.id)) {
                    renderRequestRow(req);
                }
            });

            authorizationTableBody.querySelectorAll('tr').forEach(row => {
                const id = parseInt(row.dataset.id);
                if (!isNaN(id) && !pendingRequests.some(req => req.id === id)) {
                    row.remove();
                }
            });

            if (pendingRequests.length === 0) {
                authorizationTableBody.innerHTML = '<tr><td colspan="4">No pending requests.</td></tr>';
            }
        } catch (error) {
            showModal('Error', 'Error loading requests: ' + error.message, true);
        }
    }

    // Render a single request row
    function renderRequestRow(req) {
        const row = document.createElement('tr');
        row.dataset.id = req.id;
        row.innerHTML = `
            <td>#${req.id}</td>
            <td>${req.sector_name}</td>
            <td>${formatLocalDate(req.created_at)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action btn-visualizar" data-id="${req.id}">Details</button>
                </div>
            </td>
        `;
        authorizationTableBody.prepend(row);
    }

    // Render details in modal
    function renderDetailsInModal(request) {
        requestData = request;
        const productsHtml = request.products.length > 0
            ? request.products.map((p, index) => {
                const { id: productId, name, quantity, unit } = p;
                return `
                    <li data-product-id="${productId || ''}">
                        ${isEditMode ? `
                            <input type="number" class="quantity-input" value="${quantity}" min="0" data-index="${index}">
                            <span>${name} (${unit})</span>
                            <button class="btn-action btn-delete" onclick="deleteProduct(${productId}, ${index})">Delete</button>
                        ` : `${name}: ${quantity} ${unit}`}
                    </li>`;
            }).join('')
            : '<li>No products</li>';

        detailsContainer.innerHTML = `
            <p><strong>Sector:</strong> ${request.sector_name}</p>
            ${request.employee ? `<p><strong>Employee:</strong> ${request.employee}</p>` : ''}
            ${request.supervisor ? `<p><strong>Supervisor:</strong> ${request.supervisor}</p>` : ''}
            ${request.shift ? `<p><strong>Shift:</strong> ${request.shift}</p>` : ''}
            <hr>
            <h4>Requested Items:</h4>
            <ul id="products-list">${productsHtml}</ul>
            ${isEditMode ? `<button class="btn btn-primary" onclick="saveChanges()">Save Changes</button>` : ''}
            <hr>
            <h4>Notes:</h4>
            <p>${request.notes || 'No notes.'}</p>
        `;
    }

    // Toggle edit mode
    window.toggleEditMode = function() {
        isEditMode = !isEditMode;
        editItemsBtn.textContent = isEditMode ? 'Cancel Edit' : 'Edit Items';
        renderDetailsInModal(requestData);
    };

    // Save changes to quantities
    window.saveChanges = async function() {
        const inputs = document.querySelectorAll('.quantity-input');
        const updates = Array.from(inputs).map(input => ({
            product_id: parseInt(input.parentElement.dataset.productId),
            quantity: parseInt(input.value),
            index: parseInt(input.dataset.index)
        })).filter(update => update.quantity >= 0);

        try {
            for (const update of updates) {
                if (update.quantity === 0) {
                    await fetchJSON(`${API_URL}/admin/request_items/${currentRequestId}/${update.product_id}`, {
                        method: 'DELETE'
                    });
                } else {
                    await fetchJSON(`${API_URL}/admin/request_items/${currentRequestId}/${update.product_id}`, {
                        method: 'PUT',
                        body: JSON.stringify({ quantity: update.quantity })
                    });
                }
            }
            showModal('Success', 'Items updated successfully!');
            isEditMode = false;
            editItemsBtn.textContent = 'Edit Items';
            await showRequestDetailsModal(currentRequestId);
        } catch (error) {
            showModal('Error', 'Error updating items: ' + error.message, true);
        }
    };

    // Delete a product
    window.deleteProduct = async function(productId, index) {
        if (!confirm('Are you sure you want to delete this item?')) return;
        try {
            await fetchJSON(`${API_URL}/admin/request_items/${currentRequestId}/${productId}`, {
                method: 'DELETE'
            });
            showModal('Success', 'Item deleted successfully!');
            await showRequestDetailsModal(currentRequestId);
        } catch (error) {
            showModal('Error', 'Error deleting item: ' + error.message, true);
        }
    };

    // Show request details modal
    window.showRequestDetailsModal = async function(id) {
        try {
            const request = await fetchJSON(`${API_URL}/admin/requests/${id}`);
            if (request.status !== 'pending') {
                showModal('Error', 'This request is no longer pending.', true);
                loadPendingRequests();
                return;
            }
            currentRequestId = id;
            idTitle.textContent = `#${id}`;
            renderDetailsInModal(request);
            detailsModal.style.display = 'block';
        } catch (error) {
            showModal('Error', 'Error loading request details: ' + error.message, true);
        }
    };

    // Close request details modal
    window.closeRequestDetailsModal = function() {
        detailsModal.style.display = 'none';
        isEditMode = false;
        editItemsBtn.textContent = 'Edit Items';
        currentRequestId = null;
        requestData = null;
    };

    // Close login modal
    window.closeLoginModal = function() {
        loginModal.style.display = 'none';
        stopPolling();
    };

    // Handle approve/reject
    async function handleAction(status) {
        if (!currentRequestId) return;
        try {
            await fetchJSON(`${API_URL}/admin/requests/${currentRequestId}`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });
            showModal('Success', `Request #${currentRequestId} ${status === 'approved' ? 'approved' : 'rejected'} successfully!`);
            closeRequestDetailsModal();
            loadPendingRequests();
        } catch (error) {
            showModal('Error', `Error ${status === 'approved' ? 'approving' : 'rejecting'} request: ${error.message}`, true);
        }
    }

    // Handle approve button
    approveBtn.addEventListener('click', () => handleAction('approved'));

    // Handle reject button
    rejectBtn.addEventListener('click', () => handleAction('rejected'));

    // Table click handler for details button
    authorizationTableBody.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-visualizar');
        if (btn && btn.dataset.id) {
            showRequestDetailsModal(parseInt(btn.dataset.id));
        }
    });

    // Initialize
    checkAuth().then(isAuthenticated => {
        if (isAuthenticated) {
            loadPendingRequests();
            startPolling();
        }
    });
});
