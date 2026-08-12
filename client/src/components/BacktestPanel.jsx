import {
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

function formatPercent(
  value,
  signed = true,
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

  const prefix =
    signed &&
    number >
      0
      ? "+"
      : "";

  return `${prefix}${number.toFixed(
    2,
  )}%`;
}

function formatProfitFactor(
  value,
) {
  if (
    value ===
    null
  ) {
    return "∞";
  }

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

  return number.toFixed(
    2,
  );
}

function getTone(
  value,
) {
  const number =
    Number(
      value,
    );

  if (
    number >
    0
  ) {
    return "positive";
  }

  if (
    number <
    0
  ) {
    return "negative";
  }

  return "neutral";
}

function ResultCard({
  label,
  value,
  tone =
    "neutral",
  detail =
    "",
}) {
  const toneColor =
    tone ===
    "positive"
      ? "#4ade80"
      : tone ===
          "negative"
        ? "#fb7185"
        : "#f8fafc";

  return (
    <article
      style={{
        minWidth:
          0,

        padding:
          "16px",

        border:
          "1px solid rgba(148, 163, 184, 0.12)",

        borderRadius:
          "14px",

        background:
          "rgba(15, 23, 42, 0.48)",
      }}
    >
      <span
        style={{
          display:
            "block",

          marginBottom:
            "8px",

          color:
            "#94a3b8",

          fontSize:
            "11px",

          fontWeight:
            700,

          letterSpacing:
            "0.08em",

          textTransform:
            "uppercase",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          display:
            "block",

          color:
            toneColor,

          fontSize:
            "20px",

          lineHeight:
            1.2,
        }}
      >
        {value}
      </strong>

      {detail ? (
        <small
          style={{
            display:
              "block",

            marginTop:
              "6px",

            color:
              "#64748b",
          }}
        >
          {detail}
        </small>
      ) : null}
    </article>
  );
}

function Field({
  label,
  value,
  onChange,
  min,
  max,
  step,
}) {
  return (
    <label
      style={{
        display:
          "flex",

        flexDirection:
          "column",

        gap:
          "7px",

        minWidth:
          0,
      }}
    >
      <span
        style={{
          color:
            "#94a3b8",

          fontSize:
            "12px",

          fontWeight:
            600,
        }}
      >
        {label}
      </span>

      <input
        type="number"
        min={
          min
        }
        max={
          max
        }
        step={
          step
        }
        value={
          value
        }
        onChange={
          onChange
        }
        style={{
          width:
            "100%",

          boxSizing:
            "border-box",

          border:
            "1px solid rgba(148, 163, 184, 0.16)",

          borderRadius:
            "10px",

          padding:
            "10px 11px",

          background:
            "rgba(15, 23, 42, 0.62)",

          color:
            "#f8fafc",

          outline:
            "none",
        }}
      />
    </label>
  );
}

function BacktestPanel({
  symbol =
    "SOLUSD",

  timeframe =
    "15m",
}) {
  const [
    mode,
    setMode,
  ] =
    useState(
      "standard",
    );

  const [
    settings,
    setSettings,
  ] =
    useState({
      startingCash:
        300,

      buyAmount:
        40,

      minimumScore:
        40,

      minimumConfidence:
        60,

      stopLossPercent:
        1.5,

      takeProfitPercent:
        3,

      feePercent:
        0.1,

      minimumHistory:
        210,

      limit:
        1000,

      walkForwardLimit:
        3000,

      trainingWindow:
        500,

      testingWindow:
        150,

      stepSize:
        150,
    });

  const [
    result,
    setResult,
  ] =
    useState(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState(
      "",
    );

  const [
    status,
    setStatus,
  ] =
    useState(
      "",
    );

  const isWalkForward =
    mode ===
    "walk-forward";

  function updateSetting(
    key,
    value,
  ) {
    setSettings(
      (
        previous,
      ) => ({
        ...previous,

        [key]:
          value,
      }),
    );
  }

  function changeMode(
    nextMode,
  ) {
    if (
      loading
    ) {
      return;
    }

    setMode(
      nextMode,
    );

    setResult(
      null,
    );

    setError(
      "",
    );

    setStatus(
      "",
    );
  }

  function commonRequestBody() {
    return {
      symbol,

      timeframe,

      startingCash:
        Number(
          settings.startingCash,
        ),

      buyAmount:
        Number(
          settings.buyAmount,
        ),

      minimumScore:
        Number(
          settings.minimumScore,
        ),

      minimumConfidence:
        Number(
          settings.minimumConfidence,
        ),

      stopLossPercent:
        Number(
          settings.stopLossPercent,
        ),

      takeProfitPercent:
        Number(
          settings.takeProfitPercent,
        ),

      minimumHistory:
        Number(
          settings.minimumHistory,
        ),

      feeRate:
        Number(
          settings.feePercent,
        ) /
        100,
    };
  }

  async function parseJsonResponse(
    response,
  ) {
    const text =
      await response.text();

    let data =
      {};

    if (
      text
    ) {
      try {
        data =
          JSON.parse(
            text,
          );
      } catch {
        throw new Error(
          "The server returned invalid JSON.",
        );
      }
    }

    if (
      !response.ok ||
      data.success ===
        false
    ) {
      throw new Error(
        data.message ||
          `Request failed with status ${response.status}.`,
      );
    }

    return (
      data.result ||
      data.data ||
      data
    );
  }

  async function runStandardBacktest() {
    setLoading(
      true,
    );

    setResult(
      null,
    );

    setError(
      "",
    );

    setStatus(
      "Running standard backtest…",
    );

    try {
      const response =
        await fetch(
          serverUrl(
            "/api/backtest/run",
          ),
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                ...commonRequestBody(),

                limit:
                  Number(
                    settings.limit,
                  ),
              }),
          },
        );

      const nextResult =
        await parseJsonResponse(
          response,
        );

      setResult(
        nextResult,
      );

      setStatus(
        "Backtest completed.",
      );
    } catch (
      requestError
    ) {
      setStatus(
        "",
      );

      setError(
        requestError.message ||
          "The backtest failed.",
      );
    } finally {
      setLoading(
        false,
      );
    }
  }

  function sleep(
    milliseconds,
  ) {
    return new Promise(
      (
        resolve,
      ) => {
        window.setTimeout(
          resolve,
          milliseconds,
        );
      },
    );
  }

  async function loadRecentWalkForwardTests() {
    const response =
      await fetch(
        serverUrl(
          "/api/backtest/walk-forward/recent?limit=20",
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

    const text =
      await response.text();

    let data =
      {};

    try {
      data =
        text
          ? JSON.parse(
              text,
            )
          : {};
    } catch {
      throw new Error(
        "Recent walk-forward results returned invalid JSON.",
      );
    }

    if (
      !response.ok ||
      data.success ===
        false
    ) {
      throw new Error(
        data.message ||
          "Could not load recent walk-forward tests.",
      );
    }

    return Array.isArray(
      data.tests,
    )
      ? data.tests
      : [];
  }

  async function waitForWalkForwardResult({
    existingIds,
    startedAt,
  }) {
    const attempts =
      30;

    for (
      let attempt =
        0;

      attempt <
      attempts;

      attempt +=
        1
    ) {
      if (
        attempt >
        0
      ) {
        await sleep(
          4000,
        );
      }

      setStatus(
        `Server is still processing. Checking saved results… ${attempt + 1}/${attempts}`,
      );

      try {
        const tests =
          await loadRecentWalkForwardTests();

        const match =
          tests.find(
            (
              test,
            ) => {
              if (
                !test ||
                existingIds.has(
                  test.id,
                )
              ) {
                return false;
              }

              if (
                String(
                  test.symbol ||
                    "",
                ).toUpperCase() !==
                String(
                  symbol ||
                    "",
                ).toUpperCase()
              ) {
                return false;
              }

              if (
                String(
                  test.timeframe ||
                    "",
                ) !==
                String(
                  timeframe ||
                    "",
                )
              ) {
                return false;
              }

              const createdAt =
                Number(
                  test.createdAt,
                );

              return (
                !Number.isFinite(
                  createdAt,
                ) ||
                createdAt >=
                  startedAt -
                    15000
              );
            },
          );

        if (
          match
        ) {
          return match;
        }
      } catch (
        pollingError
      ) {
        console.warn(
          "Walk-forward polling error:",
          pollingError,
        );
      }
    }

    return null;
  }

  async function runWalkForwardTest() {
    setLoading(
      true,
    );

    setResult(
      null,
    );

    setError(
      "",
    );

    setStatus(
      "Preparing walk-forward test…",
    );

    const startedAt =
      Date.now();

    let existingIds =
      new Set();

    try {
      const existing =
        await loadRecentWalkForwardTests();

      existingIds =
        new Set(
          existing
            .map(
              (
                test,
              ) =>
                test.id,
            )
            .filter(
              Boolean,
            ),
        );
    } catch (
      baselineError
    ) {
      console.warn(
        "Could not capture existing walk-forward tests:",
        baselineError,
      );
    }

    try {
      setStatus(
        "Optimizing training windows and testing unseen data…",
      );

      const response =
        await fetch(
          serverUrl(
            "/api/backtest/walk-forward",
          ),
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                ...commonRequestBody(),

                limit:
                  Number(
                    settings.walkForwardLimit,
                  ),

                trainingWindow:
                  Number(
                    settings.trainingWindow,
                  ),

                testingWindow:
                  Number(
                    settings.testingWindow,
                  ),

                stepSize:
                  Number(
                    settings.stepSize,
                  ),
              }),
          },
        );

      if (
        response.ok
      ) {
        const nextResult =
          await parseJsonResponse(
            response,
          );

        setResult(
          nextResult,
        );

        setStatus(
          "Walk-forward test completed.",
        );

        return;
      }

      if (
        response.status >=
          400 &&
        response.status <
          500
      ) {
        await parseJsonResponse(
          response,
        );

        return;
      }

      throw new Error(
        `The walk-forward connection ended with status ${response.status}.`,
      );
    } catch (
      requestError
    ) {
      setStatus(
        "The browser connection ended before the server finished. Checking for the saved result automatically…",
      );

      const savedResult =
        await waitForWalkForwardResult({
          existingIds,
          startedAt,
        });

      if (
        savedResult
      ) {
        setResult(
          savedResult,
        );

        setError(
          "",
        );

        setStatus(
          "Walk-forward test completed and the saved result was loaded.",
        );

        return;
      }

      setStatus(
        "",
      );

      setError(
        requestError.message ||
          "The walk-forward test did not return a result.",
      );
    } finally {
      setLoading(
        false,
      );
    }
  }

  const runTest =
    isWalkForward
      ? runWalkForwardTest
      : runStandardBacktest;

  return (
    <section
      className="panel-card backtest-panel"
      style={{
        overflow:
          "hidden",
      }}
    >
      {/* HEADER */}

      <div
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "flex-start",

          gap:
            "16px",

          marginBottom:
            "22px",

          flexWrap:
            "wrap",
        }}
      >
        <div>
          <span className="eyebrow">
            STRATEGY VALIDATION
          </span>

          <h2
            style={{
              marginBottom:
                "6px",
            }}
          >
            Backtesting Lab
          </h2>

          <p
            style={{
              margin:
                0,

              color:
                "#64748b",

              fontSize:
                "13px",
            }}
          >
            Test the Strategy 2.0 engine against historical market data.
          </p>
        </div>

        <div
          style={{
            padding:
              "8px 12px",

            border:
              "1px solid rgba(148, 163, 184, 0.14)",

            borderRadius:
              "999px",

            background:
              "rgba(15, 23, 42, 0.55)",

            color:
              "#cbd5e1",

            fontSize:
              "12px",

            fontWeight:
              700,
          }}
        >
          {symbol.replace(
            "USD",
            "/USD",
          )}
          {" · "}
          {timeframe}
        </div>
      </div>

      {/* SEGMENTED TOGGLE */}

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "1fr 1fr",

          gap:
            "5px",

          padding:
            "5px",

          marginBottom:
            "24px",

          border:
            "1px solid rgba(148, 163, 184, 0.12)",

          borderRadius:
            "14px",

          background:
            "rgba(15, 23, 42, 0.4)",
        }}
      >
        <button
          type="button"
          disabled={
            loading
          }
          onClick={() =>
            changeMode(
              "standard",
            )
          }
          style={{
            border:
              mode ===
              "standard"
                ? "1px solid rgba(148, 163, 184, 0.18)"
                : "1px solid transparent",

            borderRadius:
              "10px",

            padding:
              "12px 14px",

            cursor:
              loading
                ? "not-allowed"
                : "pointer",

            background:
              mode ===
              "standard"
                ? "rgba(51, 65, 85, 0.85)"
                : "transparent",

            color:
              mode ===
              "standard"
                ? "#ffffff"
                : "#94a3b8",

            fontWeight:
              700,

            transition:
              "all 160ms ease",
          }}
        >
          Standard Backtest
        </button>

        <button
          type="button"
          disabled={
            loading
          }
          onClick={() =>
            changeMode(
              "walk-forward",
            )
          }
          style={{
            border:
              mode ===
              "walk-forward"
                ? "1px solid rgba(56, 189, 248, 0.28)"
                : "1px solid transparent",

            borderRadius:
              "10px",

            padding:
              "12px 14px",

            cursor:
              loading
                ? "not-allowed"
                : "pointer",

            background:
              mode ===
              "walk-forward"
                ? "rgba(14, 116, 144, 0.28)"
                : "transparent",

            color:
              mode ===
              "walk-forward"
                ? "#e0f2fe"
                : "#94a3b8",

            fontWeight:
              700,

            transition:
              "all 160ms ease",
          }}
        >
          Walk-Forward Test
        </button>
      </div>

      {/* MODE DESCRIPTION */}

      <div
        style={{
          marginBottom:
            "22px",

          padding:
            "13px 15px",

          borderRadius:
            "12px",

          border:
            isWalkForward
              ? "1px solid rgba(56, 189, 248, 0.13)"
              : "1px solid rgba(148, 163, 184, 0.1)",

          background:
            isWalkForward
              ? "rgba(14, 116, 144, 0.08)"
              : "rgba(15, 23, 42, 0.32)",

          color:
            "#94a3b8",

          fontSize:
            "13px",

          lineHeight:
            1.5,
        }}
      >
        {isWalkForward
          ? "Walk-forward mode optimizes parameters using training data, then evaluates those settings on the unseen market window that follows."
          : "Standard mode runs Strategy 2.0 through one continuous historical dataset using the settings below."}
      </div>

      {/* STRATEGY SETTINGS */}

      <div
        style={{
          padding:
            "18px",

          marginBottom:
            "18px",

          border:
            "1px solid rgba(148, 163, 184, 0.1)",

          borderRadius:
            "14px",

          background:
            "rgba(15, 23, 42, 0.27)",
        }}
      >
        <div
          style={{
            marginBottom:
              "16px",
          }}
        >
          <span className="eyebrow">
            STRATEGY SETTINGS
          </span>

          <h3
            style={{
              margin:
                "5px 0 0",
            }}
          >
            Trading Parameters
          </h3>
        </div>

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(145px, 1fr))",

            gap:
              "14px",
          }}
        >
          <Field
            label="Starting cash"
            value={
              settings.startingCash
            }
            min="1"
            step="1"
            onChange={(
              event,
            ) =>
              updateSetting(
                "startingCash",
                event.target.value,
              )
            }
          />

          <Field
            label="Buy amount"
            value={
              settings.buyAmount
            }
            min="1"
            step="1"
            onChange={(
              event,
            ) =>
              updateSetting(
                "buyAmount",
                event.target.value,
              )
            }
          />

          <Field
            label="Minimum score"
            value={
              settings.minimumScore
            }
            min="0"
            max="100"
            step="1"
            onChange={(
              event,
            ) =>
              updateSetting(
                "minimumScore",
                event.target.value,
              )
            }
          />

          <Field
            label="Min confidence"
            value={
              settings.minimumConfidence
            }
            min="0"
            max="100"
            step="1"
            onChange={(
              event,
            ) =>
              updateSetting(
                "minimumConfidence",
                event.target.value,
              )
            }
          />

          <Field
            label="Stop loss %"
            value={
              settings.stopLossPercent
            }
            min="0.1"
            step="0.1"
            onChange={(
              event,
            ) =>
              updateSetting(
                "stopLossPercent",
                event.target.value,
              )
            }
          />

          <Field
            label="Take profit %"
            value={
              settings.takeProfitPercent
            }
            min="0.1"
            step="0.1"
            onChange={(
              event,
            ) =>
              updateSetting(
                "takeProfitPercent",
                event.target.value,
              )
            }
          />

          <Field
            label="Fee %"
            value={
              settings.feePercent
            }
            min="0"
            step="0.01"
            onChange={(
              event,
            ) =>
              updateSetting(
                "feePercent",
                event.target.value,
              )
            }
          />

          <Field
            label="Indicator history"
            value={
              settings.minimumHistory
            }
            min="20"
            step="10"
            onChange={(
              event,
            ) =>
              updateSetting(
                "minimumHistory",
                event.target.value,
              )
            }
          />
        </div>
      </div>

      {/* MODE SPECIFIC SETTINGS */}

      <div
        style={{
          padding:
            "18px",

          marginBottom:
            "20px",

          border:
            isWalkForward
              ? "1px solid rgba(56, 189, 248, 0.13)"
              : "1px solid rgba(148, 163, 184, 0.1)",

          borderRadius:
            "14px",

          background:
            isWalkForward
              ? "rgba(14, 116, 144, 0.055)"
              : "rgba(15, 23, 42, 0.27)",
        }}
      >
        <div
          style={{
            marginBottom:
              "16px",
          }}
        >
          <span className="eyebrow">
            {isWalkForward
              ? "ROLLING VALIDATION"
              : "HISTORICAL DATA"}
          </span>

          <h3
            style={{
              margin:
                "5px 0 0",
            }}
          >
            {isWalkForward
              ? "Walk-Forward Configuration"
              : "Backtest Configuration"}
          </h3>
        </div>

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(155px, 1fr))",

            gap:
              "14px",
          }}
        >
          {!isWalkForward ? (
            <Field
              label="Historical candles"
              value={
                settings.limit
              }
              min="250"
              max="5000"
              step="50"
              onChange={(
                event,
              ) =>
                updateSetting(
                  "limit",
                  event.target.value,
                )
              }
            />
          ) : (
            <>
              <Field
                label="Historical candles"
                value={
                  settings.walkForwardLimit
                }
                min="500"
                max="5000"
                step="100"
                onChange={(
                  event,
                ) =>
                  updateSetting(
                    "walkForwardLimit",
                    event.target.value,
                  )
                }
              />

              <Field
                label="Training window"
                value={
                  settings.trainingWindow
                }
                min="250"
                max="4000"
                step="50"
                onChange={(
                  event,
                ) =>
                  updateSetting(
                    "trainingWindow",
                    event.target.value,
                  )
                }
              />

              <Field
                label="Testing window"
                value={
                  settings.testingWindow
                }
                min="10"
                max="2000"
                step="10"
                onChange={(
                  event,
                ) =>
                  updateSetting(
                    "testingWindow",
                    event.target.value,
                  )
                }
              />

              <Field
                label="Step size"
                value={
                  settings.stepSize
                }
                min="1"
                max="2000"
                step="10"
                onChange={(
                  event,
                ) =>
                  updateSetting(
                    "stepSize",
                    event.target.value,
                  )
                }
              />
            </>
          )}
        </div>
      </div>

      {/* RUN BUTTON */}

      <button
        type="button"
        disabled={
          loading
        }
        onClick={
          runTest
        }
        style={{
          width:
            "100%",

          border:
            isWalkForward
              ? "1px solid rgba(56, 189, 248, 0.28)"
              : "1px solid rgba(99, 102, 241, 0.28)",

          borderRadius:
            "12px",

          padding:
            "14px 18px",

          cursor:
            loading
              ? "wait"
              : "pointer",

          background:
            loading
              ? "rgba(51, 65, 85, 0.7)"
              : isWalkForward
                ? "linear-gradient(135deg, rgba(14,116,144,0.9), rgba(2,132,199,0.75))"
                : "linear-gradient(135deg, rgba(79,70,229,0.88), rgba(99,102,241,0.72))",

          color:
            "#ffffff",

          fontSize:
            "14px",

          fontWeight:
            800,

          letterSpacing:
            "0.01em",

          opacity:
            loading
              ? 0.72
              : 1,
        }}
      >
        {loading
          ? isWalkForward
            ? "Running Walk-Forward Test…"
            : "Running Standard Backtest…"
          : isWalkForward
            ? "Run Walk-Forward Test"
            : "Run Standard Backtest"}
      </button>

      {/* STATUS */}

      {status ? (
        <div
          style={{
            marginTop:
              "14px",

            padding:
              "11px 13px",

            borderRadius:
              "10px",

            background:
              "rgba(15, 23, 42, 0.42)",

            color:
              "#94a3b8",

            fontSize:
              "12px",
          }}
        >
          {status}
        </div>
      ) : null}

      {error ? (
        <div
          className="backtest-error"
          style={{
            marginTop:
              "14px",

            padding:
              "12px 14px",

            border:
              "1px solid rgba(251, 113, 133, 0.2)",

            borderRadius:
              "10px",

            background:
              "rgba(159, 18, 57, 0.1)",
          }}
        >
          {error}
        </div>
      ) : null}

      {/* RESULTS */}

      {result ? (
        <div
          style={{
            marginTop:
              "28px",

            paddingTop:
              "24px",

            borderTop:
              "1px solid rgba(148, 163, 184, 0.1)",
          }}
        >
          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              alignItems:
                "center",

              gap:
                "12px",

              marginBottom:
                "16px",

              flexWrap:
                "wrap",
            }}
          >
            <div>
              <span className="eyebrow">
                {isWalkForward
                  ? "OUT-OF-SAMPLE PERFORMANCE"
                  : "BACKTEST PERFORMANCE"}
              </span>

              <h3
                style={{
                  margin:
                    "5px 0 0",
                }}
              >
                Results
              </h3>
            </div>

            {result.id ? (
              <small
                style={{
                  color:
                    "#64748b",
                }}
              >
                Saved ·{" "}
                {result.id.slice(
                  0,
                  8,
                )}
              </small>
            ) : null}
          </div>

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit, minmax(150px, 1fr))",

              gap:
                "12px",
            }}
          >
            <ResultCard
              label="Ending Equity"
              value={
                formatMoney(
                  result.endingEquity,
                )
              }
              tone={
                getTone(
                  result.totalProfit,
                )
              }
            />

            <ResultCard
              label={
                isWalkForward
                  ? "OOS Profit"
                  : "Total Profit"
              }
              value={
                formatMoney(
                  result.totalProfit,
                )
              }
              tone={
                getTone(
                  result.totalProfit,
                )
              }
            />

            <ResultCard
              label={
                isWalkForward
                  ? "OOS Return"
                  : "Total Return"
              }
              value={
                formatPercent(
                  result.totalReturnPercent,
                )
              }
              tone={
                getTone(
                  result.totalReturnPercent,
                )
              }
            />

            <ResultCard
              label="Win Rate"
              value={
                formatPercent(
                  result.winRate,
                  false,
                )
              }
            />

            <ResultCard
              label="Profit Factor"
              value={
                formatProfitFactor(
                  result.profitFactor,
                )
              }
            />

            <ResultCard
              label="Max Drawdown"
              value={
                formatPercent(
                  result.maximumDrawdownPercent,
                  false,
                )
              }
              tone="negative"
            />

            <ResultCard
              label="Closed Trades"
              value={
                Number(
                  result.closedTradeCount ||
                    0,
                )
              }
            />

            <ResultCard
              label="Fees"
              value={
                formatMoney(
                  result.totalFees,
                )
              }
            />

            {isWalkForward ? (
              <>
                <ResultCard
                  label="OOS Expectancy"
                  value={
                    formatMoney(
                      result.outOfSampleExpectancy,
                    )
                  }
                  tone={
                    getTone(
                      result.outOfSampleExpectancy,
                    )
                  }
                />

                <ResultCard
                  label="Windows"
                  value={
                    Number(
                      result.windowCount ||
                        0,
                    )
                  }
                />

                <ResultCard
                  label="Profitable Windows"
                  value={`${Number(
                    result.profitableWindows ||
                      0,
                  )}/${Number(
                    result.windowCount ||
                      0,
                  )}`}
                  tone={
                    Number(
                      result.profitableWindows,
                    ) >
                    Number(
                      result.losingWindows,
                    )
                      ? "positive"
                      : "negative"
                  }
                  detail={
                    formatPercent(
                      result.profitableWindowRate,
                      false,
                    )
                  }
                />

                <ResultCard
                  label="Avg Train Return"
                  value={
                    formatPercent(
                      result.averageTrainingReturnPercent,
                    )
                  }
                  tone={
                    getTone(
                      result.averageTrainingReturnPercent,
                    )
                  }
                />

                <ResultCard
                  label="Avg Test Return"
                  value={
                    formatPercent(
                      result.averageTestingReturnPercent,
                    )
                  }
                  tone={
                    getTone(
                      result.averageTestingReturnPercent,
                    )
                  }
                />

                <ResultCard
                  label="Train → Test Gap"
                  value={
                    formatPercent(
                      result.averageReturnDegradationPercent,
                      false,
                    )
                  }
                  tone={
                    Number(
                      result.averageReturnDegradationPercent,
                    ) >
                    0
                      ? "negative"
                      : "positive"
                  }
                />
              </>
            ) : null}
          </div>

          {/* WALK-FORWARD TABLE */}

          {isWalkForward &&
          Array.isArray(
            result.windows,
          ) &&
          result.windows.length >
            0 ? (
            <div
              style={{
                marginTop:
                  "26px",
              }}
            >
              <div
                style={{
                  marginBottom:
                    "12px",
                }}
              >
                <span className="eyebrow">
                  WINDOW BREAKDOWN
                </span>

                <h3
                  style={{
                    margin:
                      "5px 0 0",
                  }}
                >
                  Out-of-Sample Windows
                </h3>
              </div>

              <div
                style={{
                  overflowX:
                    "auto",

                  border:
                    "1px solid rgba(148, 163, 184, 0.1)",

                  borderRadius:
                    "12px",
                }}
              >
                <table
                  style={{
                    width:
                      "100%",

                    minWidth:
                      "900px",

                    borderCollapse:
                      "collapse",
                  }}
                >
                  <thead>
                    <tr>
                      {[
                        "Window",
                        "Train Return",
                        "Test Return",
                        "P/L",
                        "Trades",
                        "Win Rate",
                        "PF",
                        "Score",
                        "Confidence",
                        "Stop",
                        "Take",
                      ].map(
                        (
                          heading,
                        ) => (
                          <th
                            key={
                              heading
                            }
                            style={{
                              padding:
                                "11px",

                              textAlign:
                                "left",

                              color:
                                "#64748b",

                              fontSize:
                                "10px",

                              letterSpacing:
                                "0.07em",

                              textTransform:
                                "uppercase",

                              background:
                                "rgba(15, 23, 42, 0.5)",
                            }}
                          >
                            {
                              heading
                            }
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {result.windows.map(
                      (
                        window,
                      ) => (
                        <tr
                          key={
                            window.index
                          }
                          style={{
                            borderTop:
                              "1px solid rgba(148, 163, 184, 0.08)",
                          }}
                        >
                          <td
                            style={{
                              padding:
                                "11px",
                            }}
                          >
                            {Number(
                              window.index,
                            ) +
                              1}
                          </td>

                          <td>
                            {formatPercent(
                              window
                                .training
                                ?.totalReturnPercent,
                            )}
                          </td>

                          <td>
                            {formatPercent(
                              window
                                .testing
                                ?.totalReturnPercent,
                            )}
                          </td>

                          <td>
                            {formatMoney(
                              window
                                .testing
                                ?.totalProfit,
                            )}
                          </td>

                          <td>
                            {Number(
                              window
                                .testing
                                ?.closedTradeCount ||
                                0,
                            )}
                          </td>

                          <td>
                            {formatPercent(
                              window
                                .testing
                                ?.winRate,
                              false,
                            )}
                          </td>

                          <td>
                            {formatProfitFactor(
                              window
                                .testing
                                ?.profitFactor,
                            )}
                          </td>

                          <td>
                            {window
                              .selectedSettings
                              ?.minimumScore ??
                              "—"}
                          </td>

                          <td>
                            {window
                              .selectedSettings
                              ?.minimumConfidence ??
                              "—"}
                          </td>

                          <td>
                            {window
                              .selectedSettings
                              ?.stopLossPercent ??
                              "—"}
                            %
                          </td>

                          <td>
                            {window
                              .selectedSettings
                              ?.takeProfitPercent ??
                              "—"}
                            %
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {isWalkForward ? (
            <details
              style={{
                marginTop:
                  "20px",
              }}
            >
              <summary
                style={{
                  cursor:
                    "pointer",

                  color:
                    "#94a3b8",

                  fontSize:
                    "12px",
                }}
              >
                View raw walk-forward JSON
              </summary>

              <pre
                style={{
                  maxHeight:
                    "450px",

                  overflow:
                    "auto",

                  marginTop:
                    "12px",

                  padding:
                    "14px",

                  borderRadius:
                    "10px",

                  background:
                    "rgba(2, 6, 23, 0.65)",

                  color:
                    "#94a3b8",

                  fontSize:
                    "11px",

                  whiteSpace:
                    "pre-wrap",
                }}
              >
                {JSON.stringify(
                  result,
                  null,
                  2,
                )}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default BacktestPanel;