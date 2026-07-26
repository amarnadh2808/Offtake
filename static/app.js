let masterData = [];
let authToken = null;

// DOM Elements - Delivery View
const deliveryView = document.getElementById('delivery-view');
const distSelect = document.getElementById('distributor');
const dsrSelect = document.getElementById('dsr');
const beatSelect = document.getElementById('beat');
const retSelect = document.getElementById('retailer');
const productPanel = document.getElementById('product-panel');
const productList = document.getElementById('product-list');
const submitBtn = document.getElementById('submit-btn');
const successMsg = document.getElementById('success-message');

// DOM Elements - Admin View
const adminView = document.getElementById('admin-view');
const headerSubtitle = document.getElementById('header-subtitle');
const adminAccessBtn = document.getElementById('admin-access-btn');
const loginModal = document.getElementById('login-modal');
const closeModalBtn = document.getElementById('close-modal');
const loginBtn = document.getElementById('login-btn');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');

// Admin actions
const downloadBtn = document.getElementById('download-btn');
const downloadMasterBtn = document.getElementById('download-master-btn');

// Custom Confirmation Modal
function showConfirmModal(message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    const msgDiv = document.getElementById('confirm-msg');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    const confirmBtn = document.getElementById('confirm-delete-btn');

    if (!modal) {
        if (confirm(message)) onConfirm();
        return;
    }

    msgDiv.textContent = message;
    modal.classList.remove('hidden');

    const cleanUp = () => {
        modal.classList.add('hidden');
        cancelBtn.removeEventListener('click', onCancel);
        confirmBtn.removeEventListener('click', onOk);
    };

    const onCancel = () => {
        cleanUp();
    };

    const onOk = () => {
        cleanUp();
        onConfirm();
    };

    cancelBtn.addEventListener('click', onCancel);
    confirmBtn.addEventListener('click', onOk);
}

async function init() {
    try {
        const response = await fetch('/api/data');
        masterData = await response.json();
        
        const distributors = [...new Set(masterData.map(item => item['Distributor Name']))].filter(Boolean);
        populateSelect(distSelect, distributors, 'SELECT DISTRIBUTOR');
        distSelect.disabled = false;
        
        renderAdminManagement();
    } catch (e) {
        console.error("Failed to load data", e);
        if (distSelect) distSelect.innerHTML = '<option value="">ERROR LOADING DATA</option>';
    }
}

function populateSelect(selectElement, optionsArray, placeholder) {
    if (!selectElement) return;
    selectElement.innerHTML = `<option value="">${placeholder}</option>`;
    optionsArray.sort().forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        selectElement.appendChild(option);
    });
}

function resetSelect(selectElement, placeholder) {
    if (!selectElement) return;
    selectElement.innerHTML = `<option value="">${placeholder}</option>`;
    selectElement.disabled = true;
}

// Cascading logic
if (distSelect) {
    distSelect.addEventListener('change', () => {
        const dist = distSelect.value;
        resetSelect(dsrSelect, 'SELECT DSR FIRST');
        resetSelect(beatSelect, 'SELECT DSR FIRST');
        resetSelect(retSelect, 'SELECT BEAT AREA FIRST');
        if (productPanel) productPanel.classList.add('hidden');
        if (successMsg) successMsg.classList.add('hidden');

        if (dist) {
            const filtered = masterData.filter(item => item['Distributor Name'] === dist);
            const dsrs = [...new Set(filtered.map(item => item['DSR Name']))].filter(Boolean);
            populateSelect(dsrSelect, dsrs, 'SELECT DSR');
            dsrSelect.disabled = false;
        }
    });
}

