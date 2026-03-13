/* ---------- GLOBALS ---------- */
const sectorSelect = document.getElementById('filter-sector');
const productInput = document.getElementById('filter-product');
const startInput   = document.getElementById('filter-start');
const endInput     = document.getElementById('filter-end');
const tbody        = document.getElementById('report-table-body');
const pivotHead    = document.getElementById('pivot-head');
const pivotBody    = document.getElementById('pivot-body');
const detailSection = document.getElementById('daily-details');
const detailProduct = document.getElementById('detail-product');
const detailMonth   = document.getElementById('detail-month');
const detailBody    = document.getElementById('detail-items-body');
let currentData = [];
let chart = null;
let productSectorChart = null;

/* ---------- TOGGLE SUMMARY ---------- */
function toggleSummary() {
    const panel = document.getElementById('monthly-summary');
    const icon = document.getElementById('summary-toggle-icon');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        icon.name = 'chevron-up-outline';
        renderMonthlySummary();
    } else {
        panel.style.display = 'none';
        icon.name = 'chevron-down-outline';
    }
}
function closeDetails() {
    detailSection.style.display = 'none';
}

/* ---------- LOAD SECTORS ---------- */
async function loadSectors() {
    const res = await fetch('/api/sectors');
    const sectors = await res.json();
    sectorSelect.innerHTML = '<option value="">Todos os setores</option>';
    sectors.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        sectorSelect.appendChild(opt);
    });
}

/* ---------- FETCH REPORT ---------- */
async function loadReport() {
    const params = new URLSearchParams();
    if (sectorSelect.value) params.append('sector_id', sectorSelect.value);
    if (startInput.value)   params.append('start', startInput.value);
    if (endInput.value)     params.append('end',   endInput.value);
    const productFilter = productInput.value.trim();
    if (productFilter)      params.append('product', productFilter);

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Carregando...</td></tr>';

    try {
        const res = await fetch('/api/reports/approved-items?' + params);
        if (!res.ok) throw new Error('Erro na API');
        const rows = await res.json();
        currentData = rows;
        updateProductSectorSelect();

        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhum item encontrado.</td></tr>';
            return;
        }

        tbody.innerHTML = rows.map(r => `
            <tr data-request-id="${r.request_id}">
                <td>${r.request_id}</td>
                <td>${r.setor}</td>
                <td>${new Date(r.created_at).toLocaleString('pt-BR')}</td>
                <td>${r.produto}</td>
                <td>${r.quantidade}</td>
            </tr>
        `).join('');

        // Auto-open summary if visible
        if (document.getElementById('monthly-summary').style.display === 'block') {
            renderMonthlySummary();
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:red;">${e.message}</td></tr>`;
    }
}

