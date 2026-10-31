
const { createClient } = window.supabase;

const supabaseClient = createClient(
  window.STORE_CONFIG.SUPABASE_URL,
  window.STORE_CONFIG.SUPABASE_ANON_KEY
);

const WHATSAPP_NUMBER = window.STORE_CONFIG.WHATSAPP_NUMBER;

let products = [];
let cart = [];
let currentProduct = null;
let selectedSize = null;
let modalQuantity = 1;

// LOS MÁS VENDIDOS
let bestSellerProducts = [];
let bestSellerPosition = 0;
let bestSellerTimer = null;

const $ = (selector) => document.querySelector(selector);

const money = (value) =>
  `${window.STORE_CONFIG.CURRENCY} ${Number(value || 0).toLocaleString("es-PY")}`;

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

// ------------------------------
// CARGAR PRODUCTOS
// ------------------------------

async function loadProducts() {
  const grid = $("#product-grid");
  if (!grid) return;

  grid.innerHTML = "<p>Cargando productos...</p>";

  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando productos:", error);
    grid.innerHTML = "<p>No se pudieron cargar los productos.</p>";
    return;
  }

  products = data || [];

  renderProducts();
  updateCategories();

  // Cargar el carrusel después de tener los productos activos.
  await loadBestSellers();
}

function getProductPrice(product) {
  if (product.sale_type === "ml") {
    return Number(product.price_5ml || product.price || 0);
  }

  return Number(product.price || 0);
}

function renderProducts() {
  const grid = $("#product-grid");
  if (!grid) return;

  const search = ($("#search")?.value || "").toLowerCase().trim();
  const category = $("#category-filter")?.value || "";

  const filtered = products.filter((product) => {
    const matchesSearch = [
      product.name,
      product.brand,
      product.description
    ].join(" ").toLowerCase().includes(search);

    const matchesCategory =
      !category || product.category === category;

    return matchesSearch && matchesCategory;
  });

  if (!filtered.length) {
    grid.innerHTML = "<p>No se encontraron productos.</p>";
    return;
  }

  grid.innerHTML = filtered.map((product) => {
    const price = getProductPrice(product);
    const stock = Number(product.stock || 0);

    const priceText = product.sale_type === "ml"
      ? `Desde ${money(price)}`
      : money(price);

    const image = product.image_url ||
      "https://placehold.co/600x600?text=RV+Parfums";

    return `
      <article
        class="product-card"
        data-open-product="${escapeHTML(product.id)}"
        role="button"
        tabindex="0"
        aria-label="Ver ${escapeHTML(product.name)}"
      >
        <div class="product-card-image">
          <img
            src="${escapeHTML(image)}"
            alt="${escapeHTML(product.name)}"
            loading="lazy"
          >
          ${stock <= 0
            ? '<span class="stock-badge">Agotado</span>'
            : ""}
        </div>

        <div class="product-card-info">
          <p class="product-brand">${escapeHTML(product.brand || "RV PARFUMS")}</p>
          <h3>${escapeHTML(product.name)}</h3>
          <p class="product-description">
            ${escapeHTML(product.description || "")}
          </p>
          <strong class="product-price">${priceText}</strong>
          <span class="product-view-link">Ver producto →</span>
        </div>
      </article>
    `;
  }).join("");
}

function updateCategories() {
  const select = $("#category-filter");
  if (!select) return;

  const currentValue = select.value;

  const categories = [...new Set(
    products.map((product) => product.category).filter(Boolean)
  )];

  select.innerHTML =
    '<option value="">Todas las categorías</option>' +
    categories.map((category) =>
      `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`
    ).join("");

  if (categories.includes(currentValue)) {
    select.value = currentValue;
  }
}

// ------------------------------
// LOS MÁS VENDIDOS
// ------------------------------

