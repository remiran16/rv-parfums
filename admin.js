
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

  function togglePriceFields() {
    const f = $("#product-form");
    const type = f.elements.sale_type.value;
    const unitField = $("#unit-price-field");
    const mlFields = $("#ml-price-fields");
    const unitInput = f.elements.price_unit;
    const price5 = f.elements.price_5ml;
    const price10 = f.elements.price_10ml;
    const isMl = type === "ml";

    unitField.hidden = isMl;
    mlFields.hidden = !isMl;
    unitInput.disabled = isMl;
    unitInput.required = !isMl;
    price5.disabled = !isMl;
    price10.disabled = !isMl;
    price5.required = isMl;
    price10.required = isMl;
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
      toast("Error cargando inventario: " + error.message);
      return;
    }

    const rows = data || [];
    $("#stat-products").textContent = rows.filter(x => x.active).length;
    $("#stat-stock").textContent = rows.reduce((a, x) => a + Number(x.stock || 0), 0);

    const featuredCount = rows.filter(p => p.featured).length;

    $("#inventory-body").innerHTML = rows.length ? rows.map(p => `
      <tr>
        <td><b>${esc(p.name)}</b><small>${esc(p.brand || "")}</small></td>
        <td>${p.sale_type === "ml"
          ? `<small>5 ml: ${money(p.price_5ml)}</small><small>10 ml: ${money(p.price_10ml)}</small>`
          : `<small>Por unidad: ${money(p.price)}</small>`}
        </td>
        <td>
          <input class="stock-input" type="number" min="0"
            value="${Number(p.stock || 0)}" data-stock="${p.id}" aria-label="Stock">
        </td>
        <td>${p.active ? '<span class="status active">Activo</span>' : '<span class="status">Oculto</span>'}</td>
        <td>
          <label class="featured-toggle">
            <input type="checkbox" data-featured="${p.id}" ${p.featured ? "checked" : ""}>
            <span>${p.featured ? "Sí" : "No"}</span>
          </label>
        </td>
        <td>
          <button class="text-button" data-edit="${p.id}">Editar</button>
          <button class="text-button danger" data-delete="${p.id}">Borrar</button>
        </td>
      </tr>
    `).join("") : '<tr><td colspan="6">Todavía no hay productos.</td></tr>';

    $("#inventory-body").querySelectorAll("[data-edit]").forEach(b => {
      b.onclick = () => editProduct(rows.find(p => String(p.id) === b.dataset.edit));
    });

    $("#inventory-body").querySelectorAll("[data-delete]").forEach(b => {
      b.onclick = () => deleteProduct(b.dataset.delete);
    });

    $("#inventory-body").querySelectorAll("[data-stock]").forEach(i => {
      i.onchange = () => updateStock(i.dataset.stock, i.value);
    });

    $("#inventory-body").querySelectorAll("[data-featured]").forEach(i => {
      i.onchange = () => updateFeatured(i.dataset.featured, i.checked, rows);
    });

    if (featuredCount >= 6) {
      $("#product-message").textContent = "Ya tenés 6 productos destacados en portada.";
    }
  }

  async function updateFeatured(id, checked, rows) {
    const selected = rows.filter(p => p.featured).length;
    const product = rows.find(p => String(p.id) === String(id));

    if (checked && !product?.featured && selected >= 6) {
      toast("Ya alcanzaste el máximo de 6 productos para la portada.");
      await loadInventory();
      return;
    }

    const { error } = await db
      .from("products")
      .update({ featured: checked })
      .eq("id", id);

    if (error) {
      toast("No se pudo actualizar: " + error.message);
    } else {
      toast(checked ? "Producto agregado a la portada." : "Producto quitado de la portada.");
    }

    await loadInventory();
  }

  async function loadOrders() {
    const { data, error } = await db
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      $("#orders-body").innerHTML = '<tr><td colspan="7">No se pudieron cargar los pedidos.</td></tr>';
      return;
    }

    const orders = data || [];
    $("#stat-orders").textContent = orders.length;

    $("#orders-body").innerHTML = orders.length ? orders.map(o => `
      <tr>
        <td>${new Date(o.created_at).toLocaleDateString("es-PY")}</td>
        <td><b>${esc(o.customer_name)}</b><small>${esc(o.phone)}</small></td>
        <td>${(o.items || []).map(i => `${esc(i.name)}${i.size ? ` (${esc(i.size)})` : ""} ×${i.quantity}`).join("<br>")}</td>
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
        <td><button class="text-button danger" data-delete-order="${o.id}" title="Eliminar pedido">🗑️</button></td>
      </tr>
    `).join("") : '<tr><td colspan="7">Todavía no hay pedidos.</td></tr>';

    $("#orders-body").querySelectorAll("[data-status]").forEach(s => {
      s.onchange = async () => {
        const { error } = await db.from("orders")
          .update({ status: s.value })
          .eq("id", s.dataset.status);

        toast(error ? "No se pudo actualizar: " + error.message : "Estado actualizado.");
        if (error) await loadOrders();
      };
    });

    $("#orders-body").querySelectorAll("[data-delete-order]").forEach(b => {
      b.onclick = () => deleteOrder(b.dataset.deleteOrder);
    });
  }

  async function deleteOrder(id) {
    if (!confirm("¿Estás seguro de que querés eliminar este pedido? Esta acción no se puede deshacer.")) return;

    const { error } = await db.from("orders").delete().eq("id", id);

    if (error) {
      toast("No se pudo eliminar: " + error.message);
      return;
    }

    toast("Pedido eliminado correctamente.");
    await loadOrders();
  }

  function editProduct(p) {
    if (!p) return;

    const f = $("#product-form");

    for (const k of ["id", "name", "brand", "category", "description", "stock"]) {
      f.elements[k].value = p[k] ?? "";
    }

    const type = p.sale_type || "unit";
    f.elements.sale_type.value = type;
    f.elements.price_unit.value = type === "unit" ? (p.price ?? "") : "";
    f.elements.price_5ml.value = p.price_5ml ?? "";
    f.elements.price_10ml.value = p.price_10ml ?? "";
    f.elements.active.checked = !!p.active;
    f.elements.featured.checked = !!p.featured;

    togglePriceFields();
    $("#form-title").textContent = "Editar producto";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteProduct(id) {
    if (!confirm("¿Seguro que querés borrar este producto?")) return;

    const { error } = await db.from("products").delete().eq("id", id);
    toast(error ? "No se pudo borrar: " + error.message : "Producto eliminado.");
    await loadInventory();
  }

  async function updateStock(id, value) {
    const n = Math.max(0, Number(value) || 0);
    const { error } = await db.from("products").update({ stock: n }).eq("id", id);
    toast(error ? "No se pudo actualizar el stock." : "Stock actualizado.");
    await loadInventory();
  }

  async function saveProduct(e) {
    e.preventDefault();

    const f = $("#product-form");
    const d = formData();
    const id = d.id || null;
    const type = d.sale_type;
    const featured = f.elements.featured.checked;

    let image_url = null;
    let price5 = 0;
    let price10 = 0;
    let priceUnit = 0;

    if (type === "ml") {
      price5 = Number(d.price_5ml);
      price10 = Number(d.price_10ml);

      if (price5 <= 0 || price10 <= 0) {
        msg("#product-message", "Ingresá precios válidos para 5 ml y 10 ml.");
        return;
      }
    } else {
      priceUnit = Number(d.price_unit);

      if (priceUnit <= 0) {
        msg("#product-message", "Ingresá un precio válido por unidad.");
        return;
      }

      price5 = priceUnit;
    }

    if (featured) {
      const { data: selectedProducts, error: countError } = await db
        .from("products")
        .select("id")
        .eq("featured", true);

      if (countError) {
        msg("#product-message", "No se pudo verificar la selección de portada: " + countError.message);
        return;
      }

      const alreadyFeatured = (selectedProducts || []).some(p => String(p.id) === String(id));

      if (!alreadyFeatured && (selectedProducts || []).length >= 6) {
        msg("#product-message", "Ya hay 6 productos en portada. Quitá uno antes de agregar otro.");
        return;
      }
    }

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

      if (upErr) return msg("#product-message", "Error subiendo imagen: " + upErr.message);

      const { data } = db.storage.from("product-images").getPublicUrl(path);
      image_url = data.publicUrl;
    }

    const row = {
      name: d.name.trim(),
      brand: d.brand.trim(),
      category: d.category.trim(),
      description: d.description.trim(),
      sale_type: type,
      price: type === "ml" ? price5 : priceUnit,
      price_5ml: price5,
      price_10ml: price10,
      stock: Number(d.stock),
      active: f.elements.active.checked,
      featured
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
    f.elements.featured.checked = false;
    f.elements.sale_type.value = "unit";
    togglePriceFields();
    $("#form-title").textContent = "Agregar producto";

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
    $("#sale-type").addEventListener("change", togglePriceFields);

    $("#reset-form").onclick = () => {
      $("#product-form").reset();
      $("#product-form").elements.id.value = "";
      $("#product-form").elements.sale_type.value = "unit";
      $("#product-form").elements.active.checked = true;
      $("#product-form").elements.featured.checked = false;
      togglePriceFields();
      $("#form-title").textContent = "Agregar producto";
      msg("#product-message", "");
    };

    togglePriceFields();
    checkSession();
  });
})();
      
