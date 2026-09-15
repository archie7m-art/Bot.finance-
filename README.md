# Market Research Lab v7

A finance-domain experiment in multi-bot orchestration: five independent bots, each with one job, coordinated by an orchestrator that assigns work and tracks status — not a single function doing everything.

## Bot architecture

| Bot | Task | Can it be overridden? |
|---|---|---|
| Collector Bot | Fetch raw daily OHLCV history for the symbol | — |
| Matrix Bot | Normalize raw bars into the feature matrix (returns, z-scores, pressure) | — |
| Classifier Bot | Classify market state from the feature matrix | No — Risk Bot can only cap confidence, never rewrite the state |
| Risk Bot | Independently assess volatility/drawdown/liquidity risk | Runs independently of every other bot; can cap confidence, never fabricates a verdict from another bot's output |
| Pattern Bot | Assign a pattern signature for later historical validation | Cross-sectional ranking refines this once the full batch is in |

`api/refresh.js` is the **orchestrator**: for each symbol in a shard it assigns work to the pipeline (`api/lib/bots.js`), logs every bot's own verdict to an audit trail (`mrl:bots:{date}`), and tallies task counts per bot into a job record (`mrl:job:{date}`) — done/error/flagged counts, per shard run. `api/bots.js` exposes both: job-level status and, given a date + symbol, the full per-bot audit trail for that security. The frontend surfaces this two ways, matching the "both" audit design: an always-visible Orchestrator panel showing live task counts, and a per-security "Bot pipeline" list in the evidence drawer showing exactly what each bot decided and why.

## Core principle
Data → normalized matrix → mathematical features → market state → pattern → historical validation.

The system does not claim to observe hidden institutional orders. Buy/sell pressure, accumulation, distribution and build-up are derived proxies from observable data.

## v7 features
- Yahoo Finance supplemental daily OHLCV collector, now run through the five-bot orchestrated pipeline above.
- 1-year history per symbol to calculate rolling features.
- Buy/sell/net pressure proxies.
- RVOL z-score, close-location, range z-score, momentum z-score.
- Volatility, downside volatility and drawdown.
- Build-up, distribution, exhaustion and balanced-state classifications.
- Redis daily matrix history, plus a parallel per-symbol bot audit trail and an orchestrator job-status record.
- Seed universe from the supplied 2,000-company BSE list in `public/bse-universe.csv`, regenerated directly from BSE's official "Top 2,000 Companies by Average Market Capitalisation (Jul 1 2025 – Dec 31 2025)" workbook. Each row carries `symbol`, `company`, `market_cap_cr`, `rank`, and `cap_tier` (SEBI-style: rank 1–100 Large, 101–250 Mid, 251+ Small).
- Market cap, rank and cap tier flow through the Collector/Matrix bots into the daily matrix, and are shown in the Research table and security drawer.
- Small CSV universe import.
- Research / Matrix / Patterns / Risk views, plus an always-on Orchestrator status panel.
- Source-quality labeling and raw-provider-response discard policy.

## Deployment
Set `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and optionally `CRON_SECRET` in Vercel.

Vercel Cron uses UTC. The included eight shards cover 200 securities per weekday run; increase shard entries or use an external scheduler for the full 2,000-company universe. Vercel allows up to 100 cron jobs per project, but Hobby cron schedules are limited to once per day. See current Vercel documentation.

Yahoo's chart endpoint is an unofficial supplemental source. Respect provider terms and rate limits; do not represent it as a licensed exchange feed.

## Machine-discovered pattern validation

The Patterns tab now includes a deterministic historical validation layer. It groups recurring matrix signatures and measures 1/5/20-session forward returns using only later daily snapshots. No AI API is required. The engine reports occurrence count, hit rate and mean forward return; it does not convert these statistics into a buy/sell instruction.

For production research, expand this with longer history, walk-forward train/test splits, transaction-cost assumptions, survivorship-bias controls and regime-conditional evaluation before treating any pattern as predictive.
