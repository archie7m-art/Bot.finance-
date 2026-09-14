import { Redis } from "@upstash/redis";

function parseCSV(text){
  const lines=text.replace(/\r/g,"").split("\n").filter(Boolean);
  if(!lines.length) return [];
  const split=line=>{const out=[];let cur="",q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&line[i+1]==='"'){cur+='"';i++;continue}if(c==='"'){q=!q;continue}if(c===","&&!q){out.push(cur.trim());cur="";}else cur+=c}out.push(cur.trim());return out};
  const h=split(lines[0]).map(x=>x.toLowerCase().replace(/[^a-z0-9]+/g,"_"));
  return lines.slice(1).map(split).filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]??""])));
}
const num=v=>{const n=Number(String(v??"").replace(/,/g,""));return Number.isFinite(n)?n:null};
const find=(o,names)=>{const k=Object.keys(o).find(k=>names.some(n=>k===n||k.includes(n)));return k?o[k]:null};

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"POST only"});
  if(!process.env.UPSTASH_REDIS_REST_URL && !process.env.KV_REST_API_URL) return res.status(503).json({error:"Redis storage is not configured"});
  try{
    const body=typeof req.body==="string"?req.body:(req.body?.csv||"");
    if(!body) return res.status(400).json({error:"CSV body is empty"});
    const sourceName=String(req.headers["x-source-name"]||"import.csv").slice(0,120);
    const rows=parseCSV(body);
    if(!rows.length) return res.status(400).json({error:"No CSV rows found"});
    // Keep only analytical fields; raw columns/CSV are never written to Redis.
    const matrix=rows.map((o,i)=>({
      symbol:String(find(o,["symbol","scrip","code","ticker"])??`ROW-${i+1}`),
      company:String(find(o,["company","name","security"])??"").slice(0,160),
      date:String(find(o,["date","trade_date","timestamp"])??""),
      open:num(find(o,["open"])), high:num(find(o,["high"])), low:num(find(o,["low"])),
      close:num(find(o,["close","price","last"])), volume:num(find(o,["volume","traded_volume"])),
      value:num(find(o,["traded_value","value"])), marketCap:num(find(o,["market_cap","marketcapitalization"])),
      oi:num(find(o,["open_interest","oi"])), changeOi:num(find(o,["change_oi","oi_change"])),
      sector:String(find(o,["sector","industry"])??"").slice(0,100)
    })).filter(x=>x.symbol);

    const date=(matrix.map(x=>x.date).filter(Boolean).sort().at(-1))||new Date().toISOString().slice(0,10);
    const snapshot={date,updatedAt:new Date().toISOString(),source:sourceName,rows:matrix.length,matrix:matrix.slice(0,10000)};
    const r=Redis.fromEnv();
    await r.set(`mrl:daily:${date}`,JSON.stringify(snapshot),{ex:60*60*24*120});
    await r.lpush("mrl:daily:index",date); await r.ltrim("mrl:daily:index",0,89);
    return res.status(200).json({ok:true,date,rows:matrix.length,stored:["symbol","company","date","OHLC","volume","value","marketCap","OI","changeOI","sector"],message:"CSV processed transiently. Only the analytical matrix was stored; raw CSV was discarded."});
  }catch(e){return res.status(500).json({error:e.message})}
}
