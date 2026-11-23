
const productsList = document.getElementById("productsList");
const salesList = document.getElementById("salesList");
const productModal = document.getElementById("productModal");
const productForm = document.getElementById("productForm");
const searchInput = document.getElementById("searchProduct");

let products = JSON.parse(localStorage.getItem("products")) || [];
let sales = JSON.parse(localStorage.getItem("sales")) || [];

let chart = null;
let selectedImage = "";

// =====================================
// SALVAR DADOS
// =====================================

function saveProducts() {
    localStorage.setItem("products", JSON.stringify(products));
}

function saveSales() {
    localStorage.setItem("sales", JSON.stringify(sales));
}

// =====================================
// FORMATAÇÃO DE VALORES
// =====================================

function formatMoney(value) {
    return Number(value).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

// =====================================
// RENDERIZAR PRODUTOS
// =====================================

function renderProducts(search = "") {
    productsList.innerHTML = "";

    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(search.toLowerCase())
    );

    if (filteredProducts.length === 0) {
        productsList.innerHTML = `
            <p style="color: #a8aec8; text-align: center; padding: 20px;">
                Nenhum produto encontrado.
            </p>
        `;
        return;
    }

    filteredProducts.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";

        card.innerHTML = `
            <img
                src="${product.image || "https://placehold.co/100x100/171b2d/ffffff?text=Produto"}"
                class="product-image"
                alt="${product.name}"
            >

            <div class="product-info">
                <h3>${escapeHTML(product.name)}</h3>
                <p>${formatMoney(product.price)}</p>
            </div>

            <div class="product-actions">
                <button class="icon-btn edit-btn" title="Editar"
                    onclick="editProduct('${product.id}')">
                    ✏️
                </button>

                <button class="icon-btn delete-btn" title="Excluir"
                    onclick="deleteProduct('${product.id}')">
                    🗑️
                </button>
            </div>
        `;

        productsList.appendChild(card);
    });
}

// =====================================
// RENDERIZAR VENDA
// =====================================

function renderSales() {
    salesList.innerHTML = "";

    products.forEach(product => {
        const quantity = Number(product.quantity) || 0;

        const item = document.createElement("div");
        item.className = "sale-item";

        item.innerHTML = `
            <img
                src="${product.image || "https://placehold.co/100x100/171b2d/ffffff?text=Produto"}"
                class="product-image"
                alt="${product.name}"
            >

            <div class="sale-item-info">
                <h3>${escapeHTML(product.name)}</h3>
                <p>${formatMoney(product.price)} cada</p>
            </div>

            <div class="quantity-controls">
                <button onclick="changeQuantity('${product.id}', -1)">−</button>

                <span class="quantity">${quantity}</span>

                <button onclick="changeQuantity('${product.id}', 1)">+</button>
            </div>
        `;

        salesList.appendChild(item);
    });

    updateCurrentTotal();
}

// =====================================
// ALTERAR QUANTIDADE
// =====================================

function changeQuantity(id, amount) {
    const product = products.find(p => p.id === id);

    if (!product) return;

    product.quantity = Math.max(
        0,
        (Number(product.quantity) || 0) + amount
    );

    renderSales();
    saveProducts();
}

// =====================================
// CALCULAR VENDA ATUAL
// =====================================

function updateCurrentTotal() {
    const total = products.reduce((sum, product) => {
        return sum + (product.price * (Number(product.quantity) || 0));
    }, 0);

    document.getElementById("currentTotal").textContent = formatMoney(total);
}

// =====================================
// FINALIZAR / CALCULAR VENDA
// =====================================

function calculateSale() {
    const soldProducts = products.filter(
        product => (Number(product.quantity) || 0) > 0
    );

    if (soldProducts.length === 0) {
        alert("Adicione pelo menos um produto à venda.");
        return;
    }

    const totalItems = soldProducts.reduce(
        (sum, product) => sum + Number(product.quantity), 0
    );

    const totalValue = soldProducts.reduce(
        (sum, product) => sum + (product.price * product.quantity), 0
    );

    // Registrar os produtos vendidos
    soldProducts.forEach(product => {
        const existingSale = sales.find(sale => sale.id === product.id);

        if (existingSale) {
            existingSale.quantity += Number(product.quantity);
            existingSale.total += product.price * product.quantity;
        } else {
            sales.push({
                id: product.id,
                name: product.name,
                price: product.price,
                quantity: Number(product.quantity),
                total: product.price * product.quantity
            });
        }
    });

    saveSales();

    // Atualizar os resultados
    updateResults();

    alert(
        `Venda calculada!\n\n` +
        `Itens vendidos: ${totalItems}\n` +
        `Valor recebido: ${formatMoney(totalValue)}`
    );

    // Zerar a quantidade da venda atual
    products.forEach(product => {
        product.quantity = 0;
    });

    saveProducts();

    renderSales();
    renderProducts();
}

// =====================================
// RESULTADOS
// =====================================

