import { Redis } from '@upstash/redis';
const num=x=>{const n=Number(String(x??'').replace(/,/g,''));return Number.isFinite(n)?n:null};
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  try{
    const r=Redis.fromEnv();
    const text=typeof req.body==='string'?req.body:(req.body?.text||'');
    const lines=text.split(/\r?\n/).filter(Boolean);
    if(!lines.length)return res.status(400).json({error:'Empty CSV'});
    const h=lines[0].split(',').map(x=>x.trim().toLowerCase());
    const si=h.findIndex(x=>/symbol|scrip|ticker|code/.test(x));
    const ci=h.findIndex(x=>/company|name|security/.test(x));
    const mi=h.findIndex(x=>/market_?cap/.test(x));
    const ri=h.findIndex(x=>/^rank$|sr_?no/.test(x));
    const ti=h.findIndex(x=>/cap_?tier|tier/.test(x));
    const universe=lines.slice(1).map(line=>{
      const a=line.split(',');
      const symbol=String(a[si>=0?si:0]||'').trim();
      const company=String(a[ci>=0?ci:1]||'').trim();
      const marketCap=mi>=0?num(a[mi]):null;
      const rank=ri>=0?num(a[ri]):null;
      let capTier=ti>=0?String(a[ti]||'').trim():null;
      if(!capTier&&Number.isFinite(rank)){capTier=rank<=100?'Large':rank<=250?'Mid':'Small'}
      return {symbol,company,marketCap,rank,capTier};
    }).filter(x=>x.symbol);
    await r.set('mrl:universe',JSON.stringify(universe));
    return res.json({ok:true,rows:universe.length});
  }catch(e){return res.status(500).json({error:e.message})}
}
