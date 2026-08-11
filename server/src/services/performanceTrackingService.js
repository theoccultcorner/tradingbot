import {
  database,
} from "../config/database.js";

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
 * Render environment override:
 *
 * PAPER_SLIPPAGE_BPS=5
 */
const DEFAULT_SLIPPAGE_BPS =
  5;

/*
 * Profit-factor labels become meaningful
 * only after a reasonable number of closed
 * trades.
 *
 * This does not prove profitability. It
 * simply prevents a tiny sample from being
 * presented as strong evidence.
 */
const MIN_PROFIT_FACTOR_SAMPLE =
  20;

/*
 * =========================================================
 * PERSISTENT EQUITY SNAPSHOTS
 * =========================================================
 *
 * Equity history used to live only in RAM.
 *
 * That meant every Render restart erased the
 * history used to calculate maximum drawdown.
 *
 * Store snapshots in the same persistent
 * SQLite database as the paper portfolio.
 */
database.exec(`
  CREATE TABLE IF NOT EXISTS equity_snapshots (
    id TEXT PRIMARY KEY,
    cash REAL NOT NULL,
    market_value REAL NOT NULL,
    equity REAL NOT NULL,
    total_profit REAL NOT NULL,
    total_return_percent REAL NOT NULL,
    realized_profit REAL NOT NULL,
    unrealized_profit REAL NOT NULL,
    open_position_count INTEGER NOT NULL DEFAULT 0,
    symbol TEXT,
    timeframe TEXT,
    timestamp INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_equity_snapshots_timestamp
  ON equity_snapshots(timestamp);
`);

function normalizeEquitySnapshotRow(
  row,
) {
  if (!row) {
    return null;
  }

  return {
    id:
      row.id,

    cash:
      numberOrZero(
        row.cash,
      ),

    marketValue:
      numberOrZero(
        row.market_value,
      ),

    equity:
      numberOrZero(
        row.equity,
      ),

    totalProfit:
      numberOrZero(
        row.total_profit,
      ),

    totalReturnPercent:
      numberOrZero(
        row.total_return_percent,
      ),

    realizedProfit:
      numberOrZero(
        row.realized_profit,
      ),

    unrealizedProfit:
      numberOrZero(
        row.unrealized_profit,
      ),

    openPositionCount:
      numberOrZero(
        row.open_position_count,
      ),

    symbol:
      row.symbol ||
      null,

    timeframe:
      row.timeframe ||
      null,

    timestamp:
      numberOrZero(
        row.timestamp,
      ),
  };
}

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

  return (
    Number.isFinite(
      number,
    ) &&
    number > 0
  )
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
   * inside a reasonable range.
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
 * 5 bps
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
 * Calculate all estimated execution
 * costs.
 *
 * IMPORTANT:
 *
 * realizedProfit already includes the
 * trading fee from the paper portfolio.
 *
 * Fees must NOT be subtracted from the
 * account profit a second time.
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

  const totalTradingCosts =
    totalFees +
    estimatedSlippage;

  return {
    totalFees,

    estimatedSlippage,

    totalTradingCosts,

    averageFeePerOrder:
      trades.length > 0
        ? totalFees /
          trades.length
        : 0,

    averageSlippagePerOrder:
      trades.length > 0
        ? estimatedSlippage /
          trades.length
        : 0,

    averageTradingCostPerOrder:
      trades.length > 0
        ? totalTradingCosts /
          trades.length
        : 0,
  };
}

/*
 * =========================================================
 * PROFITABILITY UPGRADE #5
 *
 * ROLLING PERFORMANCE WINDOWS
 * =========================================================
 *
 * Calculate account performance over the
 * previous N calendar days.
 *
 * The return is measured from the equity
 * available around the beginning of the
 * requested period rather than always
 * comparing against the original bankroll.
 */