if (dsrSelect) {
    dsrSelect.addEventListener('change', () => {
        const dist = distSelect.value;
        const dsr = dsrSelect.value;
        resetSelect(beatSelect, 'SELECT BEAT AREA FIRST');
        resetSelect(retSelect, 'SELECT BEAT AREA FIRST');
        if (productPanel) productPanel.classList.add('hidden');
        if (successMsg) successMsg.classList.add('hidden');

        if (dsr) {
            const filtered = masterData.filter(item => item['Distributor Name'] === dist && item['DSR Name'] === dsr);
            const beats = [...new Set(filtered.map(item => item['beat_name']))].filter(Boolean);
            populateSelect(beatSelect, beats, 'SELECT BEAT AREA');
            beatSelect.disabled = false;
        }
    });
}

if (beatSelect) {
    beatSelect.addEventListener('change', () => {
        const dist = distSelect.value;
        const dsr = dsrSelect.value;
        const beat = beatSelect.value;
        resetSelect(retSelect, 'SELECT RETAILER');
        if (productPanel) productPanel.classList.add('hidden');
        if (successMsg) successMsg.classList.add('hidden');

        if (beat) {
            const filtered = masterData.filter(item => 
                item['Distributor Name'] === dist && 
                item['DSR Name'] === dsr &&
                item['beat_name'] === beat
            );
            const retailers = [...new Set(filtered.map(item => item['retailer_name']))].filter(Boolean);
            populateSelect(retSelect, retailers, 'SELECT RETAILER');
            retSelect.disabled = false;
        }
    });
}

if (retSelect) {
    retSelect.addEventListener('change', () => {
        const dist = distSelect.value;
        const dsr = dsrSelect.value;
        const beat = beatSelect.value;
        const ret = retSelect.value;
        if (successMsg) successMsg.classList.add('hidden');

        if (ret) {
            const products = masterData.filter(item => 
                item['Distributor Name'] === dist && 
                item['DSR Name'] === dsr &&
                item['beat_name'] === beat &&
                item['retailer_name'] === ret &&
                item['parent_material_desc']
            );
            renderProducts(products);
        } else {
            if (productPanel) productPanel.classList.add('hidden');
        }
    });
}

function renderProducts(products) {
    if (!productList) return;
    productList.innerHTML = '';
    products.forEach((prod, index) => {
        const div = document.createElement('div');
        div.className = 'product-item';
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let monthBoxes = '';
        let calcTotal = 0;
        months.forEach(m => {
            const val = prod[m] || 0;
            calcTotal += val;
            monthBoxes += `<div class="stat-box"><div class="stat-label">${m.toUpperCase()}</div><div class="stat-value">${val}</div></div>`;
        });
        const total = prod['Total'] !== undefined && prod['Total'] !== null ? prod['Total'] : calcTotal;
        const yearText = prod['Year'] ? ` | YEAR: ${prod['Year']}` : '';

        div.innerHTML = `
            <div class="product-name">${prod['parent_material_desc']}</div>
            <div class="product-sku">SKU: ${prod['club_sku'] || 'N/A'}${yearText}</div>
            <div class="sales-grid">
                ${monthBoxes}
                <div class="stat-box"><div class="stat-label">TOTAL</div><div class="stat-value">${total}</div></div>
            </div>
            <div class="input-row">
                <label>CLOSING STOCK:</label>
                <input type="number" class="closing-stock-input" data-desc="${prod['parent_material_desc']}" data-sku="${prod['club_sku']}" min="0" placeholder="Enter stock count">
            </div>
        `;
        productList.appendChild(div);
    });
    if (productPanel) productPanel.classList.remove('hidden');
}

