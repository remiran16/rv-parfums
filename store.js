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

let featuredProducts = [];
let featuredIndex = 0;
let featuredTimer = null;

const $ = selector => document.querySelector(selector);

const money = value =>
  `${window.STORE_CONFIG.CURRENCY} ${Number(value || 0).toLocaleString("es-PY")}`;

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
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

// --------------------------------
// CARGAR PRODUCTOS
// --------------------------------

async function loadProducts() {
  const grid = $("#product-grid");
  if (!grid) return;

  grid.innerHTML = '<p class="loading">Cargando productos...</p>';

  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando productos:", error);
    grid.innerHTML = '<p class="notice">No se pudieron cargar los productos.</p>';
    return;
  }

  products = data || [];

  renderProducts();
  updateCategories();
  prepareFeatured();
}

function getProductPrice(product) {
  if (product.sale_type === "ml") {
    return Number(product.price_5ml || product.price || 0);
  }
  return Number(product.price || 0);
}

// --------------------------------
// CATÁLOGO Y CATEGORÍAS
// --------------------------------

function renderProducts() {
  const grid = $("#product-grid");
  if (!grid) return;

  const search = ($("#search")?.value || "").toLowerCase().trim();
  const category = $("#category-filter")?.value || "";

  const filtered = products.filter(product => {
    const text = [
      product.name,
      product.brand,
      product.description
    ].join(" ").toLowerCase();

    return text.includes(search) &&
      (!category || product.category === category);
  });

  if (!filtered.length) {
    grid.innerHTML = '<p class="notice">No se encontraron productos.</p>';
    return;
  }

  grid.innerHTML = filtered.map(product => {
    const price = getProductPrice(product);
    const stock = Number(product.stock || 0);
    const priceText = product.sale_type === "ml"
      ? `Desde ${money(price)}`
      : money(price);

    const image = product.image_url ||
      "https://placehold.co/600x600?text=RV+Parfums";

    return `
      <article class="product-card"
        data-open-product="${escapeHTML(product.id)}"
        role="button" tabindex="0">
        <div class="product-card-image">
          <img src="${escapeHTML(image)}"
            alt="${escapeHTML(product.name)}" loading="lazy">
          ${stock <= 0 ? '<span class="stock-badge">Agotado</span>' : ""}
        </div>
        <div class="product-card-info">
          <p class="product-brand">${escapeHTML(product.brand || "RV PARFUMS")}</p>
          <h3>${escapeHTML(product.name)}</h3>
          <p class="product-description">${escapeHTML(product.description || "")}</p>
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
    products.map(product => product.category).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "es"));

  select.innerHTML =
    '<option value="">Todas las categorías</option>' +
    categories.map(category =>
      `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`
    ).join("");

  if (categories.includes(currentValue)) {
    select.value = currentValue;
  }
}

// --------------------------------
// CARRUSEL DE DESTACADOS
// --------------------------------

function prepareFeatured() {
  featuredProducts = products.filter(product =>
    product.featured === true && product.active === true
  ).slice(0, 6);

  featuredIndex = 0;
  renderFeatured();
}

function visibleFeaturedCount() {
  if (window.innerWidth <= 650) return 1;
  if (window.innerWidth <= 950) return 2;
  return 3;
}

function renderFeatured() {
  const section = $("#destacados");
  const track = $("#featured-track");
  const dots = $("#featured-dots");

  if (!section || !track || !dots) return;

  if (!featuredProducts.length) {
    section.hidden = true;
    stopFeaturedTimer();
    return;
  }

  section.hidden = false;

  track.innerHTML = featuredProducts.map(product => {
    const image = product.image_url ||
      "https://placehold.co/600x600?text=RV+Parfums";

    const price = product.sale_type === "ml"
      ? `Desde ${money(getProductPrice(product))}`
      : money(getProductPrice(product));

    return `
      <article class="featured-card"
        data-open-product="${escapeHTML(product.id)}"
        role="button" tabindex="0">
        <div class="featured-card-image">
          <img src="${escapeHTML(image)}"
            alt="${escapeHTML(product.name)}" loading="lazy">
        </div>
        <div class="featured-card-info">
          <p class="product-brand">${escapeHTML(product.brand || "RV PARFUMS")}</p>
          <h3>${escapeHTML(product.name)}</h3>
          <strong>${price}</strong>
          <span>DESCUBRIR FRAGANCIA ↗</span>
        </div>
      </article>
    `;
  }).join("");

  const maxIndex = Math.max(
    0,
    featuredProducts.length - visibleFeaturedCount()
  );

  featuredIndex = Math.min(featuredIndex, maxIndex);

  dots.innerHTML = Array.from({ length: maxIndex + 1 }, (_, index) =>
    `<button type="button"
      class="featured-dot ${index === featuredIndex ? "active" : ""}"
      data-featured-dot="${index}"
      aria-label="Ir a la posición ${index + 1}"></button>`
  ).join("");

  updateFeaturedPosition();
  startFeaturedTimer();
}

function updateFeaturedPosition() {
  const track = $("#featured-track");
  const dots = $("#featured-dots");
  if (!track || !dots) return;

  const count = visibleFeaturedCount();
  const cardWidth = 100 / count;

  track.style.transform = `translateX(-${featuredIndex * cardWidth}%)`;

  dots.querySelectorAll(".featured-dot").forEach((dot, index) => {
    dot.classList.toggle("active", index === featuredIndex);
  });
}

function moveFeatured(direction) {
  const maxIndex = Math.max(
    0,
    featuredProducts.length - visibleFeaturedCount()
  );

  if (maxIndex <= 0) return;

  featuredIndex += direction;

  if (featuredIndex > maxIndex) featuredIndex = 0;
  if (featuredIndex < 0) featuredIndex = maxIndex;

  updateFeaturedPosition();
}

function startFeaturedTimer() {
  stopFeaturedTimer();

  if (featuredProducts.length <= visibleFeaturedCount()) return;

  featuredTimer = setInterval(() => {
    moveFeatured(1);
  }, 4500);
}

function stopFeaturedTimer() {
  if (featuredTimer) {
    clearInterval(featuredTimer);
    featuredTimer = null;
  }
}

$("#featured-prev")?.addEventListener("click", () => {
  moveFeatured(-1);
  startFeaturedTimer();
});

$("#featured-next")?.addEventListener("click", () => {
  moveFeatured(1);
  startFeaturedTimer();
});

$("#featured-dots")?.addEventListener("click", event => {
  const button = event.target.closest("[data-featured-dot]");
  if (!button) return;

  featuredIndex = Number(button.dataset.featuredDot);
  updateFeaturedPosition();
  startFeaturedTimer();
});

$("#featured-track")?.addEventListener("click", event => {
  const card = event.target.closest("[data-open-product]");
  if (card) openProduct(card.dataset.openProduct);
});

$("#featured-track")?.addEventListener("keydown", event => {
  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target.matches("[data-open-product]")
  ) {
    event.preventDefault();
    openProduct(event.target.dataset.openProduct);
  }
});

$("#featured-viewport")?.addEventListener("mouseenter", stopFeaturedTimer);
$("#featured-viewport")?.addEventListener("mouseleave", startFeaturedTimer);
$("#featured-viewport")?.addEventListener("touchstart", stopFeaturedTimer, { passive: true });
$("#featured-viewport")?.addEventListener("touchend", startFeaturedTimer, { passive: true });

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    featuredIndex = 0;
    renderFeatured();
  }, 200);
});

// --------------------------------
// VENTANA DE DETALLES
// --------------------------------

function openProduct(id) {
  currentProduct = products.find(
    product => String(product.id) === String(id)
  );

  if (!currentProduct) return;

  selectedSize = null;
  modalQuantity = 1;

  $("#modal-product-image").src =
    currentProduct.image_url ||
    "https://placehold.co/600x600?text=RV+Parfums";

  $("#modal-product-image").alt = currentProduct.name || "";
  $("#modal-product-brand").textContent = currentProduct.brand || "RV PARFUMS";
  $("#modal-product-name").textContent = currentProduct.name || "";
  $("#modal-product-description").textContent = currentProduct.description || "";
  $("#modal-qty").textContent = modalQuantity;
  $("#modal-product-message").textContent = "";

  renderModalOptions();
  updateModalPrice();

  $("#product-overlay")?.classList.add("show");
  $("#product-modal")?.classList.add("open");
  $("#product-overlay")?.setAttribute("aria-hidden", "false");
  $("#product-modal")?.setAttribute("aria-hidden", "false");

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

  const price5 = Number(currentProduct.price_5ml || currentProduct.price || 0);
  const price10 = Number(currentProduct.price_10ml || 0);
  const options = [];

  if (price5 > 0) {
    options.push(`
      <button type="button"
        class="modal-size-option selected"
        data-modal-size="5">
        <span>5 ml</span><strong>${money(price5)}</strong>
      </button>
    `);
  }

  if (price10 > 0) {
    options.push(`
      <button type="button"
        class="modal-size-option"
        data-modal-size="10">
        <span>10 ml</span><strong>${money(price10)}</strong>
      </button>
    `);
  }

  container.innerHTML = `
    <p class="modal-options-title">ELEGÍ TU PRESENTACIÓN</p>
    <div class="modal-size-options">${options.join("")}</div>
  `;

  selectedSize = price5 > 0 ? "5 ml" : (price10 > 0 ? "10 ml" : null);
}

function getModalPrice() {
  if (!currentProduct) return 0;

  if (currentProduct.sale_type !== "ml") {
    return Number(currentProduct.price || 0);
  }

  if (selectedSize === "10 ml") {
    return Number(currentProduct.price_10ml || 0);
  }

  return Number(currentProduct.price_5ml || currentProduct.price || 0);
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

  $("#modal-product-message").textContent =
    stock <= 0 ? "Este producto está agotado." : "";
}

function closeProductModal() {
  $("#product-overlay")?.classList.remove("show");
  $("#product-modal")?.classList.remove("open");
  $("#product-overlay")?.setAttribute("aria-hidden", "true");
  $("#product-modal")?.setAttribute("aria-hidden", "true");

  document.body.classList.remove("modal-open");
  currentProduct = null;
}

$("#product-grid")?.addEventListener("click", event => {
  const card = event.target.closest("[data-open-product]");
  if (card) openProduct(card.dataset.openProduct);
});

$("#product-grid")?.addEventListener("keydown", event => {
  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target.matches("[data-open-product]")
  ) {
    event.preventDefault();
    openProduct(event.target.dataset.openProduct);
  }
});

$("#modal-purchase-options")?.addEventListener("click", event => {
  const button = event.target.closest("[data-modal-size]");
  if (!button) return;

  selectedSize = `${button.dataset.modalSize} ml`;

  document.querySelectorAll(".modal-size-option").forEach(option => {
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
  if (currentProduct) addCurrentProductToCart();
});

$("#close-product-modal")?.addEventListener("click", closeProductModal);
$("#product-overlay")?.addEventListener("click", closeProductModal);

// --------------------------------
// CARRITO
// --------------------------------

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
  const existing = cart.find(item => item.key === key);
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
    container.innerHTML = '<p class="muted">Tu carrito está vacío.</p>';
  } else {
    container.innerHTML = cart.map(item => `
      <div class="cart-item">
        <div class="cart-item-info">
          <strong>${escapeHTML(item.name)}</strong>
          ${item.size ? `<span>${escapeHTML(item.size)}</span>` : ""}
          <span>${money(item.price)} c/u</span>
          <strong>${money(item.price * item.qty)}</strong>
        </div>
        <div class="qty">
          <button type="button" data-cart-minus="${escapeHTML(item.key)}">−</button>
          <span>${item.qty}</span>
          <button type="button" data-cart-plus="${escapeHTML(item.key)}">+</button>
        </div>
        <button type="button" class="cart-remove"
          data-cart-remove="${escapeHTML(item.key)}">Eliminar</button>
      </div>
    `).join("");
  }

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.qty, 0
  );

  $("#cart-total").textContent = money(total);
  $("#cart-count").textContent = cart.reduce(
    (sum, item) => sum + item.qty, 0
  );
}

$("#cart-items")?.addEventListener("click", event => {
  const minus = event.target.closest("[data-cart-minus]");
  const plus = event.target.closest("[data-cart-plus]");
  const remove = event.target.closest("[data-cart-remove]");

  if (minus) {
    const item = cart.find(entry => entry.key === minus.dataset.cartMinus);
    if (item) {
      item.qty--;
      if (item.qty <= 0) {
        cart = cart.filter(entry => entry.key !== item.key);
      }
    }
  }

  if (plus) {
    const item = cart.find(entry => entry.key === plus.dataset.cartPlus);
    if (item && item.qty < item.stock) {
      item.qty++;
    } else if (item) {
      showToast("No hay más unidades disponibles.");
    }
  }

  if (remove) {
    cart = cart.filter(entry => entry.key !== remove.dataset.cartRemove);
  }

  renderCart();
});

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

$("#search")?.addEventListener("input", renderProducts);
$("#category-filter")?.addEventListener("change", renderProducts);

// --------------------------------
// FINALIZAR COMPRA
// --------------------------------

$("#checkout-form")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!cart.length) {
    showToast("Tu carrito está vacío.");
    return;
  }

  const form = event.currentTarget;
  const formData = new FormData(form);

  // Coincide con los nombres del formulario actual.
  const customerName = String(formData.get("customer") || "").trim();
  const notes = String(formData.get("message") || "").trim();

  if (!customerName) {
    showToast("Ingresá tu nombre.");
    return;
  }

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.qty, 0
  );

  const orderItems = cart.map(item => ({
    id: item.id,
    name: item.name,
    size: item.size,
    price: item.price,
    quantity: item.qty
  }));

  const order = {
    customer_name: customerName,
    phone: "",
    address: "",
    notes,
    items: orderItems,
    total,
    status: "Pendiente"
  };

  const submitButton = form.querySelector('[type="submit"]');

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "PROCESANDO...";
  }

  const { error } = await supabaseClient
    .from("orders")
    .insert([order]);

  if (error) {
    console.error("Error guardando pedido:", error);
    showToast("No se pudo registrar el pedido. Intentá nuevamente.");

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "FINALIZAR POR WHATSAPP ↗";
    }
    return;
  }

  let message = `Hola, quiero realizar un pedido en RV Parfums.\n\n`;
  message += `Cliente: ${customerName}\n\n`;
  message += `PRODUCTOS:\n`;

  cart.forEach(item => {
    message += `- ${item.name}`;
    if (item.size) message += ` (${item.size})`;
    message += ` x${item.qty} = ${money(item.price * item.qty)}\n`;
  });

  message += `\nTOTAL: ${money(total)}`;

  if (notes) {
    message += `\n\nObservaciones: ${notes}`;
  }

  const whatsappURL =
    `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  cart = [];
  renderCart();
  form.reset();
  closeCart();

  if (submitButton) {
    submitButton.disabled = false;
    submitButton.textContent = "FINALIZAR POR WHATSAPP ↗";
  }

  window.location.href = whatsappURL;
});

// --------------------------------
// INICIO
// --------------------------------

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeProductModal();
    closeCart();
  }
});

if ($("#year")) {
  $("#year").textContent = new Date().getFullYear();
}

renderCart();
loadProducts();
