
import { supabase } from "./supabase.js";

// =====================================
// ELEMENTOS E VARIÁVEIS
// =====================================

const loginScreen = document.getElementById("loginScreen");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const loginButton = document.getElementById("loginButton");

const productsList = document.getElementById("productsList");
const salesList = document.getElementById("salesList");
const productModal = document.getElementById("productModal");
const productForm = document.getElementById("productForm");
const searchInput = document.getElementById("searchProduct");

let products = [];
let showArchivedProducts = false;
let sales = [];
let saleItems = [];
let chart = null;
let selectedImage = "";

const DAY_START_KEY = "minhaLoja_dayStart";
const CLOSURES_KEY = "minhaLoja_closures";

let dayStart = Number(localStorage.getItem(DAY_START_KEY));

if (!dayStart) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dayStart = today.getTime();
    localStorage.setItem(DAY_START_KEY, dayStart);
}

let dailyClosures = [];

try {
    dailyClosures = JSON.parse(
        localStorage.getItem(CLOSURES_KEY) || "[]"
    );
} catch (error) {
    console.error("Erro ao carregar fechamentos:", error);
    dailyClosures = [];
}

// =====================================
// FORMATAÇÃO
// =====================================

function formatMoney(value) {
    return Number(value).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function escapeHTML(text) {
    return String(text ?? "").replace(/[&<>"']/g, character => {
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

function getProductImage(product) {
    return product.image_url ||
        "https://placehold.co/100x100/171b2d/ffffff?text=Produto";
}

function dataOrEmpty(data) {
    return data || [];
}

// =====================================
// LOGIN
// =====================================

document.getElementById("togglePassword").addEventListener("click", () => {
    const password = document.getElementById("loginPassword");
    const button = document.getElementById("togglePassword");

    if (password.type === "password") {
        password.type = "text";
        button.textContent = "Ocultar";
    } else {
        password.type = "password";
        button.textContent = "Mostrar";
    }
});

loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    loginMessage.textContent = "";
    loginButton.disabled = true;
    loginButton.textContent = "Entrando...";

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        loginMessage.textContent = "E-mail ou senha incorretos.";
        loginButton.disabled = false;
        loginButton.textContent = "Entrar";
        return;
    }

    loginForm.reset();
    loginButton.disabled = false;
    loginButton.textContent = "Entrar";
});

async function checkLogin() {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        loginScreen.style.display = "none";
        await loadProducts();
        await loadHistory();
    } else {
        loginScreen.style.display = "flex";
    }
}

supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session) {
        loginScreen.style.display = "none";

        setTimeout(async () => {
            await loadProducts();
            await loadHistory();
        }, 0);
    }

    if (event === "SIGNED_OUT" || !session) {
        loginScreen.style.display = "flex";
    }
});

// =====================================
// CARREGAR PRODUTOS
// =====================================

async function loadProducts() {
    const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erro ao carregar produtos:", error);
        alert("Erro ao carregar produtos.");
        return;
    }

    products = (data || []).map(product => ({
        ...product,
        price: Number(product.price),
        quantity: 0,
        is_active: product.is_active ?? true
    }));

    renderProducts();
    renderSales();
}

// =====================================
// CARREGAR VENDAS
// =====================================

async function loadHistory() {
    const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select("*")
        .order("created_at", { ascending: false });

    if (salesError) {
        console.error(salesError);
        alert("Erro ao carregar vendas.");
        return;
    }

    const { data: itemsData, error: itemsError } = await supabase
        .from("sales_items")
        .select("*");

    if (itemsError) {
        console.error(itemsError);
        alert("Erro ao carregar itens das vendas.");
        return;
    }

    sales = dataOrEmpty(salesData);
    saleItems = dataOrEmpty(itemsData);

    renderHistory();
    updateResults();
}

// =====================================
// RENDERIZAR PRODUTOS
// =====================================

