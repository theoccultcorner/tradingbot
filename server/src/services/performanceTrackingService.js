import {
  getPaperPortfolio,
} from "./paperPortfolioService.js";

const DEFAULT_SNAPSHOT_INTERVAL_MS =
  60 * 1000;

const DEFAULT_MAX_EQUITY_POINTS =
  2000;

const DEFAULT_STARTING_CASH =
  300;

/*
 * Estimated execution slippage.
 *
 * 5 basis points = 0.05%
 *
 * You can override this on Render with:
 *
 * PAPER_SLIPPAGE_BPS=5
 *
 * Examples:
 *
 * 1 bp  = 0.01%
 * 5 bps = 0.05%
 * 10 bps = 0.10%
 *
 * We intentionally keep this separate
 * from exchange fees.
 */
const DEFAULT_SLIPPAGE_BPS =
  5;

function timestampValue(
  value,
) {
  if (!value) {
    return null;
  }

  if (
    typeof value.toMillis ===
    "function"
  ) {
    return value.toMillis();
  }

  const numeric =
    Number(
      value,
    );

  return Number.isFinite(
    numeric,
  )
    ? numeric
    : null;
}

function numberOrZero(
  value,
) {
  const number =
    Number(
      value,
    );

  return Number.isFinite(
    number,
  )
    ? number
    : 0;
}

function positiveNumberOrFallback(
  value,
  fallback,
) {
  const number =
    Number(
      value,
    );

  return Number.isFinite(
    number,
  ) &&
    number >
      0
    ? number
    : fallback;
}

function normalizeSlippageBps(
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
    return DEFAULT_SLIPPAGE_BPS;
  }

  /*
   * Keep accidental configuration values
   * within a reasonable safety range.
   *
   * 1000 bps = 10%.
   */
  return Math.min(
    Math.max(
      number,
      0,
    ),
    1000,
  );
}

