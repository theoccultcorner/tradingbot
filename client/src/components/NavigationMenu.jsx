import { useState } from "react";
import { serverUrl } from "../config/server.js";

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

function formatPercent(
  value,
  signed = true,
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return `${
    signed && number >= 0
      ? "+"
      : ""
  }${number.toFixed(2)}%`;
}

function formatProfitFactor(
  value,
) {
  if (value === null) {
    return "∞";
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number.toFixed(2)
    : "—";
}

function getClass(value) {
  const number = Number(value);

  if (number > 0) {
    return "positive";
  }

  if (number < 0) {
    return "negative";
  }

  return "neutral";
}

function ResultCard({
  label,
  value,
  className = "",
  small = null,
}) {
  return (
    <article>
      <span>
        {label}
      </span>

      <strong
        className={
          className
        }
      >
        {value}
      </strong>

      {small ? (
        <small>
          {small}
        </small>
      ) : null}
    </article>
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
    walkForwardStatus,
    setWalkForwardStatus,
  ] =
    useState(
      "",
    );

  const isWalkForward =
    mode ===
    "walk-forward";

  function updateSetting(
    name,
    value,
  ) {
    setSettings(
      (
        previous,
      ) => ({
        ...previous,

        [name]:
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

    setWalkForwardStatus(
      "",
    );
  }

  async function parseResponse(
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
          "The backtest server returned invalid JSON.",
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
          `The backtest failed with status ${response.status}.`,
      );
    }

    return (
      data.result ||
      data.data ||
      data
    );
  }

  function buildCommonRequest() {
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

  async function runBacktest() {
    setLoading(
      true,
    );

    setError(
      "",
    );

    setResult(
      null,
    );

    setWalkForwardStatus(
      "",
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
                ...buildCommonRequest(),

                limit:
                  Number(
                    settings.limit,
                  ),
              }),
          },
        );

      setResult(
        await parseResponse(
          response,
        ),
      );
    } catch (
      requestError
    ) {
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

  async function getRecentWalkForwardTests() {
    const response =
      await fetch(
        serverUrl(
          "/api/backtest/walk-forward/recent?limit=20",
        ),
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json",
          },

          cache:
            "no-store",
        },
      );

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
          "The saved walk-forward endpoint returned invalid JSON.",
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
          `Could not load saved walk-forward tests (${response.status}).`,
      );
    }

    return Array.isArray(
      data.tests,
    )
      ? data.tests
      : [];
  }

  function matchesNewWalkForwardResult(
    test,
    baselineIds,
    requestStartedAt,
  ) {
    if (
      !test ||
      baselineIds.has(
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
        ).toUpperCase() ||
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

    /*
     * Small clock tolerance so we do not
     * accidentally load an old saved run.
     */
    if (
      Number.isFinite(
        createdAt,
      ) &&
      createdAt <
        requestStartedAt -
          15000
    ) {
      return false;
    }

    return true;
  }

  async function waitForSavedWalkForwardResult({
    baselineIds,
    requestStartedAt,
    attempts = 30,
    delayMs = 4000,
  }) {
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
          delayMs,
        );
      }

      try {
        const tests =
          await getRecentWalkForwardTests();

        const match =
          tests.find(
            (
              test,
            ) =>
              matchesNewWalkForwardResult(
                test,
                baselineIds,
                requestStartedAt,
              ),
          );

        if (
          match
        ) {
          return match;
        }
      } catch (
        pollError
      ) {
        console.warn(
          "Walk-forward result check failed:",
          pollError.message ||
            pollError,
        );
      }

      setWalkForwardStatus(
        `The server is still processing the walk-forward test. Checking saved results… (${attempt + 1}/${attempts})`,
      );
    }

    return null;
  }

  async function runWalkForwardTest() {
    setLoading(
      true,
    );

    setError(
      "",
    );

    setResult(
      null,
    );

    setWalkForwardStatus(
      "Starting walk-forward test…",
    );

    const requestStartedAt =
      Date.now();

    let baselineIds =
      new Set();

    /*
     * Remember the tests that already existed
     * before this run begins.
     *
     * If the long POST connection later dies,
     * we can distinguish the newly saved result
     * from an older result.
     */
    try {
      const existingTests =
        await getRecentWalkForwardTests();

      baselineIds =
        new Set(
          existingTests
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
        baselineError.message ||
          baselineError,
      );
    }

    const requestBody = {
      ...buildCommonRequest(),

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
    };

    try {
      setWalkForwardStatus(
        "Running training and out-of-sample windows on the server…",
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
              JSON.stringify(
                requestBody,
              ),
          },
        );

      /*
       * A 4xx error means the server explicitly
       * rejected the settings.
       *
       * Do not poll because no valid job should
       * be running.
       */
      if (
        response.status >=
          400 &&
        response.status <
          500
      ) {
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
          data =
            {};
        }

        setError(
          data.message ||
            `The walk-forward request was rejected (${response.status}).`,
        );

        setWalkForwardStatus(
          "",
        );

        return;
      }

      /*
       * Ideal path:
       *
       * The HTTP request survives until the
       * server finishes and returns the result.
       */
      if (
        response.ok
      ) {
        const nextResult =
          await parseResponse(
            response,
          );

        setResult(
          nextResult,
        );

        setWalkForwardStatus(
          "Walk-forward test completed successfully.",
        );

        return;
      }

      /*
       * Render/proxy connections can terminate
       * while a long calculation continues.
       *
       * The backend may still save the result,
       * so fall through to the polling recovery.
       */
      throw new Error(
        `The HTTP connection ended with status ${response.status} while the walk-forward job was running.`,
      );
    } catch (
      requestError
    ) {
      setWalkForwardStatus(
        "The browser connection ended before the result arrived. The server may still be finishing the test, so saved results are being checked automatically…",
      );

      const savedResult =
        await waitForSavedWalkForwardResult({
          baselineIds,
          requestStartedAt,
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

        setWalkForwardStatus(
          "Walk-forward test completed. Loaded the saved server result.",
        );

        return;
      }

      setWalkForwardStatus(
        "",
      );

      setError(
        `${
          requestError.message ||
          "The walk-forward connection ended before a response was received."
        } No new saved walk-forward result appeared after repeated checks.`,
      );
    } finally {
      setLoading(
        false,
      );
    }
  }

  const commonFields = [
    [
      "startingCash",
      "Starting cash",
      1,
      1,
    ],

    [
      "buyAmount",
      "Buy amount",
      1,
      1,
    ],

    [
      "minimumScore",
      "Min score",
      0,
      1,
      100,
    ],

    [
      "minimumConfidence",
      "Min confidence",
      0,
      1,
      100,
    ],

    [
      "stopLossPercent",
      "Stop loss %",
      0.1,
      0.1,
    ],

    [
      "takeProfitPercent",
      "Take profit %",
      0.1,
      0.1,
    ],

    [
      "feePercent",
      "Fee %",
      0,
      0.01,
    ],

    [
      "minimumHistory",
      "Indicator history",
      20,
      10,
    ],
  ];

  return (
    <section className="panel-card backtest-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            SERVER-SIDE VALIDATION
          </span>

          <h2>
            Strategy 2.0 Backtester
          </h2>
        </div>

        <span className="backtest-market">
          {symbol.replace(
            "USD",
            "/USD",
          )}{" "}
          ·{" "}
          {timeframe}
        </span>
      </div>

      <div
        style={{
          display:
            "flex",

          gap:
            "10px",

          marginBottom:
            "20px",

          flexWrap:
            "wrap",
        }}
      >
        <button
          type="button"
          className={
            mode ===
            "standard"
              ? "run-backtest-button"
              : ""
          }
          disabled={
            loading
          }
          onClick={() =>
            changeMode(
              "standard",
            )
          }
        >
          Standard Backtest
        </button>

        <button
          type="button"
          className={
            mode ===
            "walk-forward"
              ? "run-backtest-button"
              : ""
          }
          disabled={
            loading
          }
          onClick={() =>
            changeMode(
              "walk-forward",
            )
          }
        >
          Walk-Forward Test
        </button>
      </div>

      {isWalkForward ? (
        <p className="backtest-description">
          Walk-forward testing optimizes settings on historical training windows and evaluates them only on the unseen test windows that follow.
        </p>
      ) : null}

      <div className="backtest-settings">
        {commonFields.map(
          ([
            name,
            label,
            min,
            step,
            max,
          ]) => (
            <label
              key={
                name
              }
            >
              <span>
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
                  settings[
                    name
                  ]
                }
                onChange={(
                  event,
                ) =>
                  updateSetting(
                    name,
                    event.target
                      .value,
                  )
                }
              />
            </label>
          ),
        )}

        {!isWalkForward ? (
          <label>
            <span>
              Candles
            </span>

            <input
              type="number"
              min="250"
              max="5000"
              step="50"
              value={
                settings.limit
              }
              onChange={(
                event,
              ) =>
                updateSetting(
                  "limit",
                  event.target
                    .value,
                )
              }
            />
          </label>
        ) : null}
      </div>

      {isWalkForward ? (
        <>
          <div
            className="panel-heading"
            style={{
              marginTop:
                "24px",
            }}
          >
            <div>
              <span className="eyebrow">
                OUT-OF-SAMPLE VALIDATION
              </span>

              <h3>
                Walk-Forward Windows
              </h3>
            </div>
          </div>

          <div className="backtest-settings">
            <label>
              <span>
                Historical candles
              </span>

              <input
                type="number"
                min="500"
                max="5000"
                step="100"
                value={
                  settings
                    .walkForwardLimit
                }
                onChange={(
                  event,
                ) =>
                  updateSetting(
                    "walkForwardLimit",
                    event.target
                      .value,
                  )
                }
              />
            </label>

            <label>
              <span>
                Training window
              </span>

              <input
                type="number"
                min="250"
                max="4000"
                step="50"
                value={
                  settings
                    .trainingWindow
                }
                onChange={(
                  event,
                ) =>
                  updateSetting(
                    "trainingWindow",
                    event.target
                      .value,
                  )
                }
              />
            </label>

            <label>
              <span>
                Testing window
              </span>

              <input
                type="number"
                min="10"
                max="2000"
                step="10"
                value={
                  settings
                    .testingWindow
                }
                onChange={(
                  event,
                ) =>
                  updateSetting(
                    "testingWindow",
                    event.target
                      .value,
                  )
                }
              />
            </label>

            <label>
              <span>
                Step size
              </span>

              <input
                type="number"
                min="1"
                max="2000"
                step="10"
                value={
                  settings
                    .stepSize
                }
                onChange={(
                  event,
                ) =>
                  updateSetting(
                    "stepSize",
                    event.target
                      .value,
                  )
                }
              />
            </label>
          </div>
        </>
      ) : null}

      <button
        type="button"
        className="run-backtest-button"
        disabled={
          loading
        }
        onClick={
          isWalkForward
            ? runWalkForwardTest
            : runBacktest
        }
      >
        {loading
          ? isWalkForward
            ? "Running walk-forward test…"
            : "Running server backtest…"
          : isWalkForward
            ? "Run and Save Walk-Forward Test"
            : "Run and Save Backtest"}
      </button>

      {walkForwardStatus &&
      isWalkForward ? (
        <p className="backtest-description">
          {
            walkForwardStatus
          }
        </p>
      ) : null}

      {error ? (
        <p className="backtest-error">
          {error}
        </p>
      ) : null}

      {result &&
      !isWalkForward ? (
        <>
          <div className="backtest-summary">
            <ResultCard
              label="Ending equity"
              value={
                formatMoney(
                  result
                    .endingEquity,
                )
              }
            />

            <ResultCard
              label="Total profit"
              value={
                formatMoney(
                  result
                    .totalProfit,
                )
              }
              className={
                getClass(
                  result
                    .totalProfit,
                )
              }
            />

            <ResultCard
              label="Total return"
              value={
                formatPercent(
                  result
                    .totalReturnPercent,
                )
              }
              className={
                getClass(
                  result
                    .totalReturnPercent,
                )
              }
            />

            <ResultCard
              label="Win rate"
              value={
                formatPercent(
                  result
                    .winRate,
                  false,
                )
              }
            />

            <ResultCard
              label="Profit factor"
              value={
                formatProfitFactor(
                  result
                    .profitFactor,
                )
              }
            />

            <ResultCard
              label="Max drawdown"
              value={
                formatPercent(
                  result
                    .maximumDrawdownPercent,
                  false,
                )
              }
              className="negative"
            />

            <ResultCard
              label="Closed trades"
              value={
                Number(
                  result
                    .closedTradeCount ||
                    0,
                )
              }
            />

            <ResultCard
              label="Fees"
              value={
                formatMoney(
                  result
                    .totalFees,
                )
              }
            />
          </div>

          <p className="backtest-description">
            {result.id ? (
              <>
                Saved as backtest{" "}

                <strong>
                  {
                    result.id
                  }
                </strong>

                .{" "}
              </>
            ) : null}

            Tested{" "}

            {Number(
              result.candleCount ||
                0,
            )}{" "}

            candles with Strategy Engine 2.0.
          </p>
        </>
      ) : null}

      {result &&
      isWalkForward ? (
        <>
          <div
            className="panel-heading"
            style={{
              marginTop:
                "28px",
            }}
          >
            <div>
              <span className="eyebrow">
                OUT-OF-SAMPLE RESULTS
              </span>

              <h3>
                Walk-Forward Performance
              </h3>
            </div>
          </div>

          <div className="backtest-summary">
            <ResultCard
              label="Ending equity"
              value={
                formatMoney(
                  result
                    .endingEquity,
                )
              }
              className={
                getClass(
                  result
                    .totalProfit,
                )
              }
            />

            <ResultCard
              label="OOS profit"
              value={
                formatMoney(
                  result
                    .totalProfit,
                )
              }
              className={
                getClass(
                  result
                    .totalProfit,
                )
              }
            />

            <ResultCard
              label="OOS return"
              value={
                formatPercent(
                  result
                    .totalReturnPercent,
                )
              }
              className={
                getClass(
                  result
                    .totalReturnPercent,
                )
              }
            />

            <ResultCard
              label="Profit factor"
              value={
                formatProfitFactor(
                  result
                    .profitFactor,
                )
              }
            />

            <ResultCard
              label="OOS expectancy"
              value={
                formatMoney(
                  result
                    .outOfSampleExpectancy,
                )
              }
              className={
                getClass(
                  result
                    .outOfSampleExpectancy,
                )
              }
            />

            <ResultCard
              label="Win rate"
              value={
                formatPercent(
                  result
                    .winRate,
                  false,
                )
              }
            />

            <ResultCard
              label="Max drawdown"
              value={
                formatPercent(
                  result
                    .maximumDrawdownPercent,
                  false,
                )
              }
              className="negative"
            />

            <ResultCard
              label="Closed trades"
              value={
                Number(
                  result
                    .closedTradeCount ||
                    0,
                )
              }
            />

            <ResultCard
              label="Windows"
              value={
                Number(
                  result
                    .windowCount ||
                    0,
                )
              }
            />

            <ResultCard
              label="Profitable windows"
              value={`${Number(
                result.profitableWindows ||
                  0,
              )} / ${Number(
                result.windowCount ||
                  0,
              )}`}
              className={
                getClass(
                  Number(
                    result
                      .profitableWindows,
                  ) -
                    Number(
                      result
                        .losingWindows,
                    ),
                )
              }
              small={
                formatPercent(
                  result
                    .profitableWindowRate,
                  false,
                )
              }
            />

            <ResultCard
              label="Avg train return"
              value={
                formatPercent(
                  result
                    .averageTrainingReturnPercent,
                )
              }
              className={
                getClass(
                  result
                    .averageTrainingReturnPercent,
                )
              }
            />

            <ResultCard
              label="Avg test return"
              value={
                formatPercent(
                  result
                    .averageTestingReturnPercent,
                )
              }
              className={
                getClass(
                  result
                    .averageTestingReturnPercent,
                )
              }
            />

            <ResultCard
              label="Train → test degradation"
              value={
                formatPercent(
                  result
                    .averageReturnDegradationPercent,
                  false,
                )
              }
              className={
                Number(
                  result
                    .averageReturnDegradationPercent,
                ) >
                0
                  ? "negative"
                  : "positive"
              }
            />

            <ResultCard
              label="Fees"
              value={
                formatMoney(
                  result
                    .totalFees,
                )
              }
            />
          </div>

          <div
            style={{
              marginTop:
                "28px",

              overflowX:
                "auto",
            }}
          >
            <h3>
              Test Windows
            </h3>

            <table
              style={{
                width:
                  "100%",

                borderCollapse:
                  "collapse",

                marginTop:
                  "12px",
              }}
            >
              <thead>
                <tr>
                  <th>
                    Window
                  </th>

                  <th>
                    Train Return
                  </th>

                  <th>
                    Test Return
                  </th>

                  <th>
                    Test P/L
                  </th>

                  <th>
                    Trades
                  </th>

                  <th>
                    Win Rate
                  </th>

                  <th>
                    PF
                  </th>

                  <th>
                    Score
                  </th>

                  <th>
                    Confidence
                  </th>

                  <th>
                    Stop
                  </th>

                  <th>
                    Take
                  </th>
                </tr>
              </thead>

              <tbody>
                {(result.windows ||
                  []).map(
                  (
                    window,
                  ) => (
                    <tr
                      key={
                        window.index
                      }
                    >
                      <td>
                        {Number(
                          window.index,
                        ) +
                          1}
                      </td>

                      <td
                        className={
                          getClass(
                            window
                              .training
                              ?.totalReturnPercent,
                          )
                        }
                      >
                        {formatPercent(
                          window
                            .training
                            ?.totalReturnPercent,
                        )}
                      </td>

                      <td
                        className={
                          getClass(
                            window
                              .testing
                              ?.totalReturnPercent,
                          )
                        }
                      >
                        {formatPercent(
                          window
                            .testing
                            ?.totalReturnPercent,
                        )}
                      </td>

                      <td
                        className={
                          getClass(
                            window
                              .testing
                              ?.totalProfit,
                          )
                        }
                      >
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

          <p className="backtest-description">
            {result.id ? (
              <>
                Saved as walk-forward test{" "}

                <strong>
                  {
                    result.id
                  }
                </strong>

                .{" "}
              </>
            ) : null}

            Tested{" "}

            {Number(
              result.candleCount ||
                0,
            )}{" "}

            historical candles across{" "}

            {Number(
              result.windowCount ||
                0,
            )}{" "}

            rolling out-of-sample windows.
          </p>

          <details
            style={{
              marginTop:
                "20px",
            }}
          >
            <summary>
              Raw Walk-Forward JSON
            </summary>

            <pre
              style={{
                marginTop:
                  "12px",

                whiteSpace:
                  "pre-wrap",

                overflowX:
                  "auto",

                fontSize:
                  "12px",
              }}
            >
              {JSON.stringify(
                result,
                null,
                2,
              )}
            </pre>
          </details>
        </>
      ) : null}
    </section>
  );
}

export default BacktestPanel;