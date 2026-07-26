const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TOAST_CONTAINER_ID = 'toastContainer';
const SELLER_WHATSAPP = '254721379961';
const SELLER_EMAIL = 'jdhaven726@gmail.com';
const PAYMENT_METHOD = 'M-Pesa (Send Money)';
const PAYMENT_NUMBER = '+254 721 379 961';
const PAYMENT_NAME = 'J&D HAVEN';
const ORDER_SUBMIT_COOLDOWN_MS = 15000;

function getToastContainer() {
  let container = document.getElementById(TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

function showToast(message, type = 'info', timeout = 3500) {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  window.setTimeout(() => {
    toast.remove();
  }, timeout);
}

// Theme toggle
const themeToggle = document.getElementById('themeToggle');
const themeIcon = themeToggle.querySelector('i');
const savedTheme = localStorage.getItem('theme') || 'light';

if (savedTheme === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
  themeIcon.classList.remove('ti-sun');
  themeIcon.classList.add('ti-moon');
}

themeToggle.addEventListener('click', function() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  if (currentTheme === 'dark') {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
    themeIcon.classList.remove('ti-moon');
    themeIcon.classList.add('ti-sun');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    themeIcon.classList.remove('ti-sun');
    themeIcon.classList.add('ti-moon');
  }
});

// Mobile menu toggle
const menuToggle = document.getElementById('menuToggle');
const siteNav = document.getElementById('siteNav');

if (menuToggle && siteNav) {
  menuToggle.addEventListener('click', function () {
    const isOpen = siteNav.classList.toggle('nav-open');
    menuToggle.setAttribute('aria-expanded', isOpen);
    menuToggle.querySelector('i').className = isOpen ? 'ti ti-x' : 'ti ti-menu-2';
  });

  // Close mobile menu when a nav link is tapped
  siteNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      siteNav.classList.remove('nav-open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.querySelector('i').className = 'ti ti-menu-2';
    });
  });

  // Close mobile menu when tapping outside of it
  document.addEventListener('click', (e) => {
    if (!siteNav.contains(e.target) && !menuToggle.contains(e.target)) {
      siteNav.classList.remove('nav-open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.querySelector('i').className = 'ti ti-menu-2';
    }
  });
}

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

let cart = [];
let lastOrderSubmitAt = 0;
let allProducts = [];
let activeCategory = 'all';

function formatCurrency(amount) {
  return `KSh ${amount.toFixed(2)}`;
}

