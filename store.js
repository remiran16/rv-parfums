
(() => {
  const cfg = window.STORE_CONFIG || {};

  const ready =
    cfg.SUPABASE_URL?.startsWith("https://") &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes("PEGAR_AQUI");

  const db = ready
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  const $ = s => document.querySelector(s);

  const money = n =>
    `${cfg.CURRENCY || "Gs."} ${Number(n || 0).toLocaleString("es-PY")}`;

  let products = [];
  let cart = [];

  function toast(message) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2800);
  }

  function escapeHtml(s = "") {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function placeholder(p) {
    return p.image_url ||
      "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=700&q=80";
  }

  async function loadProducts() {
    const grid = $("#product-grid");

    if (!db) {
      grid.innerHTML =
        '<div class="notice">Falta configurar Supabase. Revisá config.js.</div>';
      return;
    }

    const { data, error } = await db
      .from("products")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      grid.innerHTML =
        '<div class="notice">No se pudo cargar el catálogo.</div>';
      return;
    }

    products = data || [];

    const categories = [
      ...new Set(products.map(p => p.category).filter(Boolean))
    ].sort();

    $("#category-filter").innerHTML =
      '<option value="">Todas las categorías</option>' +
      categories.map(c =>
        `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
      ).join("");

    renderProducts();
  }

  function renderProducts() {
    const grid = $("#product-grid");
    const q = $("#search").value.toLowerCase();
    const cat = $("#category-filter").value;

    const found = products.filter(p =>
      (`${p.name} ${p.brand || ""} ${p.description || ""}`)
        .toLowerCase()
        .includes(q) &&
      (!cat || p.category === cat)
    );

    grid.innerHTML = found.length
      ? found.map(p => `
        <article class="product-card">
          <div class="product-image">
            <img
              src="${escapeHtml(placeholder(p))}"
              alt="${escapeHtml(p.name)}"
              loading="lazy"
            >
            ${Number(p.stock) <= 0
              ? '<span class="sold-out">AGOTADO</span>'
              : ''}
          </div>

          <div class="product-info">
            <p class="product-brand">
              ${escapeHtml(p.brand || p.category || "FRAGANCIA")}
            </p>
            <h3>${escapeHtml(p.name)}</h3>
            <p class="product-desc">
              ${escapeHtml(p.description || "Una fragancia para destacar.")}
            </p>

            <div class="product-bottom">
              <strong>${money(p.price)}</strong>
              <button
                class="add-button"
                data-add="${escapeHtml(p.id)}"
                ${Number(p.stock) <= 0 ? "disabled" : ""}
              >
                ${Number(p.stock) <= 0 ? "SIN STOCK" : "＋ AGREGAR"}
              </button>
            </div>
          </div>
        </article>
      `).join("")
      : '<div class="notice">No encontramos productos con esa búsqueda.</div>';

    grid.querySelectorAll("[data-add]").forEach(button => {
      button.addEventListener("click", () => addToCart(button.dataset.add));
    });
  }

  function addToCart(id) {
    const p = products.find(x => String(x.id) === String(id));
    if (!p) return;

    const stock = Number(p.stock) || 0;
    const item = cart.find(x => String(x.id) === String(id));

    if (stock <= 0) {
      return toast("Este producto no tiene stock disponible.");
    }

    if (item) {
      if (item.qty >= stock) {
        return toast("No hay más unidades disponibles.");
      }
      item.qty++;
    } else {
      cart.push({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        qty: 1,
        stock
      });
    }

    renderCart();
    toast("¡Producto agregado al carrito!");
  }

  function renderCart() {
    $("#cart-count").textContent =
      cart.reduce((a, x) => a + x.qty, 0);

    $("#cart-total").textContent = money(
      cart.reduce((a, x) => a + x.price * x.qty, 0)
    );

    $("#cart-items").innerHTML = cart.length
      ? cart.map(x => `
        <div class="cart-line">
          <div>
            <b>${escapeHtml(x.name)}</b>
            <small>${money(x.price)} c/u</small>
          </div>
          <div class="qty">
            <button data-minus="${escapeHtml(x.id)}">−</button>
            <span>${x.qty}</span>
            <button data-plus="${escapeHtml(x.id)}">+</button>
          </div>
          <strong>${money(x.price * x.qty)}</strong>
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

  function changeQty(id, difference) {
    const item = cart.find(x => String(x.id) === String(id));
    if (!item) return;

    if (difference > 0 && item.qty >= item.stock) {
      return toast("No hay más unidades disponibles.");
    }

    item.qty += difference;

    if (item.qty <= 0) {
      cart = cart.filter(x => String(x.id) !== String(id));
    }

    renderCart();
  }

  function toggleCart(open) {
    $("#cart-panel").classList.toggle("open", open);
    $("#cart-overlay").classList.toggle("show", open);
  }

  async function checkout(e) {
    e.preventDefault();

    if (!cart.length) {
      return toast("Tu carrito está vacío.");
    }

    if (!db) {
      return toast("No hay conexión con la base de datos.");
    }

    const form = new FormData(e.target);
    const customer = String(form.get("customer") || "").trim();
    const message = String(form.get("message") || "").trim();

    if (!customer) {
      return toast("Escribí tu nombre completo.");
    }

    const items = cart.map(x => ({
      id: x.id,
      name: x.name,
      price: x.price,
      quantity: x.qty
    }));

    const total = cart.reduce(
      (a, x) => a + x.price * x.qty, 0
    );

    const order = {
      customer_name: customer,
      phone: "",
      address: "",
      notes: message,
      items,
      total,
      status: "Nuevo"
    };

    const number = (cfg.WHATSAPP_NUMBER || "").replace(/\D/g, "");

    if (!number) {
      return toast("Falta configurar el WhatsApp de la tienda.");
    }

    const lines = items.map(x =>
      `• ${x.name} x${x.quantity} — ${money(x.price * x.quantity)}`
    ).join("\n");

    const whatsappMessage =
      `Hola, quiero realizar este pedido en ${cfg.STORE_NAME || "RV Parfums"}:\n\n` +
      `${lines}\n\n` +
      `Total: ${money(total)}\n` +
      `Nombre completo: ${customer}\n` +
      `Mensaje: ${message || "Sin mensaje adicional"}`;

    const whatsappUrl =
      `https://wa.me/${number}?text=${encodeURIComponent(whatsappMessage)}`;

    // Abrimos la ventana durante el clic para evitar bloqueos del navegador.
    const whatsappWindow = window.open("about:blank", "_blank");

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "REGISTRANDO PEDIDO…";

    try {
      const { error } = await db.from("orders").insert(order);

      if (error) {
        console.error("Error registrando pedido:", error);

        if (whatsappWindow) whatsappWindow.close();

        toast("No se pudo registrar el pedido. Intentá nuevamente.");
        return;
      }

      cart = [];
      renderCart();
      e.target.reset();
      toggleCart(false);

      if (whatsappWindow) {
        whatsappWindow.location.href = whatsappUrl;
      } else {
        window.location.href = whatsappUrl;
      }

      toast("¡Pedido registrado correctamente!");
    } catch (error) {
      console.error(error);

      if (whatsappWindow) whatsappWindow.close();

      toast("Ocurrió un error al procesar el pedido.");
    } finally {
      btn.disabled = false;
      btn.textContent = "FINALIZAR POR WHATSAPP ↗";
    }
  }

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