async function loadBestSellers() {
  const track = $("#bestsellers-track");

  if (!track) return;

  const { data, error } = await supabaseClient
    .from("bestsellers")
    .select("slot, product_id")
    .order("slot", { ascending: true });

  if (error) {
    console.error("Error cargando los más vendidos:", error);

    bestSellerProducts = [];
    renderBestSellers();
    return;
  }

  const slots = data || [];

  // Mantener exactamente seis posiciones.
  bestSellerProducts = Array.from({ length: 6 }, (_, index) => {
    const slot = slots.find(
      (item) => Number(item.slot) === index + 1
    );

    if (!slot || !slot.product_id) return null;

    // Solo mostrar productos activos que todavía existan.
    const product = products.find(
      (item) =>
        String(item.id) === String(slot.product_id) &&
        item.active === true
    );

    return product || null;
  });

  bestSellerPosition = 0;

  renderBestSellers();
  startBestSellerCarousel();
}

function renderBestSellers() {
  const track = $("#bestsellers-track");
  if (!track) return;

  // Se crean seis tarjetas, aunque no haya productos.
  track.innerHTML = bestSellerProducts.map((product, index) => {
    if (!product) {
      return `
        <article
          class="bestseller-card is-empty"
          aria-label="Espacio disponible"
          data-bestseller-slot="${index + 1}"
        >
          <div class="bestseller-empty-content">
            <span class="bestseller-empty-mark">RV</span>
            <span class="bestseller-empty-label">PRÓXIMAMENTE</span>
          </div>
        </article>
      `;
    }

    const image = product.image_url ||
      "https://placehold.co/600x600?text=RV+Parfums";

    const priceText = product.sale_type === "ml"
      ? `Desde ${money(getProductPrice(product))}`
      : money(getProductPrice(product));

    const stock = Number(product.stock || 0);

    return `
      <article
        class="product-card bestseller-card"
        data-bestseller-product="${escapeHTML(product.id)}"
        role="button"
        tabindex="0"
        aria-label="Ver ${escapeHTML(product.name)}"
      >
        <div class="product-card-image">
          <img
            src="${escapeHTML(image)}"
            alt="${escapeHTML(product.name)}"
            loading="lazy"
          >
          ${stock <= 0
            ? '<span class="stock-badge">Agotado</span>'
            : ""}
        </div>

        <div class="product-card-info">
          <p class="product-brand">
            ${escapeHTML(product.brand || "RV PARFUMS")}
          </p>

          <h3>${escapeHTML(product.name)}</h3>

          <p class="product-description">
            ${escapeHTML(product.description || "")}
          </p>

          <strong class="product-price">${priceText}</strong>

          <span class="product-view-link">Ver producto →</span>
        </div>
      </article>
    `;
  }).join("");

  updateBestSellerPosition();
  renderBestSellerDots();
}

function updateBestSellerPosition() {
  const track = $("#bestsellers-track");
  if (!track) return;

  // Cada tarjeta ocupa el 50% del carrusel.
  track.style.transform =
    `translateX(-${bestSellerPosition * 50}%)`;
}

function renderBestSellerDots() {
  const dots = $("#bestsellers-dots");
  if (!dots) return;

  dots.innerHTML = Array.from({ length: 6 }, (_, index) => `
    <span
      class="bestseller-dot ${index === bestSellerPosition ? "active" : ""}"
    ></span>
  `).join("");
}

function moveBestSellerCarousel() {
  const track = $("#bestsellers-track");

  if (!track || bestSellerProducts.length !== 6) return;

  // Una posición hacia la izquierda.
  bestSellerPosition = (bestSellerPosition + 1) % 6;

  updateBestSellerPosition();
  renderBestSellerDots();
}

function startBestSellerCarousel() {
  clearInterval(bestSellerTimer);

  bestSellerTimer = null;

  const track = $("#bestsellers-track");

  if (!track) return;

  // Movimiento incluso cuando los seis espacios están vacíos.
  bestSellerTimer = setInterval(() => {
    if (!document.hidden) {
      moveBestSellerCarousel();
    }
  }, 2000);
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && $("#bestsellers-track")) {
    // No reinicia el contador si ya está funcionando.
    if (!bestSellerTimer) {
      startBestSellerCarousel();
    }
  }
});

