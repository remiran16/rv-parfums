(() => {
  const cfg = window.STORE_CONFIG || {};
  const ready = cfg.SUPABASE_URL?.startsWith("https://") && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("PEGAR_AQUI");
  const db = ready ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const $ = (s) => document.querySelector(s);
  const money = n => `${cfg.CURRENCY || "Gs."} ${Number(n || 0).toLocaleString("es-PY")}`;
  let products = [], cart = [];

  function toast(msg) { const el=$("#toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2800); }
  function escapeHtml(s="") { return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function placeholder(p) { return p.image_url || "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=700&q=80"; }

  async function loadProducts() {
    const grid=$("#product-grid");
    if(!db){ grid.innerHTML='<div class="notice">Falta configurar Supabase. Seguí los pasos del archivo LEEME.md para conectar tu catálogo.</div>'; return; }
    const {data,error}=await db.from("products").select("*").eq("active",true).order("created_at",{ascending:false});
    if(error){grid.innerHTML='<div class="notice">No se pudo cargar el catálogo. Revisá la configuración de Supabase.</div>';return;}
    products=data||[]; renderProducts();
    const cats=[...new Set(products.map(p=>p.category).filter(Boolean))].sort();
    $("#category-filter").innerHTML='<option value="">Todas las categorías</option>'+cats.map(c=>`<option>${escapeHtml(c)}</option>`).join("");
  }
  function renderProducts(){
    const q=$("#search").value.toLowerCase(), cat=$("#category-filter").value;
    const found=products.filter(p=>(`${p.name} ${p.brand||""} ${p.description||""}`).toLowerCase().includes(q)&&(!cat||p.category===cat));
    $("#product-grid").innerHTML=found.length?found.map(p=>`<article class="product-card">
      <div class="product-image"><img src="${escapeHtml(placeholder(p))}" alt="${escapeHtml(p.name)}" loading="lazy">${p.stock<=0?'<span class="sold-out">AGOTADO</span>':''}</div>
      <div class="product-info"><p class="product-brand">${escapeHtml(p.brand||p.category||"FRAGANCIA")}</p><h3>${escapeHtml(p.name)}</h3><p class="product-desc">${escapeHtml(p.description||"Una fragancia para destacar.")}</p><div class="product-bottom"><strong>${money(p.price)}</strong><button class="add-button" data-add="${p.id}" ${p.stock<=0?"disabled":""}>${p.stock<=0?"SIN STOCK":"＋ AGREGAR"}</button></div></div>
    </article>`).join(""):'<div class="notice">No encontramos productos con esa búsqueda.</div>';
    grid.querySelectorAll("[data-add]").forEach(b=>b.addEventListener("click",()=>addToCart(b.dataset.add)));
  }
  function addToCart(id){const p=products.find(x=>x.id===id);if(!p)return;const item=cart.find(x=>x.id===id);if(item){if(item.qty>=p.stock)return toast("No hay más unidades disponibles.");item.qty++;}else cart.push({id:p.id,name:p.name,price:p.price,qty:1,stock:p.stock});renderCart();toast("Agregado a tu bolsa.");}
  function renderCart(){
    $("#cart-count").textContent=cart.reduce((a,x)=>a+x.qty,0);
    $("#cart-total").textContent=money(cart.reduce((a,x)=>a+x.price*x.qty,0));
    $("#cart-items").innerHTML=cart.length?cart.map(x=>`<div class="cart-line"><div><b>${escapeHtml(x.name)}</b><small>${money(x.price)} c/u</small></div><div class="qty"><button data-minus="${x.id}">−</button><span>${x.qty}</span><button data-plus="${x.id}">+</button></div><strong>${money(x.price*x.qty)}</strong></div>`).join(""):'<p class="muted">Tu bolsa está vacía.</p>';
    $("#cart-items").querySelectorAll("[data-minus]").forEach(b=>b.onclick=()=>changeQty(b.dataset.minus,-1));
    $("#cart-items").querySelectorAll("[data-plus]").forEach(b=>b.onclick=()=>changeQty(b.dataset.plus,1));
  }
  function changeQty(id,d){const x=cart.find(i=>i.id===id);if(!x)return;if(d>0&&x.qty>=x.stock)return toast("No hay más unidades disponibles.");x.qty+=d;if(x.qty<=0)cart=cart.filter(i=>i.id!==id);renderCart();}
  function toggleCart(open){$("#cart-panel").classList.toggle("open",open);$("#cart-overlay").classList.toggle("show",open);}
  async function checkout(e){
    e.preventDefault();if(!cart.length)return toast("Tu bolsa está vacía.");
    const f=new FormData(e.target), customer=String(f.get("customer")).trim(), phone=String(f.get("phone")).trim();
    const items=cart.map(x=>({id:x.id,name:x.name,price:x.price,quantity:x.qty}));
    const total=cart.reduce((a,x)=>a+x.price*x.qty,0);
    const order={customer_name:customer,phone,address:String(f.get("address")||""),notes:String(f.get("notes")||""),items,total,status:"Nuevo"};
    const btn=e.target.querySelector("button[type=submit]");btn.disabled=true;btn.textContent="REGISTRANDO…";
    const {error}=await db.from("orders").insert(order);
    btn.disabled=false;btn.textContent="FINALIZAR POR WHATSAPP ↗";
    if(error){toast("No se pudo registrar el pedido. Intentá nuevamente.");return;}
    const lines=items.map(x=>`• ${x.name} x${x.quantity} — ${money(x.price*x.quantity)}`).join("\n");
    const msg=`Hola, quiero realizar este pedido en ${cfg.STORE_NAME}:\n\n${lines}\n\nTotal: ${money(total)}\nNombre: ${customer}\nTeléfono: ${phone}\nDirección: ${order.address}\nNotas: ${order.notes}`;
    const number=(cfg.WHATSAPP_NUMBER||"").replace(/\D/g,"");
    if(!number||number.includes("XXXXXXXX")){toast("Pedido guardado. Falta configurar el WhatsApp de la tienda.");return;}
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(msg)}`,"_blank");
    cart=[];renderCart();e.target.reset();toggleCart(false);toast("¡Pedido registrado!");
  }
  document.addEventListener("DOMContentLoaded",()=>{
    $("#year").textContent=new Date().getFullYear();
    $("#search").addEventListener("input",renderProducts);$("#category-filter").addEventListener("change",renderProducts);
    $("#open-cart").onclick=()=>toggleCart(true);$("#close-cart").onclick=()=>toggleCart(false);$("#cart-overlay").onclick=()=>toggleCart(false);
    $("#checkout-form").addEventListener("submit",checkout);renderCart();loadProducts();
  });
})();