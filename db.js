const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

const adapter = new FileSync(path.join(__dirname, 'orders.json'));
const db = low(adapter);

db.defaults({ orders: [] }).write();

function upsertOrder(order) {
  const existing = db.get('orders').find({ source: order.source, external_id: order.external_id }).value();
  if (existing) {
    db.get('orders')
      .find({ source: order.source, external_id: order.external_id })
      .assign(order)
      .write();
    return { order: db.get('orders').find({ source: order.source, external_id: order.external_id }).value(), isNew: false };
  }
  const record = Object.assign(
    {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      received_at: new Date().toISOString(),
      ttn: null,
      commission: order.commission || null
    },
    order
  );
  db.get('orders').push(record).write();
  return { order: record, isNew: true };
}

function getLastOrders(limit = 50) {
  return db.get('orders').sortBy('received_at').reverse().take(limit).value();
}

function getOrderById(id) {
  return db.get('orders').find({ id }).value();
}

function setTtn(id, ttn) {
  db.get('orders').find({ id }).assign({ ttn }).write();
  return db.get('orders').find({ id }).value();
}

module.exports = { db, upsertOrder, getLastOrders, getOrderById, setTtn };
