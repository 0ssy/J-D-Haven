import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

type OrderItemRow = {
  quantity: number;
  products: { name: string; price: number | null } | null;
};

type OrderRow = {
  id: string;
  customer_name: string;
  email: string;
  phone: string | null;
  shipping_address: string;
  notes: string | null;
  created_at: string;
  order_items: OrderItemRow[];
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function formatCurrency(amount: number) {
  return `KSh ${amount.toFixed(2)}`;
}

async function sendEmail(
  resendKey: string,
  from: string,
  to: string,
  subject: string,
  html: string
) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Resend API error: ${message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const emailFrom = Deno.env.get('EMAIL_FROM');
    const sellerEmail = Deno.env.get('SELLER_NOTIFICATION_EMAIL') ?? 'jdhaven726@gmail.com';

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    }
    if (!resendApiKey || !emailFrom) {
      throw new Error('Missing RESEND_API_KEY or EMAIL_FROM.');
    }

    const body = await req.json();
    const orderId = body?.orderId as string | undefined;
    const providedTotal = Number(body?.totalAmount ?? 0);

    if (!orderId) {
      throw new Error('Missing orderId payload.');
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: order, error } = await adminClient
      .from('orders')
      .select(`
        id, customer_name, email, phone, shipping_address, notes, created_at,
        order_items ( quantity, products ( name, price ) )
      `)
      .eq('id', orderId)
      .single<OrderRow>();

    if (error || !order) {
      throw new Error(`Could not load order ${orderId}. ${error?.message ?? ''}`);
    }

    const total = providedTotal > 0
      ? providedTotal
      : order.order_items.reduce((sum, item) => {
        const price = item.products?.price ?? 0;
        return sum + Number(price) * item.quantity;
      }, 0);
    const shortRef = order.id.slice(0, 8);

    const itemRows = order.order_items.map((item) => {
      const name = item.products?.name ?? 'Custom item';
      const unitPrice = Number(item.products?.price ?? 0);
      return `<li>${name} × ${item.quantity} — ${formatCurrency(unitPrice * item.quantity)}</li>`;
    }).join('');

    const buyerHtml = `
      <h2>J&D Haven Order Confirmation</h2>
      <p>Hi ${order.customer_name}, thanks for your order.</p>
      <p><strong>Order reference:</strong> #${shortRef}</p>
      <p><strong>Total amount:</strong> ${formatCurrency(total)}</p>
      <h3>Items</h3>
      <ul>${itemRows}</ul>
      <h3>Payment Instructions</h3>
      <p>Method: M-Pesa (Send Money)</p>
      <p>Number: +254 721 379 961</p>
      <p>Name: J&D HAVEN</p>
      <p>Please send payment confirmation with order ref <strong>#${shortRef}</strong> via WhatsApp or email.</p>
    `;

    const sellerHtml = `
      <h2>New Order Received</h2>
      <p><strong>Order reference:</strong> #${shortRef}</p>
      <p><strong>Customer:</strong> ${order.customer_name}</p>
      <p><strong>Email:</strong> ${order.email}</p>
      <p><strong>Phone:</strong> ${order.phone ?? '-'}</p>
      <p><strong>Shipping address:</strong> ${order.shipping_address}</p>
      <p><strong>Notes:</strong> ${order.notes ?? '-'}</p>
      <p><strong>Total amount:</strong> ${formatCurrency(total)}</p>
      <h3>Items</h3>
      <ul>${itemRows}</ul>
    `;

    await sendEmail(
      resendApiKey,
      emailFrom,
      order.email,
      `J&D Haven Order Confirmation #${shortRef}`,
      buyerHtml
    );

    let sellerNotificationError: string | null = null;
    try {
      await sendEmail(
        resendApiKey,
        emailFrom,
        sellerEmail,
        `New J&D Haven Order #${shortRef}`,
        sellerHtml
      );
    } catch (error) {
      sellerNotificationError = error instanceof Error ? error.message : 'Unknown seller email error.';
      console.error(sellerNotificationError);
    }

    return new Response(JSON.stringify({ ok: true, sellerNotificationError }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
