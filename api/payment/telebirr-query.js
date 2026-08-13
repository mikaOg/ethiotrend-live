const axios = require('axios');
const pool = require('../../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { txRef } = req.body;
    if (!txRef) return res.status(400).json({ error: 'Transaction reference required' });

    const payRes = await pool.query('SELECT * FROM payments WHERE tx_ref = $1', [txRef]);
    const payment = payRes.rows[0];
    if (!payment) return res.status(404).json({ error: 'Transaction not found' });

    const auth = Buffer.from(`${process.env.TELEBIRR_APP_ID}:${process.env.TELEBIRR_APP_KEY}`).toString('base64');
    const tokenRes = await axios.post(`${process.env.TELEBIRR_BASE_URL}/payment/v1/token`, { appid: process.env.TELEBIRR_APP_ID }, { headers: { 'Authorization': `Basic ${auth}` } });
    const fabricToken = tokenRes.data.token;

    const queryRes = await axios.post(`${process.env.TELEBIRR_BASE_URL}/payment/v1/merchant/orderQuery`, {
      appid: process.env.TELEBIRR_APP_ID,
      merch_code: process.env.TELEBIRR_MERCHANT_CODE,
      merch_order_id: txRef
    }, {
      headers: { 'X-APP-Key': process.env.TELEBIRR_APP_KEY, 'Authorization': `Bearer ${fabricToken}` }
    });

    const telebirrStatus = queryRes.data.data?.trade_status || queryRes.data.trade_status;
    if (telebirrStatus === 'SUCCESS') {
      await pool.query("UPDATE payments SET status = 'paid' WHERE tx_ref = $1", [txRef]);
      await pool.query("UPDATE users SET is_premium = true, analyses_limit = 999999, premium_expiry = $1, payment_method = 'telebirr' WHERE fingerprint = $2", [new Date(Date.now() + 30*24*60*60*1000), payment.fingerprint]);
      return res.json({ success: true, status: 'paid', message: 'Payment confirmed! Premium activated.' });
    }

    res.json({ success: true, status: payment.status, telebirrStatus, message: 'Payment still pending' });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Query failed' });
  }
};