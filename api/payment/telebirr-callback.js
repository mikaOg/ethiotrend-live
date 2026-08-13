const pool = require('../../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const { merch_order_id, trade_no, status } = req.body;
    if (!merch_order_id) return res.status(400).json({ error: 'Missing order ID' });

    const payRes = await pool.query('SELECT * FROM payments WHERE tx_ref = $1', [merch_order_id]);
    const payment = payRes.rows[0];
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    if (status === 'SUCCESS' || status === 'success' || req.body.result === 'SUCCESS') {
      await pool.query("UPDATE payments SET status = 'paid', telebirr_trade_no = $1 WHERE tx_ref = $2", [trade_no, merch_order_id]);
      await pool.query("UPDATE users SET is_premium = true, analyses_limit = 999999, premium_expiry = $1, payment_method = 'telebirr' WHERE fingerprint = $2", [new Date(Date.now() + 30*24*60*60*1000), payment.fingerprint]);
      return res.json({ success: true, message: 'Premium activated' });
    } else {
      await pool.query("UPDATE payments SET status = 'failed' WHERE tx_ref = $1", [merch_order_id]);
      return res.json({ success: false, message: 'Payment failed' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Webhook failed' });
  }
};