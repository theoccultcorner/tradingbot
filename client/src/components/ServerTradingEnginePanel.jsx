import {
  useEffect,
  useState,
} from "react";

const DEFAULT_SETTINGS = {
  enabled: false,
  emergencyStop: false,

  minimumBuyScore: 40,
  minimumBuyConfidence: 45,

  minimumSellScore: 40,
  minimumSellConfidence: 45,

  buyAmount: 40,
  maximumPositionValue: 120,

  cooldownMinutes: 0,

  stopLossPercent: 1.5,
  takeProfitPercent: 3,

  trailingStopEnabled: true,
  trailingStopPercent: 1,

  dailyLossLimit: 30,

  /*
   * Zero = unlimited.
   */
  maximumTradesPerDay: 0,
};

function numberOrFallback(
  value,
  fallback,
) {
  const number =
    Number(
      value,
    );

  return Number.isFinite(
    number,
  )
    ? number
    : fallback;
}

function formatDate(
  value,
) {
  const number =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      number,
    ) ||
    number <= 0
  ) {
    return "—";
  }

  return new Date(
    number,
  ).toLocaleString();
}

function ServerTradingEnginePanel({
  serverEngine,
}) {
  const engine =
    serverEngine.engine;

  const loading =
    Boolean(
      serverEngine.loading,
    );

  const error =
    serverEngine.error ||
    "";

  /*
   * Support either naming convention in
   * your hook.
   *
   * If your existing hook uses
   * updateSettings(), this uses it.
   *
   * If it uses saveSettings(), that also
   * works.
   */
  const saveEngineSettings =
    serverEngine.updateSettings ||
    serverEngine.saveSettings;

  const loadEngine =
    serverEngine.loadState ||
    serverEngine.loadEngine ||
    serverEngine.refresh;

  const settings =
    engine?.settings ||
    DEFAULT_SETTINGS;

  const [
    draft,
    setDraft,
  ] =
    useState({
      ...DEFAULT_SETTINGS,
      ...settings,
    });

  const [
    message,
    setMessage,
  ] =
    useState(
      "",
    );

  /*
   * IMPORTANT:
   *
   * Synchronize the form whenever fresh
   * settings arrive from the server.
   *
   * Without this, the inputs can continue
   * displaying stale defaults after the
   * server state loads.
   */
  useEffect(
    () => {
      if (
        !engine?.settings
      ) {
        return;
      }

      setDraft({
        ...DEFAULT_SETTINGS,
        ...engine.settings,
      });
    },
    [
      engine?.settings,
    ],
  );

  function updateDraft(
    name,
    value,
  ) {
    setDraft(
      (
        previous,
      ) => ({
        ...previous,
        [name]:
          value,
      }),
    );

    setMessage(
      "",
    );
  }

  function updateNumber(
    name,
    value,
  ) {
    if (
      value ===
      ""
    ) {
      updateDraft(
        name,
        "",
      );

      return;
    }

    updateDraft(
      name,
      Number(
        value,
      ),
    );
  }

  async function saveSettings(
    nextSettings =
      draft,
  ) {
    if (
      typeof saveEngineSettings !==
      "function"
    ) {
      setMessage(
        "The server engine hook does not expose a settings update function.",
      );

      return {
        success:
          false,
      };
    }

    try {
      setMessage(
        "",
      );

      const cleaned = {
        ...nextSettings,

        minimumBuyScore:
          Math.max(
            numberOrFallback(
              nextSettings
                .minimumBuyScore,
              40,
            ),
            0,
          ),

        minimumBuyConfidence:
          Math.max(
            numberOrFallback(
              nextSettings
                .minimumBuyConfidence,
              45,
            ),
            0,
          ),

        minimumSellScore:
          Math.max(
            numberOrFallback(
              nextSettings
                .minimumSellScore,
              40,
            ),
            0,
          ),

        minimumSellConfidence:
          Math.max(
            numberOrFallback(
              nextSettings
                .minimumSellConfidence,
              45,
            ),
            0,
          ),

        buyAmount:
          Math.max(
            numberOrFallback(
              nextSettings
                .buyAmount,
              40,
            ),
            1,
          ),

        maximumPositionValue:
          Math.max(
            numberOrFallback(
              nextSettings
                .maximumPositionValue,
              120,
            ),
            1,
          ),

        cooldownMinutes:
          Math.max(
            numberOrFallback(
              nextSettings
                .cooldownMinutes,
              0,
            ),
            0,
          ),

        stopLossPercent:
          Math.max(
            numberOrFallback(
              nextSettings
                .stopLossPercent,
              1.5,
            ),
            0.1,
          ),

        takeProfitPercent:
          Math.max(
            numberOrFallback(
              nextSettings
                .takeProfitPercent,
              3,
            ),
            0.1,
          ),

        trailingStopPercent:
          Math.max(
            numberOrFallback(
              nextSettings
                .trailingStopPercent,
              1,
            ),
            0.1,
          ),

        dailyLossLimit:
          Math.max(
            numberOrFallback(
              nextSettings
                .dailyLossLimit,
              30,
            ),
            1,
          ),

        maximumTradesPerDay:
          Math.max(
            Math.floor(
              numberOrFallback(
                nextSettings
                  .maximumTradesPerDay,
                0,
              ),
            ),
            0,
          ),

        enabled:
          Boolean(
            nextSettings.enabled,
          ),

        emergencyStop:
          Boolean(
            nextSettings
              .emergencyStop,
          ),

        trailingStopEnabled:
          Boolean(
            nextSettings
              .trailingStopEnabled,
          ),
      };

      const result =
        await saveEngineSettings(
          cleaned,
        );

      /*
       * Some versions of your hook return
       * { success: false, message }, while
       * others return the updated engine
       * directly.
       */
      if (
        result?.success ===
        false
      ) {
        throw new Error(
          result.message ||
            "Could not update server trading settings.",
        );
      }

      setDraft(
        cleaned,
      );

      setMessage(
        "Trading engine settings saved.",
      );

      return {
        success:
          true,
      };
    } catch (
      saveError
    ) {
      setMessage(
        saveError.message ||
          "Could not update server trading settings.",
      );

      return {
        success:
          false,
      };
    }
  }

  async function toggleEngine() {
    const next = {
      ...draft,

      enabled:
        !Boolean(
          settings.enabled,
        ),
    };

    setDraft(
      next,
    );

    await saveSettings(
      next,
    );
  }

  async function toggleEmergencyStop() {
    const nextEmergencyStop =
      !Boolean(
        settings
          .emergencyStop,
      );

    const next = {
      ...draft,

      emergencyStop:
        nextEmergencyStop,
    };

    /*
     * Emergency stop blocks new automated
     * trading immediately.
     *
     * We leave enabled unchanged so clearing
     * the emergency stop returns the engine
     * to its previous enabled state.
     */
    setDraft(
      next,
    );

    await saveSettings(
      next,
    );
  }

  if (
    loading &&
    !engine
  ) {
    return (
      <section className="panel server-engine-panel">
        <p>
          Loading server trading engine…
        </p>
      </section>
    );
  }

  const lastDecision =
    engine?.lastDecision;

  const lastRiskEvent =
    engine?.lastRiskEvent;

  const isEnabled =
    Boolean(
      settings.enabled,
    );

  const emergencyStop =
    Boolean(
      settings
        .emergencyStop,
    );

  return (
    <section className="panel server-engine-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">
            SERVER AUTOMATION
          </p>

          <h2>
            Server Trading Engine
          </h2>

          <small>
            Independent BUY and SELL rules with automatic position exits.
          </small>
        </div>

        <div className="server-engine-header-actions">
          <button
            type="button"
            className={
              isEnabled
                ? "auto-toggle enabled"
                : "auto-toggle"
            }
            disabled={
              loading
            }
            onClick={
              toggleEngine
            }
          >
            {isEnabled
              ? "Enabled"
              : "Disabled"}
          </button>

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
              ? "Emergency Stop Active"
              : "Emergency Stop"}
          </button>
        </div>
      </div>

      <div className="server-engine-status-bar">
        <div>
          <span>
            Status
          </span>

          <strong
            className={
              emergencyStop
                ? "negative"
                : isEnabled
                  ? "positive"
                  : "neutral"
            }
          >
            {engine?.status ||
              "Unavailable"}
          </strong>
        </div>

        <div>
          <span>
            Daily trades
          </span>

          <strong>
            {Number(
              settings
                .maximumTradesPerDay,
            ) ===
            0
              ? "Unlimited"
              : settings
                  .maximumTradesPerDay}
          </strong>
        </div>

        <div>
          <span>
            Cooldown
          </span>

          <strong>
            {Number(
              settings
                .cooldownMinutes,
            ) ===
            0
              ? "None"
              : `${settings.cooldownMinutes} min`}
          </strong>
        </div>
      </div>

      {/* ===================================================
          BUY RULES
          =================================================== */}

      <div className="server-engine-section-heading">
        <div>
          <span className="server-rule-badge buy">
            BUY
          </span>

          <div>
            <h3>
              Entry Rules
            </h3>

            <small>
              A BUY must meet both thresholds.
            </small>
          </div>
        </div>
      </div>

      <div className="risk-settings-grid">
        <label>
          <span>
            BUY minimum score
          </span>

          <input
            type="number"
            min="0"
            step="1"
            value={
              draft
                .minimumBuyScore
            }
            onChange={(
              event,
            ) =>
              updateNumber(
                "minimumBuyScore",
                event.target
                  .value,
              )
            }
          />

          <small>
            BUY requires score ≥ this value.
          </small>
        </label>

        <label>
          <span>
            BUY confidence %
          </span>

          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={
              draft
                .minimumBuyConfidence
            }
            onChange={(
              event,
            ) =>
              updateNumber(
                "minimumBuyConfidence",
                event.target
                  .value,
              )
            }
          />

          <small>
            BUY requires confidence ≥ this value.
          </small>
        </label>

        <label>
          <span>
            Buy amount $
          </span>

          <input
            type="number"
            min="1"
            step="1"
            value={
              draft.buyAmount
            }
            onChange={(
              event,
            ) =>
              updateNumber(
                "buyAmount",
                event.target
                  .value,
              )
            }
          />

          <small>
            Requested USD size before dynamic caps.
          </small>
        </label>

        <label>
          <span>
            Max position $
          </span>

          <input
            type="number"
            min="1"
            step="1"
            value={
              draft
                .maximumPositionValue
            }
            onChange={(
              event,
            ) =>
              updateNumber(
                "maximumPositionValue",
                event.target
                  .value,
              )
            }
          />

          <small>
            Maximum value held in one market.
          </small>
        </label>
      </div>

      {/* ===================================================
          SELL RULES
          =================================================== */}

      <div className="server-engine-section-heading">
        <div>
          <span className="server-rule-badge sell">
            SELL
          </span>

          <div>
            <h3>
              Signal Exit Rules
            </h3>

            <small>
              A bearish signal can close the entire open position.
            </small>
          </div>
        </div>
      </div>

      <div className="risk-settings-grid">
        <label>
          <span>
            SELL minimum score
          </span>

          <input
            type="number"
            min="0"
            step="1"
            value={
              draft
                .minimumSellScore
            }
            onChange={(
              event,
            ) =>
              updateNumber(
                "minimumSellScore",
                event.target
                  .value,
              )
            }
          />

          <small>
            Enter 40 to require a score of -40 or lower.
          </small>
        </label>

        <label>
          <span>
            SELL confidence %
          </span>

          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={
              draft
                .minimumSellConfidence
            }
            onChange={(
              event,
            ) =>
              updateNumber(
                "minimumSellConfidence",
                event.target
                  .value,
              )
            }
          />

          <small>
            SELL requires confidence ≥ this value.
          </small>
        </label>
      </div>

      {/* ===================================================
          AUTOMATIC EXIT RULES
          =================================================== */}

      <div className="server-engine-section-heading">
        <div>
          <span className="server-rule-badge risk">
            EXIT
          </span>

          <div>
            <h3>
              Automatic Risk Exits
            </h3>

            <small>
              These can sell even without a SELL signal.
            </small>
          </div>
        </div>
      </div>

      <div className="risk-settings-grid">
        <label>
          <span>
            Stop loss %
          </span>

          <input
            type="number"
            min="0.1"
            step="0.1"
            value={
              draft
                .stopLossPercent
            }
            onChange={(
              event,
            ) =>
              updateNumber(
                "stopLossPercent",
                event.target
                  .value,
              )
            }
          />

          <small>
            Sell when loss reaches this percentage.
          </small>
        </label>

        <label>
          <span>
            Take profit %
          </span>

          <input
            type="number"
            min="0.1"
            step="0.1"
            value={
              draft
                .takeProfitPercent
            }
            onChange={(
              event,
            ) =>
              updateNumber(
                "takeProfitPercent",
                event.target
                  .value,
              )
            }
          />

          <small>
            Sell when profit reaches this percentage.
          </small>
        </label>

        <label>
          <span>
            Trailing stop %
          </span>

          <input
            type="number"
            min="0.1"
            step="0.1"
            disabled={
              !draft
                .trailingStopEnabled
            }
            value={
              draft
                .trailingStopPercent
            }
            onChange={(
              event,
            ) =>
              updateNumber(
                "trailingStopPercent",
                event.target
                  .value,
              )
            }
          />

          <small>
            Allowed drop from the position high.
          </small>
        </label>

        <label className="server-checkbox-setting">
          <span>
            Trailing stop
          </span>

          <div>
            <input
              type="checkbox"
              checked={
                Boolean(
                  draft
                    .trailingStopEnabled,
                )
              }
              onChange={(
                event,
              ) =>
                updateDraft(
                  "trailingStopEnabled",
                  event.target
                    .checked,
                )
              }
            />

            <strong>
              {draft
                .trailingStopEnabled
                ? "Enabled"
                : "Disabled"}
            </strong>
          </div>

          <small>
            Protect gains as price moves higher.
          </small>
        </label>
      </div>

      {/* ===================================================
          ACCOUNT RISK
          =================================================== */}

      <div className="server-engine-section-heading">
        <div>
          <span className="server-rule-badge account">
            RISK
          </span>

          <div>
            <h3>
              Account Protection
            </h3>

            <small>
              Opportunity frequency stays unrestricted until a risk rule blocks it.
            </small>
          </div>
        </div>
      </div>

      <div className="risk-settings-grid">
        <label>
          <span>
            Daily loss limit $
          </span>

          <input
            type="number"
            min="1"
            step="1"
            value={
              draft
                .dailyLossLimit
            }
            onChange={(
              event,
            ) =>
              updateNumber(
                "dailyLossLimit",
                event.target
                  .value,
              )
            }
          />

          <small>
            New BUYs stop after this realized daily loss.
          </small>
        </label>

        <label>
          <span>
            Cooldown minutes
          </span>

          <input
            type="number"
            min="0"
            step="1"
            value={
              draft
                .cooldownMinutes
            }
            onChange={(
              event,
            ) =>
              updateNumber(
                "cooldownMinutes",
                event.target
                  .value,
              )
            }
          />

          <small>
            0 = none.
          </small>
        </label>

        <label>
          <span>
            Maximum trades/day
          </span>

          <input
            type="number"
            min="0"
            step="1"
            value={
              draft
                .maximumTradesPerDay
            }
            onChange={(
              event,
            ) =>
              updateNumber(
                "maximumTradesPerDay",
                event.target
                  .value,
              )
            }
          />

          <small>
            0 = unlimited.
          </small>
        </label>
      </div>

      <div className="server-engine-actions">
        <button
          type="button"
          className="run-scanner-button"
          disabled={
            loading
          }
          onClick={() =>
            saveSettings()
          }
        >
          {loading
            ? "Saving…"
            : "Save Settings"}
        </button>

        {typeof loadEngine ===
          "function" && (
          <button
            type="button"
            className="run-scanner-button"
            disabled={
              loading
            }
            onClick={
              loadEngine
            }
          >
            Refresh
          </button>
        )}
      </div>

      {message && (
        <p className="server-engine-message">
          {message}
        </p>
      )}

      {error && (
        <p className="scanner-error">
          {error}
        </p>
      )}

      {/* ===================================================
          CURRENT ENGINE ACTIVITY
          =================================================== */}

      <div className="server-engine-log">
        <article>
          <span>
            Last decision
          </span>

          <strong
            className={
              lastDecision
                ?.action ===
              "BUY"
                ? "positive"
                : lastDecision
                      ?.action ===
                    "SELL"
                  ? "negative"
                  : "neutral"
            }
          >
            {lastDecision
              ?.action ||
              "Waiting"}
          </strong>

          <small>
            {lastDecision
              ?.message ||
              "No server decision yet."}
          </small>

          {lastDecision && (
            <>
              <small>
                Score:{" "}
                {
                  lastDecision.score
                }
                {" · "}
                Confidence:{" "}
                {
                  lastDecision
                    .confidence
                }
                %
              </small>

              <small>
                {formatDate(
                  lastDecision
                    .timestamp,
                )}
              </small>
            </>
          )}
        </article>

        <article>
          <span>
            Last risk exit
          </span>

          <strong>
            {lastRiskEvent
              ?.type ||
              "None"}
          </strong>

          <small>
            {lastRiskEvent
              ?.message ||
              "No automatic risk exit yet."}
          </small>

          {lastRiskEvent && (
            <>
              <small>
                {lastRiskEvent
                  .symbol}
                {" · "}
                Quantity:{" "}
                {
                  lastRiskEvent
                    .quantity
                }
              </small>

              <small>
                {formatDate(
                  lastRiskEvent
                    .timestamp,
                )}
              </small>
            </>
          )}
        </article>
      </div>

      <div className="server-engine-explanation">
        <strong>
          Current execution logic
        </strong>

        <small>
          BUY: score ≥{" "}
          {
            draft.minimumBuyScore
          }
          {" "}
          and confidence ≥{" "}
          {
            draft.minimumBuyConfidence
          }
          %.
        </small>

        <small>
          SELL: score ≤ -
          {
            draft.minimumSellScore
          }
          {" "}
          and confidence ≥{" "}
          {
            draft.minimumSellConfidence
          }
          %.
        </small>

        <small>
          A position can also be sold by the stop loss, take profit, or trailing stop independently of the SELL signal.
        </small>

        <small>
          Maximum trades/day:{" "}
          {Number(
            draft
              .maximumTradesPerDay,
          ) ===
          0
            ? "Unlimited"
            : draft
                .maximumTradesPerDay}
          {" · "}
          Cooldown:{" "}
          {Number(
            draft
              .cooldownMinutes,
          ) ===
          0
            ? "None"
            : `${draft.cooldownMinutes} minutes`}
          .
        </small>
      </div>
    </section>
  );
}

export default ServerTradingEnginePanel;