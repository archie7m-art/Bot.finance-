import { Redis } from '@upstash/redis';
import { features, classify, enrich } from './lib/matrix.js';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const yahooSymbol=s=>{const x=String(s).trim();if(/\.(NS|BO)$/i.test(x)||/^\^/.test(x))return x;if(/^\d{6}$/.test(x))return `${x}.BO`;return x;};
async function getYahoo(symbol,range='1y'){
 const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(symbol))}?range=${range}&interval=1d&events=div%2Csplits`;
 const r=await fetch(url,{headers:{'User-Agent':'Market-Research-Lab/3.0','Accept':'application/json'}});if(!r.ok)throw new Error(`Yahoo ${r.status}`);
 const j=await r.json(),x=j?.chart?.result?.[0],q=x?.indicators?.quote?.[0];if(!x||!q)throw new Error('Yahoo empty result');
 return (x.timestamp||[]).map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),open:q.open?.[i],high:q.high?.[i],low:q.low?.[i],close:q.close?.[i],volume:q.volume?.[i]})).filter(x=>Number.isFinite(x.close)&&Number.isFinite(x.volume));
}
async function universe(redis){const raw=await redis.get('mrl:universe');return raw?(typeof raw==='string'?JSON.parse(raw):raw):[]}
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'GET only'});if(process.env.CRON_SECRET&&req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return res.status(401).json({error:'Unauthorized'});
 try{const redis=Redis.fromEnv(),u=await universe(redis);if(!u.length)return res.status(503).json({error:'No universe configured'});
  const requestedLimit=Number(req.query?.limit||200);
  const limit=Math.min(200,Math.max(1,requestedLimit));
  // A persistent cursor makes each scheduled refresh take the next batch instead
  // of repeatedly processing the first 200 securities. INCRBY is atomic in Redis,
  // so concurrent cron invocations reserve different batches.
  const cursor=await redis.incrby('mrl:collector:cursor',limit)-limit;
  const start=((cursor%u.length)+u.length)%u.length;
  const ordered=u.map(x=>typeof x==='string'?x:x.symbol).filter(Boolean);
  const symbols=Array.from({length:Math.min(limit,ordered.length)},(_,i)=>ordered[(start+i)%ordered.length]);
  const offset=start;
  const out=[],errors=[];for(const symbol of symbols){try{const bars=await getYahoo(symbol);const f=features(bars);if(f)out.push({...f,symbol:yahooSymbol(symbol),provider:'yahoo',sourceQuality:'supplemental-unofficial',state:classify(f)});}catch(e){errors.push({symbol,error:e.message})}await sleep(220)}
  const date=out[0]?.date||new Date().toISOString().slice(0,10),key=`mrl:daily:${date}`;const existing=await redis.get(key);const snap=existing?(typeof existing==='string'?JSON.parse(existing):existing):{date,updatedAt:null,matrix:[]};
  const map=new Map((snap.matrix||[]).map(x=>[x.symbol,x]));out.forEach(x=>map.set(x.symbol,x));const matrix=enrich([...map.values()]);snap.updatedAt=new Date().toISOString();snap.rows=matrix.length;snap.sources=['yahoo'];snap.matrix=matrix.slice(0,10000);
  await redis.set(key,JSON.stringify(snap),{ex:60*60*24*365});await redis.lpush('mrl:daily:index',date);await redis.ltrim('mrl:daily:index',0,364);
  await redis.set('mrl:collector:state',JSON.stringify({date,offset:start+symbols.length,total:u.length,cursor,limit,success:out.length,errors:errors.length,lastRun:new Date().toISOString()}),{ex:60*60*24*30});
  return res.json({ok:true,date,processed:symbols.length,success:out.length,errors:errors.length,nextOffset:(start+symbols.length)%u.length,total:u.length,cursor,limit,rotation:'persistent-cursor'});
 }catch(e){return res.status(500).json({error:e.message})}
}