function calculatePeriodPerformance({
  days,
  equityHistory,
  trades,
  slippageBps,
}) {
  const safeDays =
    Math.max(
      Number(
        days,
      ) || 1,
      1,
    );

  const now =
    Date.now();

  const periodStart =
    now -
    (
      safeDays *
      24 *
      60 *
      60 *
      1000
    );

  const sortedEquity =
    Array.isArray(
      equityHistory,
    )
      ? [
          ...equityHistory,
        ].sort(
          (
            left,
            right,
          ) =>
            numberOrZero(
              left.timestamp,
            ) -
            numberOrZero(
              right.timestamp,
            ),
        )
      : [];

  const endingPoint =
    sortedEquity[
      sortedEquity.length -
        1
    ] ||
    null;

  /*
   * Find the newest snapshot that existed
   * at or before the requested window.
   */
  let startingPoint =
    null;

  for (
    const point of sortedEquity
  ) {
    if (
      numberOrZero(
        point.timestamp,
      ) <=
      periodStart
    ) {
      startingPoint =
        point;
    } else {
      break;
    }
  }

  /*
   * completePeriod tells the frontend
   * whether we genuinely have the full
   * requested history.
   *
   * Example:
   *
   * If the bot has only stored 3 days of
   * data, performance30d can still display
   * available performance but will report:
   *
   * completePeriod: false
   */
  const completePeriod =
    Boolean(
      startingPoint,
    );

  if (
    !startingPoint &&
    sortedEquity.length > 0
  ) {
    startingPoint =
      sortedEquity[0];
  }

  const startingEquity =
    startingPoint
      ? numberOrZero(
          startingPoint.equity,
        )
      : 0;

  const endingEquity =
    endingPoint
      ? numberOrZero(
          endingPoint.equity,
        )
      : 0;

  const profit =
    endingEquity -
    startingEquity;

  const returnPercent =
    startingEquity > 0
      ? (
          profit /
          startingEquity
        ) *
        100
      : 0;

  /*
   * Filter all order executions that
   * occurred inside this period.
   */
  const periodTrades =
    Array.isArray(
      trades,
    )
      ? trades.filter(
          (
            trade,
          ) => {
            const timestamp =
              timestampValue(
                trade.timestamp,
              ) ||
              timestampValue(
                trade.createdAt,
              ) ||
              0;

            return (
              timestamp >=
                periodStart &&
              timestamp <=
                now
            );
          },
        )
      : [];

  /*
   * A closed trade is currently represented
   * by a SELL carrying realizedProfit.
   */
  const closedTrades =
    periodTrades.filter(
      (
        trade,
      ) =>
        trade.side ===
          "SELL" &&
        Number.isFinite(
          Number(
            trade.realizedProfit,
          ),
        ),
    );

  const wins =
    closedTrades.filter(
      (
        trade,
      ) =>
        numberOrZero(
          trade.realizedProfit,
        ) > 0,
    );

  const losses =
    closedTrades.filter(
      (
        trade,
      ) =>
        numberOrZero(
          trade.realizedProfit,
        ) < 0,
    );

  const breakEvenTrades =
    closedTrades.filter(
      (
        trade,
      ) =>
        numberOrZero(
          trade.realizedProfit,
        ) === 0,
    );

  const winRate =
    closedTrades.length > 0
      ? (
          wins.length /
          closedTrades.length
        ) *
        100
      : 0;

  const tradingCosts =
    calculateTradingCosts(
      periodTrades,
      slippageBps,
    );

  return {
    periodDays:
      safeDays,

    periodStart,

    periodEnd:
      now,

    completePeriod,

    startingTimestamp:
      startingPoint
        ? numberOrZero(
            startingPoint.timestamp,
          )
        : null,

    endingTimestamp:
      endingPoint
        ? numberOrZero(
            endingPoint.timestamp,
          )
        : null,

    startingEquity,

    endingEquity,

    profit,

    returnPercent,

    orders:
      periodTrades.length,

    closedTrades:
      closedTrades.length,

    wins:
      wins.length,

    losses:
      losses.length,

    breakEvenTrades:
      breakEvenTrades.length,

    winRate,

    fees:
      tradingCosts
        .totalFees,

    estimatedSlippage:
      tradingCosts
        .estimatedSlippage,

    totalTradingCosts:
      tradingCosts
        .totalTradingCosts,
  };
}

