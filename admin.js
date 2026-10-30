
(() => {
  const cfg = window.STORE_CONFIG || {};
  const ready = cfg.SUPABASE_URL?.startsWith("https://") &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes("PEGAR_AQUI");

  const db = ready
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  const $ = s => document.querySelector(s);
  const money = n => `${cfg.CURRENCY || "Gs."} ${Number(n || 0).toLocaleString("es-PY")}`;

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  function msg(id, t) {
    $(id).textContent = t;
  }

  function toast(t) {
    const el = $("#toast");
    el.textContent = t;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2800);
  }

  function formData() {
    return Object.fromEntries(new FormData($("#product-form")).entries());
  }

  async function checkSession() {
    if (!db) {
      $("#login-message").textContent = "Primero configurá Supabase en config.js.";
      return;
    }

    const { data } = await db.auth.getSession();
    if (data.session) showDashboard();
    else showLogin();
  }

  function showLogin() {
    $("#login-view").hidden = false;
    $("#dashboard").hidden = true;
  }

  async function showDashboard() {
    $("#login-view").hidden = true;
    $("#dashboard").hidden = false;
    await Promise.all([loadInventory(), loadOrders()]);
  }

  async function loadInventory() {
    const { data, error } = await db
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast("Error cargando inventario.");
      return;
    }

    const rows = data || [];

    $("#stat-products").textContent = rows.filter(x => x.active).length;
    $("#stat-stock").textContent = rows.reduce((a, x) => a + Number(x.stock || 0), 0);

    $("#inventory-body").innerHTML = rows.length
      ? rows.map(p => `
        <tr>
          <td><b>${esc(p.name)}</b><small>${esc(p.brand || "")}</small></td>
          <td>${money(p.price)}</td>
          <td><input class="stock-input" type="number" min="0" value="${p.stock}" data-stock="${p.id}" aria-label="Stock"></td>
          <td>${p.active ? '<span class="status active">Activo</span>' : '<span class="status">Oculto</span>'}</td>
          <td>
            <button class="text-button" data-edit="${p.id}">Editar</button>
            <button class="text-button danger" data-delete="${p.id}">Borrar</button>
          </td>
        </tr>
      `).join("")
      : '<tr><td colspan="5">Todavía no hay productos.</td></tr>';

    $("#inventory-body").querySelectorAll("[data-edit]").forEach(b =>
      b.onclick = () => editProduct(rows.find(p => p.id === b.dataset.edit))
    );

    $("#inventory-body").querySelectorAll("[data-delete]").forEach(b =>
      b.onclick = () => deleteProduct(b.dataset.delete)
    );

    $("#inventory-body").querySelectorAll("[data-stock]").forEach(i =>
      i.onchange = () => updateStock(i.dataset.stock, i.value)
    );
  }

  async function loadOrders() {
    const { data, error } = await db
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      $("#orders-body").innerHTML =
        '<tr><td colspan="7">No se pudieron cargar los pedidos.</td></tr>';
      return;
    }

    const orders = data || [];
    $("#stat-orders").textContent = orders.length;

    $("#orders-body").innerHTML = orders.length
      ? orders.map(o => `
        <tr>
          <td>${new Date(o.created_at).toLocaleDateString("es-PY")}</td>
          <td>
            <b>${esc(o.customer_name)}</b>
            <small>${esc(o.phone)}</small>
          </td>
          <td>${(o.items || []).map(i =>
            `${esc(i.name)} ×${i.quantity}`
          ).join("<br>")}</td>
          <td>${money(o.total)}</td>
          <td><span class="status">${esc(o.status)}</span></td>
          <td>
            <select data-status="${o.id}" aria-label="Estado del pedido">
              <option ${o.status === "Nuevo" ? "selected" : ""}>Nuevo</option>
              <option ${o.status === "En preparación" ? "selected" : ""}>En preparación</option>
              <option ${o.status === "Entregado" ? "selected" : ""}>Entregado</option>
              <option ${o.status === "Cancelado" ? "selected" : ""}>Cancelado</option>
            </select>
          </td>
          <td>
            <button
              class="text-button danger"
              data-delete-order="${o.id}"
              title="Eliminar pedido"
              aria-label="Eliminar pedido">
              🗑️
            </button>
          </td>
        </tr>
      `).join("")
      : '<tr><td colspan="7">Todavía no hay pedidos.</td></tr>';

    $("#orders-body").querySelectorAll("[data-status]").forEach(s => {
      s.onchange = async () => {
        const { error } = await db
          .from("orders")
          .update({ status: s.value })
          .eq("id", s.dataset.status);

        toast(error ? "No se pudo actualizar." : "Estado actualizado.");
        if (error) await loadOrders();
      };
    });

    $("#orders-body").querySelectorAll("[data-delete-order]").forEach(b => {
      b.onclick = () => deleteOrder(b.dataset.deleteOrder);
    });
  }

  async function deleteOrder(id) {
    if (!confirm("¿Estás seguro de que querés eliminar este pedido? Esta acción no se puede deshacer.")) {
      return;
    }

    const { error } = await db
      .from("orders")
      .delete()
      .eq("id", id);

    if (error) {
      toast("No se pudo eliminar el pedido: " + error.message);
      return;
    }

    toast("Pedido eliminado correctamente.");
    await loadOrders();
  }

  function editProduct(p) {
    if (!p) return;

    const f = $("#product-form");

    for (const k of ["id", "name", "brand", "category", "description", "price", "stock"]) {
      f.elements[k].value = p[k] ?? "";
    }

    f.elements.active.checked = !!p.active;
    $("#form-title").textContent = "Editar perfume";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteProduct(id) {
    if (!confirm("¿Seguro que querés borrar este producto?")) return;

    const { error } = await db.from("products").delete().eq("id", id);

    toast(error ? "No se pudo borrar." : "Producto eliminado.");
    await loadInventory();
  }

  async function updateStock(id, value) {
    const n = Math.max(0, Number(value) || 0);

    const { error } = await db
      .from("products")
      .update({ stock: n })
      .eq("id", id);

    toast(error ? "No se pudo actualizar el stock." : "Stock actualizado.");
    await loadInventory();
  }

  async function saveProduct(e) {
    e.preventDefault();

    const f = $("#product-form");
    const d = formData();
    const id = d.id || null;
    let image_url = null;

    const file = f.elements.image.files[0];

    if (file) {
      if (!file.type.startsWith("image/")) {
        return msg("#product-message", "El archivo debe ser una imagen.");
      }

      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${crypto.randomUUID()}-${safe}`;

      const { error: upErr } = await db.storage
        .from("product-images")
        .upload(path, file, { upsert: false });

      if (upErr) {
        return msg("#product-message", "Error subiendo imagen: " + upErr.message);
      }

      const { data } = db.storage.from("product-images").getPublicUrl(path);
      image_url = data.publicUrl;
    }

    const row = {
      name: d.name.trim(),
      brand: d.brand.trim(),
      category: d.category.trim(),
      description: d.description.trim(),
      price: Number(d.price),
      stock: Number(d.stock),
      active: f.elements.active.checked
    };

    if (image_url) row.image_url = image_url;

    const result = id
      ? await db.from("products").update(row).eq("id", id)
      : await db.from("products").insert(row);

    if (result.error) {
      msg("#product-message", "No se pudo guardar: " + result.error.message);
      return;
    }

    msg("#product-message", "Producto guardado correctamente.");
    f.reset();
    f.elements.id.value = "";
    f.elements.active.checked = true;
    $("#form-title").textContent = "Agregar perfume";

    await loadInventory();
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("#login-form").onsubmit = async e => {
      e.preventDefault();
      if (!db) return;

      const f = new FormData(e.target);

      const { error } = await db.auth.signInWithPassword({
        email: f.get("email"),
        password: f.get("password")
      });

      msg("#login-message", error ? "No se pudo ingresar. Revisá tus datos." : "");

      if (!error) showDashboard();
    };

    $("#logout").onclick = async () => {
      await db.auth.signOut();
      showLogin();
    };

    $("#product-form").onsubmit = saveProduct;

    $("#reset-form").onclick = () => {
      $("#product-form").reset();
      $("#product-form").elements.id.value = "";
      $("#form-title").textContent = "Agregar perfume";
      msg("#product-message", "");
    };

    checkSession();
  });
})();
