const axios = require('axios');

async function notifyNewOrder(order) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const text = [
    `🆕 Нове замовлення (${order.source})`,
    `Товар: ${order.product_name || '-'} ${order.size ? '(' + order.size + ')' : ''}`,
    `Клієнт: ${order.client_name || '-'}`,
    `Тел: ${order.client_phone || '-'}`,
    `Місто: ${order.city || '-'}, ${order.branch || '-'}`
  ].join('\n');

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text
    });
  } catch (err) {
    console.error('Telegram notify failed:', err.response ? err.response.data : err.message);
  }
}

module.exports = { notifyNewOrder };
