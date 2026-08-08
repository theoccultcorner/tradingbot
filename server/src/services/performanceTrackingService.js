import {
  getPaperPortfolio,
} from "./paperPortfolioService.js";

const DEFAULT_SNAPSHOT_INTERVAL_MS =
  60 * 1000;

const DEFAULT_MAX_EQUITY_POINTS =
  2000;

function timestampValue(value) {
  if (!value) {
    return null;
  }

  if (
    typeof value.toMillis ===
    "function"
  ) {
    return value.toMillis();
  }

  const numeric = Number(value);

  return Number.isFinite(numeric)
    ? numeric
    : null;
}

function isToday(timestamp) {
  const date =
    new Date(timestamp);

  const now =
    new Date();

  return (
    date.getFullYear() ===
      now.getFullYear() &&
    date.getMonth() ===
      now.getMonth() &&
    date.getDate() ===
      now.getDate()
  );
}

function calculateDrawdown(points) {
  if (
    !Array.isArray(points) ||
    points.length === 0
  ) {
    return {
      amount: 0,
      percent: 0,
    };
  }

  let peak =
    Number(points[0].equity) ||
    0;

  let maximumAmount = 0;
  let maximumPercent = 0;

  for (const point of points) {
    const equity =
      Number(point.equity);

    if (
      !Number.isFinite(equity)
    ) {
      continue;
    }

    if (equity > peak) {
      peak = equity;
    }

    if (peak <= 0) {
      continue;
    }

    const amount =
      peak - equity;

    const percent =
      (amount / peak) * 100;

    if (
      amount >
      maximumAmount
    ) {
      maximumAmount =
        amount;

      maximumPercent =
        percent;
    }
  }

  return {
    amount: maximumAmount,
    percent: maximumPercent,
  };
}

function calculateProfitFactor(
  trades,
) {
  const grossProfit =
    trades
      .filter(
        (trade) =>
          Number(
            trade.realizedProfit,
          ) > 0,
      )
      .reduce(
        (total, trade) =>
          total +
          Number(
            trade.realizedProfit,
          ),
        0,
      );

  const grossLoss =
    Math.abs(
      trades
        .filter(
          (trade) =>
            Number(
              trade.realizedProfit,
            ) < 0,
        )
        .reduce(
          (total, trade) =>
            total +
            Number(
              trade.realizedProfit,
            ),
          0,
        ),
    );

  if (grossLoss === 0) {
    return grossProfit > 0
      ? null
      : 0;
  }

  return (
    grossProfit /
    grossLoss
  );
}

function groupTradePerformance(
  trades,
  key,
) {
  const groups = {};

  for (const trade of trades) {
    const groupName =
      trade[key] ||
      "Unknown";

    if (!groups[groupName]) {
      groups[groupName] = {
        name: groupName,
        trades: 0,
        wins: 0,
        losses: 0,
        realizedProfit: 0,
        fees: 0,
      };
    }

    const group =
      groups[groupName];

    group.trades += 1;

    const profit =
      Number(
        trade.realizedProfit,
      ) || 0;

    if (profit > 0) {
      group.wins += 1;
    } else if (
      profit < 0
    ) {
      group.losses += 1;
    }

    group.realizedProfit +=
      profit;

    group.fees +=
      Number(
        trade.fee,
      ) || 0;
  }

  return Object.values(
    groups,
  )
    .map((group) => ({
      ...group,

      winRate:
        group.trades > 0
          ? (
              group.wins /
              group.trades
            ) * 100
          : 0,
    }))
    .sort(
      (left, right) =>
        right.realizedProfit -
        left.realizedProfit,
    );
}

function escapeCsv(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const text =
    String(value);

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return `"${text.replace(
      /"/g,
      '""',
    )}"`;
  }

  return text;
}

