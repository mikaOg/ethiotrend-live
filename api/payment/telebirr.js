const axios = require('axios');
const pool = require('../../lib/db');

async function getFabricToken() {
  const auth = Buffer.from(`${process.env.TELEBIRR_APP_ID}:${process.env.TELEBIRR_APP_KEY}`).toString('base64');
  const res = await axios.post(`${process.env.TELEBIRR_BASE_URL}/payment/v1/token`, { appid: process.env.TELEBIRR_APP_ID }, {
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
    timeout: 10000
  });
  return res.data.token || res.data.access_token;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fingerprint, phone } = req.body;
    if (!fingerprint) return res.status(400).json({ error: 'Fingerprint required' });

    const userRes = await pool.query('SELECT * FROM users WHERE fingerprint = $1', [fingerprint]);
    if (!userRes.rows[0]) await pool.query('INSERT INTO users (fingerprint) VALUES ($1)', [fingerprint]);

    const txRef = `ET-TB-${fingerprint.slice(0,6)}-${Date.now()}`;
    const fabricToken = await getFabricToken();

    const orderRes = await axios.post(`${process.env.TELEBIRR_BASE_URL}/payment/v1/paymentorder`, {
      appid: process.env.TELEBIRR_APP_ID,
      merch_code: process.env.TELEBIRR_MERCHANT_CODE,
      merch_order_id: txRef,
      title: 'EthioTrend AI Premium',
      total_amount: '150',
      trans_currency: 'ETB',
      trade_type: 'InApp',
      callback_url: `${process.env.APP_URL}/api/payment/telebirr-callback`,
      timeout_express: '30m',
      payee_identifier: phone || '251911000000',
      payee_identifier_type: '04',
      payee_type: '5000',
      redirect_url: `${process.env.APP_URL}/?payment=telebirr-success`
    }, {
      headers: { 'X-APP-Key': process.env.TELEBIRR_APP_KEY, 'Authorization': `Bearer ${fabricToken}`, 'Content-Type': 'application/json' },
      timeout: 15000
    });

    await pool.query('INSERT INTO payments (fingerprint, method, tx_ref, status, amount) VALUES ($1,$2,$3,$4,$5)', [fingerprint, 'telebirr', txRef, 'pending', 150]);

    res.json({
      success: true,
      tx_ref: txRef,
      payment_url: orderRes.data.data?.payment_url || orderRes.data.payment_url,
      qr_code: orderRes.data.data?.qr_code || null
    });

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Telebirr init failed', details: err.response?.data?.message || err.message });
  }
};