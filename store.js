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
    phone,
    address,
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

  try {
    const { error } = await supabaseClient
      .from("orders")
      .insert([order]);

    if (error) throw error;

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
    console.error("Error procesando el pedido:", error);
    showToast("No se pudo registrar el pedido. Intentá nuevamente.");

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