function renderProducts(search = "") {
    // Cria os filtros de produtos, caso ainda não existam
    let filters = document.getElementById("productStatusFilters");

    if (!filters) {
        filters = document.createElement("div");
        filters.id = "productStatusFilters";

        filters.style.display = "flex";
        filters.style.gap = "10px";
        filters.style.marginBottom = "15px";
        filters.style.flexWrap = "wrap";

        productsList.parentElement.insertBefore(filters, productsList);
    }

    filters.innerHTML = `
        <button id="showActiveProducts" class="filter-btn">
            Produtos ativos
        </button>

        <button id="showArchivedProducts" class="filter-btn">
            Arquivados
        </button>
    `;

    const activeButton = document.getElementById("showActiveProducts");
    const archivedButton = document.getElementById("showArchivedProducts");

    activeButton.style.background = !showArchivedProducts ? "#823cff" : "#252a40";
    archivedButton.style.background = showArchivedProducts ? "#823cff" : "#252a40";

    [activeButton, archivedButton].forEach(button => {
        button.style.color = "#fff";
        button.style.border = "none";
        button.style.padding = "10px 15px";
        button.style.borderRadius = "8px";
        button.style.cursor = "pointer";
    });

    activeButton.addEventListener("click", () => {
        showArchivedProducts = false;
        renderProducts(search);
    });

    archivedButton.addEventListener("click", () => {
        showArchivedProducts = true;
        renderProducts(search);
    });

    productsList.innerHTML = "";

    const filtered = products.filter(product => {
        const matchesStatus = showArchivedProducts
            ? !product.is_active
            : product.is_active;

        const matchesSearch = product.name
            .toLowerCase()
            .includes(search.toLowerCase());

        return matchesStatus && matchesSearch;
    });

    if (filtered.length === 0) {
        productsList.innerHTML = `
            <p style="color:#a8aec8;text-align:center;padding:20px">
                ${showArchivedProducts
                    ? "Nenhum produto arquivado."
                    : "Nenhum produto encontrado."}
            </p>
        `;
        return;
    }

    filtered.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";

        card.innerHTML = `
            <img
                src="${escapeHTML(getProductImage(product))}"
                class="product-image"
                alt="${escapeHTML(product.name)}"
            >

            <div class="product-info">
                <h3>${escapeHTML(product.name)}</h3>
                <p>${formatMoney(product.price)}</p>
            </div>

            <div class="product-actions">
                ${
                    product.is_active
                    ? `
                        <button class="icon-btn edit-btn" title="Editar">✏️</button>
                        <button class="icon-btn archive-btn" title="Arquivar">📦</button>
                    `
                    : `
                        <button class="icon-btn restore-btn" title="Reativar">↩️</button>
                        <button class="icon-btn delete-btn" title="Excluir definitivamente">🗑️</button>
                    `
                }
            </div>
        `;

        if (product.is_active) {
            card.querySelector(".edit-btn").addEventListener("click", () => {
                editProduct(product.id);
            });

            card.querySelector(".archive-btn").addEventListener("click", () => {
                archiveProduct(product.id);
            });
        } else {
            card.querySelector(".restore-btn").addEventListener("click", () => {
                restoreProduct(product.id);
            });

            card.querySelector(".delete-btn").addEventListener("click", () => {
                deleteProduct(product.id);
            });
        }

        productsList.appendChild(card);
    });
}

// =====================================
// VENDA ATUAL
// =====================================

function renderSales() {
    salesList.innerHTML = "";

    const activeProducts = products.filter(product => product.is_active);

    activeProducts.forEach(product => {
        const item = document.createElement("div");
        item.className = "sale-item";

        item.innerHTML = `
            <img
                src="${escapeHTML(getProductImage(product))}"
                class="product-image"
                alt="${escapeHTML(product.name)}"
            >

            <div class="sale-item-info">
                <h3>${escapeHTML(product.name)}</h3>
                <p>${formatMoney(product.price)} cada</p>
            </div>

            <div class="quantity-controls">
                <button class="decrease">−</button>
                <span class="quantity">${product.quantity}</span>
                <button class="increase">+</button>
            </div>
        `;

        item.querySelector(".decrease").addEventListener("click", () => {
            changeQuantity(product.id, -1);
        });

        item.querySelector(".increase").addEventListener("click", () => {
            changeQuantity(product.id, 1);
        });

        salesList.appendChild(item);
    });

    updateCurrentTotal();
}

