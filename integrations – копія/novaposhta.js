const axios = require('axios');

// Docs: https://developers.novaposhta.ua/
// Nova Poshta uses a single JSON-RPC style endpoint for every action.
const URL = 'https://api.novaposhta.ua/v2.0/json/';

async function createWaybill(order) {
  const apiKey = process.env.NOVA_POSHTA_API_KEY;
  if (!apiKey) throw new Error('NOVA_POSHTA_API_KEY is not set');

  const payload = {
    apiKey,
    modelName: 'InternetDocument',
    calledMethod: 'save',
    methodProperties: {
      SenderWarehouseIndex: process.env.NP_SENDER_WAREHOUSE_REF,
      NewAddress: '1',
      PayerType: 'Recipient',
      PaymentMethod: 'Cash',
      CargoType: 'Parcel',
      Weight: '1',
      SeatsAmount: '1',
      Description: order.product_name || 'Товар',
      Cost: '500',
      CitySender: process.env.NP_SENDER_CITY_REF,
      Sender: process.env.NP_SENDER_REF,
      SenderAddress: process.env.NP_SENDER_WAREHOUSE_REF,
      ContactSender: process.env.NP_SENDER_CONTACT_REF,
      SendersPhone: process.env.NP_SENDER_PHONE,
      CityRecipient: order.city_ref,
      RecipientAddress: order.warehouse_ref,
      RecipientName: order.client_name,
      RecipientsPhone: order.client_phone
    }
  };

  const res = await axios.post(URL, payload);

  if (!res.data || !res.data.success) {
    const errors = res.data && res.data.errors ? res.data.errors.join('; ') : 'unknown error';
    throw new Error(`Nova Poshta: ${errors}`);
  }

  const doc = res.data.data[0];
  return { ttn: doc.IntDocNumber, ref: doc.Ref };
}

// City/warehouse names from an order (e.g. "Київ" / "Відділення №14") need to be
// resolved to Nova Poshta's internal Ref GUIDs before a waybill can be created.
async function findCityRef(cityName) {
  const apiKey = process.env.NOVA_POSHTA_API_KEY;
  const res = await axios.post(URL, {
    apiKey,
    modelName: 'Address',
    calledMethod: 'getCities',
    methodProperties: { FindByString: cityName, Limit: 1 }
  });
  const city = res.data.data[0];
  return city ? city.Ref : null;
}

async function findWarehouseRef(cityRef, warehouseName) {
  const apiKey = process.env.NOVA_POSHTA_API_KEY;
  const res = await axios.post(URL, {
    apiKey,
    modelName: 'Address',
    calledMethod: 'getWarehouses',
    methodProperties: { CityRef: cityRef, FindByString: warehouseName, Limit: 1 }
  });
  const wh = res.data.data[0];
  return wh ? wh.Ref : null;
}

async function resolveAndCreateWaybill(order) {
  const cityRef = await findCityRef(order.city);
  if (!cityRef) throw new Error(`Could not resolve city "${order.city}" in Nova Poshta`);
  const warehouseRef = await findWarehouseRef(cityRef, order.branch);
  if (!warehouseRef) throw new Error(`Could not resolve warehouse "${order.branch}" in Nova Poshta`);

  return createWaybill(Object.assign({}, order, { city_ref: cityRef, warehouse_ref: warehouseRef }));
}

module.exports = { createWaybill, resolveAndCreateWaybill, findCityRef, findWarehouseRef };