$("#bestsellers-track")?.addEventListener("click", (event) => {
  const card = event.target.closest("[data-bestseller-product]");

  if (!card) return;

  openProduct(card.dataset.bestsellerProduct);
});

$("#bestsellers-track")?.addEventListener("keydown", (event) => {
  if (
    event.key !== "Enter" &&
    event.key !== " "
  ) return;

  const card = event.target.closest("[data-bestseller-product]");

  if (!card) return;

  event.preventDefault();
  openProduct(card.dataset.bestsellerProduct);
});

// ------------------------------
// VENTANA DE DETALLES
// ------------------------------

function openProduct(id) {
  currentProduct = products.find(
    (product) => String(product.id) === String(id)
  );

  if (!currentProduct) return;

  selectedSize = null;
  modalQuantity = 1;

  $("#modal-product-image").src =
    currentProduct.image_url ||
    "https://placehold.co/600x600?text=RV+Parfums";

  $("#modal-product-image").alt = currentProduct.name || "";

  $("#modal-product-brand").textContent =
    currentProduct.brand || "RV PARFUMS";

  $("#modal-product-name").textContent =
    currentProduct.name || "";

  $("#modal-product-description").textContent =
    currentProduct.description || "";

  $("#modal-qty").textContent = modalQuantity;
  $("#modal-product-message").textContent = "";

  renderModalOptions();
  updateModalPrice();

  const overlay = $("#product-overlay");
  const modal = $("#product-modal");

  overlay?.classList.add("show");
  modal?.classList.add("open");

  overlay?.setAttribute("aria-hidden", "false");
  modal?.setAttribute("aria-hidden", "false");

  document.body.classList.add("modal-open");
}

function renderModalOptions() {
  const container = $("#modal-purchase-options");
  if (!container || !currentProduct) return;

  if (currentProduct.sale_type !== "ml") {
    selectedSize = null;
    container.innerHTML = "";
    return;
  }

  const price5 = Number(
    currentProduct.price_5ml || currentProduct.price || 0
  );

  const price10 = Number(currentProduct.price_10ml || 0);

  const options = [];

  if (price5 > 0) {
    options.push(`
      <button
        type="button"
        class="modal-size-option selected"
        data-modal-size="5"
      >
        <span>5 ml</span>
        <strong>${money(price5)}</strong>
      </button>
    `);
  }

  if (price10 > 0) {
    options.push(`
      <button
        type="button"
        class="modal-size-option"
        data-modal-size="10"
      >
        <span>10 ml</span>
        <strong>${money(price10)}</strong>
      </button>
    `);
  }

  container.innerHTML = `
    <p class="modal-options-title">ELEGÍ TU PRESENTACIÓN</p>
    <div class="modal-size-options">
      ${options.join("")}
    </div>
  `;

  selectedSize = price5 > 0
    ? "5 ml"
    : (price10 > 0 ? "10 ml" : null);
}

function getModalPrice() {
  if (!currentProduct) return 0;

  if (currentProduct.sale_type !== "ml") {
    return Number(currentProduct.price || 0);
  }

  if (selectedSize === "10 ml") {
    return Number(currentProduct.price_10ml || 0);
  }

  return Number(
    currentProduct.price_5ml || currentProduct.price || 0
  );
}

function updateModalPrice() {
  if (!currentProduct) return;

  $("#modal-product-price").textContent = money(getModalPrice());
  $("#modal-qty").textContent = modalQuantity;

  const addButton = $("#modal-add-to-cart");
  const stock = Number(currentProduct.stock || 0);

  if (addButton) {
    addButton.disabled = stock <= 0 || getModalPrice() <= 0;
  }

  const message = $("#modal-product-message");

  if (message) {
    message.textContent = stock <= 0
      ? "Este producto está agotado."
      : "";
  }
}

function closeProductModal() {
  $("#product-overlay")?.classList.remove("show");
  $("#product-modal")?.classList.remove("open");

  $("#product-overlay")?.setAttribute("aria-hidden", "true");
  $("#product-modal")?.setAttribute("aria-hidden", "true");

  document.body.classList.remove("modal-open");
  currentProduct = null;
}

