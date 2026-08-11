function formatMoney(
  value,
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return "—";
  }

  return number.toLocaleString(
    "en-US",
    {
      style:
        "currency",

      currency:
        "USD",

      maximumFractionDigits:
        2,
    },
  );
}

function formatTime(
  timestamp,
) {
  if (!timestamp) {
    return "—";
  }

  return new Date(
    timestamp,
  ).toLocaleTimeString(
    "en-US",
    {
      hour:
        "2-digit",

      minute:
        "2-digit",

      second:
        "2-digit",
    },
  );
}

function numberOrFallback(
  value,
  fallback,
) {
  const number =
    Number(value);

  return Number.isFinite(
    number,
  )
    ? number
    : fallback;
}

function RiskManagerPanel({
  serverEngine,
}) {
  const {
    engine,
    loading,
    error,
    saveSettings,
    loadState,
  } =
    serverEngine;

  const settings =
    engine?.settings ||
    {};

  const enabled =
    Boolean(
      settings.enabled,
    );

  const emergencyStop =
    Boolean(
      settings
        .emergencyStop,
    );

  const trailingStopEnabled =
    Boolean(
      settings
        .trailingStopEnabled,
    );

  const status =
    engine?.status ||
    "Unavailable";

  const lastRiskEvent =
    engine
      ?.lastRiskEvent ||
    null;

  async function updateSetting(
    name,
    value,
  ) {
    if (
      typeof saveSettings !==
      "function"
    ) {
      return;
    }

    await saveSettings({
      ...settings,

      [name]:
        value,
    });
  }

  async function toggleEngine() {
    await updateSetting(
      "enabled",
      !enabled,
    );
  }

  async function toggleEmergencyStop() {
    await updateSetting(
      "emergencyStop",
      !emergencyStop,
    );
  }

  async function toggleTrailingStop(
    event,
  ) {
    await updateSetting(
      "trailingStopEnabled",
      event.target.checked,
    );
  }

  if (
    loading &&
    !engine
  ) {
    return (
      <section className="panel risk-manager-panel">
        <p>
          Loading server risk controls…
        </p>
      </section>
    );
  }

  if (!engine) {
    return (
      <section className="panel risk-manager-panel">
        <p className="scanner-error">
          {error ||
            "Server risk controls are unavailable."}
        </p>
      </section>
    );
  }

  return (
    <section className="panel risk-manager-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">
            SERVER CAPITAL PROTECTION
          </p>

          <h2>
            Risk Manager
          </h2>

          <small>
            Controlled by Trading Engine 2.0
          </small>
        </div>

        <button
          type="button"
          className={
            enabled
              ? "risk-toggle enabled"
              : "risk-toggle"
          }
          disabled={
            loading
          }
          onClick={
            toggleEngine
          }
        >
          {enabled
            ? "Enabled"
            : "Disabled"}
        </button>
      </div>

      <div className="risk-status-row">
        <span
          className={
            enabled &&
            !emergencyStop
              ? "risk-status-dot safe"
              : "risk-status-dot blocked"
          }
        />

        <strong>
          {emergencyStop
            ? "Emergency stop active"
            : status}
        </strong>

        <span>
          Automated trading:{" "}

          {enabled &&
          !emergencyStop
            ? "Allowed"
            : "Blocked"}
        </span>
      </div>

      <div className="risk-settings-grid">
        <label>
          <span>
            Stop loss
          </span>

          <div className="risk-input-unit">
            <input
              type="number"
              min="0.1"
              step="0.1"
              disabled={
                loading
              }
              value={
                numberOrFallback(
                  settings
                    .stopLossPercent,
                  1.5,
                )
              }
              onChange={(
                event,
              ) =>
                updateSetting(
                  "stopLossPercent",
                  Number(
                    event
                      .target
                      .value,
                  ),
                )
              }
            />

            <small>
              %
            </small>
          </div>
        </label>

        <label>
          <span>
            Take profit
          </span>

          <div className="risk-input-unit">
            <input
              type="number"
              min="0.1"
              step="0.1"
              disabled={
                loading
              }
              value={
                numberOrFallback(
                  settings
                    .takeProfitPercent,
                  3,
                )
              }
              onChange={(
                event,
              ) =>
                updateSetting(
                  "takeProfitPercent",
                  Number(
                    event
                      .target
                      .value,
                  ),
                )
              }
            />

            <small>
              %
            </small>
          </div>
        </label>

        <label>
          <span>
            Trailing stop
          </span>

          <div className="risk-input-unit">
            <input
              type="number"
              min="0.1"
              step="0.1"
              disabled={
                loading ||
                !trailingStopEnabled
              }
              value={
                numberOrFallback(
                  settings
                    .trailingStopPercent,
                  1,
                )
              }
              onChange={(
                event,
              ) =>
                updateSetting(
                  "trailingStopPercent",
                  Number(
                    event
                      .target
                      .value,
                  ),
                )
              }
            />

            <small>
              %
            </small>
          </div>
        </label>

        <label>
          <span>
            Daily loss limit
          </span>

          <div className="risk-input-unit">
            <input
              type="number"
              min="1"
              step="1"
              disabled={
                loading
              }
              value={
                numberOrFallback(
                  settings
                    .dailyLossLimit,
                  30,
                )
              }
              onChange={(
                event,
              ) =>
                updateSetting(
                  "dailyLossLimit",
                  Number(
                    event
                      .target
                      .value,
                  ),
                )
              }
            />

            <small>
              USD
            </small>
          </div>
        </label>

        <label>
          <span>
            Maximum daily trades
          </span>

          <div className="risk-input-unit">
            <input
              type="number"
              min="0"
              step="1"
              disabled={
                loading
              }
              value={
                numberOrFallback(
                  settings
                    .maximumTradesPerDay,
                  0,
                )
              }
              onChange={(
                event,
              ) =>
                updateSetting(
                  "maximumTradesPerDay",
                  Math.max(
                    Math.floor(
                      Number(
                        event
                          .target
                          .value,
                      ) ||
                        0,
                    ),
                    0,
                  ),
                )
              }
            />

            <small>
              {Number(
                settings
                  .maximumTradesPerDay,
              ) ===
              0
                ? "UNLIMITED"
                : "TRADES"}
            </small>
          </div>
        </label>
      </div>

      <label className="trailing-toggle-row">
        <input
          type="checkbox"
          checked={
            trailingStopEnabled
          }
          disabled={
            loading
          }
          onChange={
            toggleTrailingStop
          }
        />

        <span>
          Enable trailing stop
        </span>
      </label>

      <div className="risk-summary">
        <article>
          <span>
            Engine status
          </span>

          <strong
            className={
              emergencyStop
                ? "negative"
                : enabled
                  ? "positive"
                  : "neutral"
            }
          >
            {emergencyStop
              ? "STOPPED"
              : status}
          </strong>
        </article>

        <article>
          <span>
            Stop loss
          </span>

          <strong>
            {numberOrFallback(
              settings
                .stopLossPercent,
              0,
            ).toFixed(
              2,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Take profit
          </span>

          <strong>
            {numberOrFallback(
              settings
                .takeProfitPercent,
              0,
            ).toFixed(
              2,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Daily loss limit
          </span>

          <strong>
            {formatMoney(
              settings
                .dailyLossLimit,
            )}
          </strong>
        </article>
      </div>

      <button
        type="button"
        className={
          emergencyStop
            ? "emergency-stop-button active"
            : "emergency-stop-button"
        }
        disabled={
          loading
        }
        onClick={
          toggleEmergencyStop
        }
      >
        {emergencyStop
          ? "Release Emergency Stop"
          : "Activate Emergency Stop"}
      </button>

      <div className="risk-section-heading">
        <h3>
          Latest server risk event
        </h3>

        <button
          type="button"
          className="clear-risk-events"
          disabled={
            loading
          }
          onClick={() =>
            loadState?.()
          }
        >
          Refresh
        </button>
      </div>

      <div className="risk-events-list">
        {lastRiskEvent ? (
          <article className="risk-event-row">
            <strong
              className={
                lastRiskEvent
                  .executed
                  ? "negative"
                  : "neutral"
              }
            >
              {lastRiskEvent
                .type ||
                "RISK EVENT"}
            </strong>

            <span>
              {lastRiskEvent
                .symbol ||
                "—"}
            </span>

            <span>
              {formatMoney(
                lastRiskEvent
                  .price,
              )}
            </span>

            <time>
              {formatTime(
                lastRiskEvent
                  .timestamp,
              )}
            </time>

            <p>
              {lastRiskEvent
                .message ||
                "Server risk event recorded."}
            </p>
          </article>
        ) : (
          <p className="empty-state">
            No server risk exits have been recorded.
          </p>
        )}
      </div>

      {error && (
        <p className="scanner-error">
          {error}
        </p>
      )}
    </section>
  );
}

export default RiskManagerPanel;