let productData = {};

document.addEventListener('DOMContentLoaded', () => {
    const formSection = document.getElementById('form-section');
    const confirmSection = document.getElementById('confirm-section');
    const sectorSelect = document.getElementById('sector');
    const categorySelect = document.getElementById('category');
    const productSearch = document.getElementById('product-search');
    const searchBtn = document.getElementById('search-btn');
    const searchResults = document.getElementById('search-results');
    const selectedProductsList = document.getElementById('selected-products-list');
    const modalMessage = document.getElementById('modal-message');
    const modalText = document.getElementById('modal-text');
    const modalClose = document.getElementById('modal-close');
    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');
    const notesInput = document.getElementById('notes');
    
    const now = new Date();
    dateInput.value = now.toLocaleDateString('en-GB');
    timeInput.value = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

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

    // ────── SHIFT BUTTONS ──────
    const shiftButtons = document.querySelectorAll('.shift-button');
    shiftButtons.forEach(button => {
        button.addEventListener('click', () => {
            shiftButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
        });
    });

    // ────── FETCH SECTORS ──────
    async function fetchSectors() {
        try {
            const response = await fetch('/api/sectors');
            const sectors = await response.json();
            sectors.forEach(sector => {
                const option = document.createElement('option');
                option.value = sector.name;
                option.textContent = sector.name;
                sectorSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Error loading sectors:", error);
            showModal('Error loading sectors from server.', 'erro');
        }
    }

    // ────── FETCH PRODUCTS ──────
    async function fetchProducts(sector) {
        try {
            const response = await fetch(`/api/catalog/products?sector_name=${encodeURIComponent(sector)}`);
            const products = await response.json();
            productData = {
                "General": products.map(p => {
                    if (!p.id || !p.name || !p.unit) return null;
                    return { id: p.id, name: p.name, unit: p.unit };
                }).filter(p => p !== null)
            };
            if (products.length === 0) {
                showModal('No products found for the selected sector.', 'erro');
            }
            populateCategories(productData);
        } catch (error) {
            console.error("Error loading products:", error);
            showModal('Error loading products from server.', 'erro');
        }
    }

    fetchSectors();

    // ────── CATEGORIES ──────
    function populateCategories(products) {
        categorySelect.innerHTML = '<option value="">All Categories</option>';
        if (products) {
            Object.keys(products).forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                categorySelect.appendChild(option);
            });
        }
    }

    // ────── FILTER & DISPLAY ──────
    function filterAndDisplayProducts() {
        const sector = sectorSelect.value;
        const category = categorySelect.value;
        const query = productSearch.value.toLowerCase();
        
        if (!sector) return;

        const allProductsInSector = Object.values(productData).flat();
        let productsToFilter = allProductsInSector;

        if (category) {
            productsToFilter = productData[category] || [];
        }

        let results = productsToFilter;
        if (query.length > 1) {
            results = productsToFilter.filter(p => p.name.toLowerCase().includes(query));
        }
        
        displaySearchResults(results);
    }

    sectorSelect.addEventListener('change', (e) => {
        const selectedSector = e.target.value;
        if (selectedSector) {
            fetchProducts(selectedSector);
        } else {
            categorySelect.innerHTML = '<option value="">All Categories</option>';
        }
        searchResults.innerHTML = '';
        selectedProducts = [];
        renderSelectedProducts();
        hideModal();
    });

    categorySelect.addEventListener('change', () => {
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
            searchResults.innerHTML = '<p class="search-info">No products found.</p>';
            return;
        }

        results.forEach(p => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-item';
            resultItem.innerHTML = `
                <span>${p.name} (${p.unit})</span>
                <div class="add-item-controls">
                    <input type="number" value="1" min="1">
                    <button class="add-btn" data-id="${p.id}" data-name="${p.name}" data-unit="${p.unit}">Add</button>
                </div>
            `;
            searchResults.appendChild(resultItem);
        });
    }

    // ────── ADD PRODUCT + TOAST ──────
    searchResults.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-btn')) {
            const id = e.target.dataset.id;
            const name = e.target.dataset.name;
            const unit = e.target.dataset.unit;
            const quantityInput = e.target.previousElementSibling;
            const quantity = parseInt(quantityInput.value);

            if (!id || !name || !unit) {
                showModal('Error: Product with invalid data.', 'erro');
                return;
            }

            if (quantity > 0) {
                const existingProduct = selectedProducts.find(p => p.id === id);
                if (existingProduct) {
                    existingProduct.quantity += quantity;
                    showToast(`+${quantity} ${name} added!`);
                } else {
                    selectedProducts.push({ id, name, unit, quantity });
                    showToast(`${name} added to the list!`);
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
            selectedProductsList.innerHTML = '<li class="no-items">No products added.</li>';
        } else {
            selectedProducts.forEach(p => {
                const li = document.createElement('li');
                li.className = 'selected-item';
                li.innerHTML = `
                    <span>${p.name} (${p.unit}) - Qty: ${p.quantity}</span>
                    <button class="remove-btn" data-id="${p.id}">Remove</button>
                `;
                selectedProductsList.appendChild(li);
            });
        }
    }
    
    // ────── CONFIRM ──────
    document.getElementById('btn-confirm').addEventListener('click', () => {
        const sector = sectorSelect.value;
        const shiftButton = document.querySelector('.shift-button.selected');
        const employee = document.getElementById('employee').value;
        const supervisor = document.getElementById('supervisor').value;
        const notes = notesInput.value;

        if (!sector || !shiftButton || !employee || !supervisor) {
            showModal('Please fill in all required fields.', 'erro');
            return;
        }
        
        if (selectedProducts.length === 0) {
            showModal('Please add at least one product to the list.', 'erro');
            return;
        }

        const shift = shiftButton.querySelector('input').value;
        
        document.getElementById('confirm-sector').textContent = sector;
        document.getElementById('confirm-shift').textContent = shift;
        document.getElementById('confirm-date').textContent = dateInput.value;
        document.getElementById('confirm-time').textContent = timeInput.value;
        document.getElementById('confirm-employee').textContent = employee;
        document.getElementById('confirm-supervisor').textContent = supervisor;

        const confirmProductsList = document.getElementById('confirm-products');
        confirmProductsList.innerHTML = '';
        selectedProducts.forEach(p => {
            const li = document.createElement('li');
            li.textContent = `${p.name}: ${p.quantity} (${p.unit})`;
            confirmProductsList.appendChild(li);
        });

        if (notes.trim() !== '') {
            document.getElementById('confirm-notes').textContent = notes;
            document.getElementById('confirm-notes-section').style.display = 'block';
        } else {
            document.getElementById('confirm-notes').textContent = '';
            document.getElementById('confirm-notes-section').style.display = 'none';
        }

        formSection.style.display = 'none';
        confirmSection.style.display = 'block';
        hideModal();
    });

    // ────── BACK ──────
    document.getElementById('btn-back').addEventListener('click', () => {
        formSection.style.display = 'block';
        confirmSection.style.display = 'none';
    });

    // ────── SUBMIT (Send UTC) ──────
    document.getElementById('btn-submit').addEventListener('click', async () => {
        const sector = sectorSelect.value;
        const shift = document.querySelector('.shift-button.selected input').value;
        const employee = document.getElementById('employee').value;
        const supervisor = document.getElementById('supervisor').value;
        const date = dateInput.value; // "30/10/2025"
        const time = timeInput.value; // "15:51"
        const notes = notesInput.value;

        // ────── CONVERT LOCAL → UTC ──────
        const [day, month, year] = date.split('/');
        const [hour, minute] = time.split(':');
        const localDate = new Date(year, month - 1, day, hour, minute);
        const utcDate = new Date(localDate.getTime());
        const date_utc = utcDate.toISOString().slice(0, 10); // YYYY-MM-DD
        const time_utc = utcDate.toTimeString().slice(0, 5);  // HH:MM

        const requestPayload = {
            sector,
            shift,
            date: date_utc,
            time: time_utc,
            employee,
            supervisor,
            products: selectedProducts.map(p => ({
                id: p.id,
                quantity: p.quantity
            })),
            notes
        };

        console.log('Submitting (UTC):', date_utc, time_utc); // Debug

        try {
            const response = await fetch('/api/requests/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestPayload)
            });

            if (response.ok) {
                showModal('Request submitted successfully!', 'sucesso');
                // Reset form...
                document.getElementById('employee').value = '';
                document.getElementById('supervisor').value = '';
                document.getElementById('notes').value = '';
                document.querySelectorAll('.shift-button').forEach(btn => btn.classList.remove('selected'));
                selectedProducts = [];
                renderSelectedProducts();
                sectorSelect.value = '';
                categorySelect.innerHTML = '<option value="">All Categories</option>';
                productSearch.value = '';
                formSection.style.display = 'block';
                confirmSection.style.display = 'none';
                setTimeout(() => location.reload(), 1500);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Unknown error');
            }
        } catch (error) {
            showModal(`Error: ${error.message}`, 'erro');
        }
    });
});
