
// ---- Helpers ----
const fmt = n => new Intl.NumberFormat('en-IN').format(n);
const qs = sel => document.querySelector(sel);
const qsa = sel => [...document.querySelectorAll(sel)];

// ---- State ----
let catalog = [];
let cart = JSON.parse(localStorage.getItem('cart') || '[]'); // [{id, qty}]

// ---- DOM ----
const grid = qs('#productGrid');
const catFilter = qs('#categoryFilter');
const searchInput = qs('#search');
const clearBtn = qs('#clearFilters');
const openBtn = qs('#openCart');
const closeBtn = qs('#closeCart');
const drawer = qs('#cartDrawer');
const cartItemsEl = qs('#cartItems');
const subtotalEl = qs('#subtotal');
const taxEl = qs('#tax');
const totalEl = qs('#total');
const shippingLabel = qs('#shippingLabel');
const cartCount = qs('#cartCount');
const checkoutForm = qs('#checkoutForm');
const checkoutMsg = qs('#checkoutMsg');

document.getElementById('year').textContent = new Date().getFullYear();

// ---- Init ----
async function loadCatalog() {
  const res = await fetch('/api/products');
  catalog = await res.json();
  populateCategories();
  renderCatalog();
  renderCart();
}
function populateCategories() {
  const cats = [...new Set(catalog.map(p => p.category))];
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    catFilter.appendChild(opt);
  });
}

function renderCatalog() {
  const q = searchInput.value.trim().toLowerCase();
  const cat = catFilter.value;
  const filtered = catalog.filter(p => {
    const matchQ = !q || (p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    const matchC = !cat || p.category === cat;
    return matchQ && matchC;
  });
  grid.innerHTML = filtered.map(p => `
    <div class="card">
      <img src="${p.image}" alt="${p.title}" loading="lazy"/>
      <div class="body">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>${p.title}</strong>
          <span class="price">₹${fmt(p.price)}</span>
        </div>
        <div class="muted">${p.category}</div>
        <div class="muted">${p.description}</div>
        <button class="btn primary" data-add="${p.id}">Add to Cart</button>
      </div>
    </div>
  `).join('');

  qsa('[data-add]').forEach(btn => btn.addEventListener('click', e => {
    const id = Number(e.currentTarget.dataset.add);
    addToCart(id, 1);
  }));
}

function addToCart(id, qty = 1) {
  const found = cart.find(it => it.id === id);
  if (found) found.qty += qty;
  else cart.push({ id, qty });
  persistCart();
  renderCart(true);
}
function removeFromCart(id) {
  cart = cart.filter(it => it.id !== id);
  persistCart();
  renderCart();
}
function setQty(id, qty) {
  const it = cart.find(i => i.id === id);
  if (!it) return;
  it.qty = Math.max(1, qty);
  persistCart();
  renderCart();
}
function persistCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function renderCart(open = false) {
  const lines = cart.map(it => {
    const p = catalog.find(pr => pr.id === it.id);
    return { ...p, qty: it.qty, line: p.price * it.qty };
  });
  cartItemsEl.innerHTML = lines.length ? lines.map(l => `
    <div class="cart-item">
      <img src="${l.image}" alt="${l.title}"/>
      <div>
        <div style="display:flex;justify-content:space-between;gap:6px;">
          <div><strong>${l.title}</strong><div class="muted">₹${fmt(l.price)}</div></div>
          <button class="btn" data-remove="${l.id}">✕</button>
        </div>
        <div class="qty">
          <button data-dec="${l.id}">−</button>
          <span>${l.qty}</span>
          <button data-inc="${l.id}">+</button>
          <span style="margin-left:auto;font-weight:700">₹${fmt(l.line)}</span>
        </div>
      </div>
    </div>
  `).join('') : '<div class="muted">Your cart is empty.</div>';

  let subtotal = lines.reduce((a,b)=>a+b.line,0);
  let shipping = subtotal > 5000 ? 0 : (subtotal ? 199 : 0);
  let tax = Math.round(subtotal * 0.18);
  let total = subtotal + shipping + tax;

  subtotalEl.textContent = fmt(subtotal);
  taxEl.textContent = fmt(tax);
  totalEl.textContent = fmt(total);
  shippingLabel.textContent = subtotal ? (shipping ? `₹${fmt(shipping)}` : 'Free') : '—';

  const count = cart.reduce((a,b)=>a+b.qty,0);
  cartCount.textContent = `(${count})`;

  qsa('[data-remove]').forEach(b => b.addEventListener('click', e => removeFromCart(Number(e.currentTarget.dataset.remove))));
  qsa('[data-inc]').forEach(b => b.addEventListener('click', e => {
    const id = Number(e.currentTarget.dataset.inc);
    const it = cart.find(i=>i.id===id); if (!it) return; it.qty++; persistCart(); renderCart();
  }));
  qsa('[data-dec]').forEach(b => b.addEventListener('click', e => {
    const id = Number(e.currentTarget.dataset.dec);
    const it = cart.find(i=>i.id===id); if (!it) return; it.qty = Math.max(1, it.qty-1); persistCart(); renderCart();
  }));

  if (open) openDrawer();
}

function openDrawer(){ drawer.classList.add('open'); }
function closeDrawer(){ drawer.classList.remove('open'); }

openBtn.addEventListener('click', openDrawer);
closeBtn.addEventListener('click', closeDrawer);
searchInput.addEventListener('input', renderCatalog);
catFilter.addEventListener('change', renderCatalog);
clearBtn.addEventListener('click', () => { searchInput.value=''; catFilter.value=''; renderCatalog(); });

checkoutForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  checkoutMsg.innerHTML = '';
  if (!cart.length) {
    checkoutMsg.innerHTML = '<div class="alert error">Your cart is empty.</div>';
    return;
  }
  const data = new FormData(checkoutForm);
  const customer = Object.fromEntries(data.entries());
  const items = cart.map(it => ({ id: it.id, qty: it.qty }));
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, customer })
  });
  const out = await res.json();
  if (!res.ok) {
    checkoutMsg.innerHTML = `<div class="alert error">${out.error || 'Checkout failed.'}</div>`;
    return;
  }
  checkoutMsg.innerHTML = `<div class="alert">✅ ${out.message} Total paid: ₹${fmt(out.total)}.</div>`;
  cart = []; persistCart(); renderCart();
});

loadCatalog();
