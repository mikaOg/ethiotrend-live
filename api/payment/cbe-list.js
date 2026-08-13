const pool = require('../../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { adminKey, status = 'pending' } = req.query;
    if (adminKey !== process.env.ADMIN_API_KEY) return res.status(403).json({ error: 'Invalid admin key' });

    const { rows } = await pool.query("SELECT * FROM payments WHERE method = 'cbe' AND status = $1 ORDER BY created_at DESC", [status]);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
};