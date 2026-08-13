const pool = require('../../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { adminKey, txRef, action } = req.body;
    if (adminKey !== process.env.ADMIN_API_KEY) return res.status(403).json({ error: 'Invalid admin key' });
    if (!txRef || !action) return res.status(400).json({ error: 'Missing fields' });

    const payRes = await pool.query('SELECT * FROM payments WHERE tx_ref = $1 AND method = $2', [txRef, 'cbe']);
    const payment = payRes.rows[0];
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    if (action === 'approve') {
      await pool.query("UPDATE payments SET status = 'paid', verified_by = 'admin', verified_at = NOW() WHERE tx_ref = $1", [txRef]);
      await pool.query("UPDATE users SET is_premium = true, analyses_limit = 999999, premium_expiry = $1, payment_method = 'cbe' WHERE fingerprint = $2", [new Date(Date.now() + 30*24*60*60*1000), payment.fingerprint]);
      return res.json({ success: true, message: 'CBE payment approved. Premium activated.', userFingerprint: payment.fingerprint });
    } else if (action === 'reject') {
      await pool.query("UPDATE payments SET status = 'failed' WHERE tx_ref = $1", [txRef]);
      return res.json({ success: true, message: 'Payment rejected' });
    } else {
      return res.status(400).json({ error: 'Action must be approve or reject' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
};