import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Activity,BarChart3,Database,FlaskConical,RefreshCw,Search,ShieldCheck,Upload,ChevronRight,Info,Layers3,Network,BrainCircuit,GitBranch,LineChart,SlidersHorizontal} from 'lucide-react';
import './styles.css';
const demo=[
{symbol:'RELIANCE.BO',company:'Reliance Industries',close:1420,return1d:1.2,return5d:4.2,return20d:8.4,rvolZ:2.1,buyPressure:2.4,sellPressure:.3,netPressure:2.1,momentumZ:1.8,drawdown:-3.2,volatility:19.4,clv:.74,participation:1.8,pressureTrend:.9,state:'BUILD-UP',confidence:82,quality:.96},
{symbol:'TCS.BO',company:'Tata Consultancy Services',close:3920,return1d:.2,return5d:1.1,return20d:2.3,rvolZ:.4,buyPressure:.5,sellPressure:.3,netPressure:.2,momentumZ:.6,drawdown:-4.8,volatility:18.2,clv:.15,participation:.3,pressureTrend:.1,state:'BALANCED',confidence:61,quality:.96},
{symbol:'HDFCBANK.BO',company:'HDFC Bank',close:1680,return1d:-1.1,return5d:-2.2,return20d:-5.8,rvolZ:1.7,buyPressure:.2,sellPressure:1.9,netPressure:-1.7,momentumZ:-1.2,drawdown:-11.1,volatility:28.1,clv:-.71,participation:1.6,pressureTrend:-.8,state:'DISTRIBUTION',confidence:85,quality:.96},
{symbol:'SBIN.BO',company:'State Bank of India',close:820,return1d:1.4,return5d:3.4,return20d:7.1,rvolZ:2.8,buyPressure:2.8,sellPressure:.4,netPressure:2.4,momentumZ:2.2,drawdown:-5.7,volatility:24.5,clv:.82,participation:2.4,pressureTrend:1.1,state:'BUILD-UP',confidence:89,quality:.96}];
const n=x=>Number.isFinite(Number(x))?Number(x):0,pct=(x,d=2)=>`${n(x).toFixed(d)}%`,sig=x=>`${n(x).toFixed(2)}σ`;
function App(){const fileInputRef=useRef(null);const [tab,setTab]=useState('research'),[rows,setRows]=useState(demo),[history,setHistory]=useState([]),[summary,setSummary]=useState(null),[counts,setCounts]=useState({}),[query,setQuery]=useState(''),[message,setMessage]=useState(''),[loading,setLoading]=useState(false),[configured,setConfigured]=useState(false),[selected,setSelected]=useState(null);
 async function load(){setLoading(true);try{const r=await fetch('/api/state');if(!r.ok)throw Error();const j=await r.json();if(j.matrix?.length)setRows(j.matrix);setHistory(j.history||[]);setCounts(j.counts||{});setSummary(j.summary||null);setConfigured(!!j.configured);setMessage(j.matrix?.length?'Live analytical matrix loaded.':'Storage connected; awaiting collector output.')}catch{setMessage('Research preview active. Connect Upstash Redis for live collection.')}finally{setLoading(false)}}async function loadValidation(){try{const r=await fetch('/api/validation');if(r.ok)setValidation(await r.json())}catch{}} useEffect(()=>{load();loadValidation()},[]);
 async function importCsv(file){
  if(!file)return;
  setMessage('Reading file → normalizing → discarding raw file…');
  try{
    const name=(file.name||'').toLowerCase();
    const isExcel=name.endsWith('.xlsx')||name.endsWith('.xls');
    let text;
    if(isExcel){
      setMessage('Reading Excel workbook → converting first sheet to CSV…');
      const buffer=await file.arrayBuffer();
      const XLSX=await import('xlsx');
      const workbook=XLSX.read(buffer,{type:'array'});
      const firstSheet=workbook.Sheets[workbook.SheetNames[0]];
      if(!firstSheet)throw Error('The Excel workbook has no readable sheets');
      text=XLSX.utils.sheet_to_csv(firstSheet);
    }else{
      text=await file.text();
    }
    if(!text.trim())throw Error('Selected file is empty');
    const r=await fetch('/api/universe',{
      method:'POST',
      headers:{'Content-Type':'application/json','X-Source-Name':file.name||'import.csv'},
      body:JSON.stringify({csv:text})
    });
    const j=await r.json().catch(()=>({error:'Invalid server response'}));
    if(!r.ok)throw Error(j.error||'Import request failed');
    setMessage(`${Number(j.rows||0).toLocaleString()} securities added to collector universe.`);
    if(fileInputRef.current)fileInputRef.current.value='';
    await load();
  }catch(e){
    setMessage(`Import failed: ${e.message||'Unable to read the selected file'}`);
    if(fileInputRef.current)fileInputRef.current.value='';
  }
}
function openFilePicker(){fileInputRef.current?.click()}
 const filtered=useMemo(()=>rows.filter(x=>(`${x.symbol} ${x.company}`).toLowerCase().includes(query.toLowerCase())),[rows,query]);
 const s=summary||{breadth:rows.length?rows.filter(x=>n(x.return1d)>0).length/rows.length*100:0,pressureBreadth:rows.length?rows.filter(x=>n(x.netPressure)>0).length/rows.length*100,regime:'MIXED',avgPressure:rows.reduce((a,x)=>a+n(x.netPressure),0)/(rows.length||1),avgVolatility:rows.reduce((a,x)=>a+n(x.volatility),0)/(rows.length||1)};
 const selectedRow=selected?rows.find(x=>x.symbol===selected):null;
 return <div className="app"><header><div className="brand"><div className="mark">MR</div><div><h1>Market Research Lab <em>FINAL</em></h1><span>Quantitative reverse-engineering workstation</span></div></div><div className="status"><i/> {configured?'LIVE MATRIX':'RESEARCH MODE'} <span>•</span> DAILY</div></header>
 <nav>{[['research','Research',FlaskConical],['matrix','Matrix',Database],['patterns','Patterns',BarChart3],['risk','Risk',ShieldCheck]].map(([id,label,I])=><button className={tab===id?'active':''} onClick={()=>setTab(id)} key={id}><I size={15}/>{label}</button>)}</nav>
 <main><section className="hero"><div><p className="eyebrow">OBSERVE → NORMALIZE → MODEL → VALIDATE</p><h2>Market behavior,<br/><b>reconstructed from matrices.</b></h2><p className="sub">An evidence-first quantitative engine that converts observable market data into pressure, participation, momentum, risk and latent-state matrices—then tests recurring configurations.</p></div><div className="heroTools">
  <button type="button" className="featureBtn" onClick={openFilePicker}>
    <Upload size={14}/> Import Universe
  </button>
  <input
    ref={fileInputRef}
    className="filePicker"
    type="file"
    accept="*/*"
    onChange={e=>importCsv(e.target.files?.[0])}
  />
  <button className="refresh" onClick={()=>{load();loadValidation()}}>
    <RefreshCw size={14}/>{loading?'Updating…':'Refresh matrix'}
  </button>
</div></section>
 {message&&<div className="notice"><Info size={14}/>{message}</div>}
 <section className="marketStrip"><div className="regime"><span>MARKET REGIME</span><strong>{s.regime}</strong><small>Breadth {pct(s.breadth,1)} · pressure breadth {pct(s.pressureBreadth,1)}</small></div><Metric label="UNIVERSE" value={rows.length.toLocaleString()} sub="securities"/><Metric label="BUILD-UP" value={(counts.build??rows.filter(x=>x.state==='BUILD-UP').length).toLocaleString()} sub="positive configuration"/><Metric label="DISTRIBUTION" value={(counts.distribution??rows.filter(x=>x.state==='DISTRIBUTION').length).toLocaleString()} sub="negative configuration"/><Metric label="NET PRESSURE" value={sig(s.avgPressure)} sub="cross-sectional mean"/></section>
 {tab==='research'&&<Research rows={filtered} query={query} setQuery={setQuery} onSelect={setSelected}/>} {tab==='matrix'&&<Matrix rows={rows}/>} {tab==='patterns'&&<Patterns rows={rows} counts={counts} history={history} validation={validation}/>} {tab==='risk'&&<Risk rows={rows}/>} 
 <section className="architecture"><div><p className="eyebrow">RESEARCH ARCHITECTURE</p><h3>Observation → inference chain</h3><p>No black-box claim. Every state can be traced back to measurable variables and mathematical transformations.</p></div><div className="chainFlow"><Node t="OBSERVE"/><Node t="NORMALIZE"/><Node t="MATRIX"/><Node t="PATTERN"/><Node t="VALIDATE"/></div></section>
 <section className="footerNote"><BrainCircuit/><span><b>Research discipline:</b> indirect data can reconstruct market behavior proxies, but it cannot establish participant identity as fact. Predictive claims require out-of-sample validation.</span></section>
 {selectedRow&&<Drawer row={selectedRow} onClose={()=>setSelected(null)}/>}</main></div>}
