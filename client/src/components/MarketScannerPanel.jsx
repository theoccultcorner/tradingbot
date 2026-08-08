import {
  useState,
} from "react";

const SERVER_HTTP_URL =
  import.meta.env
    .VITE_SERVER_HTTP_URL ||
  "http://localhost:5000";

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
      style: "currency",
      currency: "USD",
      maximumFractionDigits:
        number < 1 ? 6 : 2,
    },
  );
}

function getScoreClass(
  score,
) {
  if (
    Number(score) > 0
  ) {
    return "positive";
  }

  if (
    Number(score) < 0
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
  ] = useState("15m");

  const [
    selectedSymbols,
    setSelectedSymbols,
  ] = useState(
    DEFAULT_SYMBOLS,
  );

  const [
    scan,
    setScan,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  function toggleSymbol(
    symbol,
  ) {
    setSelectedSymbols(
      (previous) =>
        previous.includes(
          symbol,
        )
          ? previous.filter(
              (item) =>
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

    setLoading(true);
    setError("");

    try {
      const response =
        await fetch(
          `${SERVER_HTTP_URL}/api/scanner/run`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                symbols:
                  selectedSymbols,

                timeframe,

                limit: 300,
              }),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "The market scan failed.",
        );
      }

      setScan(data.scan);
    } catch (
      requestError
    ) {
      setError(
        requestError.message,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel scanner-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">
            CROSS-MARKET RANKING
          </p>

          <h2>
            Opportunity Scanner
          </h2>
        </div>

        <label className="scanner-timeframe">
          <span>Timeframe</span>

          <select
            value={timeframe}
            onChange={(event) =>
              setTimeframe(
                event.target.value,
              )
            }
          >
            {TIMEFRAMES.map(
              (item) => (
                <option
                  value={item}
                  key={item}
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
          (symbol) => (
            <button
              type="button"
              key={symbol}
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
        disabled={loading}
        onClick={runScanner}
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
                scan.opportunities
                  .length
              }{" "}
              markets ·{" "}
              {scan.timeframe}
            </span>
          </div>

          <div className="scanner-table">
            <div className="scanner-row scanner-header">
              <span>Rank</span>
              <span>Market</span>
              <span>Price</span>
              <span>Action</span>
              <span>Score</span>
              <span>Confidence</span>
              <span>Regime</span>
              <span />
            </div>

            {scan.opportunities.map(
              (
                opportunity,
                index,
              ) => (
                <div
                  className={
                    opportunity.symbol ===
                    activeSymbol
                      ? "scanner-row active-market"
                      : "scanner-row"
                  }
                  key={
                    opportunity.symbol
                  }
                >
                  <strong>
                    {index + 1}
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
                    className={`signal-action ${opportunity.signal?.className}`}
                  >
                    {
                      opportunity.action
                    }
                  </span>

                  <strong
                    className={getScoreClass(
                      opportunity.score,
                    )}
                  >
                    {opportunity.score >
                    0
                      ? "+"
                      : ""}
                    {
                      opportunity.score
                    }
                  </strong>

                  <span>
                    {
                      opportunity.confidence
                    }
                    %
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
              ),
            )}
          </div>

          {scan.errors.length >
            0 && (
            <p className="scanner-warning">
              Some markets could not
              be scanned:{" "}
              {scan.errors
                .map(
                  (item) =>
                    item.symbol,
                )
                .join(", ")}
            </p>
          )}
        </>
      )}
    </section>
  );
}

export default MarketScannerPanel;
