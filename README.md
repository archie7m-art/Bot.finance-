# Market Research Lab v6

Reverse-engineered market-state research workstation.

## Core principle
Data → normalized matrix → mathematical features → market state → pattern → historical validation.

The system does not claim to observe hidden institutional orders. Buy/sell pressure, accumulation, distribution and build-up are derived proxies from observable data.

## v6 features
- Yahoo Finance supplemental daily OHLCV collector.
- 1-year history per symbol to calculate rolling features.
- Buy/sell/net pressure proxies.
- RVOL z-score, close-location, range z-score, momentum z-score.
- Volatility, downside volatility and drawdown.
- Build-up, distribution, exhaustion and balanced-state classifications.
- Redis daily matrix history.
- Seed universe from the supplied 2,000-company BSE list in `public/bse-universe.csv`.
- Small CSV universe import.
- Research / Matrix / Patterns / Risk views.
- Source-quality labeling and raw-provider-response discard policy.

## Deployment
Set `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and optionally `CRON_SECRET` in Vercel.

Vercel Cron uses UTC. The included eight shards cover 200 securities per weekday run; increase shard entries or use an external scheduler for the full 2,000-company universe. Vercel allows up to 100 cron jobs per project, but Hobby cron schedules are limited to once per day. See current Vercel documentation.

Yahoo's chart endpoint is an unofficial supplemental source. Respect provider terms and rate limits; do not represent it as a licensed exchange feed.

## Machine-discovered pattern validation

The Patterns tab now includes a deterministic historical validation layer. It groups recurring matrix signatures and measures 1/5/20-session forward returns using only later daily snapshots. No AI API is required. The engine reports occurrence count, hit rate and mean forward return; it does not convert these statistics into a buy/sell instruction.

For production research, expand this with longer history, walk-forward train/test splits, transaction-cost assumptions, survivorship-bias controls and regime-conditional evaluation before treating any pattern as predictive.
