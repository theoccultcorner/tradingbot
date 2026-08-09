import {
  useState,
} from "react";

import {
  serverUrl,
} from "../config/server.js";

const DEFAULT_SYMBOLS = [
  "BTCUSD",
  "ETHUSD",
  "SOLUSD",
  "ADAUSD",
  "DOGEUSD",
  "LINKUSD",
  "AVAXUSD",
  "XRPUSD",
];

const TIMEFRAMES = [
  "5m",
  "15m",
  "30m",
  "1h",
  "4h",
  "1d",
];

function formatPrice(
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
        number < 1
          ? 6
          : 2,
    },
  );
}

function getScoreClass(
  score,
) {
  const number =
    Number(
      score,
    );

  if (
    number > 0
  ) {
    return "positive";
  }

  if (
    number < 0
  ) {
    return "negative";
  }

  return "neutral";
}

function MarketScannerPanel({
  activeSymbol,
  onSelectSymbol,
}) {
  const [
    timeframe,
    setTimeframe,
  ] =
    useState(
      "15m",
    );

  const [
    selectedSymbols,
    setSelectedSymbols,
  ] =
    useState(
      DEFAULT_SYMBOLS,
    );

  const [
    scan,
    setScan,
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

  function toggleSymbol(
    symbol,
  ) {
    setSelectedSymbols(
      (
        previous,
      ) =>
        previous.includes(
          symbol,
        )
          ? previous.filter(
              (
                item,
              ) =>
                item !==
                symbol,
            )
          : [
              ...previous,
              symbol,
            ],
    );
  }

  async function runScanner() {
    if (
      selectedSymbols.length ===
      0
    ) {
      setError(
        "Select at least one market.",
      );

      return;
    }

    setLoading(
      true,
    );

    setError(
      "",
    );

    try {
      const response =
        await fetch(
          serverUrl(
            "/api/scanner/run",
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
                symbols:
                  selectedSymbols,

                timeframe,

                limit:
                  300,
              }),
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
            "The scanner server returned invalid JSON.",
          );
        }
      }

      if (
        !response.ok
      ) {
        throw new Error(
          data.message ||
            `The market scan failed with status ${response.status}.`,
        );
      }

      const nextScan =
        data.scan ||
        data.data ||
        data;

      setScan(
        nextScan,
      );
    } catch (
      requestError
    ) {
      setError(
        requestError.message ||
          "The market scan failed.",
      );
    } finally {
      setLoading(
        false,
      );
    }
  }

  const opportunities =
    Array.isArray(
      scan?.opportunities,
    )
      ? scan.opportunities
      : [];

  const scanErrors =
    Array.isArray(
      scan?.errors,
    )
      ? scan.errors
      : [];

  return (
    <section className="panel-card scanner-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            CROSS-MARKET RANKING
          </span>

          <h2>
            Opportunity Scanner
          </h2>
        </div>

        <label className="scanner-timeframe">
          <span>
            Timeframe
          </span>

          <select
            value={
              timeframe
            }
            onChange={(
              event,
            ) =>
              setTimeframe(
                event.target.value,
              )
            }
          >
            {TIMEFRAMES.map(
              (
                item,
              ) => (
                <option
                  value={
                    item
                  }
                  key={
                    item
                  }
                >
                  {item}
                </option>
              ),
            )}
          </select>
        </label>
      </div>

      <div className="scanner-symbols">
        {DEFAULT_SYMBOLS.map(
          (
            symbol,
          ) => (
            <button
              type="button"
              key={
                symbol
              }
              className={
                selectedSymbols.includes(
                  symbol,
                )
                  ? "scanner-symbol active"
                  : "scanner-symbol"
              }
              onClick={() =>
                toggleSymbol(
                  symbol,
                )
              }
            >
              {symbol.replace(
                "USD",
                "",
              )}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        className="run-scanner-button"
        disabled={
          loading
        }
        onClick={
          runScanner
        }
      >
        {loading
          ? "Scanning markets…"
          : "Scan Markets"}
      </button>

      {error && (
        <p className="scanner-error">
          {error}
        </p>
      )}

      {scan && (
        <>
          <div className="scanner-heading">
            <h3>
              Ranked opportunities
            </h3>

            <span>
              {
                opportunities.length
              }{" "}
              markets ·{" "}
              {scan.timeframe ||
                timeframe}
            </span>
          </div>

          <div className="scanner-table">
            <div className="scanner-row scanner-header">
              <span>
                Rank
              </span>

              <span>
                Market
              </span>

              <span>
                Price
              </span>

              <span>
                Action
              </span>

              <span>
                Score
              </span>

              <span>
                Confidence
              </span>

              <span>
                Regime
              </span>

              <span />
            </div>

            {opportunities.map(
              (
                opportunity,
                index,
              ) => {
                const score =
                  Number(
                    opportunity.score,
                  );

                const confidence =
                  Number(
                    opportunity.confidence,
                  );

                return (
                  <div
                    className={
                      opportunity.symbol ===
                      activeSymbol
                        ? "scanner-row active-market"
                        : "scanner-row"
                    }
                    key={
                      opportunity.symbol ||
                      index
                    }
                  >
                    <strong>
                      {index +
                        1}
                    </strong>

                    <strong>
                      {
                        opportunity.symbol
                      }
                    </strong>

                    <span>
                      {formatPrice(
                        opportunity.price,
                      )}
                    </span>

                    <span
                      className={`signal-action ${
                        opportunity
                          .signal
                          ?.className ||
                        ""
                      }`}
                    >
                      {opportunity.action ||
                        "WAIT"}
                    </span>

                    <strong
                      className={
                        getScoreClass(
                          score,
                        )
                      }
                    >
                      {Number.isFinite(
                        score,
                      ) &&
                      score >
                        0
                        ? "+"
                        : ""}

                      {Number.isFinite(
                        score,
                      )
                        ? score
                        : "—"}
                    </strong>

                    <span>
                      {Number.isFinite(
                        confidence,
                      )
                        ? confidence
                        : "—"}
                      {Number.isFinite(
                        confidence,
                      )
                        ? "%"
                        : ""}
                    </span>

                    <span>
                      {opportunity.regime
                        ?.label ||
                        "—"}
                    </span>

                    <button
                      type="button"
                      className="scanner-open-button"
                      onClick={() =>
                        onSelectSymbol?.(
                          opportunity.symbol,
                        )
                      }
                    >
                      Open
                    </button>
                  </div>
                );
              },
            )}
          </div>

          {scanErrors.length >
            0 && (
            <p className="scanner-warning">
              Some markets could not
              be scanned:{" "}
              {scanErrors
                .map(
                  (
                    item,
                  ) =>
                    item.symbol ||
                    "Unknown",
                )
                .join(
                  ", ",
                )}
            </p>
          )}
        </>
      )}
    </section>
  );
}

export default MarketScannerPanel;