function updateResults() {
    const totalItems = sales.reduce(
        (sum, sale) => sum + sale.quantity, 0
    );

    const totalReceived = sales.reduce(
        (sum, sale) => sum + sale.total, 0
    );

    document.getElementById("totalItems").textContent = totalItems;

    document.getElementById("totalReceived").textContent =
        formatMoney(totalReceived);

    const bestSeller = [...sales].sort(
        (a, b) => b.quantity - a.quantity
    )[0];

    document.getElementById("bestSeller").textContent =
        bestSeller
            ? `${bestSeller.name} (${bestSeller.quantity})`
            : "---";

    updateChart();
}

// =====================================
// GRÁFICO
// =====================================

function updateChart() {
    const canvas = document.getElementById("salesChart");
    const message = document.getElementById("chartMessage");

    const soldProducts = sales.filter(sale => sale.quantity > 0);

    if (soldProducts.length === 0) {
        message.style.display = "block";

        if (chart) {
            chart.destroy();
            chart = null;
        }

        return;
    }

    message.style.display = "none";

    if (chart) {
        chart.destroy();
    }

    chart = new Chart(canvas, {
        type: "pie",

        data: {
            labels: soldProducts.map(sale => sale.name),

            datasets: [{
                data: soldProducts.map(sale => sale.quantity),

                backgroundColor: [
                    "#823cff",
                    "#2196f3",
                    "#ff9800",
                    "#20c997",
                    "#ff4d63",
                    "#e84393",
                    "#00bcd4",
                    "#9c27b0",
                    "#cddc39",
                    "#607d8b"
                ],

                borderColor: "#171b2d",
                borderWidth: 3
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: true,

            plugins: {
                legend: {
                    position: "bottom",

                    labels: {
                        color: "#c4c9df",
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },

                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;

                            const total = context.dataset.data.reduce(
                                (sum, number) => sum + number, 0
                            );

                            const percentage = ((value / total) * 100).toFixed(1);

                            return ` ${value} unidades (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// =====================================
// CADASTRAR PRODUTO
// =====================================

function openModal() {
    productForm.reset();

    document.getElementById("productId").value = "";
    document.getElementById("modalTitle").textContent = "Novo Produto";

    selectedImage = "";

    document.getElementById("imagePreview").innerHTML = "";

    productModal.classList.add("active");
}

function closeModal() {
    productModal.classList.remove("active");
}

// =====================================
// EDITAR PRODUTO
// =====================================

function editProduct(id) {
    const product = products.find(p => p.id === id);

    if (!product) return;

    document.getElementById("productId").value = product.id;
    document.getElementById("productName").value = product.name;
    document.getElementById("productPrice").value = product.price;

    document.getElementById("modalTitle").textContent = "Editar Produto";

    selectedImage = product.image || "";

    document.getElementById("imagePreview").innerHTML =
        selectedImage
            ? `<img src="${selectedImage}" alt="Preview">`
            : "";

    productModal.classList.add("active");
}

// =====================================
// SALVAR PRODUTO
// =====================================

productForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const id = document.getElementById("productId").value;
    const name = document.getElementById("productName").value.trim();
    const price = Number(document.getElementById("productPrice").value);

    if (!name || price <= 0) {
        alert("Informe um nome e preço válido.");
        return;
    }

    if (id) {
        const product = products.find(p => p.id === id);

        if (product) {
            product.name = name;
            product.price = price;
            product.image = selectedImage;
        }
    } else {
        products.push({
            id: crypto.randomUUID(),
            name,
            price,
            image: selectedImage,
            quantity: 0
        });
    }

    saveProducts();

    renderProducts();
    renderSales();

    closeModal();
});

// =====================================
// EXCLUIR PRODUTO
// =====================================

function deleteProduct(id) {
    const confirmDelete = confirm("Deseja realmente excluir este produto?");

    if (!confirmDelete) return;

    products = products.filter(product => product.id !== id);
    sales = sales.filter(sale => sale.id !== id);

    saveProducts();
    saveSales();

    renderProducts();
    renderSales();
    updateResults();
}

// =====================================
// IMAGEM DO PRODUTO
// =====================================

document.getElementById("productImage").addEventListener("change", function(event) {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Selecione uma imagem válida.");
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        selectedImage = e.target.result;

        document.getElementById("imagePreview").innerHTML = `
            <img src="${selectedImage}" alt="Preview">
        `;
    };

    reader.readAsDataURL(file);
});

// =====================================
// BUSCAR PRODUTOS
// =====================================

searchInput.addEventListener("input", function() {
    renderProducts(this.value);
});

// =====================================
// LIMPAR VENDA ATUAL
// =====================================

function resetSales() {
    const confirmReset = confirm(
        "Deseja zerar todos os resultados de vendas?"
    );

    if (!confirmReset) return;

    sales = [];

    products.forEach(product => {
        product.quantity = 0;
    });

    saveSales();
    saveProducts();

    renderProducts();
    renderSales();
    updateResults();
}

// =====================================
// PROTEÇÃO BÁSICA CONTRA HTML
// =====================================

function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, function(character) {
        const map = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return map[character];
    });
}

// =====================================
// INICIALIZAÇÃO
// =====================================

renderProducts();
renderSales();
updateResults();
