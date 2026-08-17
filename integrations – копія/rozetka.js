const axios = require('axios');

// Docs: https://api-seller.rozetka.com.ua/apidoc/
// Auth returns a Bearer token valid for 24h - we cache it and refetch when expired.
const BASE_URL = 'https://api-seller.rozetka.com.ua';

let cachedToken = null;
let tokenExpiresAt = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const login = process.env.ROZETKA_LOGIN;
  const password = process.env.ROZETKA_PASSWORD;
  if (!login || !password) return null;

  const res = await axios.post(`${BASE_URL}/auth`, { login, password });
  cachedToken = res.data && (res.data.token || res.data.access_token);
  // Refresh a little before the real 24h expiry to be safe.
  tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000;
  return cachedToken;
}

async function fetchRecentOrders(limit = 50) {
  const token = await getToken();
  if (!token) return [];

  const res = await axios.get(`${BASE_URL}/orders`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit, expand: 'delivery,customer' }
  });

  const orders = (res.data && res.data.orders) || [];

  return orders.map((o) => ({
    source: 'Rozetka',
    external_id: String(o.id),
    client_name: o.customer ? [o.customer.first_name, o.customer.last_name].filter(Boolean).join(' ') : null,
    client_phone: o.customer ? o.customer.phone : null,
    city: o.delivery ? o.delivery.city : null,
    branch: o.delivery ? o.delivery.warehouse : null,
    delivery_type: o.delivery ? o.delivery.provider : null,
    product_name: (o.items && o.items[0] && o.items[0].name) || null,
    size: null,
    commission: null,
    status: o.status,
    raw: o
  }));
}

module.exports = { fetchRecentOrders };