// ------------------------------
// EVENTOS DE LA VENTANA
// ------------------------------

$("#product-grid")?.addEventListener("click", (event) => {
  const card = event.target.closest("[data-open-product]");
  if (card) openProduct(card.dataset.openProduct);
});

$("#product-grid")?.addEventListener("keydown", (event) => {
  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target.matches("[data-open-product]")
  ) {
    event.preventDefault();
    openProduct(event.target.dataset.openProduct);
  }
});

$("#modal-purchase-options")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-modal-size]");
  if (!button) return;

  selectedSize = `${button.dataset.modalSize} ml`;

  document.querySelectorAll(".modal-size-option").forEach((option) => {
    option.classList.toggle("selected", option === button);
  });

  updateModalPrice();
});

$("#modal-qty-minus")?.addEventListener("click", () => {
  modalQuantity = Math.max(1, modalQuantity - 1);
  updateModalPrice();
});

$("#modal-qty-plus")?.addEventListener("click", () => {
  if (!currentProduct) return;

  const stock = Number(currentProduct.stock || 0);

  if (modalQuantity < stock) {
    modalQuantity++;
    updateModalPrice();
  }
});

$("#modal-add-to-cart")?.addEventListener("click", () => {
  if (!currentProduct) return;
  addCurrentProductToCart();
});

$("#close-product-modal")?.addEventListener(
  "click",
  closeProductModal
);

$("#product-overlay")?.addEventListener(
  "click",
  closeProductModal
);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeProductModal();
  }
});

// ------------------------------
// CARRITO
// ------------------------------

function addCurrentProductToCart() {
  const product = currentProduct;
  if (!product) return;

  const price = getModalPrice();
  const stock = Number(product.stock || 0);

  if (price <= 0 || stock <= 0) {
    showToast("Este producto no está disponible.");
    return;
  }

  const key = `${product.id}-${selectedSize || "unit"}`;

  const existing = cart.find((item) => item.key === key);
  const currentQty = existing ? existing.qty : 0;

  if (currentQty + modalQuantity > stock) {
    showToast("No hay suficiente stock disponible.");
    return;
  }

  if (existing) {
    existing.qty += modalQuantity;
  } else {
    cart.push({
      key,
      id: product.id,
      name: product.name,
      size: selectedSize,
      price,
      qty: modalQuantity,
      stock
    });
  }

  renderCart();
  closeProductModal();
  showToast("Producto agregado al carrito.");
}

function renderCart() {
  const container = $("#cart-items");
  if (!container) return;

  if (!cart.length) {
    container.innerHTML = "<p>Tu carrito está vacío.</p>";
  } else {
    container.innerHTML = cart.map((item) => `
      <div class="cart-item">
        <div class="cart-item-info">
          <strong>${escapeHTML(item.name)}</strong>
          ${item.size
            ? `<span>${escapeHTML(item.size)}</span>`
            : ""}
          <span>${money(item.price)} c/u</span>
          <strong>${money(item.price * item.qty)}</strong>
        </div>

        <div class="qty">
          <button
            type="button"
            data-cart-minus="${escapeHTML(item.key)}"
            aria-label="Disminuir cantidad"
          >−</button>

          <span>${item.qty}</span>

          <button
            type="button"
            data-cart-plus="${escapeHTML(item.key)}"
            aria-label="Aumentar cantidad"
          >+</button>
        </div>

        <button
          type="button"
          class="cart-remove"
          data-cart-remove="${escapeHTML(item.key)}"
        >Eliminar</button>
      </div>
    `).join("");
  }

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );

  if ($("#cart-total")) {
    $("#cart-total").textContent = money(total);
  }

  if ($("#cart-count")) {
    $("#cart-count").textContent = cart.reduce(
      (sum, item) => sum + item.qty,
      0
    );
  }
}

