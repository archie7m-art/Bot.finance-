# Daily data sources

## Yahoo Finance

The collector uses Yahoo Finance's internal chart endpoint from the server side for daily OHLCV/adjusted-close data. This endpoint is not an official public Yahoo developer API, can change, and has no published rate guarantee. It must be used conservatively and only in ways permitted by the provider's terms. The app therefore treats Yahoo as a **supplemental** source, not the sole institutional data source.

The endpoint returns daily chart data, and the collector stores only normalized fields such as symbol, date, OHLC, adjusted close and volume.

## Other free/low-cost sources

### Alpha Vantage
An optional adapter can be added with `ALPHA_VANTAGE_KEY`. Its official documentation provides daily stock time series, while its support page currently describes a 25-request/day standard free limit and unlimited requests for verified open-source/educational projects. That means it is useful as a fallback/validation source, but it is not enough by itself for 2,000 symbols every day under ordinary free limits.

### Exchange data
For BSE/NSE-specific fields, use official exchange files or another feed you are authorized to automate. These are particularly valuable for fields Yahoo does not reliably provide, such as exchange-specific derivatives/open-interest or delivery information.

## Matrix strategy

The collector should not save provider responses. It stores only the analytical matrix:

- identity: symbol, company
- time: date
- market: open, high, low, close, adjusted close, volume
- valuation/size fields when legitimately supplied
- derivatives fields when legitimately supplied
- source and data-quality metadata

The raw provider payload is discarded after normalization.

## 2,000-company reality

Yahoo's chart endpoint is one-symbol-per-request and unofficial. A production 2,000-symbol daily pipeline should therefore be **sharded, rate-limited, cached and source-aware**, rather than firing 2,000 requests simultaneously. The current prototype processes a bounded shard per invocation and records collector progress in Redis.
