(() => {
  const cfg = window.STORE_CONFIG || {};

  const ready = cfg.SUPABASE_URL?.startsWith("https://") &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes("PEGAR_AQUI");

  const db = ready
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  const $ = selector => document.querySelector(selector);
  const money = n => `${cfg.CURRENCY || "Gs."} ${Number(n || 0).toLocaleString("es-PY")}`;

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  function msg(id, text) {
    const element = $(id);
    if (element) element.textContent = text;
  }

  function toast(text) {
    const element = $("#toast");
    if (!element) return;

    element.textContent = text;
    element.classList.add("show");

    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove("show"), 2800);
  }

  function formData() {
    return Object.fromEntries(new FormData($("#product-form")).entries());
  }

  function togglePriceFields() {
    const form = $("#product-form");
    const type = form.elements.sale_type.value;

    const unitField = $("#unit-price-field");
    const mlFields = $("#ml-price-fields");

    const unitInput = form.elements.price_unit;
    const price5 = form.elements.price_5ml;
    const price10 = form.elements.price_10ml;

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
      msg("#login-message", "Primero configurá Supabase en config.js.");
      return;
    }

    const { data, error } = await db.auth.getSession();

    if (error) {
      msg("#login-message", "No se pudo comprobar la sesión.");
      return;
    }

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
    const featuredCount = rows.filter(p => p.featured).length;

    $("#stat-products").textContent = rows.filter(p => p.active).length;
    $("#stat-stock").textContent = rows.reduce(
      (sum, p) => sum + Number(p.stock || 0), 0
    );

    $("#inventory-body").innerHTML = rows.length
      ? rows.map(p => `
        <tr>
          <td>
            <b>${esc(p.name)}</b>
            <small>${esc(p.brand || "")}</small>
          </td>
          <td>
            ${p.sale_type === "ml"
              ? `<small>5 ml: ${money(p.price_5ml)}</small>
                 <small>10 ml: ${money(p.price_10ml)}</small>`
              : `<small>Por unidad: ${money(p.price)}</small>`
            }
          </td>
          <td>
            <input class="stock-input" type="number" min="0"
              value="${Number(p.stock || 0)}"
              data-stock="${esc(p.id)}" aria-label="Stock">
          </td>
          <td>${p.active
            ? '<span class="status active">Activo</span>'
            : '<span class="status">Oculto</span>'}
          </td>
          <td>
            <label class="featured-check">
              <input type="checkbox"
                data-featured="${esc(p.id)}"
                ${p.featured ? "checked" : ""}
                ${!p.active ? "disabled" : ""}>
              <span>Mostrar en portada</span>
            </label>
          </td>
          <td>
            <button class="text-button" data-edit="${esc(p.id)}">Editar</button>
            <button class="text-button danger" data-delete="${esc(p.id)}">Borrar</button>
          </td>
        </tr>
      `).join("")
      : '<tr><td colspan="6">Todavía no hay productos.</td></tr>';

    msg("#featured-message", `${featuredCount} de 6 productos seleccionados para la portada.`);

    $("#inventory-body").querySelectorAll("[data-edit]").forEach(button => {
      button.onclick = () => {
        editProduct(rows.find(p => String(p.id) === button.dataset.edit));
      };
    });

    $("#inventory-body").querySelectorAll("[data-delete]").forEach(button => {
      button.onclick = () => deleteProduct(button.dataset.delete);
    });

    $("#inventory-body").querySelectorAll("[data-stock]").forEach(input => {
      input.onchange = () => updateStock(input.dataset.stock, input.value);
    });

    $("#inventory-body").querySelectorAll("[data-featured]").forEach(input => {
      input.onchange = () => updateFeatured(
        input.dataset.featured,
        input.checked,
        rows
      );
    });
  }

  async function updateFeatured(id, checked, rows) {
    const selected = rows.filter(p => p.featured).length;

    if (checked && selected >= 6) {
      toast("Solo podés seleccionar 6 productos destacados.");
      await loadInventory();
      return;
    }

    const { error } = await db
      .from("products")
      .update({ featured: checked })
      .eq("id", id);

    if (error) {
      toast("No se pudo actualizar: " + error.message);
      await loadInventory();
      return;
    }

    toast(checked
      ? "Producto agregado a la portada."
      : "Producto quitado de la portada.");

    await loadInventory();
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
            <small>${esc(o.phone || "")}</small>
          </td>
          <td>${(o.items || []).map(i =>
            `${esc(i.name)}${i.size ? ` (${esc(i.size)})` : ""} ×${i.quantity}`
          ).join("<br>")}</td>
          <td>${money(o.total)}</td>
          <td><span class="status">${esc(o.status)}</span></td>
          <td>
            <select data-status="${esc(o.id)}" aria-label="Estado del pedido">
              <option ${o.status === "Nuevo" ? "selected" : ""}>Nuevo</option>
              <option ${o.status === "Pendiente" ? "selected" : ""}>Pendiente</option>
              <option ${o.status === "En preparación" ? "selected" : ""}>En preparación</option>
              <option ${o.status === "Entregado" ? "selected" : ""}>Entregado</option>
              <option ${o.status === "Cancelado" ? "selected" : ""}>Cancelado</option>
            </select>
          </td>
          <td>
            <button class="text-button danger"
              data-delete-order="${esc(o.id)}"
              title="Eliminar pedido"
              aria-label="Eliminar pedido">🗑️</button>
          </td>
        </tr>
      `).join("")
      : '<tr><td colspan="7">Todavía no hay pedidos.</td></tr>';

    $("#orders-body").querySelectorAll("[data-status]").forEach(select => {
      select.onchange = async () => {
        const { error } = await db
          .from("orders")
          .update({ status: select.value })
          .eq("id", select.dataset.status);

        toast(error
          ? "No se pudo actualizar: " + error.message
          : "Estado actualizado.");

        if (error) await loadOrders();
      };
    });

    $("#orders-body").querySelectorAll("[data-delete-order]").forEach(button => {
      button.onclick = () => deleteOrder(button.dataset.deleteOrder);
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
      toast("No se pudo eliminar: " + error.message);
      return;
    }

    toast("Pedido eliminado correctamente.");
    await loadOrders();
  }

  function editProduct(p) {
    if (!p) return;

    const form = $("#product-form");

    for (const key of [
      "id", "name", "brand", "category", "description", "stock"
    ]) {
      form.elements[key].value = p[key] ?? "";
    }

    const type = p.sale_type || "unit";
    form.elements.sale_type.value = type;

    form.elements.price_unit.value = type === "unit" ? (p.price ?? "") : "";
    form.elements.price_5ml.value = p.price_5ml ?? "";
    form.elements.price_10ml.value = p.price_10ml ?? "";

    form.elements.active.checked = !!p.active;

    togglePriceFields();

    $("#form-title").textContent = "Editar producto";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteProduct(id) {
    if (!confirm("¿Seguro que querés borrar este producto?")) return;

    const { error } = await db
      .from("products")
      .delete()
      .eq("id", id);

    if (error) {
      toast("No se pudo borrar: " + error.message);
      return;
    }

    toast("Producto eliminado.");
    await loadInventory();
  }

  async function updateStock(id, value) {
    const n = Math.max(0, Number(value) || 0);

    const { error } = await db
      .from("products")
      .update({ stock: n })
      .eq("id", id);

    toast(error
      ? "No se pudo actualizar el stock: " + error.message
      : "Stock actualizado.");

    await loadInventory();
  }

  async function saveProduct(event) {
    event.preventDefault();

    const form = $("#product-form");
    const d = formData();
    const id = d.id || null;
    const type = d.sale_type;

    let imageUrl = null;
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

    const file = form.elements.image.files[0];

    if (file) {
      if (!file.type.startsWith("image/")) {
        msg("#product-message", "El archivo debe ser una imagen.");
        return;
      }

      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${crypto.randomUUID()}-${safe}`;

      const { error: uploadError } = await db.storage
        .from("product-images")
        .upload(path, file, { upsert: false });

      if (uploadError) {
        msg("#product-message", "Error subiendo imagen: " + uploadError.message);
        return;
      }

      const { data } = db.storage
        .from("product-images")
        .getPublicUrl(path);

      imageUrl = data.publicUrl;
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
      active: form.elements.active.checked
    };

    if (imageUrl) row.image_url = imageUrl;

    const result = id
      ? await db.from("products").update(row).eq("id", id)
      : await db.from("products").insert(row);

    if (result.error) {
      msg("#product-message", "No se pudo guardar: " + result.error.message);
      return;
    }

    msg("#product-message", "Producto guardado correctamente.");

    form.reset();
    form.elements.id.value = "";
    form.elements.active.checked = true;
    form.elements.sale_type.value = "unit";

    togglePriceFields();
    $("#form-title").textContent = "Agregar producto";

    await loadInventory();
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("#login-form").onsubmit = async event => {
      event.preventDefault();
      if (!db) return;

      const form = new FormData(event.target);

      const { error } = await db.auth.signInWithPassword({
        email: form.get("email"),
        password: form.get("password")
      });

      msg("#login-message",
        error ? "No se pudo ingresar. Revisá tus datos." : "");

      if (!error) showDashboard();
    };

    $("#logout").onclick = async () => {
      await db.auth.signOut();
      showLogin();
    };

    $("#product-form").onsubmit = saveProduct;
    $("#sale-type").addEventListener("change", togglePriceFields);

    $("#reset-form").onclick = () => {
      const form = $("#product-form");
      form.reset();
      form.elements.id.value = "";
      form.elements.sale_type.value = "unit";
      form.elements.active.checked = true;

      togglePriceFields();
      $("#form-title").textContent = "Agregar producto";
      msg("#product-message", "");
    };

    togglePriceFields();
    checkSession();
  });
})();