function calculateDrawdown(
  points,
) {
  if (
    !Array.isArray(
      points,
    ) ||
    points.length === 0
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
      peak <= 0
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

/*
 * =========================================================
 * PROFITABILITY UPGRADE #3
 *
 * PROFIT FACTOR INTELLIGENCE
 * =========================================================
 *
 * Profit Factor =
 *
 * Gross Winning Profit
 * --------------------
 * Gross Losing Amount
 */
function calculateProfitFactorMetrics(
  trades,
) {
  const closedTrades =
    Array.isArray(
      trades,
    )
      ? trades.filter(
          (
            trade,
          ) =>
            Number.isFinite(
              Number(
                trade.realizedProfit,
              ),
            ),
        )
      : [];

  const grossWinningProfit =
    closedTrades
      .filter(
        (
          trade,
        ) =>
          numberOrZero(
            trade.realizedProfit,
          ) > 0,
      )
      .reduce(
        (
          total,
          trade,
        ) =>
          total +
          numberOrZero(
            trade.realizedProfit,
          ),
        0,
      );

  const grossLosingAmount =
    Math.abs(
      closedTrades
        .filter(
          (
            trade,
          ) =>
            numberOrZero(
              trade.realizedProfit,
            ) < 0,
        )
        .reduce(
          (
            total,
            trade,
          ) =>
            total +
            numberOrZero(
              trade.realizedProfit,
            ),
          0,
        ),
    );

  let profitFactor =
    0;

  if (
    grossLosingAmount === 0
  ) {
    profitFactor =
      grossWinningProfit > 0
        ? null
        : 0;
  } else {
    profitFactor =
      grossWinningProfit /
      grossLosingAmount;
  }

  const sampleSize =
    closedTrades.length;

  const sampleAdequate =
    sampleSize >=
    MIN_PROFIT_FACTOR_SAMPLE;

  let rating =
    "NO DATA";

  if (
    sampleSize === 0
  ) {
    rating =
      "NO DATA";
  } else if (
    !sampleAdequate
  ) {
    rating =
      "INSUFFICIENT SAMPLE";
  } else if (
    profitFactor === null
  ) {
    rating =
      "VERY STRONG";
  } else if (
    profitFactor < 1
  ) {
    rating =
      "LOSING";
  } else if (
    profitFactor < 1.2
  ) {
    rating =
      "WEAK";
  } else if (
    profitFactor < 1.5
  ) {
    rating =
      "IMPROVING";
  } else if (
    profitFactor < 2
  ) {
    rating =
      "STRONG";
  } else {
    rating =
      "VERY STRONG";
  }

  return {
    grossWinningProfit,

    grossLosingAmount,

    profitFactor,

    rating,

    sampleSize,

    sampleAdequate,

    minimumSample:
      MIN_PROFIT_FACTOR_SAMPLE,
  };
}

function calculateProfitFactor(
  trades,
) {
  return calculateProfitFactorMetrics(
    trades,
  ).profitFactor;
}

/*
 * =========================================================
 * PROFITABILITY UPGRADE #2
 *
 * EXPECTANCY PER CLOSED TRADE
 * =========================================================
 */
function calculateExpectancyMetrics(
  trades,
  startingCash,
) {
  const closedTrades =
    Array.isArray(
      trades,
    )
      ? trades.filter(
          (
            trade,
          ) =>
            Number.isFinite(
              Number(
                trade.realizedProfit,
              ),
            ),
        )
      : [];

  const wins =
    closedTrades.filter(
      (
        trade,
      ) =>
        numberOrZero(
          trade.realizedProfit,
        ) > 0,
    );

  const losses =
    closedTrades.filter(
      (
        trade,
      ) =>
        numberOrZero(
          trade.realizedProfit,
        ) < 0,
    );

  const breakEvenTrades =
    closedTrades.filter(
      (
        trade,
      ) =>
        numberOrZero(
          trade.realizedProfit,
        ) === 0,
    );

  const totalWinningProfit =
    wins.reduce(
      (
        total,
        trade,
      ) =>
        total +
        numberOrZero(
          trade.realizedProfit,
        ),
      0,
    );

  const totalLosingProfit =
    losses.reduce(
      (
        total,
        trade,
      ) =>
        total +
        numberOrZero(
          trade.realizedProfit,
        ),
      0,
    );

  const totalClosedProfit =
    closedTrades.reduce(
      (
        total,
        trade,
      ) =>
        total +
        numberOrZero(
          trade.realizedProfit,
        ),
      0,
    );

  const averageWinningTrade =
    wins.length > 0
      ? totalWinningProfit /
        wins.length
      : 0;

  const averageLosingTrade =
    losses.length > 0
      ? totalLosingProfit /
        losses.length
      : 0;

  const winProbability =
    closedTrades.length > 0
      ? wins.length /
        closedTrades.length
      : 0;

  const lossProbability =
    closedTrades.length > 0
      ? losses.length /
        closedTrades.length
      : 0;

  const breakEvenProbability =
    closedTrades.length > 0
      ? breakEvenTrades.length /
        closedTrades.length
      : 0;

  const expectancyPerTrade =
    (
      winProbability *
      averageWinningTrade
    ) +
    (
      lossProbability *
      averageLosingTrade
    );

  const averageProfitPerClosedTrade =
    closedTrades.length > 0
      ? totalClosedProfit /
        closedTrades.length
      : 0;

  const expectancyPercent =
    startingCash > 0
      ? (
          expectancyPerTrade /
          startingCash
        ) *
        100
      : 0;

  const averageWinLossRatio =
    averageLosingTrade < 0
      ? (
          averageWinningTrade /
          Math.abs(
            averageLosingTrade,
          )
        )
      : averageWinningTrade > 0
        ? null
        : 0;

  const largestWinningTrade =
    wins.length > 0
      ? Math.max(
          ...wins.map(
            (
              trade,
            ) =>
              numberOrZero(
                trade.realizedProfit,
              ),
          ),
        )
      : 0;

  const largestLosingTrade =
    losses.length > 0
      ? Math.min(
          ...losses.map(
            (
              trade,
            ) =>
              numberOrZero(
                trade.realizedProfit,
              ),
          ),
        )
      : 0;

  const chronologicalTrades =
    [
      ...closedTrades,
    ].sort(
      (
        left,
        right,
      ) =>
        (
          timestampValue(
            left.timestamp,
          ) ||
          timestampValue(
            left.createdAt,
          ) ||
          0
        ) -
        (
          timestampValue(
            right.timestamp,
          ) ||
          timestampValue(
            right.createdAt,
          ) ||
          0
        ),
    );

  let consecutiveLosses =
    0;

  let maximumConsecutiveLosses =
    0;

  for (
    const trade of chronologicalTrades
  ) {
    const profit =
      numberOrZero(
        trade.realizedProfit,
      );

    if (
      profit < 0
    ) {
      consecutiveLosses +=
        1;

      maximumConsecutiveLosses =
        Math.max(
          maximumConsecutiveLosses,
          consecutiveLosses,
        );
    } else {
      consecutiveLosses =
        0;
    }
  }

  let currentConsecutiveLosses =
    0;

  for (
    let index =
      chronologicalTrades.length -
      1;

    index >= 0;

    index -=
      1
  ) {
    const profit =
      numberOrZero(
        chronologicalTrades[
          index
        ].realizedProfit,
      );

    if (
      profit < 0
    ) {
      currentConsecutiveLosses +=
        1;
    } else {
      break;
    }
  }

  return {
    totalClosedProfit,

    averageWinningTrade,

    averageLosingTrade,

    averageProfitPerClosedTrade,

    averageWinLossRatio,

    expectancyPerTrade,

    expectancyPercent,

    winProbability,

    lossProbability,

    breakEvenProbability,

    largestWinningTrade,

    largestLosingTrade,

    maximumConsecutiveLosses,

    currentConsecutiveLosses,

    breakEvenTrades:
      breakEvenTrades.length,
  };
}

/*
 * =========================================================
 * PROFITABILITY UPGRADE #6
 *
 * PERFORMANCE BY COIN / TIMEFRAME
 * =========================================================
 *
 * In addition to raw realized profit, each
 * group now tracks estimated execution costs
 * and cost-adjusted profit.
 */
function groupTradePerformance(
  trades,
  keyOrResolver,
  slippageBps,
) {
  const groups =
    {};

  for (
    const trade of trades
  ) {
    const resolvedGroupName =
      typeof keyOrResolver ===
      "function"
        ? keyOrResolver(
            trade,
          )
        : trade?.[
            keyOrResolver
          ];

    const groupName =
      resolvedGroupName ===
        null ||
      resolvedGroupName ===
        undefined ||
      String(
        resolvedGroupName,
      ).trim() ===
        ""
        ? "Unknown"
        : String(
            resolvedGroupName,
          );

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

        breakEven:
          0,

        realizedProfit:
          0,

        fees:
          0,

        estimatedSlippage:
          0,

        totalTradingCosts:
          0,

        netProfitAfterCosts:
          0,

        grossWinningProfit:
          0,

        grossLosingAmount:
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
      numberOrZero(
        trade.realizedProfit,
      );

    if (
      profit > 0
    ) {
      group.wins +=
        1;

      group.grossWinningProfit +=
        profit;
    } else if (
      profit < 0
    ) {
      group.losses +=
        1;

      group.grossLosingAmount +=
        Math.abs(
          profit,
        );
    } else {
      group.breakEven +=
        1;
    }

    group.realizedProfit +=
      profit;

    const fee =
      Math.abs(
        numberOrZero(
          trade.fee,
        ),
      );

    const estimatedSlippage =
      calculateTradeSlippage(
        trade,
        slippageBps,
      );

    group.fees +=
      fee;

    group.estimatedSlippage +=
      estimatedSlippage;

    group.totalTradingCosts +=
      fee +
      estimatedSlippage;

    /*
     * realizedProfit already includes fees,
     * so subtract only estimated slippage
     * when calculating cost-adjusted profit.
     */
    group.netProfitAfterCosts +=
      profit -
      estimatedSlippage;
  }

  return Object.values(
    groups,
  )
    .map(
      (
        group,
      ) => {
        const profitFactor =
          group.grossLosingAmount ===
          0
            ? group.grossWinningProfit >
              0
              ? null
              : 0
            : group.grossWinningProfit /
              group.grossLosingAmount;

        const profitFactorSampleAdequate =
          group.trades >=
          MIN_PROFIT_FACTOR_SAMPLE;

        let profitFactorRating =
          "NO DATA";

        if (
          group.trades === 0
        ) {
          profitFactorRating =
            "NO DATA";
        } else if (
          !profitFactorSampleAdequate
        ) {
          profitFactorRating =
            "INSUFFICIENT SAMPLE";
        } else if (
          profitFactor === null
        ) {
          profitFactorRating =
            "VERY STRONG";
        } else if (
          profitFactor < 1
        ) {
          profitFactorRating =
            "LOSING";
        } else if (
          profitFactor < 1.2
        ) {
          profitFactorRating =
            "WEAK";
        } else if (
          profitFactor < 1.5
        ) {
          profitFactorRating =
            "IMPROVING";
        } else if (
          profitFactor < 2
        ) {
          profitFactorRating =
            "STRONG";
        } else {
          profitFactorRating =
            "VERY STRONG";
        }

        return {
          ...group,

          winRate:
            group.trades > 0
              ? (
                  group.wins /
                  group.trades
                ) *
                100
              : 0,

          averageProfit:
            group.trades > 0
              ? group.realizedProfit /
                group.trades
              : 0,

          averageNetProfitAfterCosts:
            group.trades > 0
              ? group.netProfitAfterCosts /
                group.trades
              : 0,

          averageFee:
            group.trades > 0
              ? group.fees /
                group.trades
              : 0,

          averageEstimatedSlippage:
            group.trades > 0
              ? group.estimatedSlippage /
                group.trades
              : 0,

          profitFactor,

          profitFactorRating,

          profitFactorSampleSize:
            group.trades,

          profitFactorSampleAdequate,

          profitFactorMinimumSample:
            MIN_PROFIT_FACTOR_SAMPLE,
        };
      },
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

/*
 * =========================================================
 * PROFITABILITY UPGRADE #7
 *
 * STRATEGY BREAKDOWN HELPERS
 * =========================================================
 *
 * These buckets operate on CLOSED SELL trades.
 *
 * That means they describe the metadata attached
 * to the execution that CLOSED the trade. They do
 * not retroactively reconstruct the entry signal
 * for positions created before metadata persistence.
 */
function confidenceBucket(
  trade,
) {
  const confidence =
    Number(
      trade?.confidence ??
      trade?.metadata
        ?.confidence,
    );

  if (
    !Number.isFinite(
      confidence,
    )
  ) {
    return "Unknown";
  }

  if (confidence < 45) {
    return "Below 45%";
  }

  if (confidence < 60) {
    return "45-59%";
  }

  if (confidence < 75) {
    return "60-74%";
  }

  if (confidence < 90) {
    return "75-89%";
  }

  return "90-100%";
}

function scoreBucket(
  trade,
) {
  const score =
    Number(
      trade?.score ??
      trade?.metadata
        ?.score,
    );

  if (
    !Number.isFinite(
      score,
    )
  ) {
    return "Unknown";
  }

  const absoluteScore =
    Math.abs(
      score,
    );

  if (absoluteScore < 40) {
    return "0-39";
  }

  if (absoluteScore < 50) {
    return "40-49";
  }

  if (absoluteScore < 60) {
    return "50-59";
  }

  if (absoluteScore < 70) {
    return "60-69";
  }

  return "70+";
}

function strategyName(
  trade,
) {
  return (
    trade?.strategy ||
    trade?.metadata
      ?.strategy ||
    (
      trade?.source ===
      "SERVER_RISK_MANAGER"
        ? "RISK_MANAGER"
        : trade?.source ===
            "SERVER_TRADING_ENGINE"
          ? "SIGNAL_ENGINE"
          : "Unknown"
    )
  );
}

function signalLabelName(
  trade,
) {
  return (
    trade?.label ||
    trade?.metadata
      ?.label ||
    trade?.type ||
    trade?.metadata
      ?.type ||
    "Unknown"
  );
}

function exitTypeName(
  trade,
) {
  const type =
    trade?.type ||
    trade?.metadata
      ?.type;

  if (type) {
    return type;
  }

  const strategy =
    strategyName(
      trade,
    );

  if (
    strategy ===
    "SIGNAL_ENGINE"
  ) {
    return "SIGNAL_EXIT";
  }

  return "Unknown";
}

function escapeCsv(
  value,
) {
  if (
    value === null ||
    value === undefined
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

    this.slippageBps =
      normalizeSlippageBps(
        slippageBps,
      );

    const latestStoredSnapshot =
      database
        .prepare(
          `
            SELECT timestamp
            FROM equity_snapshots
            ORDER BY timestamp DESC
            LIMIT 1
          `,
        )
        .get();

    this.lastSnapshotTime =
      numberOrZero(
        latestStoredSnapshot
          ?.timestamp,
      );

    this.latestPrices =
      {};

    this.snapshotLock =
      false;

    database
      .prepare(
        `
          DELETE FROM equity_snapshots
          WHERE rowid NOT IN (
            SELECT rowid
            FROM equity_snapshots
            ORDER BY timestamp DESC, rowid DESC
            LIMIT ?
          )
        `,
      )
      .run(
        this.maxEquityPoints,
      );
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
          numberOrZero(
            position.quantity,
          );

        const averageEntryPrice =
          numberOrZero(
            position
              .averageEntryPrice,
          );

        const latestKnownPrice =
          this.latestPrices[
            positionSymbol
          ];

        const currentPrice =
          Number.isFinite(
            Number(
              latestKnownPrice,
            ),
          ) &&
          Number(
            latestKnownPrice,
          ) > 0
            ? Number(
                latestKnownPrice,
              )
            : (
                positionSymbol ===
                  symbol &&
                Number.isFinite(
                  Number(
                    marketPrice,
                  ),
                ) &&
                Number(
                  marketPrice,
                ) > 0
              )
              ? Number(
                  marketPrice,
                )
              : averageEntryPrice;

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
        numberOrZero(
          portfolio.cash,
        );

      const startingCash =
        positiveNumberOrFallback(
          portfolio
            .startingCash,
          DEFAULT_STARTING_CASH,
        );

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
          numberOrZero(
            portfolio
              .realizedProfit,
          ),

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

      database
        .transaction(
          () => {
            database
              .prepare(
                `
                  INSERT INTO equity_snapshots (
                    id,
                    cash,
                    market_value,
                    equity,
                    total_profit,
                    total_return_percent,
                    realized_profit,
                    unrealized_profit,
                    open_position_count,
                    symbol,
                    timeframe,
                    timestamp
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
              )
              .run(
                snapshot.id,
                snapshot.cash,
                snapshot.marketValue,
                snapshot.equity,
                snapshot.totalProfit,
                snapshot.totalReturnPercent,
                snapshot.realizedProfit,
                snapshot.unrealizedProfit,
                snapshot.openPositionCount,
                snapshot.symbol,
                snapshot.timeframe,
                snapshot.timestamp,
              );

            database
              .prepare(
                `
                  DELETE FROM equity_snapshots
                  WHERE rowid NOT IN (
                    SELECT rowid
                    FROM equity_snapshots
                    ORDER BY timestamp DESC, rowid DESC
                    LIMIT ?
                  )
                `,
              )
              .run(
                this.maxEquityPoints,
              );
          },
        )();

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

    const rows =
      database
        .prepare(
          `
            SELECT
              id,
              cash,
              market_value,
              equity,
              total_profit,
              total_return_percent,
              realized_profit,
              unrealized_profit,
              open_position_count,
              symbol,
              timeframe,
              timestamp
            FROM equity_snapshots
            ORDER BY timestamp DESC, rowid DESC
            LIMIT ?
          `,
        )
        .all(
          safeLimit,
        );

    return rows
      .map(
        normalizeEquitySnapshotRow,
      )
      .reverse();
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
          numberOrZero(
            trade.realizedProfit,
          ) > 0,
      );

    const losses =
      sellTrades.filter(
        (
          trade,
        ) =>
          numberOrZero(
            trade.realizedProfit,
          ) < 0,
      );

    const breakEvenTrades =
      sellTrades.filter(
        (
          trade,
        ) =>
          numberOrZero(
            trade.realizedProfit,
          ) === 0,
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
          numberOrZero(
            trade
              .realizedProfit,
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

    const expectancyMetrics =
      calculateExpectancyMetrics(
        sellTrades,
        startingCash,
      );

    const profitFactorMetrics =
      calculateProfitFactorMetrics(
        sellTrades,
      );

    const tradingCosts =
      calculateTradingCosts(
        trades,
        this.slippageBps,
      );

    const performance1d =
      calculatePeriodPerformance({
        days:
          1,

        equityHistory,

        trades,

        slippageBps:
          this.slippageBps,
      });

    const performance7d =
      calculatePeriodPerformance({
        days:
          7,

        equityHistory,

        trades,

        slippageBps:
          this.slippageBps,
      });

    const performance30d =
      calculatePeriodPerformance({
        days:
          30,

        equityHistory,

        trades,

        slippageBps:
          this.slippageBps,
      });

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
        : numberOrZero(
            portfolio
              .realizedProfit,
          );

    const grossTradingProfit =
      accountProfitAfterFees +
      tradingCosts
        .totalFees;

    const netProfitAfterCosts =
      accountProfitAfterFees -
      tradingCosts
        .estimatedSlippage;

    const netReturnAfterCostsPercent =
      startingCash > 0
        ? (
            netProfitAfterCosts /
            startingCash
          ) *
          100
        : 0;

    const winRate =
      sellTrades.length > 0
        ? (
            wins.length /
            sellTrades.length
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

      breakEvenTrades:
        breakEvenTrades.length,

      winRate,

      profitFactor:
        profitFactorMetrics
          .profitFactor,

      grossWinningProfit:
        profitFactorMetrics
          .grossWinningProfit,

      grossLosingAmount:
        profitFactorMetrics
          .grossLosingAmount,

      profitFactorRating:
        profitFactorMetrics
          .rating,

      profitFactorSampleSize:
        profitFactorMetrics
          .sampleSize,

      profitFactorSampleAdequate:
        profitFactorMetrics
          .sampleAdequate,

      profitFactorMinimumSample:
        profitFactorMetrics
          .minimumSample,

      averageWinningTrade:
        expectancyMetrics
          .averageWinningTrade,

      averageLosingTrade:
        expectancyMetrics
          .averageLosingTrade,

      averageProfitPerClosedTrade:
        expectancyMetrics
          .averageProfitPerClosedTrade,

      averageWinLossRatio:
        expectancyMetrics
          .averageWinLossRatio,

      expectancyPerTrade:
        expectancyMetrics
          .expectancyPerTrade,

      expectancyPercent:
        expectancyMetrics
          .expectancyPercent,

      winProbability:
        expectancyMetrics
          .winProbability,

      lossProbability:
        expectancyMetrics
          .lossProbability,

      breakEvenProbability:
        expectancyMetrics
          .breakEvenProbability,

      largestWinningTrade:
        expectancyMetrics
          .largestWinningTrade,

      largestLosingTrade:
        expectancyMetrics
          .largestLosingTrade,

      maximumConsecutiveLosses:
        expectancyMetrics
          .maximumConsecutiveLosses,

      currentConsecutiveLosses:
        expectancyMetrics
          .currentConsecutiveLosses,

      realizedProfitToday,

      performance1d,

      performance7d,

      performance30d,

      grossTradingProfit,

      accountProfitAfterFees,

      totalFees:
        tradingCosts
          .totalFees,

      estimatedSlippage:
        tradingCosts
          .estimatedSlippage,

      totalTradingCosts:
        tradingCosts
          .totalTradingCosts,

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

      slippageBps:
        this.slippageBps,

      maximumDrawdownAmount:
        drawdown.amount,

      maximumDrawdownPercent:
        drawdown.percent,

      /*
       * =====================================================
       * ROADMAP #6
       *
       * PERFORMANCE BY COIN / TIMEFRAME
       * =====================================================
       */
      bySymbol:
        groupTradePerformance(
          sellTrades,
          "symbol",
          this.slippageBps,
        ),

      byTimeframe:
        groupTradePerformance(
          sellTrades,
          "timeframe",
          this.slippageBps,
        ),

      /*
       * =====================================================
       * ROADMAP #7
       *
       * STRATEGY BREAKDOWN
       * =====================================================
       *
       * These groups use metadata attached to
       * CLOSED SELL executions.
       */
      byStrategy:
        groupTradePerformance(
          sellTrades,
          strategyName,
          this.slippageBps,
        ),

      bySignalLabel:
        groupTradePerformance(
          sellTrades,
          signalLabelName,
          this.slippageBps,
        ),

      byConfidenceBucket:
        groupTradePerformance(
          sellTrades,
          confidenceBucket,
          this.slippageBps,
        ),

      byScoreBucket:
        groupTradePerformance(
          sellTrades,
          scoreBucket,
          this.slippageBps,
        ),

      byExitType:
        groupTradePerformance(
          sellTrades,
          exitTypeName,
          this.slippageBps,
        ),

      strategyBreakdownScope:
        "CLOSED_TRADE_EXIT_METADATA",

      equityStorage:
        "sqlite",

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
    const result =
      database
        .prepare(
          `
            DELETE FROM equity_snapshots
          `,
        )
        .run();

    this.lastSnapshotTime =
      0;

    return {
      success:
        true,

      deletedSnapshots:
        Number(
          result.changes,
        ) ||
        0,

      clearedAt:
        Date.now(),
    };
  }
}