export class PerformanceTrackingService {
  constructor({
    snapshotIntervalMs =
      DEFAULT_SNAPSHOT_INTERVAL_MS,

    maxEquityPoints =
      DEFAULT_MAX_EQUITY_POINTS,
  } = {}) {
    this.snapshotIntervalMs =
      Math.max(
        Number(
          snapshotIntervalMs,
        ) ||
          DEFAULT_SNAPSHOT_INTERVAL_MS,
        10000,
      );

    this.maxEquityPoints =
      Math.min(
        Math.max(
          Number(
            maxEquityPoints,
          ) ||
            DEFAULT_MAX_EQUITY_POINTS,
          100,
        ),
        10000,
      );

    this.lastSnapshotTime = 0;

    this.latestPrices = {};

    this.snapshotLock = false;

    /*
     * Equity history is temporary.
     *
     * It lives only in server memory.
     * Nothing here is written to Firestore.
     */
    this.equityHistory = [];
  }

  async handleMarketUpdate(
    state,
  ) {
    if (
      !state?.symbol ||
      !Number.isFinite(
        Number(state.price),
      )
    ) {
      return;
    }

    this.latestPrices[
      state.symbol
    ] = Number(
      state.price,
    );

    if (
      Date.now() -
        this.lastSnapshotTime <
      this.snapshotIntervalMs
    ) {
      return;
    }

    await this.createSnapshot({
      symbol:
        state.symbol,

      timeframe:
        state.timeframe,

      marketPrice:
        state.price,
    });
  }

  async createSnapshot({
    symbol = null,
    timeframe = null,
    marketPrice = null,
  } = {}) {
    if (this.snapshotLock) {
      return null;
    }

    this.snapshotLock = true;

    try {
      /*
       * Portfolio and executed trades still come
       * from Firestore.
       *
       * Equity HISTORY does not.
       */
      const portfolio =
        await getPaperPortfolio({
          tradeLimit: 500,
        });

      let marketValue = 0;

      let unrealizedProfit = 0;

      for (
        const [
          positionSymbol,
          position,
        ] of Object.entries(
          portfolio.positions ||
            {},
        )
      ) {
        const quantity =
          Number(
            position.quantity,
          ) || 0;

        const averageEntryPrice =
          Number(
            position.averageEntryPrice,
          ) || 0;

        const currentPrice =
          this.latestPrices[
            positionSymbol
          ] ||
          (
            positionSymbol ===
              symbol &&
            Number.isFinite(
              Number(
                marketPrice,
              ),
            )
              ? Number(
                  marketPrice,
                )
              : averageEntryPrice
          );

        const positionValue =
          quantity *
          currentPrice;

        const costBasis =
          quantity *
          averageEntryPrice;

        marketValue +=
          positionValue;

        unrealizedProfit +=
          positionValue -
          costBasis;
      }

      const cash =
        Number(
          portfolio.cash,
        ) || 0;

      const startingCash =
        Number(
          portfolio.startingCash,
        ) || 10000;

      const equity =
        cash +
        marketValue;

      const totalProfit =
        equity -
        startingCash;

      const totalReturnPercent =
        startingCash > 0
          ? (
              totalProfit /
              startingCash
            ) * 100
          : 0;

      const snapshot = {
        id:
          crypto.randomUUID(),

        cash,

        marketValue,

        equity,

        totalProfit,

        totalReturnPercent,

        realizedProfit:
          Number(
            portfolio.realizedProfit,
          ) || 0,

        unrealizedProfit,

        openPositionCount:
          Object.keys(
            portfolio.positions ||
              {},
          ).length,

        symbol,

        timeframe,

        timestamp:
          Date.now(),
      };

      /*
       * Store only in server memory.
       */
      this.equityHistory.push(
        snapshot,
      );

      /*
       * Prevent memory from growing forever.
       */
      if (
        this.equityHistory.length >
        this.maxEquityPoints
      ) {
        this.equityHistory.splice(
          0,
          this.equityHistory.length -
            this.maxEquityPoints,
        );
      }

      this.lastSnapshotTime =
        snapshot.timestamp;

      return {
        ...snapshot,
      };
    } finally {
      this.snapshotLock =
        false;
    }
  }

  async getEquityHistory(
    limit = 1000,
  ) {
    const safeLimit =
      Math.min(
        Math.max(
          Number(limit) ||
            500,
          1,
        ),
        this.maxEquityPoints,
      );

    /*
     * Read directly from memory.
     *
     * Zero Firestore reads.
     */
    return this.equityHistory
      .slice(-safeLimit)
      .map(
        (point) => ({
          ...point,
        }),
      );
  }