function isToday(
  timestamp,
) {
  const date =
    new Date(
      timestamp,
    );

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

/*
 * Estimate slippage for one execution.
 *
 * Example:
 *
 * $100 order
 * 5 basis points
 *
 * $100 × 0.0005 = $0.05
 */
function calculateTradeSlippage(
  trade,
  slippageBps,
) {
  const grossValue =
    Math.abs(
      numberOrZero(
        trade?.grossValue,
      ),
    );

  return (
    grossValue *
    (
      slippageBps /
      10000
    )
  );
}

/*
 * Calculate execution costs across all
 * orders.
 *
 * IMPORTANT:
 *
 * realizedProfit from the paper portfolio
 * already includes exchange fees through
 * the execution accounting.
 *
 * Therefore we DO NOT subtract fees again
 * when calculating net profit.
 *
 * Fees are reported separately for
 * transparency.
 */
function calculateTradingCosts(
  trades,
  slippageBps,
) {
  let totalFees =
    0;

  let estimatedSlippage =
    0;

  for (
    const trade of trades
  ) {
    totalFees +=
      Math.abs(
        numberOrZero(
          trade.fee,
        ),
      );

    estimatedSlippage +=
      calculateTradeSlippage(
        trade,
        slippageBps,
      );
  }

  return {
    totalFees,

    estimatedSlippage,

    totalTradingCosts:
      totalFees +
      estimatedSlippage,

    averageFeePerOrder:
      trades.length >
      0
        ? totalFees /
          trades.length
        : 0,

    averageSlippagePerOrder:
      trades.length >
      0
        ? estimatedSlippage /
          trades.length
        : 0,

    averageTradingCostPerOrder:
      trades.length >
      0
        ? (
            totalFees +
            estimatedSlippage
          ) /
          trades.length
        : 0,
  };
}

function calculateDrawdown(
  points,
) {
  if (
    !Array.isArray(
      points,
    ) ||
    points.length ===
      0
  ) {
    return {
      amount:
        0,

      percent:
        0,
    };
  }

  let peak =
    Number(
      points[0]
        .equity,
    ) ||
    0;

  let maximumAmount =
    0;

  let maximumPercent =
    0;

  for (
    const point of points
  ) {
    const equity =
      Number(
        point.equity,
      );

    if (
      !Number.isFinite(
        equity,
      )
    ) {
      continue;
    }

    if (
      equity >
      peak
    ) {
      peak =
        equity;
    }

    if (
      peak <=
      0
    ) {
      continue;
    }

    const amount =
      peak -
      equity;

    const percent =
      (
        amount /
        peak
      ) *
      100;

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
    amount:
      maximumAmount,

    percent:
      maximumPercent,
  };
}

function calculateProfitFactor(
  trades,
) {
  const grossProfit =
    trades
      .filter(
        (
          trade,
        ) =>
          Number(
            trade.realizedProfit,
          ) >
          0,
      )
      .reduce(
        (
          total,
          trade,
        ) =>
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
          (
            trade,
          ) =>
            Number(
              trade.realizedProfit,
            ) <
            0,
        )
        .reduce(
          (
            total,
            trade,
          ) =>
            total +
            Number(
              trade.realizedProfit,
            ),
          0,
        ),
    );

  if (
    grossLoss ===
    0
  ) {
    return grossProfit >
      0
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
  const groups =
    {};

  for (
    const trade of trades
  ) {
    const groupName =
      trade[key] ||
      "Unknown";

    if (
      !groups[
        groupName
      ]
    ) {
      groups[
        groupName
      ] = {
        name:
          groupName,

        trades:
          0,

        wins:
          0,

        losses:
          0,

        realizedProfit:
          0,

        fees:
          0,
      };
    }

    const group =
      groups[
        groupName
      ];

    group.trades +=
      1;

    const profit =
      Number(
        trade.realizedProfit,
      ) ||
      0;

    if (
      profit >
      0
    ) {
      group.wins +=
        1;
    } else if (
      profit <
      0
    ) {
      group.losses +=
        1;
    }

    group.realizedProfit +=
      profit;

    group.fees +=
      Number(
        trade.fee,
      ) ||
      0;
  }

  return Object.values(
    groups,
  )
    .map(
      (
        group,
      ) => ({
        ...group,

        winRate:
          group.trades >
          0
            ? (
                group.wins /
                group.trades
              ) *
              100
            : 0,
      }),
    )
    .sort(
      (
        left,
        right,
      ) =>
        right.realizedProfit -
        left.realizedProfit,
    );
}

function escapeCsv(
  value,
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return "";
  }

  const text =
    String(
      value,
    );

  if (
    text.includes(
      ",",
    ) ||
    text.includes(
      '"',
    ) ||
    text.includes(
      "\n",
    )
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

    slippageBps =
      process.env
        .PAPER_SLIPPAGE_BPS ??
      DEFAULT_SLIPPAGE_BPS,
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

    /*
     * Estimated slippage used for
     * profitability calculations.
     */
    this.slippageBps =
      normalizeSlippageBps(
        slippageBps,
      );

    this.lastSnapshotTime =
      0;

    this.latestPrices =
      {};

    this.snapshotLock =
      false;

    /*
     * Equity history lives in server memory.
     *
     * Portfolio and trade records remain
     * persistent in SQLite.
     */
    this.equityHistory =
      [];
  }

  async handleMarketUpdate(
    state,
  ) {
    if (
      !state?.symbol ||
      !Number.isFinite(
        Number(
          state.price,
        ),
      )
    ) {
      return;
    }

    this.latestPrices[
      state.symbol
    ] =
      Number(
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
    symbol =
      null,

    timeframe =
      null,

    marketPrice =
      null,
  } = {}) {
    if (
      this.snapshotLock
    ) {
      return null;
    }

    this.snapshotLock =
      true;

    try {
      const portfolio =
        await getPaperPortfolio({
          tradeLimit:
            500,
        });

      let marketValue =
        0;

      let unrealizedProfit =
        0;

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
          ) ||
          0;

        const averageEntryPrice =
          Number(
            position
              .averageEntryPrice,
          ) ||
          0;

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
        ) ||
        0;

      /*
       * FIX:
       *
       * The paper account now starts at
       * $300, not $10,000.
       */
      const startingCash =
        positiveNumberOrFallback(
          portfolio
            .startingCash,
          DEFAULT_STARTING_CASH,
        );

      const equity =
        cash +
        marketValue;

      /*
       * This already reflects recorded
       * exchange fees because fees affect
       * cash and position cost basis.
       */
      const totalProfit =
        equity -
        startingCash;

      const totalReturnPercent =
        startingCash >
        0
          ? (
              totalProfit /
              startingCash
            ) *
            100
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
            portfolio
              .realizedProfit,
          ) ||
          0,

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

      this.equityHistory.push(
        snapshot,
      );

      if (
        this.equityHistory
          .length >
        this.maxEquityPoints
      ) {
        this.equityHistory.splice(
          0,
          this.equityHistory
            .length -
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
          Number(
            limit,
          ) ||
            500,
          1,
        ),
        this.maxEquityPoints,
      );

    return this
      .equityHistory
      .slice(
        -safeLimit,
      )
      .map(
        (
          point,
        ) => ({
          ...point,
        }),
      );
  }

  async getTrades(
    limit = 500,
  ) {
    const portfolio =
      await getPaperPortfolio({
        tradeLimit:
          Math.min(
            Math.max(
              Number(
                limit,
              ) ||
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
          tradeLimit:
            500,
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
        (
          trade,
        ) =>
          trade.side ===
            "SELL" &&
          Number.isFinite(
            Number(
              trade
                .realizedProfit,
            ),
          ),
      );

    const wins =
      sellTrades.filter(
        (
          trade,
        ) =>
          Number(
            trade.realizedProfit,
          ) >
          0,
      );

    const losses =
      sellTrades.filter(
        (
          trade,
        ) =>
          Number(
            trade.realizedProfit,
          ) <
          0,
      );

    const todayTrades =
      trades.filter(
        (
          trade,
        ) =>
          isToday(
            trade.timestamp,
          ),
      );

    const realizedProfitToday =
      todayTrades.reduce(
        (
          total,
          trade,
        ) =>
          total +
          Number(
            trade
              .realizedProfit ||
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
      ] ||
      null;

    const startingCash =
      positiveNumberOrFallback(
        portfolio
          .startingCash,
        DEFAULT_STARTING_CASH,
      );

    /*
     * =====================================================
     * PROFITABILITY UPGRADE #1
     *
     * NET PROFIT AFTER FEES & SLIPPAGE
     * =====================================================
     */

    const tradingCosts =
      calculateTradingCosts(
        trades,
        this.slippageBps,
      );

    /*
     * Account profit AFTER recorded fees.
     *
     * Prefer live equity because this
     * includes both realized and unrealized
     * account performance.
     *
     * If no equity snapshot exists yet,
     * use realized profit as the fallback.
     */
    const accountProfitAfterFees =
      latestEquity &&
      Number.isFinite(
        Number(
          latestEquity
            .totalProfit,
        ),
      )
        ? Number(
            latestEquity
              .totalProfit,
          )
        : Number(
            portfolio
              .realizedProfit,
          ) ||
          0;

    /*
     * Add recorded fees back to estimate
     * what P/L would have been before
     * exchange fees.
     */
    const grossTradingProfit =
      accountProfitAfterFees +
      tradingCosts
        .totalFees;

    /*
     * Fees are ALREADY included in
     * accountProfitAfterFees.
     *
     * Therefore only estimated slippage
     * is subtracted here.
     */
    const netProfitAfterCosts =
      accountProfitAfterFees -
      tradingCosts
        .estimatedSlippage;

    const netReturnAfterCostsPercent =
      startingCash >
      0
        ? (
            netProfitAfterCosts /
            startingCash
          ) *
          100
        : 0;

    return {
      portfolio: {
        startingCash:
          portfolio
            .startingCash,

        cash:
          portfolio.cash,

        realizedProfit:
          portfolio
            .realizedProfit,

        openPositionCount:
          Object.keys(
            portfolio
              .positions ||
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
        sellTrades.length >
        0
          ? (
              wins.length /
              sellTrades.length
            ) *
            100
          : 0,

      profitFactor:
        calculateProfitFactor(
          sellTrades,
        ),

      realizedProfitToday,

      /*
       * ===================================================
       * NEW PROFITABILITY METRICS
       * ===================================================
       */

      grossTradingProfit,

      /*
       * Account profit after the actual
       * fees already recorded by the bot.
       */
      accountProfitAfterFees,

      /*
       * Recorded exchange fees from all
       * executions.
       */
      totalFees:
        tradingCosts
          .totalFees,

      /*
       * Estimated market slippage.
       */
      estimatedSlippage:
        tradingCosts
          .estimatedSlippage,

      /*
       * Fees + estimated slippage.
       *
       * Useful for showing total trading
       * friction, but DO NOT subtract this
       * again from accountProfitAfterFees.
       */
      totalTradingCosts:
        tradingCosts
          .totalTradingCosts,

      /*
       * Most important number for
       * profitability testing.
       */
      netProfitAfterCosts,

      netReturnAfterCostsPercent,

      averageFeePerOrder:
        tradingCosts
          .averageFeePerOrder,

      averageSlippagePerOrder:
        tradingCosts
          .averageSlippagePerOrder,

      averageTradingCostPerOrder:
        tradingCosts
          .averageTradingCostPerOrder,

      /*
       * The assumption used to calculate
       * estimated slippage.
       */
      slippageBps:
        this.slippageBps,

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

      /*
       * New profitability columns.
       */
      "estimatedSlippage",
      "estimatedExecutionCost",

      "realizedProfit",
      "source",
    ];

    const rows =
      trades.map(
        (
          trade,
        ) => {
          const timestamp =
            timestampValue(
              trade.timestamp,
            ) ||
            timestampValue(
              trade.createdAt,
            );

          const estimatedSlippage =
            calculateTradeSlippage(
              trade,
              this.slippageBps,
            );

          const fee =
            Math.abs(
              numberOrZero(
                trade.fee,
              ),
            );

          const estimatedExecutionCost =
            fee +
            estimatedSlippage;

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

            estimatedSlippage,

            estimatedExecutionCost,

            trade.realizedProfit,

            trade.source ||
              "",
          ]
            .map(
              escapeCsv,
            )
            .join(
              ",",
            );
        },
      );

    return [
      headers.join(
        ",",
      ),

      ...rows,
    ].join(
      "\n",
    );
  }

  clearEquityHistory() {
    this.equityHistory =
      [];

    this.lastSnapshotTime =
      0;

    return {
      success:
        true,

      clearedAt:
        Date.now(),
    };
  }
}