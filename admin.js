const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginView = document.getElementById('loginView');
const adminView = document.getElementById('adminView');

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
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
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    alert('Login failed: ' + error.message);
    return;
  }
  await checkSession();
});

document.getElementById('addProductBtn').addEventListener('click', async () => {
  const name = document.getElementById('pName').value;
  const description = document.getElementById('pDesc').value;
  const price = parseFloat(document.getElementById('pPrice').value);
  const category = document.getElementById('pCategory').value;
  const imageFile = document.getElementById('pImage').files[0];

  let imageUrl = null;
  if (imageFile) {
    const filePath = `${Date.now()}_${imageFile.name}`;
    const { error: uploadError } = await supabaseClient.storage
      .from('product-images')
      .upload(filePath, imageFile);

    if (uploadError) {
      alert('Image upload failed: ' + uploadError.message);
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
    alert('Error adding product: ' + error.message);
    return;
  }

  alert('Product added.');
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
        alert('Unable to update product visibility: ' + toggleError.message);
        return;
      }
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
        alert('Unable to delete product: ' + deleteError.message);
        return;
      }
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

  const statuses = ['pending', 'paid', 'in_production', 'shipped', 'delivered'];

  document.getElementById('ordersList').innerHTML = orders.map(o => `
    <div class="admin-order-card">
      <p><strong>${o.customer_name}</strong> - ${o.email} - ${o.phone ?? ''}</p>
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
          ${statuses.map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </label>
    </div>
  `).join('');

  document.querySelectorAll('[data-order]').forEach(select => {
    select.addEventListener('change', async () => {
      const { error: statusError } = await supabaseClient
        .from('orders')
        .update({ status: select.value })
        .eq('id', select.dataset.order);
      if (statusError) {
        alert('Unable to update order status: ' + statusError.message);
      }
    });
  });

  document.querySelectorAll('[data-design-path]').forEach(button => {
    button.addEventListener('click', async () => {
      const filePath = button.dataset.designPath;
      const { data, error: signedUrlError } = await supabaseClient.storage
        .from('design-uploads')
        .createSignedUrl(filePath, 3600);

      if (signedUrlError) {
        alert('Unable to open design file: ' + signedUrlError.message);
        return;
      }

      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    });
  });
}

checkSession();
