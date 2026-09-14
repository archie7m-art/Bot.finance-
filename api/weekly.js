import { Redis } from "@upstash/redis";
export default async function handler(req,res){
  if(req.method!=="GET") return res.status(405).json({error:"GET only"});
  if(process.env.CRON_SECRET && req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({error:"Unauthorized"});
  if(!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) return res.status(503).json({error:"Redis storage is not configured"});
  try{const r=Redis.fromEnv(),dates=await r.lrange("mrl:daily:index",0,6),week={weekEnding:new Date().toISOString().slice(0,10),days:dates.length,snapshots:[]};for(const d of dates){const x=await r.get(`mrl:daily:${d}`);if(x)week.snapshots.push(typeof x==="string"?JSON.parse(x):x)}await r.set(`mrl:weekly:${week.weekEnding}`,JSON.stringify(week),{ex:60*60*24*365});return res.status(200).json({ok:true,weekEnding:week.weekEnding,days:week.days})}catch(e){return res.status(500).json({error:e.message})}
}