if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
        const inputs = document.querySelectorAll('.closing-stock-input');
        const productsData = [];
        
        let hasData = false;
        inputs.forEach(input => {
            if (input.value !== '') {
                hasData = true;
                productsData.push({
                    parent_material_desc: input.getAttribute('data-desc'),
                    club_sku: input.getAttribute('data-sku'),
                    closing_stock: parseInt(input.value)
                });
            }
        });

        if (!hasData) {
            alert("Please enter closing stock for at least one product.");
            return;
        }

        const payload = {
            distributor: distSelect.value,
            dsr: dsrSelect.value,
            beat_area: beatSelect.value,
            retailer: retSelect.value,
            products: productsData,
            timestamp: new Date().toISOString()
        };

        submitBtn.disabled = true;
        submitBtn.textContent = 'SUBMITTING...';

        try {
            const response = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                if (productPanel) productPanel.classList.add('hidden');
                if (successMsg) successMsg.classList.remove('hidden');
                retSelect.value = '';
            } else {
                alert("Failed to submit data.");
            }
        } catch (e) {
            alert("Network error.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'SUBMIT CLOSING STOCK';
        }
    });
}

// LOGIN LOGIC
if (adminAccessBtn) {
    adminAccessBtn.addEventListener('click', () => {
        if (authToken) {
            authToken = null;
            adminView.classList.add('hidden');
            deliveryView.classList.remove('hidden');
            headerSubtitle.textContent = 'STOCK TRACKING';
            adminAccessBtn.textContent = 'ADMIN ACCESS';
            return;
        }
        loginModal.classList.remove('hidden');
        loginError.classList.add('hidden');
    });
}

if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
        loginModal.classList.add('hidden');
    });
}

if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        const u = loginUsername.value;
        const p = loginPassword.value;
        
        loginBtn.textContent = "VERIFYING...";
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({username: u, password: p})
            });
            const data = await res.json();
            
            if (res.ok && data.token) {
                authToken = data.token;
                loginModal.classList.add('hidden');
                
                deliveryView.classList.add('hidden');
                adminView.classList.remove('hidden');
                headerSubtitle.textContent = 'ADMINISTRATION';
                adminAccessBtn.textContent = 'LOGOUT';
                
                loginUsername.value = '';
                loginPassword.value = '';
                renderAdminManagement();
            } else {
                loginError.classList.remove('hidden');
            }
        } catch(e) {
            loginError.classList.remove('hidden');
        } finally {
            loginBtn.textContent = "LOGIN";
        }
    });
}

// ADMIN PANEL FILE LOGIC
if (downloadBtn) {
    downloadBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/admin/download', {
                headers: { 'X-Admin-Key': authToken }
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'closing_stock_submissions.xlsx';
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } else {
                alert("Download failed. No submissions found.");
            }
        } catch(e) {
            alert("Network error.");
        }
    });
}

if (downloadMasterBtn) {
    downloadMasterBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/admin/download_master', {
                headers: { 'X-Admin-Key': authToken }
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'updated_master_data.xlsx';
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } else {
                alert("Download failed. Master file not found.");
            }
        } catch(e) {
            alert("Network error.");
        }
    });
}

// ACCORDION TOGGLING
const togglePanels = [
    { toggle: 'toggle-distributors', panel: 'panel-distributors' },
    { toggle: 'toggle-dsrs', panel: 'panel-dsrs' },
    { toggle: 'toggle-beats', panel: 'panel-beats' },
    { toggle: 'toggle-retailers', panel: 'panel-retailers' },
    { toggle: 'toggle-products', panel: 'panel-products' }
];

togglePanels.forEach(item => {
    const el = document.getElementById(item.toggle);
    const pan = document.getElementById(item.panel);
    if (el && pan) {
        el.addEventListener('click', () => {
            const icon = el.querySelector('.toggle-icon');
            if (pan.classList.contains('hidden')) {
                pan.classList.remove('hidden');
                if (icon) icon.textContent = '-';
            } else {
                pan.classList.add('hidden');
                if (icon) icon.textContent = '+';
            }
        });
    }
});

// SEARCH FILTER SETUP
function setupSearchFilter(inputId, listId) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    if (!input || !list) return;
    
    input.addEventListener('input', () => {
        // Split search query into individual words/tokens
        const queryWords = input.value.toLowerCase().trim().split(/\s+/).filter(w => w);
        const items = list.querySelectorAll('.entity-item');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            // Check if every word in the search query exists somewhere in the item text
            const matchesAll = queryWords.length === 0 || queryWords.every(word => text.includes(word));
            
            if (matchesAll) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    });
}