function changeQuantity(id, amount) {
    const product = products.find(p => p.id === id);

    if (!product) return;

    product.quantity = Math.max(
        0,
        Number(product.quantity) + amount
    );

    renderSales();
}

function updateCurrentTotal() {
    const total = products.reduce((sum, product) => {
        return sum + product.price * product.quantity;
    }, 0);

    document.getElementById("currentTotal").textContent =
        formatMoney(total);
}

// =====================================
// CONFERIR VENDA
// =====================================

function calculateSale() {
    const soldProducts = products.filter(
        product => product.quantity > 0
    );

    if (soldProducts.length === 0) {
        alert("Adicione pelo menos um produto à venda.");
        return;
    }

    const totalItems = soldProducts.reduce(
        (sum, product) => sum + product.quantity,
        0
    );

    const total = soldProducts.reduce(
        (sum, product) => sum + product.price * product.quantity,
        0
    );

    alert(
        "Conferência da venda\n\n" +
        `Itens: ${totalItems}\n` +
        `Total: ${formatMoney(total)}\n\n` +
        "Nenhuma venda foi registrada."
    );
}

// =====================================
// FINALIZAR VENDA
// =====================================

async function finalizeSale() {
    const soldProducts = products.filter(
        product => product.quantity > 0
    );

    if (soldProducts.length === 0) {
        alert("Adicione pelo menos um produto à venda.");
        return;
    }

    const total = soldProducts.reduce(
        (sum, product) => sum + product.price * product.quantity,
        0
    );

    const totalItems = soldProducts.reduce(
        (sum, product) => sum + product.quantity,
        0
    );

    const confirmed = confirm(
        `Confirmar finalização da venda?\n\n` +
        `Quantidade: ${totalItems} unidades\n` +
        `Total: ${formatMoney(total)}`
    );

    if (!confirmed) return;

    const { data: newSale, error: saleError } = await supabase
        .from("sales")
        .insert([{ total }])
        .select()
        .single();

    if (saleError) {
        console.error(saleError);
        alert("Erro ao registrar a venda.");
        return;
    }

    const items = soldProducts.map(product => ({
        sale_id: newSale.id,
        product_id: product.id,
        product_name: product.name,
        quantity: Number(product.quantity),
        unit_price: Number(product.price),
        subtotal: Number(
            (product.price * product.quantity).toFixed(2)
        )
    }));

    const { error: itemsError } = await supabase
        .from("sales_items")
        .insert(items);

    if (itemsError) {
        console.error(itemsError);

        const { error: rollbackError } = await supabase
            .from("sales")
            .delete()
            .eq("id", newSale.id);

        if (rollbackError) {
            console.error("Erro ao desfazer venda:", rollbackError);
        }

        alert("Erro ao salvar os produtos da venda.");
        return;
    }

    products.forEach(product => {
        product.quantity = 0;
    });

    renderSales();
    await loadHistory();

    alert("Venda finalizada com sucesso!");
}

// =====================================
// HISTÓRICO DE VENDAS
// OCULTO, MAS MANTIDO NO SUPABASE
// =====================================

function renderHistory() {
    return;
}

// =====================================
// RESULTADOS
// =====================================

