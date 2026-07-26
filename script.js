const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TOAST_CONTAINER_ID = 'toastContainer';

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
    .select('*')
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

  grid.innerHTML = products.map(p => `
    <div class="product-card" data-product-id="${p.id}" data-price="${p.price}">
      <div class="product-img">
        ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}">` : ''}
      </div>
      <div class="product-info">
        <p class="product-name">${p.name}</p>
        <p class="product-sub">${p.description ?? ''}</p>
        <p class="product-price">KSh ${p.price}</p>
        <button class="btn btn-primary add-to-order" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}">
          Add to Order
        </button>
      </div>
    </div>
  `).join('');

  animateProductCards();
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

  if (!cart.length) {
    showToast('Please add at least one product to your order first.', 'error');
    return;
  }

  const submitBtn = e.target.querySelector('.submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
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

    showToast(`Order received! Reference #${orderId.slice(0, 8)}. Please send payment confirmation via WhatsApp or email.`, 'success', 5000);
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
  loadProducts();
  renderCart();
});