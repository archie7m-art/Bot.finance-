import { Redis } from '@upstash/redis';

function parseCSV(text){
  const lines=String(text||'').replace(/\r/g,'').split('\n').filter(line=>line.trim());
  if(!lines.length) return [];
  const split=line=>{
    const out=[]; let cur=''; let quoted=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(c==='"' && line[i+1]==='"'){cur+='"';i++;continue;}
      if(c==='"'){quoted=!quoted;continue;}
      if(c===',' && !quoted){out.push(cur.trim());cur='';}
      else cur+=c;
    }
    out.push(cur.trim());
    return out;
  };
  const h=split(lines[0]).map(x=>x.toLowerCase().replace(/[^a-z0-9]+/g,'_'));
  return lines.slice(1).map(split).filter(r=>r.some(Boolean)).map(r=>
    Object.fromEntries(h.map((k,i)=>[k,r[i]??'']))
  );
}

const find=(o,names)=>{
  const k=Object.keys(o).find(k=>names.some(n=>k===n||k.includes(n)));
  return k?o[k]:null;
};

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'POST only'});
  try{
    const r=Redis.fromEnv();
    let text='';
    if(typeof req.body==='string'){
      text=req.body;
      // Some runtimes may pass a JSON string even with an application/json body.
      try{
        const parsed=JSON.parse(text);
        if(parsed && typeof parsed==='object') text=String(parsed.csv||parsed.text||'');
      }catch{}
    }else if(req.body && typeof req.body==='object'){
      text=String(req.body.csv||req.body.text||'');
    }
    if(!text.trim()) return res.status(400).json({error:'Empty CSV'});

    const rows=parseCSV(text);
    if(!rows.length) return res.status(400).json({error:'No CSV rows found'});

    const universe=rows.map((o,i)=>({
      symbol:String(find(o,['symbol','scrip','ticker','code'])??'').trim(),
      company:String(find(o,['company','name','security','security_name'])??'').trim().slice(0,160)
    })).filter(x=>x.symbol);

    if(!universe.length) return res.status(400).json({error:'No securities found. Expected a Symbol, Scrip, Ticker, or Code column.'});

    await r.set('mrl:universe',JSON.stringify(universe));
    return res.json({ok:true,rows:universe.length,message:'Universe imported successfully. Raw CSV was discarded.'});
  }catch(e){
    return res.status(500).json({error:e.message||'Import failed'});
  }
}