setupSearchFilter('search-distributor', 'list-distributor');
setupSearchFilter('search-dsr', 'list-dsr');
setupSearchFilter('search-beat', 'list-beat');
setupSearchFilter('search-retailer', 'list-retailer');
setupSearchFilter('search-product', 'list-product');

// ADMIN ENTITY MANAGEMENT RENDERING & LOGIC
function renderAdminManagement() {
    const distributors = [...new Set(masterData.map(i => i['Distributor Name']))].filter(Boolean).sort();
    const dsrs = [...new Set(masterData.map(i => i['DSR Name']))].filter(Boolean).sort();
    const beats = [...new Set(masterData.map(i => i['beat_name']))].filter(Boolean).sort();
    const retailers = [...new Set(masterData.map(i => i['retailer_name']))].filter(Boolean).sort();
    const products = masterData.filter(i => i['parent_material_desc'] && i['retailer_name']);

    const cntDist = document.getElementById('count-distributor');
    const cntDsr = document.getElementById('count-dsr');
    const cntBeat = document.getElementById('count-beat');
    const cntRet = document.getElementById('count-retailer');
    const cntProd = document.getElementById('count-product');
    if (cntDist) cntDist.textContent = distributors.length;
    if (cntDsr) cntDsr.textContent = dsrs.length;
    if (cntBeat) cntBeat.textContent = beats.length;
    if (cntRet) cntRet.textContent = retailers.length;
    if (cntProd) cntProd.textContent = products.length;

    renderEntityList('list-distributor', distributors, 'distributor');
    renderEntityList('list-dsr', dsrs, 'dsr');
    renderEntityList('list-beat', beats, 'beat');
    renderEntityList('list-retailer', retailers, 'retailer');
    renderProductList('list-product', products);

    populateSelect(document.getElementById('dsr-parent-select'), distributors, 'SELECT DISTRIBUTOR...');
    populateSelect(document.getElementById('beat-parent-select'), dsrs, 'SELECT DSR...');
    populateSelect(document.getElementById('retailer-parent-select'), beats, 'SELECT BEAT AREA...');
    populateSelect(document.getElementById('product-parent-select'), retailers, 'SELECT STORE (RETAILER)...');
}

function renderEntityList(listId, items, type) {
    const container = document.getElementById(listId);
    if (!container) return;
    container.innerHTML = '';
    
    if (items.length === 0) {
        container.innerHTML = '<p class="text-dark p-2">No records found.</p>';
        return;
    }

    items.forEach(name => {
        const row = document.createElement('div');
        row.className = 'entity-item';
        row.innerHTML = `
            <span class="entity-name">${name}</span>
            <button class="btn-small-danger" data-type="${type}" data-name="${name}">DELETE</button>
        `;
        container.appendChild(row);
    });

    // Attach custom confirm modal delete handlers
    container.querySelectorAll('.btn-small-danger').forEach(btn => {
        btn.addEventListener('click', () => {
            const entityType = btn.getAttribute('data-type');
            const entityName = btn.getAttribute('data-name');
            
            showConfirmModal(`Are you sure you want to permanently delete "${entityName}" from the ${entityType.toUpperCase()} list? Associated child records will also be removed.`, async () => {
                btn.textContent = 'DELETING...';
                btn.disabled = true;
                try {
                    const res = await fetch('/api/admin/entity', {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Admin-Key': authToken
                        },
                        body: JSON.stringify({ type: entityType, name: entityName })
                    });
                    const resData = await res.json();
                    if (res.ok) {
                        await init(); // Reload master data
                    } else {
                        alert(resData.error || 'Failed to delete entity.');
                        btn.textContent = 'DELETE';
                        btn.disabled = false;
                    }
                } catch(e) {
                    alert('Network error during deletion.');
                    btn.textContent = 'DELETE';
                    btn.disabled = false;
                }
            });
        });
    });

    // Re-apply filter if search box has text
    const searchInp = document.getElementById('search-' + type);
    if (searchInp && searchInp.value.trim() !== '') {
        searchInp.dispatchEvent(new Event('input'));
    }
}

