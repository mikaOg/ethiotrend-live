const { Redis } = require('@upstash/redis');
const axios = require('axios');
const { parseStringPromise } = require('xml2js');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const cached = await redis.get('external_trends');
    if (cached) return res.json({ success: true, data: cached, cached: true });

    const rssUrl = 'https://news.google.com/rss/search?q=ethiopia&hl=en-US&gl=US&ceid=US:en';
    const response = await axios.get(rssUrl, { timeout: 8000 });
    const parsed = await parseStringPromise(response.data);
    const items = parsed.rss?.channel?.[0]?.item || [];
    const trends = items.slice(0, 12).map(item => {
      let title = item.title?.[0]?.replace(/\(.*?\)/g, '').trim() || 'Ethiopia News';
      if (title.length > 70) title = title.substring(0, 70) + '...';
      return title;
    });

    await redis.setex('external_trends', 300, trends);
    res.json({ success: true, data: trends, cached: false });
  } catch (err) {
    console.error(err);
    res.json({ success: true, data: ['Ethiopian music','Addis Ababa','Habesha culture','Ethiopian coffee','TikTok Ethiopia'], cached: false, fallback: true });
  }
};