  async getTrades(
    limit = 500,
  ) {
    /*
     * Executed trades are important and remain
     * persistent in Firestore.
     */
    const portfolio =
      await getPaperPortfolio({
        tradeLimit:
          Math.min(
            Math.max(
              Number(limit) ||
                500,
              1,
            ),
            2000,
          ),
      });

    return Array.isArray(
      portfolio.trades,
    )
      ? portfolio.trades
      : [];
  }

  async getSummary() {
    const [
      portfolio,
      trades,
      equityHistory,
    ] =
      await Promise.all([
        getPaperPortfolio({
          tradeLimit: 500,
        }),

        this.getTrades(
          2000,
        ),

        this.getEquityHistory(
          2000,
        ),
      ]);

    const sellTrades =
      trades.filter(
        (trade) =>
          trade.side ===
            "SELL" &&
          Number.isFinite(
            Number(
              trade.realizedProfit,
            ),
          ),
      );

    const wins =
      sellTrades.filter(
        (trade) =>
          Number(
            trade.realizedProfit,
          ) > 0,
      );

    const losses =
      sellTrades.filter(
        (trade) =>
          Number(
            trade.realizedProfit,
          ) < 0,
      );

    const todayTrades =
      trades.filter(
        (trade) =>
          isToday(
            trade.timestamp,
          ),
      );

    const realizedProfitToday =
      todayTrades.reduce(
        (total, trade) =>
          total +
          Number(
            trade.realizedProfit ||
              0,
          ),
        0,
      );

    const fees =
      trades.reduce(
        (total, trade) =>
          total +
          Number(
            trade.fee ||
              0,
          ),
        0,
      );

    const drawdown =
      calculateDrawdown(
        equityHistory,
      );

    const latestEquity =
      equityHistory[
        equityHistory.length -
          1
      ] || null;

    return {
      portfolio: {
        startingCash:
          portfolio.startingCash,

        cash:
          portfolio.cash,

        realizedProfit:
          portfolio.realizedProfit,

        openPositionCount:
          Object.keys(
            portfolio.positions ||
              {},
          ).length,
      },

      latestEquity,

      totalOrders:
        trades.length,

      closedTrades:
        sellTrades.length,

      wins:
        wins.length,

      losses:
        losses.length,

      winRate:
        sellTrades.length > 0
          ? (
              wins.length /
              sellTrades.length
            ) * 100
          : 0,

      profitFactor:
        calculateProfitFactor(
          sellTrades,
        ),

      realizedProfitToday,

      totalFees:
        fees,

      maximumDrawdownAmount:
        drawdown.amount,

      maximumDrawdownPercent:
        drawdown.percent,

      bySymbol:
        groupTradePerformance(
          sellTrades,
          "symbol",
        ),

      byTimeframe:
        groupTradePerformance(
          sellTrades,
          "timeframe",
        ),

      /*
       * Useful confirmation that the new
       * storage system is active.
       */
      equityStorage:
        "memory",

      equityPointCount:
        equityHistory.length,

      generatedAt:
        Date.now(),
    };
  }

  async exportTradesCsv() {
    const trades =
      await this.getTrades(
        2000,
      );

    const headers = [
      "id",
      "timestamp",
      "date",
      "symbol",
      "timeframe",
      "side",
      "quantity",
      "price",
      "grossValue",
      "fee",
      "realizedProfit",
    ];

    const rows =
      trades.map(
        (trade) => {
          const timestamp =
            timestampValue(
              trade.timestamp,
            ) ||
            timestampValue(
              trade.createdAt,
            );

          return [
            trade.id,

            timestamp,

            timestamp
              ? new Date(
                  timestamp,
                ).toISOString()
              : "",

            trade.symbol,

            trade.timeframe ||
              "",

            trade.side,

            trade.quantity,

            trade.price,

            trade.grossValue,

            trade.fee,

            trade.realizedProfit,
          ]
            .map(
              escapeCsv,
            )
            .join(",");
        },
      );

    return [
      headers.join(","),
      ...rows,
    ].join("\n");
  }

  clearEquityHistory() {
    this.equityHistory = [];

    this.lastSnapshotTime = 0;

    return {
      success: true,

      clearedAt:
        Date.now(),
    };
  }
}