function renderProductList(listId, items) {
    const container = document.getElementById(listId);
    if (!container) return;
    container.innerHTML = '';
    if (items.length === 0) {
        container.innerHTML = '<p class="text-dark p-2">No store products found.</p>';
        return;
    }
    items.forEach(prod => {
        const name = prod['parent_material_desc'];
        const store = prod['retailer_name'];
        const sku = prod['club_sku'] || 'N/A';
        const yearMeta = prod['Year'] ? ` | Year: ${prod['Year']}` : '';
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let calcTotal = 0;
        months.forEach(m => calcTotal += (prod[m] || 0));
        const amt = prod['Total'] !== undefined && prod['Total'] !== null ? prod['Total'] : calcTotal;
        
        const row = document.createElement('div');
        row.className = 'entity-item';
        row.innerHTML = `
            <div>
                <span class="entity-name">${name}</span>
                <span class="entity-meta">[Store: ${store} | SKU: ${sku}${yearMeta} | Amount: ${amt}]</span>
            </div>
            <button class="btn-small-danger" data-name="${name}" data-store="${store}">DELETE</button>
        `;
        container.appendChild(row);
    });
    
    container.querySelectorAll('.btn-small-danger').forEach(btn => {
        btn.addEventListener('click', () => {
            const entityName = btn.getAttribute('data-name');
            const storeName = btn.getAttribute('data-store');
            showConfirmModal(`Are you sure you want to permanently delete product "${entityName}" from store "${storeName}"?`, async () => {
                btn.textContent = 'DELETING...';
                btn.disabled = true;
                try {
                    const res = await fetch('/api/admin/entity', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': authToken },
                        body: JSON.stringify({ type: 'store_product', name: entityName, parent: storeName })
                    });
                    const resData = await res.json();
                    if (res.ok) {
                        await init();
                    } else {
                        alert(resData.error || 'Failed to delete product.');
                        btn.textContent = 'DELETE';
                        btn.disabled = false;
                    }
                } catch(e) {
                    alert('Network error.');
                    btn.textContent = 'DELETE';
                    btn.disabled = false;
                }
            });
        });
    });

    const searchInp = document.getElementById('search-product');
    if (searchInp && searchInp.value.trim() !== '') {
        searchInp.dispatchEvent(new Event('input'));
    }
}

// ADD ENTITY EVENT LISTENERS
function setupAddEntity(btnId, inputId, parentSelectId, type, parentRequiredName) {
    const btn = document.getElementById(btnId);
    const inp = document.getElementById(inputId);
    const parentSel = parentSelectId ? document.getElementById(parentSelectId) : null;

    if (btn && inp) {
        btn.addEventListener('click', async () => {
            const name = inp.value.trim();
            const parent = parentSel ? parentSel.value : '';

            if (!name) {
                alert(`Please enter a name for the new ${type}.`);
                return;
            }
            if (parentSelectId && !parent) {
                alert(`Please select a ${parentRequiredName} first so the ${type} links correctly.`);
                return;
            }

            btn.textContent = 'ADDING...';
            btn.disabled = true;
            try {
                const res = await fetch('/api/admin/entity', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Admin-Key': authToken
                    },
                    body: JSON.stringify({ type: type, name: name, parent: parent })
                });
                const resData = await res.json();
                if (res.ok) {
                    inp.value = '';
                    if (parentSel) parentSel.value = '';
                    await init(); // Reload data from backend and refresh UI
                } else {
                    alert(resData.error || `Failed to add ${type}.`);
                }
            } catch(e) {
                alert('Network error during addition.');
            } finally {
                btn.textContent = 'ADD';
                btn.disabled = false;
            }
        });
    }
}

