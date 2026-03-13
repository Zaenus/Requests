let productData = {};

document.addEventListener('DOMContentLoaded', () => {
    const formSection = document.getElementById('form-section');
    const confirmSection = document.getElementById('confirm-section');
    const setorSelect = document.getElementById('setor');
    const categoriaSelect = document.getElementById('categoria');
    const productSearch = document.getElementById('product-search');
    const searchBtn = document.getElementById('search-btn');
    const searchResults = document.getElementById('search-results');
    const selectedProductsList = document.getElementById('selected-products-list');
    const modalMessage = document.getElementById('modal-message');
    const modalText = document.getElementById('modal-text');
    const modalClose = document.getElementById('modal-close');
    const dataInput = document.getElementById('data');
    const horaInput = document.getElementById('hora');
    const observacoesInput = document.getElementById('observacoes');
    
    const now = new Date();
    dataInput.value = now.toLocaleDateString('pt-BR');
    horaInput.value = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let selectedProducts = [];

    // ────── TOAST SUCCESS ──────
    const toast = document.createElement('div');
    toast.id = 'toast-success';
    toast.innerHTML = `
        <div class="toast-content">
            <ion-icon name="checkmark-circle-outline"></ion-icon>
            <span id="toast-message"></span>
        </div>
    `;
    document.body.appendChild(toast);
    toast.style.display = 'none';

    const showToast = (message) => {
        toast.style.display = 'block';
        const msgEl = document.getElementById('toast-message');
        msgEl.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    };

    // ────── MODAL (ERROR / SUCCESS) ──────
    function showModal(message, type) {
        modalText.textContent = message;
        modalMessage.className = `modal ${type}`;
        modalMessage.style.display = 'block';
    }

    function hideModal() {
        modalMessage.style.display = 'none';
    }

    modalClose.addEventListener('click', hideModal);
    modalMessage.addEventListener('click', (e) => {
        if (e.target === modalMessage) hideModal();
    });

    // ────── TURNO BUTTONS ──────
    const turnoButtons = document.querySelectorAll('.turno-button');
    turnoButtons.forEach(button => {
        button.addEventListener('click', () => {
            turnoButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
        });
    });

    // ────── FETCH SECTORES ──────
    async function fetchSetores() {
        try {
            const response = await fetch('/api/sectors');
            const setores = await response.json();
            setores.forEach(setor => {
                const option = document.createElement('option');
                option.value = setor.name;
                option.textContent = setor.name;
                setorSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Erro ao carregar setores:", error);
            showModal('Erro ao carregar os setores do servidor.', 'erro');
        }
    }

    // ────── FETCH PRODUTOS ──────
    async function fetchProdutos(setor) {
        try {
            const response = await fetch(`/api/catalog/products?sector_name=${encodeURIComponent(setor)}`);
            const products = await response.json();
            productData = {
                "Geral": products.map(p => {
                    if (!p.id || !p.name || !p.unit) return null;
                    return { id: p.id, nome: p.name, und: p.unit };
                }).filter(p => p !== null)
            };
            if (products.length === 0) {
                showModal('Nenhum produto encontrado para o setor selecionado.', 'erro');
            }
            populateCategories(productData);
        } catch (error) {
            console.error("Erro ao carregar produtos:", error);
            showModal('Erro ao carregar os produtos do servidor.', 'erro');
        }
    }

    fetchSetores();

    // ────── CATEGORIAS ──────
    function populateCategories(products) {
        categoriaSelect.innerHTML = '<option value="">Todas as Categorias</option>';
        if (products) {
            Object.keys(products).forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                categoriaSelect.appendChild(option);
            });
        }
    }

    // ────── FILTER & DISPLAY ──────
    function filterAndDisplayProducts() {
        const setor = setorSelect.value;
        const categoria = categoriaSelect.value;
        const query = productSearch.value.toLowerCase();
        
        if (!setor) return;

        const allProductsInSector = Object.values(productData).flat();
        let productsToFilter = allProductsInSector;

        if (categoria) {
            productsToFilter = productData[categoria] || [];
        }

        let results = productsToFilter;
        if (query.length > 1) {
            results = productsToFilter.filter(p => p.nome.toLowerCase().includes(query));
        }
        
        displaySearchResults(results);
    }

    setorSelect.addEventListener('change', (e) => {
        const selectedSector = e.target.value;
        if (selectedSector) {
            fetchProdutos(selectedSector);
        } else {
            categoriaSelect.innerHTML = '<option value="">Todas as Categorias</option>';
        }
        searchResults.innerHTML = '';
        selectedProducts = [];
        renderSelectedProducts();
        hideModal();
    });

    categoriaSelect.addEventListener('change', () => {
        productSearch.value = '';
        filterAndDisplayProducts();
    });
    
    searchBtn.addEventListener('click', () => {
        filterAndDisplayProducts();
    });

    // ────── DISPLAY RESULTS ──────
    function displaySearchResults(results) {
        searchResults.innerHTML = '';
        if (results.length === 0) {
            searchResults.innerHTML = '<p class="search-info">Nenhum produto encontrado.</p>';
            return;
        }

        results.forEach(p => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-item';
            resultItem.innerHTML = `
                <span>${p.nome} (${p.und})</span>
                <div class="add-item-controls">
                    <input type="number" value="1" min="1">
                    <button class="add-btn" data-id="${p.id}" data-nome="${p.nome}" data-und="${p.und}">Adicionar</button>
                </div>
            `;
            searchResults.appendChild(resultItem);
        });
    }

    // ────── ADD PRODUCT + TOAST ──────
    searchResults.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-btn')) {
            const id = e.target.dataset.id;
            const nome = e.target.dataset.nome;
            const und = e.target.dataset.und;
            const quantidadeInput = e.target.previousElementSibling;
            const quantidade = parseInt(quantidadeInput.value);

            if (!id || !nome || !und) {
                showModal('Erro: Produto com dados inválidos.', 'erro');
                return;
            }

            if (quantidade > 0) {
                const existingProduct = selectedProducts.find(p => p.id === id);
                if (existingProduct) {
                    existingProduct.quantidade += quantidade;
                    showToast(`+${quantidade} ${nome} adicionado!`);
                } else {
                    selectedProducts.push({ id, nome, und, quantidade });
                    showToast(`${nome} adicionado à lista!`);
                }
                renderSelectedProducts();
                productSearch.value = '';
                filterAndDisplayProducts();
            }
        }
    });

    // ────── REMOVE PRODUCT ──────
    selectedProductsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-btn')) {
            const id = e.target.dataset.id;
            selectedProducts = selectedProducts.filter(p => p.id !== id);
            renderSelectedProducts();
        }
    });

    // ────── RENDER SELECTED ──────
    function renderSelectedProducts() {
        selectedProductsList.innerHTML = '';
        if (selectedProducts.length === 0) {
            selectedProductsList.innerHTML = '<li class="no-items">Nenhum produto adicionado.</li>';
        } else {
            selectedProducts.forEach(p => {
                const li = document.createElement('li');
                li.className = 'selected-item';
                li.innerHTML = `
                    <span>${p.nome} (${p.und}) - Qtd: ${p.quantidade}</span>
                    <button class="remove-btn" data-id="${p.id}">Remover</button>
                `;
                selectedProductsList.appendChild(li);
            });
        }
    }
    
    // ────── CONFIRMAR ──────
    document.getElementById('btn-confirmar').addEventListener('click', () => {
        const setor = setorSelect.value;
        const turnoButton = document.querySelector('.turno-button.selected');
        const funcionario = document.getElementById('funcionario').value;
        const responsavel = document.getElementById('responsavel').value;
        const observacoes = observacoesInput.value;

        if (!setor || !turnoButton || !funcionario || !responsavel) {
            showModal('Por favor, preencha todos os campos obrigatórios.', 'erro');
            return;
        }
        
        if (selectedProducts.length === 0) {
            showModal('Por favor, adicione pelo menos um produto à lista.', 'erro');
            return;
        }

        const turno = turnoButton.querySelector('input').value;
        
        document.getElementById('confirm-setor').textContent = setor;
        document.getElementById('confirm-turno').textContent = turno;
        document.getElementById('confirm-data').textContent = dataInput.value;
        document.getElementById('confirm-hora').textContent = horaInput.value;
        document.getElementById('confirm-funcionario').textContent = funcionario;
        document.getElementById('confirm-responsavel').textContent = responsavel;

        const confirmProdutosList = document.getElementById('confirm-produtos');
        confirmProdutosList.innerHTML = '';
        selectedProducts.forEach(p => {
            const li = document.createElement('li');
            li.textContent = `${p.nome}: ${p.quantidade} (${p.und})`;
            confirmProdutosList.appendChild(li);
        });

        if (observacoes.trim() !== '') {
            document.getElementById('confirm-observacoes').textContent = observacoes;
            document.getElementById('confirm-observacoes-section').style.display = 'block';
        } else {
            document.getElementById('confirm-observacoes').textContent = '';
            document.getElementById('confirm-observacoes-section').style.display = 'none';
        }

        formSection.style.display = 'none';
        confirmSection.style.display = 'block';
        hideModal();
    });

    // ────── VOLTAR ──────
    document.getElementById('btn-voltar').addEventListener('click', () => {
        formSection.style.display = 'block';
        confirmSection.style.display = 'none';
    });
    // ────── ENVIAR (FIXED: Send UTC) ──────
    document.getElementById('btn-enviar').addEventListener('click', async () => {
        const setor = setorSelect.value;
        const turno = document.querySelector('.turno-button.selected input').value;
        const funcionario = document.getElementById('funcionario').value;
        const responsavel = document.getElementById('responsavel').value;
        const data = dataInput.value; // "30/10/2025"
        const hora = horaInput.value; // "15:51"
        const observacoes = observacoesInput.value;

        // ────── CONVERT LOCAL → UTC ──────
        const [day, month, year] = data.split('/');
        const [hour, minute] = hora.split(':');
        const localDate = new Date(year, month - 1, day, hour, minute);
        const utcDate = new Date(localDate.getTime());
        const data_utc = utcDate.toISOString().slice(0, 10); // YYYY-MM-DD
        const hora_utc = utcDate.toTimeString().slice(0, 5);  // HH:MM

        const dadosParaEnvio = {
            setor,
            turno,
            data: data_utc,
            hora: hora_utc,
            funcionario,
            responsavel,
            produtos: selectedProducts.map(p => ({
                id: p.id,
                quantidade: p.quantidade
            })),
            observacoes
        };

        console.log('Enviando (UTC):', data_utc, hora_utc); // Debug

        try {
            const response = await fetch('/api/requests/enviar_requisicao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosParaEnvio)
            });

            if (response.ok) {
                showModal('Requisição enviada com sucesso!', 'sucesso');
                // Reset form...
                document.getElementById('funcionario').value = '';
                document.getElementById('responsavel').value = '';
                document.getElementById('observacoes').value = '';
                document.querySelectorAll('.turno-button').forEach(btn => btn.classList.remove('selected'));
                selectedProducts = [];
                renderSelectedProducts();
                setorSelect.value = '';
                categoriaSelect.innerHTML = '<option value="">Todas as Categorias</option>';
                productSearch.value = '';
                formSection.style.display = 'block';
                confirmSection.style.display = 'none';
                setTimeout(() => location.reload(), 1500);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro desconhecido');
            }
        } catch (error) {
            showModal(`Erro: ${error.message}`, 'erro');
        }
    });
});