const { put } = require('@vercel/blob');
const pool = require('../../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fingerprint, imageBase64, transferRef } = req.body;
    if (!fingerprint || !imageBase64 || !transferRef) return res.status(400).json({ error: 'Missing fields' });
    if (!transferRef.startsWith('ET-CBE-')) return res.status(400).json({ error: 'Invalid reference format' });

    const existing = await pool.query('SELECT * FROM payments WHERE cbe_transfer_ref = $1', [transferRef]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'This transfer reference was already submitted' });

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > 4 * 1024 * 1024) return res.status(413).json({ error: 'Image too large. Max 4MB.' });

    const blob = await put(`cbe-screenshots/${transferRef}.jpg`, buffer, { access: 'public', contentType: 'image/jpeg' });

    await pool.query('INSERT INTO payments (fingerprint, method, tx_ref, cbe_screenshot_url, cbe_transfer_ref, status, amount) VALUES ($1,$2,$3,$4,$5,$6,$7)', [fingerprint, 'cbe', transferRef, blob.url, transferRef, 'pending', 150]);

    res.json({ success: true, message: 'Screenshot uploaded! Admin will verify within 24 hours.', screenshotUrl: blob.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
};