function createOrderId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function renderOrderConfirmation(orderId, items, totalAmount) {
  const confirmationSection = document.getElementById('orderConfirmation');
  if (!confirmationSection) {
    return;
  }

  const shortRef = orderId.slice(0, 8);
  const itemSummary = items.map(item => `${item.name} × ${item.quantity}`).join(', ');
  const whatsappText = encodeURIComponent(
    `Hi J&D Haven, I have completed payment for order #${shortRef}.\nAmount: ${formatCurrency(totalAmount)}\nItems: ${itemSummary}`
  );
  const whatsappUrl = `https://wa.me/${SELLER_WHATSAPP}?text=${whatsappText}`;

  confirmationSection.hidden = false;
  confirmationSection.innerHTML = `
    <h3>Order Submitted Successfully</h3>
    <p><strong>Reference:</strong> #${shortRef}</p>
    <p><strong>Total Amount:</strong> ${formatCurrency(totalAmount)}</p>
    <ul class="order-confirmation-list">
      ${items.map(item => `<li>${item.name} × ${item.quantity} — ${formatCurrency(item.price * item.quantity)}</li>`).join('')}
    </ul>
    <div class="payment-details">
      <p><strong>Payment Instructions</strong></p>
      <p>Method: ${PAYMENT_METHOD}</p>
      <p>Number: ${PAYMENT_NUMBER}</p>
      <p>Name: ${PAYMENT_NAME}</p>
      <p>After payment, send your confirmation with order ref <strong>#${shortRef}</strong>.</p>
    </div>
    <div class="confirmation-actions">
      <a href="${whatsappUrl}" class="btn btn-primary" target="_blank" rel="noopener noreferrer">Send Confirmation on WhatsApp</a>
      <a href="mailto:${SELLER_EMAIL}?subject=Payment%20Confirmation%20Order%20%23${shortRef}" class="btn btn-outline">Send via Email</a>
    </div>
  `;
  confirmationSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function sendOrderConfirmationEmail(payload) {
  const { error } = await supabaseClient.functions.invoke('order-confirmation', {
    body: payload
  });

  if (error) {
    throw error;
  }
}

function animateProductCards() {
  document.querySelectorAll('.product-card').forEach(el => {
    if (el.dataset.animated === 'true') {
      return;
    }

    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
    el.dataset.animated = 'true';
  });
}

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) {
    return;
  }

  const filteredProducts = activeCategory === 'all'
    ? allProducts
    : allProducts.filter(product => product.category_id === activeCategory);

  if (!filteredProducts.length) {
    grid.innerHTML = '<p>No products in this category yet.</p>';
    return;
  }

  grid.innerHTML = filteredProducts.map(p => {
    const inStock = p.in_stock !== false;
    const leadTimeDays = Number.isFinite(Number(p.lead_time_days)) ? Number(p.lead_time_days) : null;
    const availabilityText = inStock
      ? (leadTimeDays ? `Made to order - ships in about ${leadTimeDays} day${leadTimeDays === 1 ? '' : 's'}` : 'Made to order')
      : 'Currently unavailable';
    const notifyText = encodeURIComponent(`Hi J&D Haven, please notify me when "${p.name}" is back in stock.`);
    const notifyUrl = `https://wa.me/${SELLER_WHATSAPP}?text=${notifyText}`;

    return `
    <div class="product-card" data-product-id="${p.id}" data-price="${p.price}">
      <div class="product-img">
        ${inStock ? '' : '<span class="product-badge out-stock-badge">Back Soon</span>'}
        ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}">` : ''}
      </div>
      <div class="product-info">
        <p class="product-name">${p.name}</p>
        <p class="product-sub">${p.description ?? ''}</p>
        <p class="product-availability ${inStock ? 'is-available' : 'is-unavailable'}">${availabilityText}</p>
        <p class="product-price">KSh ${p.price}</p>
        ${inStock
          ? `<button class="btn btn-primary add-to-order" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}">Add to Order</button>`
          : `<a class="btn btn-outline notify-stock-btn" href="${notifyUrl}" target="_blank" rel="noopener noreferrer">Notify me on WhatsApp</a>`
        }
      </div>
    </div>
  `;
  }).join('');

  animateProductCards();
}

async function loadCategories() {
  const filterBar = document.getElementById('categoryFilters');
  if (!filterBar) {
    return;
  }

  const { data: categories, error } = await supabaseClient
    .from('categories')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error loading categories:', error);
    return;
  }

  filterBar.innerHTML = '<button class="filter-btn active" data-category="all">All</button>';
  categories.forEach(category => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.type = 'button';
    btn.dataset.category = category.id;
    btn.textContent = category.name;
    filterBar.appendChild(btn);
  });
}

async function loadProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) {
    return;
  }

  if (typeof supabaseClient === 'undefined') {
    console.error('Supabase client is not initialized.');
    grid.innerHTML = '<p>Unable to load products right now.</p>';
    return;
  }

  const { data: products, error } = await supabaseClient
    .from('products')
    .select('*, categories(name)')
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error loading products:', error);
    grid.innerHTML = '<p>Unable to load products right now.</p>';
    return;
  }

  if (!products.length) {
    grid.innerHTML = '<p>No products available yet.</p>';
    return;
  }

  allProducts = products;
  renderProducts();
}

function renderCart() {
  const cartEl = document.getElementById('cartSummary');
  if (!cartEl) {
    return;
  }

  if (!cart.length) {
    cartEl.innerHTML = '<p>No items added yet.</p>';
    return;
  }

  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  cartEl.innerHTML = `
    <ul class="cart-list">
      ${cart.map((item, idx) => `
        <li>
          ${item.name} × ${item.quantity} — KSh ${item.price * item.quantity}
          <button type="button" data-remove="${idx}">Remove</button>
        </li>
      `).join('')}
    </ul>
    <p><strong>Total: KSh ${total}</strong></p>
  `;

  cartEl.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      cart.splice(parseInt(btn.dataset.remove, 10), 1);
      renderCart();
    });
  });
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('add-to-order')) {
    const id = e.target.dataset.id;
    const name = e.target.dataset.name;
    const price = parseFloat(e.target.dataset.price);

    const existing = cart.find(item => item.id === id);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({ id, name, price, quantity: 1, variant: '' });
    }
    renderCart();
  }
});

document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const emailInput = document.getElementById('custEmail');
  const normalizedEmail = emailInput.value.trim().toLowerCase();

  if (!isValidEmail(normalizedEmail)) {
    showToast('Please enter a valid email address before submitting your order.', 'error');
    emailInput.focus();
    return;
  }

  const honeypotField = document.getElementById('websiteField');
  if (honeypotField.value.trim()) {
    console.warn('Spam-like form submission blocked by honeypot.');
    showToast('Unable to submit this order request.', 'error');
    return;
  }

  const now = Date.now();
  if (now - lastOrderSubmitAt < ORDER_SUBMIT_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((ORDER_SUBMIT_COOLDOWN_MS - (now - lastOrderSubmitAt)) / 1000);
    showToast(`Please wait ${waitSeconds}s before submitting another order.`, 'error');
    return;
  }

  if (!cart.length) {
    showToast('Please add at least one product to your order first.', 'error');
    return;
  }

  const submitBtn = e.target.querySelector('.submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';
  const confirmationSection = document.getElementById('orderConfirmation');
  if (confirmationSection) {
    confirmationSection.hidden = true;
  }

  try {
    lastOrderSubmitAt = now;
    const orderItemsSnapshot = cart.map(item => ({ ...item }));
    const totalAmount = orderItemsSnapshot.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderId = createOrderId();
    const { error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        id: orderId,
        customer_name: document.getElementById('custName').value,
        email: normalizedEmail,
        phone: document.getElementById('custPhone').value,
        shipping_address: document.getElementById('custAddress').value,
        notes: document.getElementById('custNotes').value
      });

    if (orderError) {
      throw orderError;
    }

    let designFileUrl = null;
    const fileInput = document.getElementById('designFile');
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const filePath = `${orderId}/${file.name}`;
      const { error: uploadError } = await supabaseClient.storage
        .from('design-uploads')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }
      designFileUrl = filePath;
    }

    const itemsToInsert = cart.map(item => ({
      order_id: orderId,
      product_id: item.id,
      quantity: item.quantity,
      variant: item.variant || null,
      design_file_url: designFileUrl
    }));

    const { error: itemsError } = await supabaseClient
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsError) {
      throw itemsError;
    }

    renderOrderConfirmation(orderId, orderItemsSnapshot, totalAmount);
    showToast(`Order received! Reference #${orderId.slice(0, 8)}.`, 'success', 5000);

    try {
      await sendOrderConfirmationEmail({
        orderId,
        customerName: document.getElementById('custName').value.trim(),
        customerEmail: normalizedEmail,
        totalAmount
      });
      showToast('A confirmation email has been sent.', 'info');
    } catch (emailError) {
      console.error(emailError);
      showToast('Order saved, but confirmation email could not be sent right now.', 'error', 5000);
    }

    cart = [];
    renderCart();
    e.target.reset();
  } catch (err) {
    console.error(err);
    showToast(`Something went wrong submitting your order: ${err.message}`, 'error', 5000);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Order Request';
  }
});

// Add scroll animation
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver(function(entries) {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, observerOptions);

document.querySelectorAll('.product-card, .service-card, .value-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(el);
});

document.addEventListener('DOMContentLoaded', () => {
  const filterBar = document.getElementById('categoryFilters');
  if (filterBar) {
    filterBar.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement) || !target.classList.contains('filter-btn')) {
        return;
      }
      filterBar.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      target.classList.add('active');
      activeCategory = target.dataset.category || 'all';
      renderProducts();
    });
  }

  loadCategories();
  loadProducts();
  renderCart();
});