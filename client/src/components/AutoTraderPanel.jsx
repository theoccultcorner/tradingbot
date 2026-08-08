function formatTime(timestamp) {
  if (!timestamp) {
    return "—";
  }

  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function AutoTraderPanel({ autoTrader }) {
  const {
    settings,
    status,
    lastDecision,
    activity,
    updateSetting,
    toggleEnabled,
    clearActivity,
  } = autoTrader;

  return (
    <section className="panel auto-trader-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">
            AUTOMATIC PAPER STRATEGY
          </p>

          <h2>Auto Trader</h2>
        </div>

        <button
          type="button"
          className={
            settings.enabled
              ? "auto-toggle enabled"
              : "auto-toggle"
          }
          onClick={toggleEnabled}
        >
          {settings.enabled ? "Enabled" : "Disabled"}
        </button>
      </div>

      <div className="auto-status-row">
        <span
          className={
            settings.enabled
              ? "auto-status-dot running"
              : "auto-status-dot"
          }
        />

        <strong>{status}</strong>
      </div>

      <div className="auto-settings-grid">
        <label>
          <span>Minimum confidence</span>

          <div className="setting-with-unit">
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={settings.minimumConfidence}
              onChange={(event) =>
                updateSetting(
                  "minimumConfidence",
                  Number(event.target.value),
                )
              }
            />

            <small>%</small>
          </div>
        </label>

        <label>
          <span>Buy amount</span>

          <div className="setting-with-unit">
            <input
              type="number"
              min="1"
              step="1"
              value={settings.buyAmount}
              onChange={(event) =>
                updateSetting(
                  "buyAmount",
                  Number(event.target.value),
                )
              }
            />

            <small>USD</small>
          </div>
        </label>

        <label>
          <span>Maximum position</span>

          <div className="setting-with-unit">
            <input
              type="number"
              min="1"
              step="1"
              value={settings.maximumPositionValue}
              onChange={(event) =>
                updateSetting(
                  "maximumPositionValue",
                  Number(event.target.value),
                )
              }
            />

            <small>USD</small>
          </div>
        </label>

        <label>
          <span>Trade cooldown</span>

          <div className="setting-with-unit">
            <input
              type="number"
              min="0"
              step="1"
              value={settings.cooldownMinutes}
              onChange={(event) =>
                updateSetting(
                  "cooldownMinutes",
                  Number(event.target.value),
                )
              }
            />

            <small>MIN</small>
          </div>
        </label>
      </div>

      <p className="auto-trader-note">
        Decisions occur only when the selected timeframe candle
        closes. SELL signals close the full position for the
        selected asset.
      </p>

      <div className="auto-section-heading">
        <h3>Latest decision</h3>
      </div>

      {lastDecision ? (
        <article
          className={
            lastDecision.executed
              ? "latest-auto-decision executed"
              : "latest-auto-decision"
          }
        >
          <div>
            <span>Action</span>

            <strong
              className={
                lastDecision.action === "BUY"
                  ? "positive"
                  : lastDecision.action === "SELL"
                    ? "negative"
                    : "neutral"
              }
            >
              {lastDecision.action}
            </strong>
          </div>

          <div>
            <span>Signal</span>
            <strong>{lastDecision.label}</strong>
          </div>

          <div>
            <span>Confidence</span>
            <strong>{lastDecision.confidence}%</strong>
          </div>

          <div>
            <span>Time</span>
            <strong>{formatTime(lastDecision.timestamp)}</strong>
          </div>

          <p>{lastDecision.message}</p>
        </article>
      ) : (
        <p className="empty-state">
          No automatic decisions have been evaluated yet.
        </p>
      )}

      <div className="auto-section-heading">
        <h3>Decision history</h3>

        <button
          type="button"
          className="clear-auto-history"
          onClick={clearActivity}
        >
          Clear
        </button>
      </div>

      <div className="auto-activity-list">
        {activity.length > 0 ? (
          activity.slice(0, 20).map((item) => (
            <article
              className="auto-activity-row"
              key={item.id}
            >
              <span
                className={
                  item.action === "BUY"
                    ? "positive"
                    : item.action === "SELL"
                      ? "negative"
                      : "neutral"
                }
              >
                {item.action}
              </span>

              <span>{item.confidence}%</span>

              <span>
                {item.executed ? "Executed" : "Skipped"}
              </span>

              <time>{formatTime(item.timestamp)}</time>

              <p>{item.message}</p>
            </article>
          ))
        ) : (
          <p className="empty-state">
            Automatic decision history is empty.
          </p>
        )}
      </div>
    </section>
  );
}

export default AutoTraderPanel;