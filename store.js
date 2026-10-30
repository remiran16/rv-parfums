
(() => {
  const cfg = window.STORE_CONFIG || {};

  const db = (
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    window.supabase
  )
    ? window.supabase.createClient(
        cfg.SUPABASE_URL,
        cfg.SUPABASE_ANON_KEY
      )
    : null;

  const $ = (selector) => document.querySelector(selector);

  const money = (value) =>
    `${cfg.CURRENCY || "Gs."} ${Number(value || 0).toLocaleString("es-PY")}`;

  let products = [];
  let cart = [];

  function toast(message) {
    const element = $("#toast");

    if (!element) {
      alert(message);
      return;
    }

    element.textContent = message;
    element.classList.add("show");

    setTimeout(() => {
      element.classList.remove("show");
    }, 3000);
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  // CARGAR PRODUCTOS
  async function loadProducts() {
    const grid = $("#product-grid");

    if (!db) {
      grid.innerHTML =
        '<div class="notice">Error de conexión con la tienda.</div>';
      return;
    }

    const { data, error } = await db
      .from("products")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("ERROR PRODUCTOS:", error);
      grid.innerHTML =
        '<div class="notice">No se pudo cargar el catálogo.</div>';
      return;
    }

    products = data || [];

    renderProducts();

    const categories = [
      ...new Set(products.map(p => p.category).filter(Boolean))
    ].sort();

    $("#category-filter").innerHTML =
      '<option value="">Todas las categorías</option>' +
      categories.map(category =>
        `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
      ).join("");
  }

  // MOSTRAR PRODUCTOS
  function renderProducts() {
    const grid = $("#product-grid");
    const search = ($("#search").value || "").toLowerCase();
    const category = $("#category-filter").value;

    const found = products.filter(product => {
      const text =
        `${product.name} ${product.brand || ""} ${product.description || ""}`
          .toLowerCase();

      return text.includes(search) &&
        (!category || product.category === category);
    });

    grid.innerHTML = found.length
      ? found.map(product => `
        <article class="product-card">
          <div class="product-image">
            <img
              src="${escapeHtml(product.image_url || "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=700&q=80")}"
              alt="${escapeHtml(product.name)}"
              loading="lazy"
            >
            ${product.stock <= 0
              ? '<span class="sold-out">AGOTADO</span>'
              : ""}
          </div>

          <div class="product-info">
            <p class="product-brand">
              ${escapeHtml(product.brand || product.category || "FRAGANCIA")}
            </p>

            <h3>${escapeHtml(product.name)}</h3>

            <p class="product-desc">
              ${escapeHtml(product.description || "Una fragancia para destacar.")}
            </p>

            <div class="product-bottom">
              <strong>${money(product.price)}</strong>

              <button
                class="add-button"
                data-add="${escapeHtml(product.id)}"
                ${product.stock <= 0 ? "disabled" : ""}
              >
                ${product.stock <= 0 ? "SIN STOCK" : "＋ AGREGAR"}
              </button>
            </div>
          </div>
        </article>
      `).join("")
      : '<div class="notice">No encontramos productos.</div>';

    grid.querySelectorAll("[data-add]").forEach(button => {
      button.addEventListener("click", () => {
        addToCart(button.dataset.add);
      });
    });
  }

  // AGREGAR AL CARRITO
  function addToCart(id) {
    const product = products.find(
      p => String(p.id) === String(id)
    );

    if (!product) return;

    const item = cart.find(
      p => String(p.id) === String(id)
    );

    if (item) {
      if (item.qty >= product.stock) {
        return toast("No hay más unidades disponibles.");
      }

      item.qty++;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: Number(product.price),
        qty: 1,
        stock: Number(product.stock)
      });
    }

    renderCart();
    toast("¡Producto agregado al carrito!");
  }

  // MOSTRAR CARRITO
  function renderCart() {
    const count = cart.reduce(
      (sum, item) => sum + item.qty, 0
    );

    const total = cart.reduce(
      (sum, item) => sum + item.price * item.qty, 0
    );

    $("#cart-count").textContent = count;
    $("#cart-total").textContent = money(total);

    $("#cart-items").innerHTML = cart.length
      ? cart.map(item => `
        <div class="cart-line">
          <div>
            <b>${escapeHtml(item.name)}</b>
            <small>${money(item.price)} c/u</small>
          </div>

          <div class="qty">
            <button type="button" data-minus="${escapeHtml(item.id)}">−</button>
            <span>${item.qty}</span>
            <button type="button" data-plus="${escapeHtml(item.id)}">+</button>
          </div>

          <strong>${money(item.price * item.qty)}</strong>
        </div>
      `).join("")
      : '<p class="muted">Tu carrito está vacío.</p>';

    $("#cart-items").querySelectorAll("[data-minus]").forEach(button => {
      button.onclick = () => changeQty(button.dataset.minus, -1);
    });

    $("#cart-items").querySelectorAll("[data-plus]").forEach(button => {
      button.onclick = () => changeQty(button.dataset.plus, 1);
    });
  }

  // MODIFICAR CANTIDAD
  function changeQty(id, difference) {
    const item = cart.find(
      p => String(p.id) === String(id)
    );

    if (!item) return;

    if (difference > 0 && item.qty >= item.stock) {
      return toast("No hay más unidades disponibles.");
    }

    item.qty += difference;

    if (item.qty <= 0) {
      cart = cart.filter(
        p => String(p.id) !== String(id)
      );
    }

    renderCart();
  }

  // ABRIR Y CERRAR CARRITO
  function toggleCart(open) {
    $("#cart-panel").classList.toggle("open", open);
    $("#cart-overlay").classList.toggle("show", open);
  }

  // FINALIZAR COMPRA
  async function checkout(event) {
    event.preventDefault();

    if (!cart.length) {
      return toast("Tu carrito está vacío.");
    }

    if (!db) {
      return alert(
        "ERROR: No se pudo conectar con Supabase. Revisá config.js."
      );
    }

    const form = new FormData(event.target);

    const customer = String(
      form.get("customer") || ""
    ).trim();

    const message = String(
      form.get("message") || ""
    ).trim();

    if (!customer) {
      return toast("Escribí tu nombre completo.");
    }

    const number = String(
      cfg.WHATSAPP_NUMBER || ""
    ).replace(/\D/g, "");

    if (!number) {
      return toast("Falta configurar el WhatsApp.");
    }

    const items = cart.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.qty
    }));

    const total = cart.reduce(
      (sum, item) => sum + item.price * item.qty,
      0
    );

    const order = {
      customer_name: customer,
      phone: "",
      address: "",
      notes: message,
      items: items,
      total: total,
      status: "Nuevo"
    };

    const button = event.target.querySelector(
      'button[type="submit"]'
    );

    button.disabled = true;
    button.textContent = "REGISTRANDO PEDIDO...";

    try {
      // REGISTRAR PEDIDO EN SUPABASE
      const { data, error } = await db
        .from("orders")
        .insert([order])
        .select();

      if (error) {
        console.error("ERROR COMPLETO DE SUPABASE:", error);

        alert(
          "ERROR AL REGISTRAR PEDIDO:\n\n" +
          "Mensaje: " + (error.message || "Sin mensaje") +
          "\n\nDetalles: " + (error.details || "Sin detalles") +
          "\n\nCódigo: " + (error.code || "Sin código") +
          "\n\nSugerencia: " + (error.hint || "Sin sugerencia")
        );

        return;
      }

      console.log("PEDIDO REGISTRADO:", data);

      // CONSTRUIR MENSAJE DE WHATSAPP
      const lines = items.map(item =>
        `• ${item.name} x${item.quantity} — ${money(item.price * item.quantity)}`
      ).join("\n");

      const whatsappMessage =
        `Hola, quiero realizar este pedido en ${cfg.STORE_NAME || "RV Parfums"}:\n\n` +
        `${lines}\n\n` +
        `Total: ${money(total)}\n` +
        `Nombre: ${customer}\n` +
        `Mensaje: ${message || "Sin mensaje adicional"}`;

      const whatsappUrl =
        `https://wa.me/${number}?text=${encodeURIComponent(whatsappMessage)}`;

      // LIMPIAR CARRITO
      cart = [];
      renderCart();
      event.target.reset();
      toggleCart(false);

      // REDIRECCIÓN A WHATSAPP
      window.location.assign(whatsappUrl);

    } catch (error) {
      console.error("ERROR GENERAL:", error);

      alert(
        "ERROR GENERAL:\n\n" +
        (error.message || String(error))
      );

    } finally {
      button.disabled = false;
      button.textContent = "FINALIZAR POR WHATSAPP ↗";
    }
  }

  // INICIAR TIENDA
  document.addEventListener("DOMContentLoaded", () => {
    $("#year").textContent = new Date().getFullYear();

    $("#search").addEventListener("input", renderProducts);
    $("#category-filter").addEventListener("change", renderProducts);

    $("#open-cart").onclick = () => toggleCart(true);
    $("#close-cart").onclick = () => toggleCart(false);
    $("#cart-overlay").onclick = () => toggleCart(false);

    $("#checkout-form").addEventListener("submit", checkout);

    renderCart();
    loadProducts();
  });

})();
