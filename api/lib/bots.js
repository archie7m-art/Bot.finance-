import { features, classify } from './matrix.js';

// The registry is the single source of truth for what each bot's job is.
// The orchestrator (api/refresh.js) assigns work against these IDs, and the
// UI reads this same list so the "task" text shown to the user always
// matches what the code actually does.
export const BOT_REGISTRY = [
  { id: 'collector', name: 'Collector Bot', task: 'Fetch raw daily OHLCV history for the symbol' },
  { id: 'matrix', name: 'Matrix Bot', task: 'Normalize raw bars into the feature matrix (returns, z-scores, pressure)' },
  { id: 'classifier', name: 'Classifier Bot', task: 'Classify market state from the feature matrix' },
  { id: 'risk', name: 'Risk Bot', task: 'Independently assess volatility/drawdown/liquidity risk; can cap confidence regardless of pattern strength' },
  { id: 'pattern', name: 'Pattern Bot', task: 'Assign a pattern signature for later historical validation' }
];

const step = (bot, status, verdict, data = {}) => ({ bot, status, verdict, data, at: new Date().toISOString() });

// The Risk Bot's decision is independent of every other bot's output.
// It only ever looks at raw feature risk measures, never at the state
// or pattern signature, and it can cap confidence — but it never
// silently rewrites the classifier's state.
export function assessRisk(f) {
  if (!f) return { highVolatility: false, highDrawdown: false, liquidityStress: false, riskScore: 0, override: false, verdict: 'No data to assess' };
  const highVolatility = f.volatility > 40;
  const highDrawdown = Math.abs(f.drawdown) > 15;
  const liquidityStress = f.liquidityStress > 2.5;
  const flags = [highVolatility, highDrawdown, liquidityStress].filter(Boolean).length;
  const riskScore = Math.round(Math.min(100, (f.volatility / 60 * 40) + (Math.min(30, Math.abs(f.drawdown)) / 30 * 30) + (Math.min(5, f.liquidityStress) / 5 * 30)));
  const override = flags >= 2;
  const verdict = override
    ? 'High risk on multiple measures — capping confidence regardless of pattern strength'
    : flags === 1
      ? 'One risk flag raised — noted, not overriding'
      : 'Risk within normal range';
  return { highVolatility, highDrawdown, liquidityStress, riskScore, override, verdict };
}

// Runs one symbol through every bot in sequence, logging each bot's own
// verdict along the way. Returns both the merged row (for the matrix) and
// the full audit trail (for inspection) — the "both" the user asked for.
// Cross-sectional steps (ranking, final confidence cap, final pattern
// signature) still happen in enrich() once the whole batch is in, since
// those require comparing against every other symbol in the run.
export function runBotPipeline(symbol, bars, meta = {}) {
  const audit = [];

  if (!bars || bars.length < 20) {
    audit.push(step('collector', 'error', 'Insufficient history to proceed', { barsCount: bars ? bars.length : 0 }));
    return { row: null, audit };
  }
  audit.push(step('collector', 'done', `Fetched ${bars.length} daily bars`, { barsCount: bars.length }));

  const f = features(bars);
  if (!f) {
    audit.push(step('matrix', 'error', 'Could not build a clean feature matrix (too few valid bars)', {}));
    return { row: null, audit };
  }
  audit.push(step('matrix', 'done', 'Feature matrix computed', {
    netPressure: Number(f.netPressure.toFixed(2)),
    momentumZ: Number(f.momentumZ.toFixed(2)),
    rvolZ: Number(f.rvolZ.toFixed(2))
  }));

  const state = classify(f);
  audit.push(step('classifier', 'done', `Classified as ${state}`, { state }));

  const risk = assessRisk(f);
  audit.push(step('risk', risk.override ? 'flagged' : 'done', risk.verdict, risk));

  const signature = [
    f.netPressure > 0 ? 'P+' : 'P-',
    f.rvolZ > 0 ? 'V+' : 'V-',
    f.momentumZ > 0 ? 'M+' : 'M-',
    f.trendAlignment > 0 ? 'T+' : 'T-',
    f.liquidityStress > 1.5 ? 'R+' : 'R-'
  ].join('|');
  audit.push(step('pattern', 'done', `Signature ${signature} assigned; cross-sectional ranking runs on the full batch next`, { signature }));

  const row = {
    ...f,
    symbol,
    company: meta.company || undefined,
    marketCap: meta.marketCap ?? null,
    rank: meta.rank ?? null,
    capTier: meta.capTier ?? null,
    provider: 'yahoo',
    sourceQuality: 'supplemental-unofficial',
    state,
    riskFlags: risk
  };
  return { row, audit };
}
