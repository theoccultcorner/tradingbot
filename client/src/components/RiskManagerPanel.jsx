function formatMoney(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function formatTime(timestamp) {
  if (!timestamp) {
    return "—";
  }

  return new Date(timestamp).toLocaleTimeString(
    "en-US",
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    },
  );
}

function RiskManagerPanel({ riskManager }) {
  const {
    settings,
    status,
    events,
    tradesToday,
    realizedProfitToday,
    dailyLossReached,
    tradeLimitReached,
    canOpenTrade,
    updateSetting,
    toggleEnabled,
    toggleEmergencyStop,
    clearEvents,
  } = riskManager;

  return (
    <section className="panel risk-manager-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">
            CAPITAL PROTECTION
          </p>

          <h2>Risk Manager</h2>
        </div>

        <button
          type="button"
          className={
            settings.enabled
              ? "risk-toggle enabled"
              : "risk-toggle"
          }
          onClick={toggleEnabled}
        >
          {settings.enabled ? "Enabled" : "Disabled"}
        </button>
      </div>

      <div className="risk-status-row">
        <span
          className={
            canOpenTrade
              ? "risk-status-dot safe"
              : "risk-status-dot blocked"
          }
        />

        <strong>{status}</strong>

        <span>
          New entries:{" "}
          {canOpenTrade ? "Allowed" : "Blocked"}
        </span>
      </div>

      <div className="risk-settings-grid">
        <label>
          <span>Stop loss</span>

          <div className="risk-input-unit">
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={settings.stopLossPercent}
              onChange={(event) =>
                updateSetting(
                  "stopLossPercent",
                  Number(event.target.value),
                )
              }
            />

            <small>%</small>
          </div>
        </label>

        <label>
          <span>Take profit</span>

          <div className="risk-input-unit">
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={settings.takeProfitPercent}
              onChange={(event) =>
                updateSetting(
                  "takeProfitPercent",
                  Number(event.target.value),
                )
              }
            />

            <small>%</small>
          </div>
        </label>

        <label>
          <span>Trailing stop</span>

          <div className="risk-input-unit">
            <input
              type="number"
              min="0.1"
              step="0.1"
              disabled={!settings.trailingStopEnabled}
              value={settings.trailingStopPercent}
              onChange={(event) =>
                updateSetting(
                  "trailingStopPercent",
                  Number(event.target.value),
                )
              }
            />

            <small>%</small>
          </div>
        </label>

        <label>
          <span>Daily loss limit</span>

          <div className="risk-input-unit">
            <input
              type="number"
              min="1"
              step="10"
              value={settings.dailyLossLimit}
              onChange={(event) =>
                updateSetting(
                  "dailyLossLimit",
                  Number(event.target.value),
                )
              }
            />

            <small>USD</small>
          </div>
        </label>

        <label>
          <span>Maximum daily trades</span>

          <div className="risk-input-unit">
            <input
              type="number"
              min="1"
              step="1"
              value={settings.maximumTradesPerDay}
              onChange={(event) =>
                updateSetting(
                  "maximumTradesPerDay",
                  Number(event.target.value),
                )
              }
            />

            <small>TRADES</small>
          </div>
        </label>
      </div>

      <label className="trailing-toggle-row">
        <input
          type="checkbox"
          checked={settings.trailingStopEnabled}
          onChange={(event) =>
            updateSetting(
              "trailingStopEnabled",
              event.target.checked,
            )
          }
        />

        <span>Enable trailing stop</span>
      </label>

      <div className="risk-summary">
        <article>
          <span>Trades today</span>
          <strong>{tradesToday}</strong>
        </article>

        <article>
          <span>Realized P/L today</span>

          <strong
            className={
              realizedProfitToday > 0
                ? "positive"
                : realizedProfitToday < 0
                  ? "negative"
                  : "neutral"
            }
          >
            {formatMoney(realizedProfitToday)}
          </strong>
        </article>

        <article>
          <span>Daily loss gate</span>

          <strong
            className={
              dailyLossReached
                ? "negative"
                : "positive"
            }
          >
            {dailyLossReached ? "Reached" : "Clear"}
          </strong>
        </article>

        <article>
          <span>Trade-count gate</span>

          <strong
            className={
              tradeLimitReached
                ? "negative"
                : "positive"
            }
          >
            {tradeLimitReached ? "Reached" : "Clear"}
          </strong>
        </article>
      </div>

      <button
        type="button"
        className={
          settings.emergencyStop
            ? "emergency-stop-button active"
            : "emergency-stop-button"
        }
        onClick={toggleEmergencyStop}
      >
        {settings.emergencyStop
          ? "Release Emergency Stop"
          : "Activate Emergency Stop"}
      </button>

      <div className="risk-section-heading">
        <h3>Risk events</h3>

        <button
          type="button"
          className="clear-risk-events"
          onClick={clearEvents}
        >
          Clear
        </button>
      </div>

      <div className="risk-events-list">
        {events.length > 0 ? (
          events.slice(0, 20).map((event) => (
            <article
              className="risk-event-row"
              key={event.id}
            >
              <strong
                className={
                  event.executed
                    ? "negative"
                    : "neutral"
                }
              >
                {event.type}
              </strong>

              <span>{event.symbol}</span>

              <span>{formatMoney(event.price)}</span>

              <time>{formatTime(event.timestamp)}</time>

              <p>{event.message}</p>
            </article>
          ))
        ) : (
          <p className="empty-state">
            No risk exits have been triggered.
          </p>
        )}
      </div>
    </section>
  );
}

export default RiskManagerPanel;