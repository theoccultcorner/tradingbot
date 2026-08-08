function formatScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return "0";
  return value > 0 ? `+${value}` : String(value);
}

function scoreClass(score) {
  return Number(score) > 0 ? "positive" : Number(score) < 0 ? "negative" : "neutral";
}

function SignalFactor({ title, score, reason }) {
  return (
    <article className="signal-factor">
      <div className="signal-factor-heading">
        <span>{title}</span>
        <strong className={scoreClass(score)}>{formatScore(score)}</strong>
      </div>
      <p>{reason}</p>
    </article>
  );
}

function SignalPanel({ signal }) {
  if (!signal) {
    return (
      <section className="panel signal-panel">
        <p className="empty-state">Waiting for server-side signal data.</p>
      </section>
    );
  }

  const regime = signal.regime || {};

  return (
    <section className="panel signal-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">WEIGHTED STRATEGY ENGINE</p>
          <h2>Trading Signal 2.0</h2>
        </div>
        <span className={`signal-action ${signal.className}`}>{signal.action}</span>
      </div>

      <div className="signal-summary">
        <div><span>Market reading</span><strong>{signal.label}</strong></div>
        <div><span>Weighted score</span><strong>{formatScore(signal.totalScore)} / 100</strong></div>
        <div><span>Confidence</span><strong>{signal.confidence}%</strong></div>
        <div><span>Market regime</span><strong>{regime.label || "Analyzing"}</strong></div>
      </div>

      <div className="regime-grid">
        <article><span>Direction</span><strong>{regime.direction || "Unknown"}</strong></article>
        <article><span>Trend type</span><strong>{regime.trend || "Unknown"}</strong></article>
        <article><span>ADX</span><strong>{Number.isFinite(Number(regime.adx)) ? Number(regime.adx).toFixed(1) : "—"}</strong></article>
        <article><span>ATR volatility</span><strong>{Number.isFinite(Number(regime.atrPercent)) ? `${Number(regime.atrPercent).toFixed(2)}%` : "—"}</strong></article>
      </div>

      <div className="confidence-track">
        <div className={`confidence-fill ${signal.className}`} style={{ width: `${signal.confidence}%` }} />
      </div>

      <div className="signal-factors">
        <SignalFactor title="Trend" score={signal.trend?.score} reason={signal.trend?.reason} />
        <SignalFactor title="Momentum" score={signal.momentum?.score} reason={signal.momentum?.reason} />
        <SignalFactor title="Price position" score={signal.pricePosition?.score} reason={signal.pricePosition?.reason} />
        <SignalFactor title="Volume" score={signal.volume?.score} reason={signal.volume?.reason} />
        <SignalFactor title="Trend strength" score={signal.trendStrength?.score} reason={signal.trendStrength?.reason} />
        <SignalFactor title="Volatility" score={signal.volatility?.score} reason={signal.volatility?.reason} />
      </div>

      <p className="signal-warning">This weighted technical model is for paper testing and does not guarantee profit.</p>
    </section>
  );
}

export default SignalPanel;
