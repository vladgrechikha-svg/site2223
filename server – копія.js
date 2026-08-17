require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');

const { upsertOrder, getLastOrders, getOrderById, setTtn } = require('./db');
const prom = require('./integrations/prom');
const rozetka = require('./integrations/rozetka');
const novaposhta = require('./integrations/novaposhta');
const telegram = require('./integrations/telegram');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- 1. Receives orders pushed directly from your own site ---
app.post('/webhook/site-order', async (req, res) => {
  const body = req.body || {};
  const order = {
    source: 'Сайт',
    external_id: body.order_code || String(Date.now()),
    client_name: body.full_name,
    client_phone: body.phone,
    city: body.city,
    branch: body.branch,
    delivery_type: 'Нова пошта',
    product_name: (body.items && body.items[0] && body.items[0].item_name) || body.order_details,
    size: null,
    commission: null,
    status: 'new'
  };
  const { order: saved, isNew } = upsertOrder(order);
  if (isNew) await telegram.notifyNewOrder(saved);
  res.json({ ok: true });
});

// --- 2. Dashboard reads orders from here ---
app.get('/api/orders', (req, res) => {
  res.json(getLastOrders(50));
});

// --- 3. Generate a Nova Poshta waybill for one order ---
app.post('/api/orders/:id/invoice', async (req, res) => {
  const order = getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  try {
    const { ttn } = await novaposhta.resolveAndCreateWaybill(order);
    const updated = setTtn(order.id, ttn);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 4. Manually attach a waybill number typed in by hand ---
app.post('/api/orders/:id/invoice-manual', (req, res) => {
  const { ttn } = req.body;
  if (!ttn) return res.status(400).json({ error: 'ttn is required' });
  const updated = setTtn(req.params.id, ttn);
  res.json(updated);
});

// --- 5. Pull marketplaces for new orders (also runs on a schedule below) ---
async function syncMarketplaces() {
  const results = await Promise.allSettled([prom.fetchRecentOrders(50), rozetka.fetchRecentOrders(50)]);

  for (const result of results) {
    if (result.status !== 'fulfilled') {
      console.error('Sync failed:', result.reason && result.reason.message);
      continue;
    }
    for (const order of result.value) {
      const { order: saved, isNew } = upsertOrder(order);
      if (isNew) await telegram.notifyNewOrder(saved);
    }
  }
}

app.post('/api/sync', async (req, res) => {
  await syncMarketplaces();
  res.json({ ok: true, orders: getLastOrders(50) });
});

const intervalMinutes = Number(process.env.SYNC_INTERVAL_MINUTES || 5);
cron.schedule(`*/${intervalMinutes} * * * *`, () => {
  syncMarketplaces().catch((err) => console.error('Scheduled sync error:', err));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CRM running on http://localhost:${PORT}`));
