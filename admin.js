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

function getStoragePathFromPublicUrl(publicUrl, bucketName) {
  if (!publicUrl) {
    return null;
  }

  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${bucketName}/`;
    const index = url.pathname.indexOf(marker);
    if (index === -1) {
      return null;
    }
    const path = url.pathname.slice(index + marker.length);
    return decodeURIComponent(path);
  } catch {
    return null;
  }
}

function filterOrders() {
  const searchTerm = orderSearchInput.value.trim().toLowerCase();
  const statusFilter = orderStatusFilter.value;

  const filtered = adminOrders.filter(order => {
    const matchesSearch = !searchTerm
      || order.customer_name.toLowerCase().includes(searchTerm)
      || order.email.toLowerCase().includes(searchTerm);
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'fresh' && order.status !== 'delivered')
      || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  renderOrders(filtered);
}

async function loadCategoryOptions() {
  const { data: categories, error } = await supabaseClient
    .from('categories')
    .select('*')
    .order('name');

  if (error) {
    console.error(error);
    showToast('Unable to load category options: ' + error.message, 'error');
    return;
  }

  const select = document.getElementById('pCategory');
  select.innerHTML = '<option value="">Select category</option>'
    + categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
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
    await loadCategoryOptions();
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
  const categoryId = document.getElementById('pCategory').value.trim();
  const inStock = document.getElementById('pInStock').checked;
  const leadTimeRaw = document.getElementById('pLeadTimeDays').value.trim();
  const leadTimeDays = leadTimeRaw ? parseInt(leadTimeRaw, 10) : null;
  const imageFile = document.getElementById('pImage').files[0];

  if (!name) {
    showToast('Product name is required.', 'error');
    return;
  }

  if (!Number.isFinite(price) || price <= 0) {
    showToast('Please enter a valid product price.', 'error');
    return;
  }

  if (!categoryId) {
    showToast('Please select a category.', 'error');
    return;
  }

  if (leadTimeDays !== null && (!Number.isFinite(leadTimeDays) || leadTimeDays < 1)) {
    showToast('Lead time must be at least 1 day.', 'error');
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
    name,
    description,
    price,
    category_id: categoryId,
    image_url: imageUrl,
    active: true,
    in_stock: inStock,
    lead_time_days: leadTimeDays
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
  document.getElementById('pInStock').checked = true;
  document.getElementById('pLeadTimeDays').value = '';
  document.getElementById('pImage').value = '';
  await loadAdminProducts();
});

async function loadAdminProducts() {
  const { data: products, error } = await supabaseClient
    .from('products')
    .select('*, categories(name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  document.getElementById('productsList').innerHTML = products.map(p => `
    <div class="admin-product-row">
      ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}" class="admin-product-thumb">` : '<div class="admin-product-thumb admin-product-thumb-empty">No image</div>'}
      <strong>${p.name}</strong> - KSh ${p.price} - ${p.categories?.name ?? 'Uncategorized'} - ${p.active ? 'Visible' : 'Hidden'} - ${p.in_stock === false ? 'Out of stock' : 'In stock'}${p.lead_time_days ? ` - ${p.lead_time_days}d lead time` : ''}
      <button class="btn btn-outline" data-toggle="${p.id}" data-active="${p.active}">
        ${p.active ? 'Hide' : 'Show'}
      </button>
      <button class="btn btn-outline" data-stock="${p.id}" data-in-stock="${p.in_stock === false ? 'false' : 'true'}">
        ${p.in_stock === false ? 'Mark In Stock' : 'Mark Out of Stock'}
      </button>
      <button class="btn btn-outline" data-change-image="${p.id}">Edit Image</button>
      <input type="file" accept="image/*" class="admin-image-input" data-image-input="${p.id}" data-current-image="${p.image_url ?? ''}">
      <button class="btn btn-outline" data-delete="${p.id}">Delete / Archive</button>
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
      const productId = btn.dataset.delete;
      const { count: linkedOrderItemsCount, error: orderItemsCheckError } = await supabaseClient
        .from('order_items')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId);
      if (orderItemsCheckError) {
        showToast('Unable to verify product usage in orders: ' + orderItemsCheckError.message, 'error');
        return;
      }

      const hasLinkedOrders = (linkedOrderItemsCount ?? 0) > 0;
      const confirmMessage = hasLinkedOrders
        ? 'This product is used in existing orders, so it cannot be fully deleted. Click OK to archive it (hide + out of stock).'
        : 'This product has no linked orders. Click OK to permanently delete it.';
      if (!confirm(confirmMessage)) {
        return;
      }

      if (hasLinkedOrders) {
        const { error: archiveError } = await supabaseClient
          .from('products')
          .update({ active: false, in_stock: false })
          .eq('id', productId);
        if (archiveError) {
          showToast('Unable to archive product: ' + archiveError.message, 'error');
          return;
        }
        showToast('Product is used in existing orders, so it was archived (hidden) instead of deleted.', 'info', 5000);
        await loadAdminProducts();
        return;
      }

      const { data: product, error: productFetchError } = await supabaseClient
        .from('products')
        .select('id,image_url')
        .eq('id', productId)
        .single();
      if (productFetchError) {
        showToast('Unable to load product details: ' + productFetchError.message, 'error');
        return;
      }

      const { error: deleteError } = await supabaseClient
        .from('products')
        .delete()
        .eq('id', productId);
      if (deleteError) {
        showToast('Unable to delete product: ' + deleteError.message, 'error');
        return;
      }

      const imagePath = getStoragePathFromPublicUrl(product.image_url, 'product-images');
      if (imagePath) {
        const { error: storageDeleteError } = await supabaseClient.storage
          .from('product-images')
          .remove([imagePath]);
        if (storageDeleteError) {
          showToast('Product deleted, but image cleanup failed: ' + storageDeleteError.message, 'error');
          await loadAdminProducts();
          return;
        }
      }

      showToast('Product deleted.', 'success');
      await loadAdminProducts();
    });
  });

  document.querySelectorAll('[data-stock]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.stock;
      const currentlyInStock = btn.dataset.inStock === 'true';
      const { error: stockError } = await supabaseClient
        .from('products')
        .update({ in_stock: !currentlyInStock })
        .eq('id', id);
      if (stockError) {
        showToast('Unable to update stock status: ' + stockError.message, 'error');
        return;
      }
      showToast('Stock status updated.', 'success');
      await loadAdminProducts();
    });
  });

  document.querySelectorAll('[data-change-image]').forEach(btn => {
    btn.addEventListener('click', () => {
      const productId = btn.dataset.changeImage;
      const fileInput = document.querySelector(`[data-image-input="${productId}"]`);
      if (!(fileInput instanceof HTMLInputElement)) {
        showToast('Could not open image picker for this product.', 'error');
        return;
      }
      fileInput.click();
    });
  });

  document.querySelectorAll('[data-image-input]').forEach(input => {
    input.addEventListener('change', async () => {
      if (!(input instanceof HTMLInputElement) || !input.files || input.files.length === 0) {
        return;
      }

      const productId = input.dataset.imageInput;
      const oldImageUrl = input.dataset.currentImage;
      const imageFile = input.files[0];
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
      const newImageUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabaseClient
        .from('products')
        .update({ image_url: newImageUrl })
        .eq('id', productId);
      if (updateError) {
        showToast('Image updated upload succeeded, but database update failed: ' + updateError.message, 'error');
        return;
      }

      const oldImagePath = getStoragePathFromPublicUrl(oldImageUrl, 'product-images');
      if (oldImagePath) {
        await supabaseClient.storage.from('product-images').remove([oldImagePath]);
      }

      showToast('Product image updated.', 'success');
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
          ${item.design_file_url ? ` - <button type="button" class="btn btn-outline admin-inline-btn" data-design-path="${item.design_file_url}">View design file</button>` : ' - <span class="no-design-file">No design file</span>'}</li>
        `).join('')}
      </ul>
      <label>Status:
        <select data-order="${o.id}">
          ${statusOptions.map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${formatStatusLabel(s)}</option>`).join('')}
        </select>
      </label>
      ${o.status === 'delivered' ? '' : '<button type="button" class="btn btn-outline close-order-btn" data-close-order="' + o.id + '">Close Order</button>'}
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

  document.querySelectorAll('[data-close-order]').forEach(button => {
    button.addEventListener('click', async () => {
      const orderId = button.dataset.closeOrder;
      const { error: closeError } = await supabaseClient
        .from('orders')
        .update({ status: 'delivered' })
        .eq('id', orderId);

      if (closeError) {
        showToast('Unable to close order: ' + closeError.message, 'error');
        return;
      }

      showToast('Order closed successfully.', 'success');
      const updated = adminOrders.find(order => order.id === orderId);
      if (updated) {
        updated.status = 'delivered';
      }
      filterOrders();
    });
  });
}

checkSession();