function Metric({label,value,sub}){return <div><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>}
function Node({t}){return <div className="node"><b>{t}</b><ChevronRight size={13}/></div>}
function Research({rows,query,setQuery,onSelect}){return <section className="panel"><div className="panelhead"><div><p className="eyebrow">RESEARCH OUTPUT</p><h3>Cross-sectional state matrix</h3></div><div className="search"><Search size={14}/><input placeholder="Search security" value={query} onChange={e=>setQuery(e.target.value)}/></div></div><div className="description">Ranked research surface. Click any row to inspect its evidence chain and data quality.</div><div className="tablewrap"><table><thead><tr><th>Security</th><th>Close</th><th>1D</th><th>5D</th><th>RVOL</th><th>BUY</th><th>SELL</th><th>NET</th><th>MOM</th><th>DD</th><th>STATE</th></tr></thead><tbody>{rows.slice(0,500).map((r,i)=><tr key={r.symbol+i} onClick={()=>onSelect(r.symbol)} className="clickrow"><td><b>{r.symbol}</b><small>{r.company}</small></td><td>{n(r.close).toLocaleString(undefined,{maximumFractionDigits:2})}</td><td className={n(r.return1d)>=0?'pos':'neg'}>{pct(r.return1d)}</td><td>{pct(r.return5d)}</td><td>{sig(r.rvolZ)}</td><td>{n(r.buyPressure).toFixed(2)}</td><td>{n(r.sellPressure).toFixed(2)}</td><td className={n(r.netPressure)>=0?'pos':'neg'}>{n(r.netPressure).toFixed(2)}</td><td>{sig(r.momentumZ)}</td><td>{pct(r.drawdown)}</td><td><span className={'tag '+String(r.state).toLowerCase().replaceAll(' ','-')}>{r.state}<ChevronRight size={10}/></span></td></tr>)}</tbody></table></div><footer><span>Showing {Math.min(500,rows.length).toLocaleString()} of {rows.length.toLocaleString()}</span><span>Evidence-first · no trade instruction</span></footer></section>}
function Matrix({rows}){const groups=[['PRICE',['close','return1d','return5d','return20d','return60d','clv','rangeZ']],['FLOW',['volume','rvolZ','buyPressure','sellPressure','netPressure','pressureTrend','participation','buySellRatio','priceVolumeDivergence']],['TREND & RISK',['momentumZ','trendAlignment','volatility','downsideVol','drawdown','liquidityStress']],['MODEL',['confidence','quality','factorScore','patternSignature','state']]];return <section className="outputCard"><div className="sectionTitle"><div><p className="eyebrow">MATRIX LAB</p><h3>Multi-layer analytical matrix</h3></div><Layers3 size={19}/></div><p className="description">Raw observations feed derived variables; derived variables feed state classification. Values remain inspectable.</p>{groups.map(([g,keys])=><div className="matrixGroup" key={g}><h4>{g}</h4><div className="fieldgrid">{keys.map(k=><div key={k}><b>{k.replaceAll(/([A-Z])/g,' $1')}</b><span>{rows.filter(r=>r[k]!==undefined).length.toLocaleString()} populated</span></div>)}</div></div>)}<div className="matrixsample">{rows.slice(0,12).map(r=><div className="matrixrow" key={r.symbol}><b>{r.symbol}</b><span>P {n(r.netPressure).toFixed(2)}</span><span>V {sig(r.rvolZ)}</span><span>M {sig(r.momentumZ)}</span><span>R {pct(r.drawdown)}</span><strong>{r.state}</strong></div>)}</div></section>}
function Patterns({rows,counts,history,validation}){const ex=rows.filter(x=>x.state==='EXHAUSTION').length,se=rows.filter(x=>x.state==='SELLING EXHAUSTION').length;return <section className="outputCard"><div className="sectionTitle"><div><p className="eyebrow">PATTERN ENGINE</p><h3>Latent configurations & evidence</h3></div><Network size={19}/></div><div className="patternGrid"><Card t="Build-up" v={counts.build||0} s="positive participation"/><Card t="Distribution" v={counts.distribution||0} s="negative participation"/><Card t="Exhaustion" v={ex} s="momentum / flow divergence"/><Card t="Selling exhaustion" v={se} s="downside momentum / positive flow"/></div><div className="patternRows"><PatternRow title="Participation build-up" desc="Pressure, abnormal participation, momentum and pressure trend align positively." count={counts.build||0}/><PatternRow title="Distribution pressure" desc="Negative pressure, abnormal participation and weakening directional state align." count={counts.distribution||0}/><PatternRow title="Momentum exhaustion" desc="Strong momentum is opposed by flow pressure, creating a divergence configuration." count={ex}/></div><div className="validation"><GitBranch size={16}/><div><b>Validation layer</b><span>{validation?.snapshots||history.length} daily snapshots · {validation?.observations||0} historical pattern occurrences evaluated. Forward returns are calculated only from later snapshots.</span></div></div>{validation?.patterns?.length>0&&<div className="validationTable"><div className="vhead"><span>PATTERN SIGNATURE</span><span>N</span><span>1D HIT</span><span>5D HIT</span><span>20D HIT</span><span>MEAN 20D</span></div>{validation.patterns.slice(0,12).map(p=><div className="vrow" key={p.signature}><b>{p.signature}</b><span>{p.observations}</span><span>{p.hit1.toFixed(0)}%</span><span>{p.hit5.toFixed(0)}%</span><span>{p.hit20.toFixed(0)}%</span><strong>{p.mean20>=0?'+':''}{p.mean20.toFixed(2)}%</strong></div>)}</div>}</section>}
function PatternRow({title,desc,count}){return <div className="patternRow"><div><b>{title}</b><span>{desc}</span></div><strong>{count.toLocaleString()}</strong></div>}
function Card({t,v,s}){return <article className="patternCard"><b>{t}</b><strong>{v}</strong><span>{s}</span></article>}
function Risk({rows}){const total=rows.length||1,meanDD=rows.reduce((a,x)=>a+Math.abs(n(x.drawdown)),0)/total,highVol=rows.filter(x=>n(x.volatility)>40).length,highDD=rows.filter(x=>Math.abs(n(x.drawdown))>10).length,stress=rows.filter(x=>n(x.liquidityStress)>2).length;return <section className="outputCard"><div className="sectionTitle"><div><p className="eyebrow">RISK MATRIX</p><h3>Risk independent from pattern</h3></div><SlidersHorizontal size={19}/></div><div className="patternGrid"><Card t="Mean drawdown" v={pct(meanDD)} s="absolute current drawdown"/><Card t="High drawdown" v={highDD} s="> 10% current DD"/><Card t="High volatility" v={highVol} s="> 40% annualized"/><Card t="Liquidity stress" v={stress} s="composite stress > 2"/></div><div className="riskList"><RiskLine t="Drawdown stress" v={Math.min(100,meanDD*5)}/><RiskLine t="Volatility stress" v={highVol/total*100}/><RiskLine t="Liquidity stress" v={stress/total*100}/></div><div className="validation"><ShieldCheck size={16}/><div><b>Risk rule</b><span>Strong pattern evidence cannot override volatility, drawdown, liquidity or poor data quality.</span></div></div></section>}
function RiskLine({t,v}){return <div className="riskLine"><span>{t}</span><div><i style={{width:`${Math.max(0,Math.min(100,v))}%`}}/></div><b>{v.toFixed(0)}</b></div>}
function Drawer({row,onClose}){const evidence=[['1D return',pct(row.return1d)],['5D return',pct(row.return5d)],['Volume anomaly',sig(row.rvolZ)],['Buy pressure',n(row.buyPressure).toFixed(2)],['Sell pressure',n(row.sellPressure).toFixed(2)],['Net pressure',n(row.netPressure).toFixed(2)],['Momentum',sig(row.momentumZ)],['Relative trend',sig(row.trendAlignment)],['Drawdown',pct(row.drawdown)],['Model confidence',`${n(row.confidence)}%`],['Data quality',`${Math.round(n(row.quality)*100)}%`]];return <div className="drawerBack" onClick={onClose}><aside className="drawer" onClick={e=>e.stopPropagation()}><button className="close" onClick={onClose}>×</button><p className="eyebrow">SECURITY EVIDENCE</p><h3>{row.symbol}</h3><span className="company">{row.company}</span><div className="stateHero"><span>MARKET STATE</span><strong>{row.state}</strong><small>Model confidence {n(row.confidence)}%</small></div><div className="evidence">{evidence.map(([k,v])=><div key={k}><span>{k}</span><b>{v}</b></div>)}</div><div className="chain"><b>Inference chain</b><span>Observed price + volume → normalized features → flow/participation matrices → state classifier.</span><small>Indirect evidence describes a market configuration; it does not identify participants.</small></div></aside></div>}
createRoot(document.getElementById('root')).render(<App/>);
