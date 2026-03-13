document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api';
    const autorizacaoTableBody = document.getElementById('autorizacao-table-body');
    const detalhesModal = document.getElementById('requisicao-details-modal');
    const detalhesContainer = document.getElementById('requisition-details-container');
    const idTitle = document.getElementById('requisition-id-title');
    const aprovarBtn = document.getElementById('aprovar-btn-modal');
    const recusarBtn = document.getElementById('recusar-btn-modal');
    const editItemsBtn = document.getElementById('edit-items-btn');
    const loginModal = document.getElementById('login-modal');
    const loginUsernameInput = document.getElementById('login-username');
    const loginPasswordInput = document.getElementById('login-password');
    const loginBtn = document.getElementById('login-btn');
    const usernameDisplay = document.getElementById('username-display');

    let currentRequisitionId = null;
    let pollingInterval = null;
    let isEditMode = false;
    let requestData = null;

    // Helper function for API calls.
    // Credentials are included so the HttpOnly auth cookie is sent automatically.
    async function fetchJSON(url, opts = {}) {
        opts.credentials = 'include';
        opts.headers = {
            'Content-Type': 'application/json',
            ...opts.headers
        };
        const res = await fetch(url, opts);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    }

    const formatLocalDate = (utcIso) => {
        const d = new Date(utcIso);                 // JS treats the string as UTC
        return d.toLocaleString('pt-BR', {
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
            showModal('Erro', 'Erro ao fazer login: ' + error.message, true);
        }
    });

    // Load pending requests
    async function loadPendingRequests() {
        try {
            const requests = await fetchJSON(`${API_URL}/admin/requests`);
            const pendingRequests = requests.filter(r => r.status === 'pending');

            const existingIds = new Set(
                Array.from(autorizacaoTableBody.querySelectorAll('tr'))
                    .map(row => parseInt(row.dataset.id))
                    .filter(id => !isNaN(id))
            );

            pendingRequests.forEach(req => {
                if (!existingIds.has(req.id)) {
                    renderRequisitionRow(req);
                }
            });

            autorizacaoTableBody.querySelectorAll('tr').forEach(row => {
                const id = parseInt(row.dataset.id);
                if (!isNaN(id) && !pendingRequests.some(req => req.id === id)) {
                    row.remove();
                }
            });

            if (pendingRequests.length === 0) {
                autorizacaoTableBody.innerHTML = '<tr><td colspan="4">Nenhuma requisição pendente.</td></tr>';
            }
        } catch (error) {
            showModal('Erro', 'Erro ao carregar requisições: ' + error.message, true);
        }
    }

    // Render a single requisition row
    function renderRequisitionRow(req) {
        const row = document.createElement('tr');
        row.dataset.id = req.id;
        row.innerHTML = `
            <td>#${req.id}</td>
            <td>${req.sector_name}</td>
            <td>${formatLocalDate(req.created_at)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action btn-visualizar" data-id="${req.id}">Detalhes</button>
                </div>
            </td>
        `;
        autorizacaoTableBody.prepend(row);
    }

    // Render details in modal
    function renderDetailsInModal(request) {
        requestData = request;
        const produtosHtml = request.products.length > 0
            ? request.products.map((p, index) => {
                const [name, qtyUnit] = p.split(' (');
                const [quantity, unit] = qtyUnit.slice(0, -1).split(' ');
                const productId = request.product_ids ? request.product_ids[index] : null;
                return `
                    <li data-product-id="${productId || ''}">
                        ${isEditMode ? `
                            <input type="number" class="quantity-input" value="${quantity}" min="0" data-index="${index}">
                            <span>${name} (${unit})</span>
                            <button class="btn-action btn-delete" onclick="deleteProduct(${productId}, ${index})">Excluir</button>
                        ` : `${name}: ${quantity} ${unit}`}
                    </li>`;
            }).join('')
            : '<li>Nenhum produto</li>';

        detalhesContainer.innerHTML = `
            <p><strong>Setor:</strong> ${request.sector_name}</p>
            ${request.funcionario ? `<p><strong>Funcionário:</strong> ${request.funcionario}</p>` : ''}
            ${request.responsavel ? `<p><strong>Responsável:</strong> ${request.responsavel}</p>` : ''}
            ${request.turno ? `<p><strong>Turno:</strong> ${request.turno}</p>` : ''}
            <hr>
            <h4>Itens Solicitados:</h4>
            <ul id="products-list">${produtosHtml}</ul>
            ${isEditMode ? `<button class="btn btn-primary" onclick="saveChanges()">Salvar Alterações</button>` : ''}
            <hr>
            <h4>Observações:</h4>
            <p>${request.observacoes || 'Nenhuma observação.'}</p>
        `;
    }

    // Toggle edit mode
    window.toggleEditMode = function() {
        isEditMode = !isEditMode;
        editItemsBtn.textContent = isEditMode ? 'Cancelar Edição' : 'Editar Itens';
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
                    await fetchJSON(`${API_URL}/admin/request_items/${currentRequisitionId}/${update.product_id}`, {
                        method: 'DELETE'
                    });
                } else {
                    await fetchJSON(`${API_URL}/admin/request_items/${currentRequisitionId}/${update.product_id}`, {
                        method: 'PUT',
                        body: JSON.stringify({ quantity: update.quantity })
                    });
                }
            }
            showModal('Sucesso', 'Itens atualizados com sucesso!');
            isEditMode = false;
            editItemsBtn.textContent = 'Editar Itens';
            await showRequisicaoDetailsModal(currentRequisitionId);
        } catch (error) {
            showModal('Erro', 'Erro ao atualizar itens: ' + error.message, true);
        }
    };

    // Delete a product
    window.deleteProduct = async function(productId, index) {
        if (!confirm('Tem certeza que deseja excluir este item?')) return;
        try {
            await fetchJSON(`${API_URL}/admin/request_items/${currentRequisitionId}/${productId}`, {
                method: 'DELETE'
            });
            showModal('Sucesso', 'Item excluído com sucesso!');
            await showRequisicaoDetailsModal(currentRequisitionId);
        } catch (error) {
            showModal('Erro', 'Erro ao excluir item: ' + error.message, true);
        }
    };

    // Show requisition details modal
    window.showRequisicaoDetailsModal = async function(id) {
        try {
            const request = await fetchJSON(`${API_URL}/admin/requests/${id}`);
            if (request.status !== 'pending') {
                showModal('Erro', 'Esta requisição não está mais pendente.', true);
                loadPendingRequests();
                return;
            }
            currentRequisitionId = id;
            idTitle.textContent = `#${id}`;
            renderDetailsInModal(request);
            detalhesModal.style.display = 'block';
        } catch (error) {
            showModal('Erro', 'Erro ao carregar detalhes da requisição: ' + error.message, true);
        }
    };

    // Close requisition details modal
    window.closeRequisicaoDetailsModal = function() {
        detalhesModal.style.display = 'none';
        isEditMode = false;
        editItemsBtn.textContent = 'Editar Itens';
        currentRequisitionId = null;
        requestData = null;
    };

    // Close login modal
    window.closeLoginModal = function() {
        loginModal.style.display = 'none';
        stopPolling();
    };

    // Handle approve/reject
    async function handleAction(status) {
        if (!currentRequisitionId) return;
        try {
            await fetchJSON(`${API_URL}/admin/requests/${currentRequisitionId}`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });
            showModal('Sucesso', `Requisição #${currentRequisitionId} ${status === 'approved' ? 'aprovada' : 'recusada'} com sucesso!`);
            closeRequisicaoDetailsModal();
            loadPendingRequests();
        } catch (error) {
            showModal('Erro', `Erro ao ${status === 'approved' ? 'aprovar' : 'recusar'} requisição: ${error.message}`, true);
        }
    }

    // Handle approve button
    aprovarBtn.addEventListener('click', () => handleAction('approved'));

    // Handle reject button
    recusarBtn.addEventListener('click', () => handleAction('rejected'));

    // Table click handler for details button
    autorizacaoTableBody.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-visualizar');
        if (btn && btn.dataset.id) {
            showRequisicaoDetailsModal(parseInt(btn.dataset.id));
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