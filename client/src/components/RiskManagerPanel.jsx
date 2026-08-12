import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  serverUrl,
} from "../config/server.js";


function formatMoney(
  value,
) {
  const number =
    Number(
      value,
    );

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
  if (
    !timestamp
  ) {
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


function formatDateTime(
  timestamp,
) {
  if (
    !timestamp
  ) {
    return "—";
  }

  const date =
    new Date(
      timestamp,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return date.toLocaleString(
    "en-US",
    {
      year:
        "numeric",

      month:
        "short",

      day:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",

      second:
        "2-digit",
    },
  );
}


function formatStatus(
  value,
) {
  return String(
    value ||
      "Unknown",
  )
    .replaceAll(
      "_",
      " ",
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character.toUpperCase(),
    );
}


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

  const [
    killSwitchData,
    setKillSwitchData,
  ] =
    useState(
      null,
    );

  const [
    killSwitchLoading,
    setKillSwitchLoading,
  ] =
    useState(
      false,
    );

  const [
    killSwitchError,
    setKillSwitchError,
  ] =
    useState(
      "",
    );

  const [
    killSwitchMessage,
    setKillSwitchMessage,
  ] =
    useState(
      "",
    );

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


  /*
   * The engine state now also contains the
   * persisted automatic kill-switch state.
   *
   * Prefer the dedicated endpoint response,
   * but fall back to engine state while the
   * dedicated endpoint is loading.
   */
  const killSwitch =
    killSwitchData
      ?.killSwitch ||
    engine
      ?.killSwitchState ||
    {
      active:
        false,

      type:
        null,

      reason:
        null,

      triggeredAt:
        null,
    };

  const automaticKillSwitchActive =
    Boolean(
      killSwitch
        ?.active,
    );

  const priceSafetyFailureCount =
    Number(
      killSwitchData
        ?.priceSafetyFailureCount ??
      engine
        ?.priceSafetyFailureCount ??
      0,
    ) ||
    0;


  const loadKillSwitch =
    useCallback(
      async () => {
        setKillSwitchLoading(
          true,
        );

        setKillSwitchError(
          "",
        );

        try {
          const response =
            await fetch(
              serverUrl(
                "/api/trading-engine/kill-switch",
              ),
              {
                method:
                  "GET",

                cache:
                  "no-store",

                headers: {
                  Accept:
                    "application/json",
                },
              },
            );

          const data =
            await response
              .json();

          if (
            !response.ok ||
            !data
              ?.success
          ) {
            throw new Error(
              data
                ?.message ||
                `Kill-switch request failed with status ${response.status}.`,
            );
          }

          setKillSwitchData(
            data,
          );
        } catch (
          requestError
        ) {
          setKillSwitchError(
            requestError
              ?.message ||
              "Could not load automatic kill-switch state.",
          );
        } finally {
          setKillSwitchLoading(
            false,
          );
        }
      },
      [],
    );


  useEffect(
    () => {
      loadKillSwitch();
    },
    [
      loadKillSwitch,
    ],
  );


  /*
   * Refresh the kill-switch card whenever the
   * main engine state changes.
   */
  useEffect(
    () => {
      if (
        engine
      ) {
        loadKillSwitch();
      }
    },
    [
      engine
        ?.settings
        ?.emergencyStop,

      engine
        ?.status,

      engine
        ?.lastRiskEvent
        ?.timestamp,

      loadKillSwitch,
    ],
  );


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

    await loadKillSwitch();
  }


  async function toggleEngine() {
    await updateSetting(
      "enabled",
      !enabled,
    );
  }


  async function toggleEmergencyStop() {
    setKillSwitchMessage(
      "",
    );

    await updateSetting(
      "emergencyStop",
      !emergencyStop,
    );

    await loadState?.();
    await loadKillSwitch();
  }


  async function toggleTrailingStop(
    event,
  ) {
    await updateSetting(
      "trailingStopEnabled",
      event.target.checked,
    );
  }


  async function resetPaperKillSwitch() {
    const approved =
      window.confirm(
        "Clear the automatic emergency stop and allow the paper engine to resume monitoring?",
      );

    if (
      !approved
    ) {
      return;
    }

    setKillSwitchLoading(
      true,
    );

    setKillSwitchError(
      "",
    );

    setKillSwitchMessage(
      "",
    );

    try {
      const response =
        await fetch(
          serverUrl(
            "/api/trading-engine/kill-switch/reset-test",
          ),
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },
          },
        );

      const data =
        await response
          .json();

      if (
        !response.ok ||
        !data
          ?.success
      ) {
        throw new Error(
          data
            ?.message ||
            `Kill-switch reset failed with status ${response.status}.`,
        );
      }

      setKillSwitchMessage(
        data.message ||
          "Automatic kill switch cleared.",
      );

      await loadState?.();
      await loadKillSwitch();
    } catch (
      requestError
    ) {
      setKillSwitchError(
        requestError
          ?.message ||
          "Could not reset the automatic kill switch.",
      );
    } finally {
      setKillSwitchLoading(
        false,
      );
    }
  }


  async function refreshEverything() {
    setKillSwitchMessage(
      "",
    );

    await loadState?.();
    await loadKillSwitch();
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


  if (
    !engine
  ) {
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


      {/*
       * =====================================================
       * AUTOMATIC KILL SWITCH
       * =====================================================
       */}
      <section className="kill-switch-panel">
        <div className="risk-section-heading">
          <div>
            <p className="panel-eyebrow">
              AUTOMATIC SAFETY SYSTEM
            </p>

            <h3>
              Automatic Kill Switch
            </h3>
          </div>

          <button
            type="button"
            className="clear-risk-events"
            disabled={
              killSwitchLoading
            }
            onClick={
              loadKillSwitch
            }
          >
            {killSwitchLoading
              ? "Refreshing…"
              : "Refresh"}
          </button>
        </div>


        <div
          className={
            automaticKillSwitchActive
              ? "kill-switch-status triggered"
              : "kill-switch-status armed"
          }
        >
          <div className="kill-switch-status-header">
            <span
              className={
                automaticKillSwitchActive
                  ? "risk-status-dot blocked"
                  : "risk-status-dot safe"
              }
            />

            <div>
              <strong
                className={
                  automaticKillSwitchActive
                    ? "negative"
                    : "positive"
                }
              >
                {automaticKillSwitchActive
                  ? "TRIGGERED"
                  : "ARMED"}
              </strong>

              <small>
                {automaticKillSwitchActive
                  ? "New automated entries are blocked."
                  : "Automatic protection is monitoring the engine."}
              </small>
            </div>
          </div>


          <div className="kill-switch-details">
            <article>
              <span>
                Emergency Stop
              </span>

              <strong
                className={
                  emergencyStop
                    ? "negative"
                    : "positive"
                }
              >
                {emergencyStop
                  ? "ACTIVE"
                  : "CLEAR"}
              </strong>
            </article>


            <article>
              <span>
                Trigger Type
              </span>

              <strong>
                {killSwitch
                  ?.type
                  ? formatStatus(
                      killSwitch
                        .type,
                    )
                  : "None"}
              </strong>
            </article>


            <article>
              <span>
                Price Safety Failures
              </span>

              <strong
                className={
                  priceSafetyFailureCount >
                  0
                    ? "negative"
                    : "positive"
                }
              >
                {
                  priceSafetyFailureCount
                }
              </strong>
            </article>


            <article>
              <span>
                Triggered At
              </span>

              <strong>
                {formatDateTime(
                  killSwitch
                    ?.triggeredAt,
                )}
              </strong>
            </article>
          </div>


          {killSwitch
            ?.reason ? (
            <div className="kill-switch-reason">
              <span>
                Trigger reason
              </span>

              <p>
                {
                  killSwitch.reason
                }
              </p>
            </div>
          ) : (
            <div className="kill-switch-reason">
              <span>
                Status
              </span>

              <p>
                No automatic safety trigger is currently active.
              </p>
            </div>
          )}


          {automaticKillSwitchActive &&
          killSwitch
            ?.type ===
            "PAPER_MODE_TEST" ? (
            <button
              type="button"
              className="emergency-stop-button active"
              disabled={
                killSwitchLoading
              }
              onClick={
                resetPaperKillSwitch
              }
            >
              {killSwitchLoading
                ? "Resetting…"
                : "Reset Paper Test Kill Switch"}
            </button>
          ) : null}


          {automaticKillSwitchActive &&
          killSwitch
            ?.type !==
            "PAPER_MODE_TEST" ? (
            <div className="kill-switch-warning">
              This stop was triggered by an actual safety condition.
              Review the reason before manually releasing the emergency stop.
            </div>
          ) : null}


          {killSwitchMessage ? (
            <p className="order-message">
              {
                killSwitchMessage
              }
            </p>
          ) : null}


          {killSwitchError ? (
            <p className="scanner-error">
              {
                killSwitchError
              }
            </p>
          ) : null}

        </div>
      </section>


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
            Kill switch
          </span>

          <strong
            className={
              automaticKillSwitchActive
                ? "negative"
                : "positive"
            }
          >
            {automaticKillSwitchActive
              ? "TRIGGERED"
              : "ARMED"}
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


      {/*
       * Keep the existing manual emergency
       * stop separate from the automatic
       * kill switch.
       */}
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
            loading ||
            killSwitchLoading
          }
          onClick={
            refreshEverything
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
          {
            error
          }
        </p>
      )}
    </section>
  );
}


export default RiskManagerPanel;