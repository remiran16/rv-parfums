(() => {
  "use strict";

  const db = window.supabase.createClient(
    window.STORE_CONFIG.SUPABASE_URL,
    window.STORE_CONFIG.SUPABASE_ANON_KEY
  );

  const $ = (selector) => document.querySelector(selector);

  const money = (value) =>
    Number(value || 0).toLocaleString("es-PY");

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  function msg(element, text, error = false) {
    if (!element) return;

    element.textContent = text;
    element.style.color = error ? "#d66b6b" : "";
  }

  function toast(text) {
    const element = $("#toast");
    if (!element) return;

    element.textContent = text;
    element.classList.add("show");

    setTimeout(() => {
      element.classList.remove("show");
    }, 3000);
  }

  let inventoryProducts = [];
  let editingImageUrl = "";

  // ==========================================
  // FUNCIONES DE PRECIOS Y OFERTAS
  // ==========================================

  function validOffer(normalPrice, offerPrice) {
    const normal = Number(normalPrice || 0);
    const offer = Number(offerPrice || 0);

    return offer > 0 && normal > 0 && offer < normal;
  }

  function priceDisplay(normalPrice, offerPrice, label = "") {
    const normal = Number(normalPrice || 0);
    const offer = Number(offerPrice || 0);

    if (validOffer(normal, offer)) {
      return `
        ${label ? `<small>${esc(label)}</small>` : ""}
        <span class="price-original">
          Gs. ${money(normal)}
        </span>
        <strong class="price-current">
          Gs. ${money(offer)}
        </strong>
        <span class="offer-badge">OFERTA</span>
      `;
    }

    return `
      ${label ? `<small>${esc(label)}</small>` : ""}
      <strong>Gs. ${money(normal)}</strong>
    `;
  }

  // ==========================================
  // SESIÓN Y PANEL
  // ==========================================

  async function checkSession() {
    const { data, error } = await db.auth.getSession();

    if (error) {
      msg($("#login-message"), error.message, true);
      return;
    }

    if (data.session) {
      await showDashboard();
    } else {
      $("#login-view").hidden = false;
      $("#dashboard").hidden = true;
    }
  }

  async function showDashboard() {
    $("#login-view").hidden = true;
    $("#dashboard").hidden = false;

    await Promise.all([
      loadInventory(),
      loadOrders(),
      loadBestSellers()
    ]);
  }

  // ==========================================
  // INVENTARIO
  // ==========================================

  async function loadInventory() {
    const { data, error } = await db
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      $("#inventory-body").innerHTML =
        `<tr><td colspan="5">Error: ${esc(error.message)}</td></tr>`;
      return;
    }

    inventoryProducts = data || [];

    const activeProducts = inventoryProducts.filter(
      (product) => product.active
    );

    $("#stat-products").textContent = activeProducts.length;

    $("#stat-stock").textContent = inventoryProducts.reduce(
      (total, product) =>
        total + Number(product.stock || 0),
      0
    );

    renderInventory();
    renderBestSellerSelectors();
  }
    function renderInventory() {
    const body = $("#inventory-body");

    if (!inventoryProducts.length) {
      body.innerHTML =
        `<tr><td colspan="5">No hay productos registrados.</td></tr>`;
      return;
    }

    body.innerHTML = inventoryProducts.map((product) => {
      let prices = "";

      if (product.sale_type === "ml") {
        prices = `
          <div class="inventory-prices">
            ${priceDisplay(product.price_3ml, product.offer_price_3ml, "3 ml")}
            ${priceDisplay(product.price_5ml, product.offer_price_5ml, "5 ml")}
            ${priceDisplay(product.price_10ml, product.offer_price_10ml, "10 ml")}
          </div>
        `;
      } else {
        prices = `
          <div class="inventory-prices">
            ${priceDisplay(product.price, product.offer_price)}
          </div>
        `;
      }

      return `
        <tr>
          <td>
            <strong>${esc(product.name)}</strong><br>
            <small>${esc(product.brand || "")}</small>
          </td>

          <td>${prices}</td>

          <td>${Number(product.stock || 0)}</td>

          <td>
            ${product.active ? "Activo" : "Oculto"}
          </td>

          <td>
            <button
              type="button"
              class="button button-outline"
              data-edit="${esc(product.id)}"
            >
              Editar
            </button>

            <button
              type="button"
              class="button button-outline"
              data-delete="${esc(product.id)}"
            >
              Eliminar
            </button>
          </td>
        </tr>
      `;
    }).join("");

    body.querySelectorAll("[data-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        editProduct(button.dataset.edit);
      });
    });

    body.querySelectorAll("[data-delete]").forEach((button) => {
      button.addEventListener("click", () => {
        deleteProduct(button.dataset.delete);
      });
    });
  }

  async function deleteProduct(id) {
    if (!confirm("¿Querés eliminar este producto?")) return;

    const { error } = await db
      .from("products")
      .delete()
      .eq("id", id);

    if (error) {
      toast("Error al eliminar: " + error.message);
      return;
    }

    toast("Producto eliminado.");
    await loadInventory();
    await loadBestSellers();
  }

  // ==========================================
  // EDITAR PRODUCTO
  // ==========================================

  function editProduct(id) {
    const product = inventoryProducts.find(
      (item) => String(item.id) === String(id)
    );

    if (!product) return;

    const form = $("#product-form");

    form.elements.id.value = product.id;
    form.elements.name.value = product.name || "";
    form.elements.brand.value = product.brand || "";
    form.elements.category.value = product.category || "";
    form.elements.description.value = product.description || "";
    form.elements.sale_type.value = product.sale_type || "unit";

    // Precio por unidad
    form.elements.price_unit.value = product.price || "";
    form.elements.offer_price_unit.value = product.offer_price || "";

    // Precios de decants
    form.elements.price_3ml.value = product.price_3ml || "";
    form.elements.offer_price_3ml.value = product.offer_price_3ml || "";

    form.elements.price_5ml.value = product.price_5ml || "";
    form.elements.offer_price_5ml.value = product.offer_price_5ml || "";

    form.elements.price_10ml.value = product.price_10ml || "";
    form.elements.offer_price_10ml.value = product.offer_price_10ml || "";

    form.elements.stock.value = product.stock || 0;
    form.elements.active.checked = Boolean(product.active);

    editingImageUrl = product.image_url || "";

    $("#form-title").textContent = "Editar producto";

    togglePriceFields();

    window.scrollTo({
      top: form.getBoundingClientRect().top + window.scrollY - 100,
      behavior: "smooth"
    });
  }

  // ==========================================
  // MODALIDAD DE VENTA
  // ==========================================

  function togglePriceFields() {
    const saleType = $("#sale-type").value;

    $("#unit-price-field").hidden = saleType !== "unit";
    $("#ml-price-fields").hidden = saleType !== "ml";
  }

  // ==========================================
  // VALIDACIÓN DE PRECIOS
  // ==========================================

  function getPriceValue(formData, field) {
    return Math.max(0, Number(formData.get(field) || 0));
  }

  function getOfferValue(formData, normalField, offerField) {
    const normal = getPriceValue(formData, normalField);
    const offer = getPriceValue(formData, offerField);

    return validOffer(normal, offer) ? offer : null;
  }
    // ==========================================
  // GUARDAR PRODUCTO
  // ==========================================

  async function saveProduct(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    const id = formData.get("id");
    const image = formData.get("image");

    let imageUrl = editingImageUrl;

    if (image && image.size > 0) {
      const extension = image.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await db.storage
        .from("product-images")
        .upload(fileName, image, {
          upsert: true
        });

      if (uploadError) {
        msg($("#product-message"), uploadError.message, true);
        return;
      }

      const { data: publicUrl } = db.storage
        .from("product-images")
        .getPublicUrl(fileName);

      imageUrl = publicUrl.publicUrl;
    }

    const saleType = formData.get("sale_type");

    const unitPrice = getPriceValue(formData, "price_unit");

    const price3ml = getPriceValue(formData, "price_3ml");
    const price5ml = getPriceValue(formData, "price_5ml");
    const price10ml = getPriceValue(formData, "price_10ml");

    const product = {
      name: formData.get("name"),
      brand: formData.get("brand"),
      category: formData.get("category"),
      description: formData.get("description"),

      sale_type: saleType,

      // Precio por unidad
      price: saleType === "unit" ? unitPrice : 0,
      offer_price: saleType === "unit"
        ? getOfferValue(formData, "price_unit", "offer_price_unit")
        : null,

      // Precio 3 ml
      price_3ml: saleType === "ml" ? price3ml : 0,
      offer_price_3ml: saleType === "ml"
        ? getOfferValue(formData, "price_3ml", "offer_price_3ml")
        : null,

      // Precio 5 ml
      price_5ml: saleType === "ml" ? price5ml : 0,
      offer_price_5ml: saleType === "ml"
        ? getOfferValue(formData, "price_5ml", "offer_price_5ml")
        : null,

      // Precio 10 ml
      price_10ml: saleType === "ml" ? price10ml : 0,
      offer_price_10ml: saleType === "ml"
        ? getOfferValue(formData, "price_10ml", "offer_price_10ml")
        : null,

      stock: Number(formData.get("stock") || 0),
      active: form.elements.active.checked,
      image_url: imageUrl
    };

    let result;

    if (id) {
      result = await db
        .from("products")
        .update(product)
        .eq("id", id);
    } else {
      result = await db
        .from("products")
        .insert([product]);
    }

    if (result.error) {
      msg($("#product-message"), result.error.message, true);
      return;
    }

    msg($("#product-message"), "Producto guardado correctamente.");

    resetProductForm();

    await loadInventory();
    await loadBestSellers();

    toast("Producto guardado.");
  }

  function resetProductForm() {
    $("#product-form").reset();

    const form = $("#product-form");

    form.elements.id.value = "";

    editingImageUrl = "";

    $("#form-title").textContent = "Agregar producto";

    togglePriceFields();

    $("#product-message").textContent = "";
  }

  // ==========================================
  // LOS MÁS VENDIDOS
  // ==========================================

  function getBestSellerSelect(slot) {
    return $(`#bestseller-slot-${slot}`);
  }

  function renderBestSellerSelectors() {
    const activeProducts = inventoryProducts.filter(
      (product) => product.active
    );

    for (let slot = 1; slot <= 6; slot++) {
      const select = getBestSellerSelect(slot);

      if (!select) continue;

      const currentValue = select.value;

      select.innerHTML = `
        <option value="">Espacio vacío</option>
        ${activeProducts.map((product) => `
          <option value="${esc(product.id)}">
            ${esc(product.name)}
            ${product.brand ? ` — ${esc(product.brand)}` : ""}
          </option>
        `).join("")}
      `;

      if (
        currentValue &&
        activeProducts.some(
          (product) => String(product.id) === currentValue
        )
      ) {
        select.value = currentValue;
      }
    }
  }

  async function loadBestSellers() {
    const message = $("#bestsellers-message");

    const { data, error } = await db
      .from("bestsellers")
      .select("slot, product_id")
      .order("slot", { ascending: true });

    if (error) {
      msg(
        message,
        "No se pudo cargar la selección: " + error.message,
        true
      );
      return;
    }

    renderBestSellerSelectors();

    for (let slot = 1; slot <= 6; slot++) {
      const select = getBestSellerSelect(slot);

      if (!select) continue;

      const saved = (data || []).find(
        (item) => Number(item.slot) === slot
      );

      const productId = saved?.product_id || "";

      const exists = Array.from(select.options).some(
        (option) => option.value === String(productId)
      );

      select.value = exists ? String(productId) : "";
    }

    msg(message, "");
  }
    async function saveBestSellers() {
    const message = $("#bestsellers-message");

    const selected = [];

    for (let slot = 1; slot <= 6; slot++) {
      const select = getBestSellerSelect(slot);

      selected.push({
        slot,
        product_id: select?.value || null
      });
    }

    const chosenIds = selected
      .map((item) => item.product_id)
      .filter(Boolean);

    if (new Set(chosenIds).size !== chosenIds.length) {
      msg(
        message,
        "No podés seleccionar el mismo producto en dos posiciones.",
        true
      );
      return;
    }

    const { error: deleteError } = await db
      .from("bestsellers")
      .delete()
      .gte("slot", 1)
      .lte("slot", 6);

    if (deleteError) {
      msg(message, deleteError.message, true);
      return;
    }

    const rows = selected.filter(
      (item) => item.product_id !== null
    );

    if (rows.length) {
      const { error: insertError } = await db
        .from("bestsellers")
        .insert(rows);

      if (insertError) {
        msg(message, insertError.message, true);
        return;
      }
    }

    msg(message, "Selección guardada correctamente.");
    toast("Los más vendidos se actualizaron.");
  }

  function clearBestSellers() {
    for (let slot = 1; slot <= 6; slot++) {
      const select = getBestSellerSelect(slot);

      if (select) select.value = "";
    }

    msg(
      $("#bestsellers-message"),
      "Selección vaciada. Presioná GUARDAR SELECCIÓN para confirmar."
    );
  }

  // ==========================================
  // PEDIDOS
  // ==========================================

  async function loadOrders() {
    const { data, error } = await db
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      $("#orders-body").innerHTML =
        `<tr><td colspan="7">Error: ${esc(error.message)}</td></tr>`;
      return;
    }

    const orders = data || [];

    $("#stat-orders").textContent = orders.length;

    const body = $("#orders-body");

    if (!orders.length) {
      body.innerHTML =
        `<tr><td colspan="7">Todavía no hay pedidos.</td></tr>`;
      return;
    }

    body.innerHTML = orders.map((order) => {
      const date = new Date(order.created_at).toLocaleString("es-PY");

      const items = Array.isArray(order.items)
        ? order.items.map((item) => {
            const size = item.size ? ` (${esc(item.size)})` : "";
            return `${esc(item.name)}${size} x ${Number(item.quantity || 1)}`;
          }).join("<br>")
        : "";

      return `
        <tr>
          <td>${date}</td>

          <td>
            <strong>${esc(order.customer_name)}</strong><br>
            ${esc(order.phone || "")}
          </td>

          <td>${items}</td>

          <td>Gs. ${money(order.total)}</td>

          <td>${esc(order.status || "Pendiente")}</td>

          <td>
            <select data-status="${esc(order.id)}">
              <option value="Pendiente" ${order.status === "Pendiente" ? "selected" : ""}>Pendiente</option>
              <option value="Confirmado" ${order.status === "Confirmado" ? "selected" : ""}>Confirmado</option>
              <option value="En preparación" ${order.status === "En preparación" ? "selected" : ""}>En preparación</option>
              <option value="Entregado" ${order.status === "Entregado" ? "selected" : ""}>Entregado</option>
              <option value="Cancelado" ${order.status === "Cancelado" ? "selected" : ""}>Cancelado</option>
            </select>
          </td>

          <td>
            <button
              type="button"
              class="button button-outline"
              data-delete-order="${esc(order.id)}"
            >
              Eliminar
            </button>
          </td>
        </tr>
      `;
    }).join("");

    body.querySelectorAll("[data-status]").forEach((select) => {
      select.addEventListener("change", async () => {
        const { error } = await db
          .from("orders")
          .update({ status: select.value })
          .eq("id", select.dataset.status);

        if (error) {
          toast("Error al actualizar pedido.");
          return;
        }

        toast("Estado del pedido actualizado.");
        await loadOrders();
      });
    });

    body.querySelectorAll("[data-delete-order]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("¿Eliminar este pedido?")) return;

        const { error } = await db
          .from("orders")
          .delete()
          .eq("id", button.dataset.deleteOrder);

        if (error) {
          toast("Error al eliminar pedido.");
          return;
        }

        toast("Pedido eliminado.");
        await loadOrders();
      });
    });
  }

  // ==========================================
  // EVENTOS
  // ==========================================

  document.addEventListener("DOMContentLoaded", () => {

    $("#login-form").addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(event.currentTarget);

      const { error } = await db.auth.signInWithPassword({
        email: formData.get("email"),
        password: formData.get("password")
      });

      if (error) {
        msg($("#login-message"), error.message, true);
        return;
      }

      await checkSession();
    });

    $("#logout").addEventListener("click", async () => {
      await db.auth.signOut();
      location.reload();
    });

    $("#product-form").addEventListener("submit", saveProduct);

    $("#sale-type").addEventListener("change", togglePriceFields);

    $("#reset-form").addEventListener("click", resetProductForm);

    $("#save-bestsellers").addEventListener(
      "click",
      saveBestSellers
    );

    $("#clear-bestsellers").addEventListener(
      "click",
      clearBestSellers
    );

    togglePriceFields();

    checkSession();
  });

})();
