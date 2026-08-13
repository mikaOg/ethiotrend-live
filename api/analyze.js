import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { caption, score, tips, hashtags } = req.body;
  const sql = neon(process.env.DATABASE_URL);
  try {
    const result = await sql`
      INSERT INTO analyses (caption, score, tips, hashtags)
      VALUES (${caption}, ${score}, ${JSON.stringify(tips)}, ${JSON.stringify(hashtags)})
      RETURNING *;
    `;
    res.status(200).json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}