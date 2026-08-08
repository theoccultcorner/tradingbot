import {
  useMemo,
  useState,
} from "react";

import MiniMarketChart from "./MiniMarketChart";

import useFourMarketCharts from "../hooks/useFourMarketCharts";

const SYMBOLS = [
  "BTCUSD",
  "ETHUSD",
  "SOLUSD",
  "DOGEUSD",
];

const TIMEFRAMES = [
  "1m",
  "5m",
  "15m",
  "30m",
  "1h",
  "4h",
];

function FourMarketCharts() {
  const [
    timeframe,
    setTimeframe,
  ] =
    useState(
      "1m",
    );

  const symbols =
    useMemo(
      () =>
        SYMBOLS,
      [],
    );

  const {
    markets,
  } =
    useFourMarketCharts({
      symbols,
      timeframe,
    });

  return (
    <section className="four-market-panel">
      <div className="four-market-toolbar">
        <div>
          <p className="panel-eyebrow">
            MULTI-MARKET MONITOR
          </p>

          <h2>
            Live 24-Hour Markets
          </h2>

          <small>
            Visual monitoring only · does not change the bot&apos;s active market
          </small>
        </div>

        <div className="four-chart-timeframes">
          {TIMEFRAMES.map(
            (
              item,
            ) => (
              <button
                type="button"
                key={
                  item
                }
                className={
                  timeframe ===
                  item
                    ? "four-chart-timeframe active"
                    : "four-chart-timeframe"
                }
                onClick={() =>
                  setTimeframe(
                    item,
                  )
                }
              >
                {item}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="four-market-grid">
        {symbols.map(
          (
            symbol,
          ) => {
            const market =
              markets[
                symbol
              ] || {};

            return (
              <MiniMarketChart
                key={`${symbol}-${timeframe}`}
                symbol={
                  symbol
                }
                timeframe={
                  timeframe
                }
                candles={
                  market.candles ||
                  []
                }
                price={
                  market.price
                }
                connectionStatus={
                  market.connectionStatus ||
                  "Loading"
                }
                error={
                  market.error
                }
              />
            );
          },
        )}
      </div>
    </section>
  );
}

export default FourMarketCharts;