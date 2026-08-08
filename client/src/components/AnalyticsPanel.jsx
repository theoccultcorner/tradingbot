import { useEffect, useRef } from "react";
import {
  ColorType,
  LineSeries,
  createChart,
} from "lightweight-charts";

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

function formatPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return `${number.toFixed(2)}%`;
}

function formatNumber(value) {
  if (value === Infinity) {
    return "∞";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toFixed(2);
}

function getProfitClass(value) {
  const number = Number(value);

  if (number > 0) {
    return "positive";
  }

  if (number < 0) {
    return "negative";
  }

  return "neutral";
}

function AnalyticsCard({
  title,
  value,
  className = "",
  subtitle,
}) {
  return (
    <article className="analytics-card">
      <span>{title}</span>

      <strong className={className}>
        {value}
      </strong>

      {subtitle && <small>{subtitle}</small>}
    </article>
  );
}

function EquityCurve({ history = [] }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const chart = createChart(
      containerRef.current,
      {
        width: containerRef.current.clientWidth,
        height: 280,

        layout: {
          background: {
            type: ColorType.Solid,
            color: "#111419",
          },
          textColor: "#848e9c",
        },

        grid: {
          vertLines: {
            color: "#242830",
          },
          horzLines: {
            color: "#242830",
          },
        },

        rightPriceScale: {
          borderColor: "#2b3139",
        },

        timeScale: {
          borderColor: "#2b3139",
          timeVisible: true,
          secondsVisible: false,
        },
      },
    );

    const series = chart.addSeries(
      LineSeries,
      {
        color: "#f0b90b",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      },
    );

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry) {
          return;
        }

        chart.applyOptions({
          width: entry.contentRect.width,
        });
      },
    );

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) {
      return;
    }

    const data = history
      .map((point) => ({
        time: Math.floor(
          Number(point.timestamp) / 1000,
        ),
        value: Number(point.equity),
      }))
      .filter(
        (point) =>
          Number.isFinite(point.time) &&
          Number.isFinite(point.value),
      );

    /*
     * Lightweight Charts requires unique ascending times.
     */
    const uniqueData = [];

    for (const point of data) {
      const previous =
        uniqueData[uniqueData.length - 1];

      if (previous?.time === point.time) {
        uniqueData[uniqueData.length - 1] =
          point;
      } else {
        uniqueData.push(point);
      }
    }

    seriesRef.current.setData(uniqueData);

    if (uniqueData.length > 0) {
      chartRef.current
        ?.timeScale()
        .fitContent();
    }
  }, [history]);

  return (
    <div
      ref={containerRef}
      className="equity-curve"
    />
  );
}

function AnalyticsPanel({
  portfolio,
  analyticsState,
}) {
  const {
    analytics,
    resetEquityHistory,
  } = analyticsState;

  if (!analytics) {
    return null;
  }

  return (
    <section className="panel analytics-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">
            PERFORMANCE MEASUREMENT
          </p>

          <h2>Trading Analytics</h2>
        </div>

        <button
          type="button"
          className="reset-equity-button"
          onClick={() => {
            const approved = window.confirm(
              "Reset the equity curve history?",
            );

            if (approved) {
              resetEquityHistory();
            }
          }}
        >
          Reset Curve
        </button>
      </div>

      <div className="analytics-primary-grid">
        <AnalyticsCard
          title="Total equity"
          value={formatMoney(
            portfolio.totalEquity,
          )}
        />

        <AnalyticsCard
          title="Total profit"
          value={formatMoney(
            portfolio.totalProfit,
          )}
          className={getProfitClass(
            portfolio.totalProfit,
          )}
        />

        <AnalyticsCard
          title="Total return"
          value={formatPercent(
            portfolio.totalReturnPercent,
          )}
          className={getProfitClass(
            portfolio.totalReturnPercent,
          )}
        />

        <AnalyticsCard
          title="Win rate"
          value={formatPercent(
            analytics.winRate,
          )}
          subtitle={`${analytics.winningTrades} wins · ${analytics.losingTrades} losses`}
        />

        <AnalyticsCard
          title="Profit factor"
          value={formatNumber(
            analytics.profitFactor,
          )}
        />

        <AnalyticsCard
          title="Trade expectancy"
          value={formatMoney(
            analytics.expectancy,
          )}
          className={getProfitClass(
            analytics.expectancy,
          )}
        />

        <AnalyticsCard
          title="Maximum drawdown"
          value={formatPercent(
            analytics.maximumDrawdownPercent,
          )}
          className="negative"
          subtitle={formatMoney(
            analytics.maximumDrawdownAmount,
          )}
        />

        <AnalyticsCard
          title="Current drawdown"
          value={formatPercent(
            analytics.currentDrawdownPercent,
          )}
          className={
            analytics.currentDrawdownAmount > 0
              ? "negative"
              : "neutral"
          }
          subtitle={formatMoney(
            analytics.currentDrawdownAmount,
          )}
        />
      </div>

      <div className="analytics-section-heading">
        <h3>Equity curve</h3>

        <span>
          {analytics.equityHistory.length} points
        </span>
      </div>

      <div className="equity-chart-wrapper">
        <EquityCurve
          history={analytics.equityHistory}
        />
      </div>

      <div className="analytics-section-heading">
        <h3>Detailed statistics</h3>
      </div>

      <div className="analytics-detail-grid">
        <AnalyticsCard
          title="Closed trades"
          value={analytics.closedTrades}
        />

        <AnalyticsCard
          title="Total orders"
          value={analytics.totalOrders}
        />

        <AnalyticsCard
          title="Gross profit"
          value={formatMoney(
            analytics.grossProfit,
          )}
          className="positive"
        />

        <AnalyticsCard
          title="Gross loss"
          value={formatMoney(
            -analytics.grossLoss,
          )}
          className="negative"
        />

        <AnalyticsCard
          title="Average winner"
          value={formatMoney(
            analytics.averageWinner,
          )}
          className="positive"
        />

        <AnalyticsCard
          title="Average loser"
          value={formatMoney(
            analytics.averageLoser,
          )}
          className="negative"
        />

        <AnalyticsCard
          title="Largest winner"
          value={formatMoney(
            analytics.largestWinner,
          )}
          className="positive"
        />

        <AnalyticsCard
          title="Largest loser"
          value={formatMoney(
            analytics.largestLoser,
          )}
          className="negative"
        />

        <AnalyticsCard
          title="Fees paid"
          value={formatMoney(
            analytics.totalFees,
          )}
        />

        <AnalyticsCard
          title="Longest win streak"
          value={analytics.longestWinStreak}
        />

        <AnalyticsCard
          title="Longest loss streak"
          value={analytics.longestLossStreak}
        />

        <AnalyticsCard
          title="Flat trades"
          value={analytics.flatTrades}
        />
      </div>
    </section>
  );
}

export default AnalyticsPanel;