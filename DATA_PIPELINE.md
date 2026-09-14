# Automatic daily/weekly tracking

The application supports manual CSV analysis and an automatic scheduled mode.

## Environment variables

- `MARKET_DATA_URL` — a permitted CSV endpoint/feed from your chosen market-data provider.
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `CRON_SECRET`

The app stores derived daily matrices/snapshots, not the original downloaded CSV. Daily snapshots are retained for 120 days in this prototype; weekly summaries for one year.

## Schedule

- Daily refresh: 15:30 UTC, Monday–Friday (21:00 IST).
- Weekly consolidation: 16:00 UTC Friday (21:30 IST).

Change these schedules to match the publication time of your chosen data source.

## Important

BSE provides market-data products including EOD/reference data and access is governed by its data products/subscriptions. Use a source you are permitted to automate and respect its terms and rate limits. The provider-specific collector should eventually map BSE/NSE/OI/F&O schemas into the common matrix.


## CSV import feature

The small **Import CSV** feature posts the selected CSV only to the transient import function. The function extracts the analytical fields and stores only the compact daily matrix in Redis. The original CSV body is not written to Redis. After the request finishes, the raw source is discarded from the application's processing path.
