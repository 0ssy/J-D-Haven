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

const loginView = document.getElementById('loginView');
const adminView = document.getElementById('adminView');
const orderSearchInput = document.getElementById('orderSearch');
const orderStatusFilter = document.getElementById('orderStatusFilter');
const statusOptions = ['pending', 'paid', 'in_production', 'shipped', 'delivered'];
let adminOrders = [];
let adminControlsInitialized = false;

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatStatusLabel(status) {
  return status.replaceAll('_', ' ');
}

function filterOrders() {
  const searchTerm = orderSearchInput.value.trim().toLowerCase();
  const statusFilter = orderStatusFilter.value;

  const filtered = adminOrders.filter(order => {
    const matchesSearch = !searchTerm
      || order.customer_name.toLowerCase().includes(searchTerm)
      || order.email.toLowerCase().includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  renderOrders(filtered);
}

function initAdminControls() {
  if (adminControlsInitialized) {
    return;
  }

  orderSearchInput.addEventListener('input', filterOrders);
  orderStatusFilter.addEventListener('change', filterOrders);
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      showToast('Could not log out: ' + error.message, 'error');
      return;
    }
    showToast('You have been logged out.', 'success');
    await checkSession();
  });

  adminControlsInitialized = true;
}

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    initAdminControls();
    loginView.style.display = 'none';
    adminView.style.display = 'block';
    await loadAdminProducts();
    await loadAdminOrders();
  } else {
    loginView.style.display = 'block';
    adminView.style.display = 'none';
  }
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;

  if (!isValidEmail(email)) {
    showToast('Please enter a valid admin email address.', 'error');
    return;
  }

  if (!password) {
    showToast('Please enter your password.', 'error');
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    showToast('Login failed: ' + error.message, 'error');
    return;
  }
  showToast('Logged in successfully.', 'success');
  await checkSession();
});

document.getElementById('addProductBtn').addEventListener('click', async () => {
  const name = document.getElementById('pName').value.trim();
  const description = document.getElementById('pDesc').value.trim();
  const price = parseFloat(document.getElementById('pPrice').value);
  const category = document.getElementById('pCategory').value.trim();
  const imageFile = document.getElementById('pImage').files[0];

  if (!name) {
    showToast('Product name is required.', 'error');
    return;
  }

  if (!Number.isFinite(price) || price <= 0) {
    showToast('Please enter a valid product price.', 'error');
    return;
  }

  let imageUrl = null;
  if (imageFile) {
    const filePath = `${Date.now()}_${imageFile.name}`;
    const { error: uploadError } = await supabaseClient.storage
      .from('product-images')
      .upload(filePath, imageFile);

    if (uploadError) {
      showToast('Image upload failed: ' + uploadError.message, 'error');
      return;
    }

    const { data: publicUrlData } = supabaseClient.storage
      .from('product-images')
      .getPublicUrl(filePath);
    imageUrl = publicUrlData.publicUrl;
  }

  const { error } = await supabaseClient.from('products').insert({
    name, description, price, category, image_url: imageUrl, active: true
  });

  if (error) {
    showToast('Error adding product: ' + error.message, 'error');
    return;
  }

  showToast('Product added.', 'success');
  document.getElementById('pName').value = '';
  document.getElementById('pDesc').value = '';
  document.getElementById('pPrice').value = '';
  document.getElementById('pCategory').value = '';
  document.getElementById('pImage').value = '';
  await loadAdminProducts();
});

async function loadAdminProducts() {
  const { data: products, error } = await supabaseClient
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  document.getElementById('productsList').innerHTML = products.map(p => `
    <div class="admin-product-row">
      <strong>${p.name}</strong> - KSh ${p.price} - ${p.active ? 'Active' : 'Hidden'}
      <button class="btn btn-outline" data-toggle="${p.id}" data-active="${p.active}">
        ${p.active ? 'Hide' : 'Show'}
      </button>
      <button class="btn btn-outline" data-delete="${p.id}">Delete</button>
    </div>
  `).join('');

  document.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.toggle;
      const currentlyActive = btn.dataset.active === 'true';
      const { error: toggleError } = await supabaseClient
        .from('products')
        .update({ active: !currentlyActive })
        .eq('id', id);
      if (toggleError) {
        showToast('Unable to update product visibility: ' + toggleError.message, 'error');
        return;
      }
      showToast('Product visibility updated.', 'success');
      await loadAdminProducts();
    });
  });

  document.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this product?')) {
        return;
      }
      const { error: deleteError } = await supabaseClient
        .from('products')
        .delete()
        .eq('id', btn.dataset.delete);
      if (deleteError) {
        showToast('Unable to delete product: ' + deleteError.message, 'error');
        return;
      }
      showToast('Product deleted.', 'success');
      await loadAdminProducts();
    });
  });
}

async function loadAdminOrders() {
  const { data: orders, error } = await supabaseClient
    .from('orders')
    .select(`
      id, customer_name, email, phone, shipping_address, status, notes, created_at,
      order_items ( id, quantity, variant, design_file_url, products ( name, price ) )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  adminOrders = orders ?? [];
  filterOrders();
}

function renderOrders(orders) {
  document.getElementById('ordersList').innerHTML = orders.map(o => `
    <div class="admin-order-card">
      <p>
        <strong>${o.customer_name}</strong> - ${o.email} - ${o.phone ?? ''}
        <span class="status-pill status-${o.status}">${formatStatusLabel(o.status)}</span>
      </p>
      <p>${o.shipping_address}</p>
      <p>Notes: ${o.notes ?? '-'}</p>
      <ul>
        ${o.order_items.map(item => `
          <li>${item.products?.name ?? 'Deleted product'} × ${item.quantity} ${item.variant ? '(' + item.variant + ')' : ''}
          ${item.design_file_url ? ` - <button type="button" class="btn btn-outline admin-inline-btn" data-design-path="${item.design_file_url}">View design file</button>` : ''}</li>
        `).join('')}
      </ul>
      <label>Status:
        <select data-order="${o.id}">
          ${statusOptions.map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${formatStatusLabel(s)}</option>`).join('')}
        </select>
      </label>
    </div>
  `).join('') || '<p>No matching orders found.</p>';

  document.querySelectorAll('[data-order]').forEach(select => {
    select.addEventListener('change', async () => {
      const { error: statusError } = await supabaseClient
        .from('orders')
        .update({ status: select.value })
        .eq('id', select.dataset.order);
      if (statusError) {
        showToast('Unable to update order status: ' + statusError.message, 'error');
        return;
      }
      showToast('Order status updated.', 'success');

      const updated = adminOrders.find(order => order.id === select.dataset.order);
      if (updated) {
        updated.status = select.value;
      }
      filterOrders();
    });
  });

  document.querySelectorAll('[data-design-path]').forEach(button => {
    button.addEventListener('click', async () => {
      const filePath = button.dataset.designPath;
      const { data, error: signedUrlError } = await supabaseClient.storage
        .from('design-uploads')
        .createSignedUrl(filePath, 3600);

      if (signedUrlError) {
        showToast('Unable to open design file: ' + signedUrlError.message, 'error');
        return;
      }

      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    });
  });
}

checkSession();