$("#cart-items")?.addEventListener("click", (event) => {
  const minus = event.target.closest("[data-cart-minus]");
  const plus = event.target.closest("[data-cart-plus]");
  const remove = event.target.closest("[data-cart-remove]");

  if (minus) {
    const item = cart.find(
      (entry) => entry.key === minus.dataset.cartMinus
    );

    if (item) {
      item.qty--;

      if (item.qty <= 0) {
        cart = cart.filter((entry) => entry.key !== item.key);
      }
    }
  }

  if (plus) {
    const item = cart.find(
      (entry) => entry.key === plus.dataset.cartPlus
    );

    if (item && item.qty < item.stock) {
      item.qty++;
    } else if (item) {
      showToast("No hay más unidades disponibles.");
    }
  }

  if (remove) {
    cart = cart.filter(
      (entry) => entry.key !== remove.dataset.cartRemove
    );
  }

  renderCart();
});

// ------------------------------
// ABRIR Y CERRAR CARRITO
// ------------------------------

function openCart() {
  $("#cart-panel")?.classList.add("open");
  $("#cart-overlay")?.classList.add("show");
}

function closeCart() {
  $("#cart-panel")?.classList.remove("open");
  $("#cart-overlay")?.classList.remove("show");
}

$("#open-cart")?.addEventListener("click", openCart);
$("#close-cart")?.addEventListener("click", closeCart);
$("#cart-overlay")?.addEventListener("click", closeCart);

// ------------------------------
// BUSCADOR Y FILTROS
// ------------------------------

$("#search")?.addEventListener("input", renderProducts);
$("#category-filter")?.addEventListener("change", renderProducts);

// ------------------------------
// FINALIZAR COMPRA
// ------------------------------

$("#checkout-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!cart.length) {
    showToast("Tu carrito está vacío.");
    return;
  }

  const form = event.currentTarget;
  const formData = new FormData(form);

  const customerName = String(
    formData.get("customer") ||
    formData.get("customer_name") ||
    formData.get("name") ||
    ""
  ).trim();

  const phone = String(formData.get("phone") || "").trim();
  const address = String(formData.get("address") || "").trim();

  const notes = String(
    formData.get("message") ||
    formData.get("notes") ||
    ""
  ).trim();

  if (!customerName) {
    showToast("Por favor, escribí tu nombre completo.");
    return;
  }

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );

  const orderItems = cart.map((item) => ({
    id: item.id,
    name: item.name,
    size: item.size,
    price: item.price,
    quantity: item.qty
  }));

  const order = {
    customer_name: customerName,
    phone: phone,
    address: address,
    notes: notes,
    items: orderItems,
    total: total,
    status: "Pendiente"
  };

  const submitButton = form.querySelector('[type="submit"]');

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "PROCESANDO...";
  }

  try {
    const { error } = await supabaseClient
      .from("orders")
      .in
    const { error } = await supabaseClient
  .from("orders")
  .insert([order]);

if (error) {
  console.error("Error guardando el pedido:", error);
  showToast("No se pudo registrar el pedido. Intentá nuevamente.");
  return;
}

const messageLines = [
  `Hola, soy ${customerName}. Quiero realizar el siguiente pedido:`,
  "",
  ...orderItems.map((item) =>
    `• ${item.name}${item.size ? ` (${item.size})` : ""} x${item.quantity} — ${money(item.price * item.quantity)}`
  ),
  "",
  `TOTAL: ${money(total)}`,
  "",
  `Teléfono: ${phone || "No indicado"}`,
  `Dirección: ${address || "No indicada"}`,
  `Observaciones: ${notes || "Ninguna"}`
];

const whatsappURL =
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(messageLines.join("\n"))}`;

cart = [];
renderCart();
form.reset();

closeCart();
showToast("Pedido registrado correctamente.");

window.open(whatsappURL, "_blank");

} catch (error) {
  console.error("Error inesperado:", error);
  showToast("Ocurrió un error al procesar el pedido.");
} finally {
  if (submitButton) {
    submitButton.disabled = false;
    submitButton.textContent = "CONFIRMAR PEDIDO";
  }
}
});

// ------------------------------
// INICIALIZACIÓN
// ------------------------------

renderCart();
loadProducts();
