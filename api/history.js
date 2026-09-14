import { Redis } from "@upstash/redis";
export default async function handler(req,res){
  if(req.method!=="GET") return res.status(405).json({error:"GET only"});
  if(!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) return res.status(200).json({configured:false,daily:[]});
  try{const r=Redis.fromEnv(),dates=await r.lrange("mrl:daily:index",0,29),daily=[];for(const d of dates){const x=await r.get(`mrl:daily:${d}`);if(x)daily.push(typeof x==="string"?JSON.parse(x):x)}return res.status(200).json({configured:true,daily})}catch(e){return res.status(500).json({error:e.message})}
}
