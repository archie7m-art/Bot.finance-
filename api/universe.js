import { Redis } from '@upstash/redis';

function parseCSV(text){
  const lines=String(text||'').replace(/\r/g,'').split('\n').filter(Boolean);
  if(!lines.length)return [];
  const split=line=>{const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&line[i+1]==='"'){cur+='"';i++;continue}if(c==='"'){q=!q;continue}if(c===','&&!q){out.push(cur.trim());cur='';}else cur+=c}out.push(cur.trim());return out};
  const h=split(lines[0]).map(x=>x.toLowerCase().replace(/[^a-z0-9]+/g,'_'));
  const find=(o,names)=>{const k=Object.keys(o).find(k=>names.some(n=>k===n||k.includes(n)));return k?o[k]:null};
  return lines.slice(1).map(split).filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]??'']))).map((o,i)=>({symbol:String(find(o,['symbol','scrip','code','ticker'])??`ROW-${i+1}`).trim(),company:String(find(o,['company','name','security'])??'').trim().slice(0,160)})).filter(x=>x.symbol);
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  try{
    const body=typeof req.body==='string'?req.body:(req.body||{});
    let universe=[];
    if(Array.isArray(body.universe)){
      universe=body.universe.map(x=>({symbol:String(x?.symbol??'').trim(),company:String(x?.company??'').trim().slice(0,160)})).filter(x=>x.symbol);
    }else if(typeof body.csv==='string'){
      universe=parseCSV(body.csv);
    }else if(typeof body.text==='string'){
      universe=parseCSV(body.text);
    }else if(typeof req.body==='string'){
      universe=parseCSV(req.body);
    }
    if(!universe.length)return res.status(400).json({error:'No universe rows received'});
    const r=Redis.fromEnv();
    await r.set('mrl:universe',JSON.stringify(universe.slice(0,10000)));
    return res.json({ok:true,rows:universe.length});
  }catch(e){return res.status(500).json({error:e.message})}
}
