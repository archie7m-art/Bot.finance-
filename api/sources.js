export default async function handler(req,res){
 return res.status(200).json({
  sources:[
   {name:"Yahoo Finance",type:"supplemental",status:"enabled",data:"daily OHLCV / adjusted close",note:"Unofficial chart endpoint; rate-limited and subject to provider terms."},
   {name:"Alpha Vantage",type:"optional",status:process.env.ALPHA_VANTAGE_KEY?"configured":"optional",data:"daily OHLCV / indicators",note:"Free tier has request limits; useful as a fallback, not for 2,000-symbol daily collection."},
   {name:"BSE/NSE files",type:"user_or_permitted_feed",status:"manual",data:"official exchange files where permitted",note:"Best source for exchange-specific fields such as OI/delivery when legally available."}
  ]
 });
}