function updateResults() {
    const currentSales = sales.filter(sale =>
        new Date(sale.created_at).getTime() >= dayStart
    );

    const currentSaleIds = new Set(
        currentSales.map(sale => sale.id)
    );

    const currentItems = saleItems.filter(item =>
        currentSaleIds.has(item.sale_id)
    );

    const productTotals = {};

    currentItems.forEach(item => {
        const name = item.product_name;

        productTotals[name] =
            (productTotals[name] || 0) + Number(item.quantity);
    });

    const totalItems = currentItems.reduce(
        (sum, item) => sum + Number(item.quantity),
        0
    );

    const totalReceived = currentSales.reduce(
        (sum, sale) => sum + Number(sale.total),
        0
    );

    document.getElementById("totalItems").textContent = totalItems;

    document.getElementById("totalReceived").textContent =
        formatMoney(totalReceived);

    document.getElementById("totalSales").textContent =
        currentSales.length;

    const ranking = Object.entries(productTotals)
        .sort((a, b) => b[1] - a[1]);

    document.getElementById("bestSeller").textContent =
        ranking.length
            ? `${ranking[0][0]} (${ranking[0][1]})`
            : "---";

    updateChart(ranking);
}

// =====================================
// FECHAMENTOS ANTERIORES
// =====================================

function renderClosures() {
    const list = document.getElementById("closuresList");

    if (!list) return;

    if (dailyClosures.length === 0) {
        list.innerHTML = "<p>Nenhum dia finalizado ainda.</p>";
        return;
    }

    list.innerHTML = "";

    dailyClosures.forEach((closure, index) => {
        const card = document.createElement("div");
        card.className = "history-card";

        card.innerHTML = `
            <div class="history-header">
                <h3>Fechamento #${dailyClosures.length - index}</h3>
                <span>${escapeHTML(closure.date)}</span>
            </div>

            <div class="history-products">
                <div class="history-product">
                    <span>Vendas realizadas</span>
                    <span>${closure.totalSales}</span>
                </div>

                <div class="history-product">
                    <span>Itens vendidos</span>
                    <span>${closure.totalItems}</span>
                </div>

                <div class="history-product">
                    <span>Mais vendido</span>
                    <span>${escapeHTML(closure.bestSeller)}</span>
                </div>
            </div>

            <div class="history-total">
                <strong>Faturamento do dia</strong>
                <strong>${formatMoney(closure.totalReceived)}</strong>
            </div>
        `;

        list.appendChild(card);
    });
}

// =====================================
// FINALIZAR DIA
// =====================================

function finalizeDay() {
    const currentSales = sales.filter(sale =>
        new Date(sale.created_at).getTime() >= dayStart
    );

    if (currentSales.length === 0) {
        alert("Não existem vendas registradas neste expediente.");
        return;
    }

    const currentSaleIds = new Set(
        currentSales.map(sale => sale.id)
    );

    const currentItems = saleItems.filter(item =>
        currentSaleIds.has(item.sale_id)
    );

    const totalReceived = currentSales.reduce(
        (sum, sale) => sum + Number(sale.total),
        0
    );

    const totalItems = currentItems.reduce(
        (sum, item) => sum + Number(item.quantity),
        0
    );

    const productTotals = {};

    currentItems.forEach(item => {
        const name = item.product_name;

        productTotals[name] =
            (productTotals[name] || 0) + Number(item.quantity);
    });

    const ranking = Object.entries(productTotals)
        .sort((a, b) => b[1] - a[1]);

    const bestSeller = ranking.length
        ? `${ranking[0][0]} (${ranking[0][1]})`
        : "---";

    const confirmed = confirm(
        "FINALIZAR EXPEDIENTE?\n\n" +
        `Vendas: ${currentSales.length}\n` +
        `Itens vendidos: ${totalItems}\n` +
        `Faturamento: ${formatMoney(totalReceived)}\n` +
        `Mais vendido: ${bestSeller}\n\n` +
        "O resumo será salvo neste navegador e os indicadores serão zerados."
    );

    if (!confirmed) return;

    const closure = {
        date: new Date().toLocaleString("pt-BR"),
        totalSales: currentSales.length,
        totalItems,
        totalReceived,
        bestSeller
    };

    const updatedClosures = [closure, ...dailyClosures];
    const newDayStart = Date.now();

    try {
        localStorage.setItem(
            CLOSURES_KEY,
            JSON.stringify(updatedClosures)
        );

        localStorage.setItem(DAY_START_KEY, newDayStart);
    } catch (error) {
        console.error(error);
        alert("Não foi possível salvar o fechamento no navegador.");
        return;
    }

    dailyClosures = updatedClosures;
    dayStart = newDayStart;

    updateResults();
    renderClosures();

    alert("Expediente finalizado com sucesso!");
}

