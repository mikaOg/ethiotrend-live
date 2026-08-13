const pool = require('../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { platform = 'all', limit = 60 } = req.query;
    const sql = platform === 'all'
      ? 'SELECT * FROM creators ORDER BY growth DESC LIMIT $1'
      : 'SELECT * FROM creators WHERE category = $1 ORDER BY growth DESC LIMIT $2';
    const params = platform === 'all' ? [limit] : [platform, limit];
    const { rows } = await pool.query(sql, params);

    const creators = rows.map(c => ({
      id: c.id,
      name: c.name,
      username: c.username,
      category: c.category,
      growth: +(c.growth + (Math.random() * 1 - 0.5)).toFixed(1),
      sentiment: Math.min(100, Math.max(0, Math.round(c.sentiment + (Math.random() * 2 - 1)))),
      volume: c.volume,
      data: c.data || [],
      desc: c.desc,
      recentPost: c.recent_post,
      thumbnail: c.thumbnail,
      videoUrl: c.video_url,
      awards: c.awards,
      verified: c.verified
    }));

    res.json({ success: true, data: creators });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch creators' });
  }
};