/* ---------- RENDER MONTHLY SUMMARY ---------- */
function renderMonthlySummary() {
    if (!currentData.length) return;

    const grouped = {};
    currentData.forEach(r => {
        const date = new Date(r.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
        const key = `${r.produto}|||${monthKey}`;
        if (!grouped[key]) grouped[key] = { product: r.produto, month: monthKey, qty: 0, items: [] };
        grouped[key].qty += r.quantidade;
        grouped[key].items.push({ date: r.created_at.split('T')[0], request_id: r.request_id, qty: r.quantidade });
    });
    const entries = Object.values(grouped);

    const months = [...new Set(entries.map(e => e.month))].sort();
    const monthLabels = months.map(m => `${m.slice(5)}/${m.slice(0,4)}`);

    const productMap = {};
    entries.forEach(e => {
        if (!productMap[e.product]) productMap[e.product] = {};
        productMap[e.product][e.month] = e;
    });
    const products = Object.keys(productMap).sort();

    // === PIVOT TABLE ===
    const head = `<tr><th>Produto</th>${months.map(m => `<th>${monthLabels[months.indexOf(m)]}</th>`).join('')}<th>Total</th></tr>`;
    pivotHead.innerHTML = head;

    const maxQty = Math.max(...entries.map(e => e.qty), 1);
    const rows = products.map(prod => {
        let total = 0;
        const cells = months.map(month => {
            const e = productMap[prod][month];
            const qty = e ? e.qty : 0;
            total += qty;
            const intensity = e ? Math.min(255, Math.floor((qty / maxQty) * 200) + 55) : 255;
            const bg = e ? `rgb(91, 80, ${intensity})` : '#f9f9f9';
            return `<td style="background:${bg}; text-align:center; cursor:pointer;" 
                     onclick="showDaily('${prod}', '${month}')">${qty || '-'}</td>`;
        }).join('');
        return `<tr><td><strong>${prod}</strong></td>${cells}<td style="font-weight:bold;">${total}</td></tr>`;
    }).join('');
    pivotBody.innerHTML = rows;

    // === CHART ===
    const productColors = {
        'Parafuso M8': 'rgba(255, 99, 132, 0.6)',
        'Parafuso M10': 'rgba(54, 162, 235, 0.6)',
        'Porca M8': 'rgba(255, 206, 86, 0.6)',
        'Arame 2mm': 'rgba(75, 192, 192, 0.6)',
        'Tinta Azul': 'rgba(153, 102, 255, 0.6)',
        'Cimento': 'rgba(255, 159, 64, 0.6)',
        // Add more products as needed, or use dynamic generation
        default: 'rgba(91, 85, 227, 0.6)'
    };

    const datasets = products.map((prod, index) => ({
        label: prod,
        data: months.map(m => productMap[prod][m]?.qty || 0),
        backgroundColor: productColors[prod] || `hsl(${(index * 60) % 360}, 70%, 60%)`,
        borderColor: productColors[prod]?.replace('0.6', '1') || `hsl(${(index * 60) % 360}, 70%, 40%)`,
        borderWidth: 2
    }));

    const ctx = document.getElementById('monthlyChart').getContext('2d');
    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: 'bar', // vertical columns
        data: {
            labels: monthLabels, // months along the X-axis
            datasets: products.map((prod, index) => ({
                label: prod,
                data: months.map(m => productMap[prod][m]?.qty || 0),
                backgroundColor: productColors[prod] || `hsl(${(index * 50) % 360}, 70%, 60%)`,
                borderColor: productColors[prod]?.replace('0.6', '1') || `hsl(${(index * 50) % 360}, 70%, 40%)`,
                borderWidth: 1
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}`
                    }
                },
                title: {
                    display: true,
                    text: 'Consumo Mensal por Produto'
                }
            },
            scales: {
                x: {
                    stacked: false, // disable stacking for column view
                    title: {
                        display: true,
                        text: 'Mês'
                    }
                },
                y: {
                    beginAtZero: true,
                    stacked: false,
                    title: {
                        display: true,
                        text: 'Quantidade'
                    }
                }
            },
            onClick: (e, els) => {
                if (els.length) {
                    const { datasetIndex, index } = els[0];
                    showDaily(products[datasetIndex], months[index]);
                }
            }
        }
    });

}

/* ---------- DRILL-DOWN ---------- */
function showDaily(product, month) {
    const items = currentData
        .filter(r => r.produto === product && r.created_at.startsWith(month))
        .sort((a,b) => a.created_at.localeCompare(b.created_at));

    detailProduct.textContent = product;
    detailMonth.textContent = `${month.slice(5)}/${month.slice(0,4)}`;
    detailBody.innerHTML = items.map(r => `
        <tr><td>${r.created_at.split('T')[0].split('-').reverse().join('/')}</td>
            <td>${r.request_id}</td><td>${r.quantidade}</td></tr>
    `).join('');
    detailSection.style.display = 'block';
}

/* ---------- EXPORT TO CSV (RAW + SUMMARY) ---------- */
function exportToCSV() {
    if (!currentData.length) return alert('Nenhum dado.');

    // Raw data
    const rawCSV = [
        ['Req. ID', 'Setor', 'Data/Hora', 'Produto', 'Quantidade'],
        ...currentData.map(r => [
            r.request_id,
            r.setor,
            new Date(r.created_at).toLocaleString('pt-BR'),
            r.produto,
            r.quantidade
        ])
    ].map(r => r.join(',')).join('\n');

    // Summary
    const summary = groupByProductMonth(currentData);
    const months = [...new Set(summary.map(s => s.month))].sort();
    const summaryCSV = [
        ['Produto', ...months.map(m => `${m.slice(5)}/${m.slice(0,4)}`), 'Total'],
        ...Object.keys(Object.groupBy(summary, s => s.product)).map(prod => {
            let total = 0;
            const row = months.map(m => {
                const e = summary.find(s => s.product === prod && s.month === m);
                const qty = e ? e.qty : 0;
                total += qty;
                return qty;
            });
            row.unshift(prod); row.push(total);
            return row;
        })
    ].map(r => r.join(',')).join('\n');

    const fullCSV = `DADOS BRUTOS\n${rawCSV}\n\nRESUMO MENSAL\n${summaryCSV}`;
    downloadFile('\uFEFF' + fullCSV, 'text/csv', `relatorio_completo_${new Date().toISOString().slice(0,10)}.csv`);
}

/* ---------- EXPORT TO PDF (UPDATED) ---------- */
function exportToPDF() {
    if (!currentData.length) return alert('Nenhum dado.');

    if (typeof window.jspdf === 'undefined') return alert('PDF não carregado.');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const today = new Date().toLocaleDateString('pt-BR');

    doc.setFontSize(16);
    doc.text('Relatório Completo - Requisições Aprovadas', 14, 20);

    let y = 30;
    doc.setFontSize(10);
    const filters = [];
    if (sectorSelect.value) filters.push(`Setor: ${sectorSelect.selectedOptions[0].textContent}`);
    if (startInput.value) filters.push(`De: ${formatDate(startInput.value)}`);
    if (endInput.value) filters.push(`Até: ${formatDate(endInput.value)}`);
    if (filters.length) doc.text('Filtros: ' + filters.join(' | '), 14, y);
    y += 10;

    // Raw Table
    const rawData = currentData.map(r => [
        r.request_id, r.setor,
        new Date(r.created_at).toLocaleString('pt-BR'),
        r.produto, r.quantidade
    ]);
    doc.autoTable({
        head: [['Req. ID', 'Setor', 'Data/Hora', 'Produto', 'Qtd']],
        body: rawData,
        startY: y,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [91, 85, 227] }
    });

    // Summary Table
    const summary = groupByProductMonth(currentData);
    const months = [...new Set(summary.map(s => s.month))].sort();
    const monthLabels = months.map(m => `${m.slice(5)}/${m.slice(0,4)}`);
    const productMap = {};
    summary.forEach(s => { if (!productMap[s.product]) productMap[s.product] = {}; productMap[s.product][s.month] = s.qty; });
    const products = Object.keys(productMap).sort();

    const head = [['Produto', ...monthLabels, 'Total']];
    const body = products.map(p => {
        let total = 0;
        const row = months.map(m => { const q = productMap[p][m] || 0; total += q; return q; });
        row.unshift(p); row.push(total);
        return row;
    });

    doc.addPage();
    doc.autoTable({ head, body, startY: 20, theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [91, 85, 227] } });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 30, doc.internal.pageSize.getHeight() - 10);
    }

    doc.save(`relatorio_completo_${new Date().toISOString().slice(0,10)}.pdf`);
}

function groupByProductMonth(data) {
    const map = {};
    data.forEach(r => {
        const date = new Date(r.created_at);
        const month = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
        const key = `${r.produto}|||${month}`;
        if (!map[key]) map[key] = { product: r.produto, month, qty: 0 };
        map[key].qty += r.quantidade;
    });
    return Object.values(map);
}

function formatDate(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

function downloadFile(content, type, filename) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

/* ---------- PRODUCT BY SECTOR ---------- */
function toggleProductBySector() {
    const panel = document.getElementById('product-sector-panel');
    const icon  = document.getElementById('product-sector-toggle-icon');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        icon.name = 'chevron-up-outline';
    } else {
        panel.style.display = 'none';
        icon.name = 'chevron-down-outline';
    }
}

function updateProductSectorSelect() {
    const select = document.getElementById('product-sector-select');
    const current = select.value;
    const products = [...new Set(currentData.map(r => r.produto))].sort();
    select.innerHTML = '<option value="">Selecione um produto...</option>';
    products.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        if (p === current) opt.selected = true;
        select.appendChild(opt);
    });
}

async function loadProductBySector() {
    const product = document.getElementById('product-sector-select').value;
    if (!product) return;

    const params = new URLSearchParams({ product });
    if (startInput.value) params.append('start', startInput.value);
    if (endInput.value)   params.append('end',   endInput.value);

    const chartContainer = document.getElementById('product-sector-chart-container');
    const emptyMsg = document.getElementById('product-sector-empty');
    chartContainer.style.display = 'none';
    emptyMsg.style.display = 'none';

    try {
        const res = await fetch('/api/reports/product-by-sector?' + params);
        if (!res.ok) throw new Error('Erro na API');
        const data = await res.json();

        if (!data.length) {
            emptyMsg.style.display = 'block';
            return;
        }

        chartContainer.style.display = 'block';

        document.getElementById('product-sector-body').innerHTML = data.map(d =>
            `<tr><td>${d.setor}</td><td>${d.total}</td></tr>`
        ).join('');

        try {
            const ctx = document.getElementById('productSectorChart').getContext('2d');
            if (productSectorChart) productSectorChart.destroy();
            productSectorChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.map(d => d.setor),
                    datasets: [{
                        label: product,
                        data: data.map(d => d.total),
                        backgroundColor: 'rgba(91, 85, 227, 0.6)',
                        borderColor: 'rgba(91, 85, 227, 1)',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        title: {
                            display: true,
                            text: `Uso de "${product}" por Setor`
                        }
                    },
                    scales: {
                        x: { title: { display: true, text: 'Setor' } },
                        y: { beginAtZero: true, title: { display: true, text: 'Quantidade' } }
                    }
                }
            });
        } catch (_) {
            // Chart library unavailable; data table is still displayed
        }
} catch (e) {        
        chartContainer.style.display = 'none';
        emptyMsg.style.display = 'block';
        emptyMsg.textContent = e.message;
    }
}

/* ---------- INIT ---------- */
document.getElementById('btn-filter').onclick = loadReport;
document.getElementById('btn-export').onclick = exportToCSV;
document.getElementById('btn-export-pdf').onclick = exportToPDF;

window.addEventListener('DOMContentLoaded', () => {
    loadSectors();
    loadReport();
});
