import { Redis } from '@upstash/redis';
import { enrich } from './lib/matrix.js';
import { runBotPipeline, BOT_REGISTRY } from './lib/bots.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const yahooSymbol = s => {
  const x = String(s).trim();
  if (/\.(NS|BO)$/i.test(x) || /^\^/.test(x)) return x;
  if (/^\d{6}$/.test(x)) return `${x}.BO`;
  return x;
};

async function getYahoo(symbol, range = '1y') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(symbol))}?range=${range}&interval=1d&events=div%2Csplits`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Market-Research-Lab/3.0', 'Accept': 'application/json' } });
  if (!r.ok) throw new Error(`Yahoo ${r.status}`);
  const j = await r.json(), x = j?.chart?.result?.[0], q = x?.indicators?.quote?.[0];
  if (!x || !q) throw new Error('Yahoo empty result');
  return (x.timestamp || []).map((t, i) => ({
    date: new Date(t * 1000).toISOString().slice(0, 10),
    open: q.open?.[i], high: q.high?.[i], low: q.low?.[i], close: q.close?.[i], volume: q.volume?.[i]
  })).filter(x => Number.isFinite(x.close) && Number.isFinite(x.volume));
}

async function universeOf(redis) {
  const raw = await redis.get('mrl:universe');
  const list = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
  return list.map(x => typeof x === 'string' ? { symbol: x } : x).filter(x => x.symbol);
}

async function getJSON(redis, key, fallback) {
  const raw = await redis.get(key);
  return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : fallback;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const redis = Redis.fromEnv();
    const entries = await universeOf(redis);
    if (!entries.length) return res.status(503).json({ error: 'No universe configured' });
    const uMap = new Map(entries.map(x => [x.symbol, x]));

    const offset = Math.max(0, Number(req.query?.offset || 0));
    const limit = Math.min(50, Math.max(1, Number(req.query?.limit || 25)));
    const symbols = entries.map(x => x.symbol).slice(offset, offset + limit);

    // botCounts is the orchestrator's task-tracking ledger for this shard run:
    // one line per bot, tallying what it actually did.
    const botCounts = Object.fromEntries(BOT_REGISTRY.map(b => [b.id, { done: 0, error: 0, flagged: 0 }]));
    const tally = (id, status) => { const c = botCounts[id]; if (!c) return; if (status === 'error') c.error++; else if (status === 'flagged') { c.flagged++; c.done++; } else c.done++; };

    const out = [], errors = [], auditBySymbol = {};
    for (const symbol of symbols) {
      let bars = null;
      try {
        bars = await getYahoo(symbol);
      } catch (e) {
        auditBySymbol[symbol] = [{ bot: 'collector', status: 'error', verdict: e.message, data: {}, at: new Date().toISOString() }];
        errors.push({ symbol, error: e.message });
        tally('collector', 'error');
        await sleep(220);
        continue;
      }
      const meta = uMap.get(symbol) || {};
      const { row, audit } = runBotPipeline(symbol, bars, meta);
      audit.forEach(a => tally(a.bot, a.status));
      auditBySymbol[symbol] = audit;
      if (row) { row.symbol = yahooSymbol(symbol); out.push(row); }
      else errors.push({ symbol, error: audit[audit.length - 1]?.verdict || 'pipeline failed' });
      await sleep(220);
    }

    const date = out[0]?.date || new Date().toISOString().slice(0, 10);

    // Merge this shard's matrix rows into the day's snapshot.
    const matrixKey = `mrl:daily:${date}`;
    const existingSnap = await getJSON(redis, matrixKey, { date, updatedAt: null, matrix: [] });
    const matrixMap = new Map((existingSnap.matrix || []).map(x => [x.symbol, x]));
    out.forEach(x => matrixMap.set(x.symbol, x));
    const matrix = enrich([...matrixMap.values()]);
    existingSnap.updatedAt = new Date().toISOString();
    existingSnap.rows = matrix.length;
    existingSnap.sources = ['yahoo'];
    existingSnap.matrix = matrix.slice(0, 10000);
    await redis.set(matrixKey, JSON.stringify(existingSnap), { ex: 60 * 60 * 24 * 365 });
    await redis.lpush('mrl:daily:index', date);
    await redis.ltrim('mrl:daily:index', 0, 364);

    // Merge this shard's bot audit trail into the day's audit log.
    const botsKey = `mrl:bots:${date}`;
    const existingBots = await getJSON(redis, botsKey, {});
    Object.assign(existingBots, auditBySymbol);
    await redis.set(botsKey, JSON.stringify(existingBots), { ex: 60 * 60 * 24 * 365 });

    // Merge this shard's task counts into the day's orchestrator job record.
    const jobKey = `mrl:job:${date}`;
    const job = await getJSON(redis, jobKey, { date, botCounts: Object.fromEntries(BOT_REGISTRY.map(b => [b.id, { done: 0, error: 0, flagged: 0 }])), shards: [] });
    for (const b of BOT_REGISTRY) {
      job.botCounts[b.id] = job.botCounts[b.id] || { done: 0, error: 0, flagged: 0 };
      job.botCounts[b.id].done += botCounts[b.id].done;
      job.botCounts[b.id].error += botCounts[b.id].error;
      job.botCounts[b.id].flagged += botCounts[b.id].flagged;
    }
    job.shards = [...(job.shards || []), { offset, limit, processed: symbols.length, success: out.length, errors: errors.length, at: new Date().toISOString() }].slice(-20);
    job.updatedAt = new Date().toISOString();
    await redis.set(jobKey, JSON.stringify(job), { ex: 60 * 60 * 24 * 30 });

    // Legacy status key some older clients may still poll.
    await redis.set('mrl:collector:state', JSON.stringify({ date, offset: offset + symbols.length, total: entries.length, success: out.length, errors: errors.length, lastRun: new Date().toISOString() }), { ex: 60 * 60 * 24 * 30 });

    return res.json({ ok: true, date, processed: symbols.length, success: out.length, errors: errors.length, nextOffset: offset + symbols.length, total: entries.length, botCounts });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
