import { Redis } from '@upstash/redis';

export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'GET only'});
  if(!process.env.UPSTASH_REDIS_REST_URL && !process.env.KV_REST_API_URL) return res.status(200).json({configured:false,patterns:[],summary:{snapshots:0,observations:0}});
  try{
    const r=Redis.fromEnv();
    const ds=[...new Set(await r.lrange('mrl:daily:index',0,120)||[])];
    const snaps=[];
    for(const d of ds){ const x=await r.get(`mrl:daily:${d}`);
      const parsed=typeof x==='string'?JSON.parse(x):x; if(parsed?.matrix?.length) snaps.push({date:d,rows:parsed.matrix}); }
    const bySymbol=new Map();
    for(const s of snaps){ for(const r of s.rows){ if(!bySymbol.has(r.symbol))bySymbol.set(r.symbol,[]); bySymbol.get(r.symbol).push({...r,date:s.date}); } }
    const buckets=new Map(); let observations=0;
    for(const [symbol,arr] of bySymbol){
      arr.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
      for(let i=0;i<arr.length;i++){
        const r=arr[i]; if(!r.patternSignature)continue;
        const future=(h)=>arr[i+h];
        const outcomes=[1,5,20].map(h=>{const f=future(h); return f&&Number.isFinite(Number(f.close))&&Number(r.close)?(Number(f.close)/Number(r.close)-1)*100:null});
        if(outcomes.some(x=>x!==null)){
          observations++;
          const key=r.patternSignature;
          if(!buckets.has(key))buckets.set(key,{signature:key,n:0,forward1:[],forward5:[],forward20:[],states:{}});
          const b=buckets.get(key); b.n++; [b.forward1,b.forward5,b.forward20].forEach((a,j)=>outcomes[j]!==null&&a.push(outcomes[j])); b.states[r.state]=(b.states[r.state]||0)+1;
        }
      }
    }
    const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
    const median=a=>{if(!a.length)return 0;const q=[...a].sort((x,y)=>x-y);const m=Math.floor(q.length/2);return q.length%2?q[m]:(q[m-1]+q[m])/2};
    const hit=a=>a.length?a.filter(x=>x>0).length/a.length*100:0;
    const patterns=[...buckets.values()].map(b=>({signature:b.signature,observations:b.n,hit1:hit(b.forward1),hit5:hit(b.forward5),hit20:hit(b.forward20),mean1:mean(b.forward1),mean5:mean(b.forward5),mean20:mean(b.forward20),median20:median(b.forward20),states:b.states})).filter(x=>x.observations>=3).sort((a,b)=>b.observations-a.observations);
    return res.status(200).json({configured:true,snapshots:snaps.length,observations,patterns:patterns.slice(0,100),method:'Pattern occurrence is measured only when a future snapshot exists; outcomes are calculated from later observed closes. No look-ahead is used.'});
  }catch(e){return res.status(500).json({error:e.message});}
}
