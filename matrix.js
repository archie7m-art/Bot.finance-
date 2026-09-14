export const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
export const sd=a=>a.length>1?Math.sqrt(a.reduce((s,x)=>s+(x-mean(a))**2,0)/(a.length-1)):0;
export const clamp=(x,a=-5,b=5)=>Math.max(a,Math.min(b,x));
export const pct=(a,b)=>b?((a/b)-1)*100:0;
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const arr=(a,n)=>a.slice(Math.max(0,a.length-n));
const z=(x,a)=>{const s=sd(a);return s?clamp((x-mean(a))/s):0};
const rank=(x,a)=>{const q=a.filter(Number.isFinite).sort((u,v)=>u-v);if(!q.length)return .5;let lo=0,hi=q.length;while(lo<hi){const m=(lo+hi)>>1;if(q[m]<=x)lo=m+1;else hi=m;}return (lo-.5)/q.length};
function linSlope(a){if(a.length<3)return 0;const n=a.length,m=(n-1)/2,den=a.reduce((s,_,i)=>s+(i-m)**2,0);return den?a.reduce((s,v,i)=>s+(i-m)*(v-mean(a)),0)/den:0}
export function features(bars){
 const clean=bars.filter(x=>Number.isFinite(x.close)&&x.close>0&&Number.isFinite(x.volume)&&Number.isFinite(x.high)&&Number.isFinite(x.low));
 if(clean.length<20)return null;
 const c=clean.map(x=>x.close),v=clean.map(x=>x.volume),ret=clean.map((x,i)=>i?x.close/clean[i-1].close-1:0);
 const ranges=clean.map(x=>Math.max(0,(x.high-x.low)/x.close));
 const n=clean.length,last=clean[n-1], r20=arr(ret,20), v20=arr(v,20), rg20=arr(ranges,20);
 const clv=last.high!==last.low?((last.close-last.low)-(last.high-last.close))/(last.high-last.low):0;
 const r1=num(ret[n-1])*100, r5=pct(last.close,clean[n-6].close), r20p=pct(last.close,clean[Math.max(0,n-21)].close), r60=pct(last.close,clean[Math.max(0,n-61)].close);
 const vol20=sd(r20)*Math.sqrt(252)*100, downside=sd(r20.filter(x=>x<0))*Math.sqrt(252)*100;
 let peak=-Infinity; for(const x of arr(c,60)) peak=Math.max(peak,x); const dd=peak?((last.close/peak)-1)*100:0;
 const rv=z(last.volume,v20), rangeZ=z(ranges[n-1],rg20);
 const retZ=z(r1,arr(ret,60).map(x=>x*100));
 const momSeries=arr(c,80).map((x,i,a)=>i?pct(x,a[i-1]):0); const momZ=z(r20p,momSeries);
 const pressureRaw=.55*clv+.30*clamp(r1/Math.max(vol20,.1),-5,5)+.45*clamp(rv,-5,5)+.20*clamp(r5/Math.max(vol20,.1),-5,5);
 const pressure=clamp(pressureRaw);
 const participation=clamp(.7*Math.abs(rv)+.3*Math.abs(clv)*2,0,5);
 const buy=clamp(Math.max(0,pressure)*(0.8+Math.max(0,clv)*.4));
 const sell=clamp(Math.max(0,-pressure)*(0.8+Math.max(0,-clv)*.4));
 const ps=arr(ret,5).map((r,i)=>clamp(.6*(r*100/Math.max(vol20,.1))+.5*clv+.25*rv));
 const pressureTrend=linSlope(ps)*5;
 const trendAlignment=clamp(.5*z(r5,arr(c,60).map((x,i,a)=>i?pct(x,a[i-1]):0))+.5*z(r20p,arr(c,120).map((x,i,a)=>i?pct(x,a[i-1]):0)));
 const divergence=clamp((r5>0?1:-1)*(rv>0?1:-1)*(clv));
 const liquidityStress=clamp(Math.abs(dd)/10 + Math.max(0,vol20-25)/25 + Math.max(0,-rv)/3,0,5);
 const quality=Math.min(1,clean.length/252)*Math.max(0,1-Math.min(.5,((bars.length-clean.length)/Math.max(1,bars.length))));
 const flowScore=clamp(buy-sell);
 return {date:last.date,close:last.close,volume:last.volume,return1d:r1,return5d:r5,return20d:r20p,return60d:r60,rvolZ:rv,clv,rangeZ,volatility:vol20,downsideVol:downside,drawdown:dd,buyPressure:buy,sellPressure:sell,netPressure:flowScore,pressureTrend,participation,buySellRatio:(buy+.01)/(sell+.01),trendAlignment,momentum:r20p,momentumZ:momZ,returnZ:retZ,priceVolumeDivergence:divergence,liquidityStress,quality,observations:clean.length};
}
export function classify(f){
 if(!f)return 'NO DATA';
 if(f.quality<.15)return 'LOW HISTORY';
 if(f.netPressure>1.25&&f.momentumZ>.55&&f.rvolZ>.35&&f.pressureTrend>=0)return 'BUILD-UP';
 if(f.netPressure<-1.25&&f.momentumZ<-.55&&f.rvolZ>.35&&f.pressureTrend<=0)return 'DISTRIBUTION';
 if(f.momentumZ>1.1&&f.netPressure<-.15)return 'EXHAUSTION';
 if(f.momentumZ< -1.1&&f.netPressure>.15)return 'SELLING EXHAUSTION';
 if(Math.abs(f.netPressure)<.35&&Math.abs(f.momentumZ)<.55)return 'BALANCED';
 return f.netPressure>0?'POSITIVE PARTICIPATION':'NEGATIVE PARTICIPATION';
}
export function confidence(f){
 if(!f)return 0; const aligned=[f.netPressure>0, f.momentumZ>0, f.rvolZ>0, f.pressureTrend>0, f.trendAlignment>0].filter(Boolean).length; const opposed=[f.netPressure<0, f.momentumZ<0, f.rvolZ<0, f.pressureTrend<0, f.trendAlignment<0].filter(Boolean).length; const directional=Math.max(aligned,opposed)/5; return Math.round(clamp((directional*.72+Math.min(1,f.quality)*.28)*100,0,100));
}
export function enrich(rows){
 const valid=rows.filter(r=>r&&Number.isFinite(r.netPressure));
 const fields=['netPressure','rvolZ','momentumZ','trendAlignment','participation','liquidityStress','return20d'];
 const stats={}; for(const k of fields){const a=valid.map(r=>num(r[k]));stats[k]={mean:mean(a),sd:sd(a)};}
 return rows.map(r=>{if(!r)return r;const ranks={};for(const k of fields)ranks[k]=rank(num(r[k]),valid.map(x=>num(x[k])));const state=classify(r);const conf=confidence(r);return {...r,ranks,state,confidence:conf,patternSignature:[r.netPressure>0?'P+':'P-',r.rvolZ>0?'V+':'V-',r.momentumZ>0?'M+':'M-',r.trendAlignment>0?'T+':'T-',r.liquidityStress>1.5?'R+':'R-'].join('|'),factorScore:clamp((ranks.netPressure-.5)*2*.3+(ranks.momentumZ-.5)*2*.2+(ranks.rvolZ-.5)*2*.15+(ranks.trendAlignment-.5)*2*.2-(ranks.liquidityStress-.5)*2*.15)}});
}
export function marketSummary(rows){
 const valid=rows.filter(Boolean),n=valid.length||1,avg=k=>valid.reduce((s,x)=>s+num(x[k]),0)/n;
 const breadth=valid.filter(x=>num(x.return1d)>0).length/n*100, pressureBreadth=valid.filter(x=>num(x.netPressure)>0).length/n*100;
 const build=valid.filter(x=>x.state==='BUILD-UP').length,dist=valid.filter(x=>x.state==='DISTRIBUTION').length;
 const regime=breadth>62&&pressureBreadth>58?'RISK-ON':breadth<38&&pressureBreadth<42?'RISK-OFF':Math.abs(breadth-pressureBreadth)>12?'ROTATION':'MIXED';
 return {securities:valid.length,breadth,pressureBreadth,avgReturn:avg('return1d'),avgPressure:avg('netPressure'),avgVolumeZ:avg('rvolZ'),avgDrawdown:avg('drawdown'),avgVolatility:avg('volatility'),build,distribution:dist,buildPct:build/n*100,distributionPct:dist/n*100,regime};
}
