import { Redis } from '@upstash/redis';
import { BOT_REGISTRY } from './lib/bots.js';

async function getJSON(redis, key, fallback) {
  const raw = await redis.get(key);
  return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : fallback;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  if (!process.env.UPSTASH_REDIS_REST_URL && !process.env.KV_REST_API_URL) {
    return res.status(200).json({ configured: false, registry: BOT_REGISTRY, date: null, job: null, symbol: null, audit: [] });
  }
  try {
    const redis = Redis.fromEnv();
    const symbol = String(req.query?.symbol || '');
    let date = String(req.query?.date || '');
    if (!date) {
      const dates = await redis.lrange('mrl:daily:index', 0, 0);
      date = dates?.[0] || '';
    }
    if (!date) return res.status(200).json({ configured: true, registry: BOT_REGISTRY, date: null, job: null, symbol, audit: [] });

    const job = await getJSON(redis, `mrl:job:${date}`, null);
    let audit = [];
    if (symbol) {
      const bots = await getJSON(redis, `mrl:bots:${date}`, {});
      const bare = symbol.replace(/\.(NS|BO)$/i, '');
      audit = bots[symbol] || bots[bare] || [];
    }
    return res.status(200).json({ configured: true, registry: BOT_REGISTRY, date, job, symbol, audit });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
