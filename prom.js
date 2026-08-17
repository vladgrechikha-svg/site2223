const axios = require('axios');

// Docs: https://prom.ua/cloud-cgi/static/uaprom-static/docs/swagger/index.html
// Verify exact field names against current docs - marketplace APIs change over time.
const BASE_URL = 'https://my.prom.ua/api/v1';

async function fetchRecentOrders(limit = 50) {
  const token = process.env.PROM_API_TOKEN;
  if (!token) return [];

  const res = await axios.get(`${BASE_URL}/orders/list`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit }
  });

  const orders = (res.data && res.data.orders) || [];

  return orders.map((o) => ({
    source: 'Prom',
    external_id: String(o.id),
    client_name: o.client_full_name || [o.client_first_name, o.client_second_name].filter(Boolean).join(' '),
    client_phone: o.phone,
    city: o.delivery_address ? o.delivery_address.city : null,
    branch: o.delivery_address ? o.delivery_address.warehouse : null,
    delivery_type: o.delivery_provider_data ? o.delivery_provider_data.provider : null,
    product_name: (o.products && o.products[0] && o.products[0].name) || null,
    size: null,
    commission: null,
    status: o.status,
    raw: o
  }));
}

module.exports = { fetchRecentOrders };
