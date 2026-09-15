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
    const botId = String(req.query?.bot || '');
    let date = String(req.query?.date || '');
    if (!date) {
      const dates = await redis.lrange('mrl:daily:index', 0, 0);
      date = dates?.[0] || '';
    }
    if (!date) return res.status(200).json({ configured: true, registry: BOT_REGISTRY, date: null, job: null, symbol, audit: [], feed: [] });

    const job = await getJSON(redis, `mrl:job:${date}`, null);
    let audit = [], feed = [];
    const bots = (symbol || botId) ? await getJSON(redis, `mrl:bots:${date}`, {}) : {};
    if (symbol) {
      const bare = symbol.replace(/\.(NS|BO)$/i, '');
      audit = bots[symbol] || bots[bare] || [];
    }
    if (botId) {
      for (const [sym, entries] of Object.entries(bots)) {
        const hit = (entries || []).find(e => e.bot === botId);
        if (hit) feed.push({ symbol: sym, ...hit });
      }
      feed.sort((a, b) => (a.status === 'error' || a.status === 'flagged' ? -1 : 1) - (b.status === 'error' || b.status === 'flagged' ? -1 : 1));
      feed = feed.slice(0, 200);
    }
    return res.status(200).json({ configured: true, registry: BOT_REGISTRY, date, job, symbol, audit, bot: botId, feed });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