setupAddEntity('add-distributor-btn', 'add-distributor-input', null, 'distributor', null);
setupAddEntity('add-dsr-btn', 'add-dsr-input', 'dsr-parent-select', 'dsr', 'Distributor');
setupAddEntity('add-beat-btn', 'add-beat-input', 'beat-parent-select', 'beat', 'DSR');
setupAddEntity('add-retailer-btn', 'add-retailer-input', 'retailer-parent-select', 'retailer', 'Beat Area');

// ADD STORE PRODUCT SPECIAL HANDLER
const addProdBtn = document.getElementById('add-product-btn');
if (addProdBtn) {
    addProdBtn.addEventListener('click', async () => {
        const parentSel = document.getElementById('product-parent-select');
        const nameInp = document.getElementById('add-product-input');
        const skuInp = document.getElementById('add-product-sku');
        const monthSel = document.getElementById('add-product-month');
        const yearSel = document.getElementById('add-product-year');
        const amtInp = document.getElementById('add-product-amount');
        
        const store = parentSel ? parentSel.value : '';
        const name = nameInp ? nameInp.value.trim() : '';
        const sku = skuInp ? skuInp.value.trim() : '';
        const month = monthSel ? monthSel.value : 'Total';
        const year = yearSel ? yearSel.value : '';
        const amount = amtInp ? amtInp.value.trim() : '0';
        
        if (!store) {
            alert("Please select a Store (Retailer) first.");
            return;
        }
        if (!name) {
            alert("Please enter a product description / name.");
            return;
        }
        
        addProdBtn.textContent = 'ADDING...';
        addProdBtn.disabled = true;
        try {
            const res = await fetch('/api/admin/entity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Key': authToken },
                body: JSON.stringify({ type: 'store_product', name: name, parent: store, sku: sku, amount: amount, month: month, year: year })
            });
            const resData = await res.json();
            if (res.ok) {
                if (nameInp) nameInp.value = '';
                if (skuInp) skuInp.value = '';
                if (amtInp) amtInp.value = '';
                if (monthSel) monthSel.value = 'Total';
                if (yearSel) yearSel.value = '';
                await init();
            } else {
                alert(resData.error || 'Failed to add product to store.');
            }
        } catch(e) {
            alert('Network error during product addition.');
        } finally {
            addProdBtn.textContent = 'ADD PRODUCT';
            addProdBtn.disabled = false;
        }
    });
}

// MASTER DATA BULK UPLOAD
const masterUploadBtn = document.getElementById('master-upload-btn');
const masterUploadInput = document.getElementById('master-upload-input');
if (masterUploadBtn && masterUploadInput) {
    masterUploadBtn.addEventListener('click', async () => {
        const file = masterUploadInput.files[0];
        if (!file) {
            alert("Please select an Excel file (.xlsx) first.");
            return;
        }
        
        showConfirmModal("WARNING: This will completely replace the entire master dataset on the website. Existing manual additions will be lost. Are you absolutely sure?", async () => {
            masterUploadBtn.textContent = 'UPLOADING...';
            masterUploadBtn.disabled = true;
            
            const formData = new FormData();
            formData.append('file', file);
            
            try {
                const res = await fetch('/api/admin/upload_master', {
                    method: 'POST',
                    headers: { 'X-Admin-Key': authToken },
                    body: formData
                });
                const resData = await res.json();
                
                if (res.ok) {
                    alert("Master Data updated successfully!");
                    masterUploadInput.value = '';
                    await init(); // Reload data across the site
                } else {
                    alert(resData.error || 'Failed to upload master data.');
                }
            } catch(e) {
                alert('Network error during upload.');
            } finally {
                masterUploadBtn.textContent = 'UPLOAD & OVERWRITE';
                masterUploadBtn.disabled = false;
            }
        });
    });
}

// Initialize app
init();