// =====================================
// GRÁFICO
// =====================================

function updateChart(ranking) {
    const canvas = document.getElementById("salesChart");
    const message = document.getElementById("chartMessage");

    if (!canvas || !message) return;

    if (chart) {
        chart.destroy();
        chart = null;
    }

    if (typeof Chart === "undefined") {
        message.style.display = "block";
        message.textContent = "Não foi possível carregar o gráfico.";
        console.error("Chart.js não foi carregado.");
        return;
    }

    if (!ranking || ranking.length === 0) {
        message.style.display = "block";
        message.textContent =
            "Registre uma venda para visualizar o gráfico.";
        return;
    }

    message.style.display = "none";

    chart = new Chart(canvas, {
        type: "pie",

        data: {
            labels: ranking.map(item => item[0]),

            datasets: [{
                data: ranking.map(item => item[1]),

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
                        padding: 15
                    }
                }
            }
        }
    });
}

// =====================================
// MODAL DE PRODUTO
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

    selectedImage = product.image_url || "";

    document.getElementById("imagePreview").innerHTML =
        selectedImage
            ? `<img src="${escapeHTML(selectedImage)}" alt="Preview">`
            : "";

    productModal.classList.add("active");
}

// =====================================
// SALVAR PRODUTO
// =====================================

productForm.addEventListener("submit", async event => {
    event.preventDefault();

    const id = document.getElementById("productId").value;
    const name = document.getElementById("productName").value.trim();
    const price = Number(
        document.getElementById("productPrice").value
    );

    if (!name || !Number.isFinite(price) || price <= 0) {
        alert("Informe um nome e preço válido.");
        return;
    }

    const productData = {
        name,
        price,
        image_url: selectedImage || null
    };

    let error;

    if (id) {
        ({ error } = await supabase
            .from("products")
            .update(productData)
            .eq("id", id));
    } else {
        ({ error } = await supabase
            .from("products")
            .insert([productData]));
    }

    if (error) {
        console.error(error);
        alert("Não foi possível salvar o produto.");
        return;
    }

    await loadProducts();
    closeModal();

    alert(id ? "Produto atualizado!" : "Produto cadastrado!");
});

// =====================================
// EXCLUIR PRODUTO
// =====================================

// =====================================
// ARQUIVAR PRODUTO
// =====================================

async function archiveProduct(id) {
    const product = products.find(p => p.id === id);

    if (!product) return;

    const confirmed = confirm(
        `Deseja arquivar "${product.name}"?\n\n` +
        "Ele deixará de aparecer nas vendas, mas seu histórico será preservado."
    );

    if (!confirmed) return;

    const { error } = await supabase
        .from("products")
        .update({ is_active: false })
        .eq("id", id);

    if (error) {
        console.error("Erro ao arquivar:", error);
        alert("Não foi possível arquivar o produto.");
        return;
    }

    await loadProducts();

    alert("Produto arquivado com sucesso!");
}


// =====================================
// REATIVAR PRODUTO
// =====================================

async function restoreProduct(id) {
    const product = products.find(p => p.id === id);

    if (!product) return;

    const confirmed = confirm(
        `Deseja reativar "${product.name}"?`
    );

    if (!confirmed) return;

    const { error } = await supabase
        .from("products")
        .update({ is_active: true })
        .eq("id", id);

    if (error) {
        console.error("Erro ao reativar:", error);
        alert("Não foi possível reativar o produto.");
        return;
    }

    showArchivedProducts = false;

    await loadProducts();

    alert("Produto reativado com sucesso!");
}


// =====================================
// EXCLUIR DEFINITIVAMENTE
// =====================================

