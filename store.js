
(() => {
  const cfg = window.STORE_CONFIG || {};

  const ready =
    cfg.SUPABASE_URL?.startsWith("https://") &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes("PEGAR_AQUI");

  const db = ready
    ? window.supabase.createClient(
        cfg.SUPABASE_URL,
        cfg.SUPABASE_ANON_KEY
      )
    : null;

  const $ = (s) => document.querySelector(s);

  const money = (n) =>
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
    return String(s).replace(/[&<>"']/g, (c) => ({
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
        '<div class="notice">Falta configurar Supabase. Revisá el archivo config.js.</div>';
      return;
    }

    const { data, error } = await db
      .from("products")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error cargando productos:", error);
      grid.innerHTML =
        '<div class="notice">No se pudo cargar el catálogo. Revisá la conexión con Supabase.</div>';
      return;
    }

    products = data || [];

    const cats = [
      ...new Set(products.map(p => p.category).filter(Boolean))
    ].sort();

    $("#category-filter").innerHTML =
      '<option value="">Todas las categorías</option>' +
      cats.map(c =>
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
      button.addEventListener("click", () => {
        addToCart(button.dataset.add);
      });
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
        stock: stock
      });
    }

    renderCart();
    toast("¡Producto agregado a tu bolsa!");
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
      : '<p class="muted">Tu bolsa está vacía.</p>';

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
      return toast("Tu bolsa está vacía.");
    }

    if (!db) {
      return toast("No hay conexión con la base de datos.");
    }

    const f = new FormData(e.target);

    const customer = String(f.get("customer") || "").trim();
    const phone = String(f.get("phone") || "").trim();

    const items = cart.map(x => ({
      id: x.id,
      name: x.name,
      price: x.price,
      quantity: x.qty
    }));

    const total = cart.reduce(
      (a, x) => a + x.price * x.qty,
      0
    );

    const order = {
      customer_name: customer,
      phone: phone,
      address: String(f.get("address") || ""),
      notes: String(f.get("notes") || ""),
      items: items,
      total: total,
      status: "Nuevo"
    };

    const btn = e.target.querySelector('button[type="submit"]');

    btn.disabled = true;
    btn.textContent = "REGISTRANDO…";

    const { error } = await db.from("orders").insert(order);

    btn.disabled = false;
    btn.textContent = "FINALIZAR POR WHATSAPP ↗";

    if (error) {
      console.error("Error registrando pedido:", error);
      toast("No se pudo registrar el pedido. Intentá nuevamente.");
      return;
    }

    const lines = items.map(x =>
      `• ${x.name} x${x.quantity} — ${money(x.price * x.quantity)}`
    ).join("\n");

    const message =
      `Hola, quiero realizar este pedido en ${cfg.STORE_NAME}:\n\n` +
      `${lines}\n\n` +
      `Total: ${money(total)}\n` +
      `Nombre: ${customer}\n` +
      `Teléfono: ${phone}\n` +
      `Dirección: ${order.address}\n` +
      `Notas: ${order.notes}`;

    const number = (cfg.WHATSAPP_NUMBER || "").replace(/\D/g, "");

    if (!number || number.includes("XXXXXXXX")) {
      toast("Pedido guardado. Falta configurar el WhatsApp.");
      return;
    }

    window.open(
      `https://wa.me/${number}?text=${encodeURIComponent(message)}`,
      "_blank"
    );

    cart = [];
    renderCart();
    e.target.reset();
    toggleCart(false);

    toast("¡Pedido registrado correctamente!");
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