async function deleteProduct(id) {
    const product = products.find(p => p.id === id);

    if (!product) return;

    const { count, error: checkError } = await supabase
        .from("sales_items")
        .select("*", { count: "exact", head: true })
        .eq("product_id", id);

    if (checkError) {
        console.error("Erro ao verificar vendas:", checkError);
        alert("Não foi possível verificar o histórico do produto.");
        return;
    }

    if (count > 0) {
        alert(
            "Este produto possui vendas registradas.\n\n" +
            "Por segurança, ele não pode ser excluído definitivamente.\n" +
            "Você pode mantê-lo arquivado."
        );
        return;
    }

    const confirmed = confirm(
        `Deseja excluir definitivamente "${product.name}"?\n\n` +
        "Essa ação não poderá ser desfeita."
    );

    if (!confirmed) return;

    const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Erro ao excluir:", error);
        alert("Não foi possível excluir o produto: " + error.message);
        return;
    }

    await loadProducts();

    alert("Produto excluído definitivamente!");
}

// =====================================
// IMAGEM DO PRODUTO
// =====================================

document.getElementById("productImage").addEventListener("change", event => {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Selecione uma imagem válida.");
        return;
    }

    const reader = new FileReader();

    reader.onload = event => {
        selectedImage = event.target.result;

        document.getElementById("imagePreview").innerHTML = `
            <img src="${selectedImage}" alt="Preview">
        `;
    };

    reader.readAsDataURL(file);
});

// =====================================
// BUSCAR PRODUTOS
// =====================================

searchInput.addEventListener("input", () => {
    renderProducts(searchInput.value);
});

// =====================================
// LIMPAR VENDA ATUAL
// =====================================



async function resetSales() {
    const currentSales = sales.filter(sale =>
        new Date(sale.created_at).getTime() >= dayStart
    );

    if (currentSales.length === 0) {
        alert("Não existem vendas para limpar neste expediente.");
        return;
    }

    const confirmed = confirm(
        "ATENÇÃO! Você deseja apagar os resultados deste expediente?\n\n" +
        "As vendas e seus respectivos itens serão excluídos permanentemente do Supabase.\n\n" +
        "Os produtos cadastrados e os fechamentos anteriores serão preservados."
    );

    if (!confirmed) return;

    const saleIds = currentSales.map(sale => sale.id);

    // 1. Apagar os itens das vendas atuais
    const { error: itemsError } = await supabase
        .from("sales_items")
        .delete()
        .in("sale_id", saleIds);

    if (itemsError) {
        console.error("Erro ao apagar itens:", itemsError);
        alert("Não foi possível apagar os itens das vendas.");
        return;
    }

    // 2. Apagar as vendas do expediente atual
    const { error: salesError } = await supabase
        .from("sales")
        .delete()
        .in("id", saleIds);

    if (salesError) {
        console.error("Erro ao apagar vendas:", salesError);
        alert("Os itens foram apagados, mas não foi possível apagar as vendas. Verifique o Supabase.");
        return;
    }

    // 3. Atualizar os dados locais
    sales = sales.filter(sale => !saleIds.includes(sale.id));

    saleItems = saleItems.filter(item =>
        !saleIds.includes(item.sale_id)
    );

    // 4. Zerar quantidades selecionadas
    products.forEach(product => {
        product.quantity = 0;
    });

    // 5. Atualizar a tela e o gráfico
    renderSales();
    updateResults();
    renderClosures();

    alert("Resultados do expediente apagados com sucesso!");
}



// =====================================
// FUNÇÕES DISPONÍVEIS NO HTML
// =====================================

window.openModal = openModal;
window.closeModal = closeModal;
window.calculateSale = calculateSale;
window.finalizeSale = finalizeSale;
window.finalizeDay = finalizeDay;
window.resetSales = resetSales;

// =====================================
// INICIALIZAÇÃO
// =====================================
async function initializeApp() {

    await checkLogin();
    renderClosures();
}

document.getElementById("resetSalesButton").addEventListener("click", resetSales);

initializeApp();
