import crypto from "node:crypto";

import {
  database,
} from "../config/database.js";

import {
  calculateAllIndicators,
} from "../utils/indicators.js";

import {
  calculateTradingSignal,
} from "../utils/signalEngine.js";

const BINANCE_REST_URL =
  process.env.BINANCE_BASE_URL ||
  "https://api.binance.us";

database.exec(`
  CREATE TABLE IF NOT EXISTS backtests (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    candle_count INTEGER NOT NULL,

    starting_cash REAL NOT NULL,
    ending_cash REAL NOT NULL,
    ending_equity REAL NOT NULL,
    total_profit REAL NOT NULL,
    total_return_percent REAL NOT NULL,
    total_fees REAL NOT NULL,

    closed_trade_count INTEGER NOT NULL,
    order_count INTEGER NOT NULL,
    wins INTEGER NOT NULL,
    losses INTEGER NOT NULL,
    win_rate REAL NOT NULL,
    gross_profit REAL NOT NULL,
    gross_loss REAL NOT NULL,

    profit_factor REAL,
    average_trade REAL NOT NULL,

    maximum_drawdown_amount REAL NOT NULL,
    maximum_drawdown_percent REAL NOT NULL,

    settings_json TEXT NOT NULL,
    open_position_json TEXT,
    orders_json TEXT NOT NULL,
    closed_trades_json TEXT NOT NULL,
    equity_curve_json TEXT NOT NULL,

    completed_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

database.exec(`
  CREATE TABLE IF NOT EXISTS walk_forward_tests (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    candle_count INTEGER NOT NULL,

    training_window INTEGER NOT NULL,
    testing_window INTEGER NOT NULL,
    step_size INTEGER NOT NULL,
    window_count INTEGER NOT NULL,

    starting_cash REAL NOT NULL,
    ending_equity REAL NOT NULL,
    total_profit REAL NOT NULL,
    total_return_percent REAL NOT NULL,
    total_fees REAL NOT NULL,

    closed_trade_count INTEGER NOT NULL,
    order_count INTEGER NOT NULL,
    wins INTEGER NOT NULL,
    losses INTEGER NOT NULL,
    win_rate REAL NOT NULL,
    gross_profit REAL NOT NULL,
    gross_loss REAL NOT NULL,
    profit_factor REAL,
    average_trade REAL NOT NULL,

    maximum_drawdown_amount REAL NOT NULL,
    maximum_drawdown_percent REAL NOT NULL,

    profitable_windows INTEGER NOT NULL,
    losing_windows INTEGER NOT NULL,
    break_even_windows INTEGER NOT NULL,
    profitable_window_rate REAL NOT NULL,
    average_training_return_percent REAL NOT NULL,
    average_testing_return_percent REAL NOT NULL,
    average_return_degradation_percent REAL NOT NULL,

    settings_json TEXT NOT NULL,
    windows_json TEXT NOT NULL,
    closed_trades_json TEXT NOT NULL,
    equity_curve_json TEXT NOT NULL,

    completed_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_walk_forward_tests_created_at
  ON walk_forward_tests(created_at);
`);

function normalizeCandle(
  kline,
) {
  return {
    time:
      Math.floor(
        Number(
          kline[0],
        ) / 1000,
      ),

    open:
      Number(
        kline[1],
      ),

    high:
      Number(
        kline[2],
      ),

    low:
      Number(
        kline[3],
      ),

    close:
      Number(
        kline[4],
      ),

    volume:
      Number(
        kline[5],
      ),

    closeTime:
      Number(
        kline[6],
      ),

    closed:
      true,
  };
}

function calculateMaximumDrawdown(
  equityCurve,
) {
  let peak =
    equityCurve[0]
      ?.equity ||
    0;

  let maximumDrawdownAmount =
    0;

  let maximumDrawdownPercent =
    0;

  for (
    const point
    of equityCurve
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
      equity > peak
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
      ) * 100;

    if (
      amount >
      maximumDrawdownAmount
    ) {
      maximumDrawdownAmount =
        amount;

      maximumDrawdownPercent =
        percent;
    }
  }

  return {
    amount:
      maximumDrawdownAmount,

    percent:
      maximumDrawdownPercent,
  };
}

function calculateProfitFactor(
  closedTrades,
) {
  const grossProfit =
    closedTrades
      .filter(
        (
          trade,
        ) =>
          trade.profit >
          0,
      )
      .reduce(
        (
          total,
          trade,
        ) =>
          total +
          trade.profit,
        0,
      );

  const grossLoss =
    Math.abs(
      closedTrades
        .filter(
          (
            trade,
          ) =>
            trade.profit <
            0,
        )
        .reduce(
          (
            total,
            trade,
          ) =>
            total +
            trade.profit,
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

function parseJson(
  value,
  fallback,
) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(
      value,
    );
  } catch {
    return fallback;
  }
}

export async function fetchHistoricalCandles({
  symbol,
  timeframe,
  limit = 1000,
}) {
  /*
   * Binance limits a single kline request to
   * 1000 candles.
   *
   * Walk-forward testing needs more history,
   * so fetch older batches by moving endTime
   * backward until the requested amount has
   * been collected.
   */
  const safeLimit =
    Math.min(
      Math.max(
        Number(
          limit,
        ) ||
          500,
        250,
      ),
      5000,
    );

  const normalizedSymbol =
    String(
      symbol,
    ).toUpperCase();

  const normalizedTimeframe =
    String(
      timeframe,
    );

  const allCandles =
    [];

  let endTime =
    Date.now();

  while (
    allCandles.length <
    safeLimit
  ) {
    const remaining =
      safeLimit -
      allCandles.length;

    const requestLimit =
      Math.min(
        remaining,
        1000,
      );

    const query =
      new URLSearchParams({
        symbol:
          normalizedSymbol,

        interval:
          normalizedTimeframe,

        limit:
          String(
            requestLimit,
          ),

        endTime:
          String(
            endTime,
          ),
      });

    const response =
      await fetch(
        `${BINANCE_REST_URL}/api/v3/klines?${query}`,
      );

    const data =
      await response.json();

    if (
      !response.ok
    ) {
      throw new Error(
        data.msg ||
          "Could not load historical candles.",
      );
    }

    if (
      !Array.isArray(
        data,
      )
    ) {
      throw new Error(
        "Binance returned invalid historical data.",
      );
    }

    if (
      data.length ===
      0
    ) {
      break;
    }

    allCandles.unshift(
      ...data.map(
        normalizeCandle,
      ),
    );

    const oldestOpenTime =
      Number(
        data[0]?.[0],
      );

    if (
      !Number.isFinite(
        oldestOpenTime,
      )
    ) {
      break;
    }

    endTime =
      oldestOpenTime -
      1;

    if (
      data.length <
      requestLimit
    ) {
      break;
    }
  }

  /*
   * Defensive de-duplication in case adjacent
   * REST batches overlap by one candle.
   */
  const candleMap =
    new Map();

  for (
    const candle of
    allCandles
  ) {
    candleMap.set(
      candle.time,
      candle,
    );
  }

  return [
    ...candleMap.values(),
  ]
    .sort(
      (
        left,
        right,
      ) =>
        left.time -
        right.time,
    )
    .slice(
      -safeLimit,
    );
}

/*
 * =========================================================
 * WALK-FORWARD SIGNAL CACHE
 * =========================================================
 *
 * Indicator and signal calculations are the expensive part
 * of a backtest.
 *
 * Walk-forward optimization previously recalculated the
 * exact same indicators/signals once for every parameter
 * candidate, even though minimumScore, minimumConfidence,
 * stop-loss and take-profit settings do not change the
 * underlying indicator values or signal-engine output.
 *
 * Build them once for a candle window and reuse them across
 * every candidate simulation.
 *
 * This preserves the strategy logic while dramatically
 * reducing CPU work.
 */
function buildSignalCache({
  candles,
  minimumHistory,
}) {
  const cache =
    new Array(
      candles.length,
    );

  for (
    let index =
      minimumHistory;

    index <
    candles.length;

    index +=
      1
  ) {
    const history =
      candles.slice(
        0,
        index +
          1,
      );

    const candle =
      history[
        history.length -
          1
      ];

    const price =
      Number(
        candle?.close,
      );

    if (
      !Number.isFinite(
        price,
      ) ||
      price <=
        0
    ) {
      cache[index] = {
        candle,
        price,
        signal:
          null,
      };

      continue;
    }

    const indicators =
      calculateAllIndicators(
        history,
      );

    const signal =
      calculateTradingSignal({
        price,

        candles:
          history,

        indicators,
      });

    cache[index] = {
      candle,
      price,
      signal,
    };
  }

  return cache;
}

export function runStrategyBacktest({
  candles,
  symbol,
  timeframe,
  startingCash = 10000,
  buyAmount = 500,
  feeRate = 0.001,
  minimumScore = 60,
  minimumConfidence = 60,
  stopLossPercent = 2,
  takeProfitPercent = 4,
  minimumHistory = 210,
  closeOpenPositionAtEnd = false,
  signalCache = null,
}) {
  if (
    !Array.isArray(
      candles,
    ) ||
    candles.length <
      minimumHistory +
        2
  ) {
    throw new Error(
      `At least ${
        minimumHistory +
        2
      } candles are required.`,
    );
  }

  let cash =
    Number(
      startingCash,
    );

  let position =
    null;

  let totalFees =
    0;

  const orders =
    [];

  const closedTrades =
    [];

  const equityCurve =
    [];

  for (
    let index =
      minimumHistory;

    index <
    candles.length;

    index +=
      1
  ) {
    /*
     * Walk-forward optimization can provide a
     * precomputed signal cache.
     *
     * Standard backtests still calculate signals
     * exactly as before when no cache is supplied.
     */
    let candle;
    let price;
    let signal;

    const cached =
      Array.isArray(
        signalCache,
      )
        ? signalCache[
            index
          ]
        : null;

    if (
      cached
    ) {
      candle =
        cached.candle;

      price =
        cached.price;

      signal =
        cached.signal;
    } else {
      const history =
        candles.slice(
          0,
          index +
            1,
        );

      candle =
        history[
          history.length -
            1
        ];

      price =
        Number(
          candle?.close,
        );

      if (
        Number.isFinite(
          price,
        ) &&
        price >
          0
      ) {
        const indicators =
          calculateAllIndicators(
            history,
          );

        signal =
          calculateTradingSignal({
            price,

            candles:
              history,

            indicators,
          });
      }
    }

    if (
      !Number.isFinite(
        price,
      ) ||
      price <=
        0 ||
      !signal
    ) {
      continue;
    }

    if (position) {
      const returnPercent =
        (
          (
            price -
            position
              .entryPrice
          ) /
          position
            .entryPrice
        ) *
        100;

      const stopTriggered =
        returnPercent <=
        -Math.abs(
          Number(
            stopLossPercent,
          ),
        );

      const takeProfitTriggered =
        returnPercent >=
        Math.abs(
          Number(
            takeProfitPercent,
          ),
        );

      const sellSignal =
        signal.action ===
          "SELL" &&
        Number(
          signal.totalScore,
        ) <=
          -Math.abs(
            Number(
              minimumScore,
            ),
          ) &&
        signal.confidence >=
          Number(
            minimumConfidence,
          );

      if (
        stopTriggered ||
        takeProfitTriggered ||
        sellSignal
      ) {
        const grossProceeds =
          position.quantity *
          price;

        const exitFee =
          grossProceeds *
          feeRate;

        const netProceeds =
          grossProceeds -
          exitFee;

        cash +=
          netProceeds;

        totalFees +=
          exitFee;

        const profit =
          netProceeds -
          position
            .entryValue -
          position
            .entryFee;

        const tradeReturn =
          position
            .entryValue >
          0
            ? (
                profit /
                position
                  .entryValue
              ) *
              100
            : 0;

        const reason =
          stopTriggered
            ? "STOP_LOSS"
            : takeProfitTriggered
              ? "TAKE_PROFIT"
              : "SELL_SIGNAL";

        const closedTrade = {
          entryTime:
            position
              .entryTime,

          exitTime:
            candle.time,

          entryPrice:
            position
              .entryPrice,

          exitPrice:
            price,

          quantity:
            position
              .quantity,

          entryValue:
            position
              .entryValue,

          exitValue:
            grossProceeds,

          entryFee:
            position
              .entryFee,

          exitFee,

          totalFees:
            position
              .entryFee +
            exitFee,

          profit,

          returnPercent:
            tradeReturn,

          exitReason:
            reason,

          entryConfidence:
            position
              .entryConfidence,

          entryScore:
            position
              .entryScore,

          exitConfidence:
            signal
              .confidence,

          exitScore:
            signal
              .totalScore,
        };

        closedTrades.push(
          closedTrade,
        );

        orders.push({
          side:
            "SELL",

          time:
            candle.time,

          price,

          quantity:
            position
              .quantity,

          fee:
            exitFee,

          confidence:
            signal
              .confidence,

          score:
            signal
              .totalScore,

          reason,

          realizedProfit:
            profit,
        });

        position =
          null;
      }
    }

    if (
      !position &&
      signal.action ===
        "BUY" &&
      Number(
        signal.totalScore,
      ) >=
        Math.abs(
          Number(
            minimumScore,
          ),
        ) &&
      signal.confidence >=
        Number(
          minimumConfidence,
        )
    ) {
      const availableAmount =
        Math.min(
          Number(
            buyAmount,
          ),

          cash /
            (
              1 +
              feeRate
            ),
        );

      if (
        availableAmount >
        0
      ) {
        const quantity =
          availableAmount /
          price;

        const entryFee =
          availableAmount *
          feeRate;

        cash -=
          availableAmount +
          entryFee;

        totalFees +=
          entryFee;

        position = {
          entryTime:
            candle.time,

          entryPrice:
            price,

          quantity,

          entryValue:
            availableAmount,

          entryFee,

          entryConfidence:
            signal
              .confidence,

          entryScore:
            signal
              .totalScore,
        };

        orders.push({
          side:
            "BUY",

          time:
            candle.time,

          price,

          quantity,

          fee:
            entryFee,

          confidence:
            signal
              .confidence,

          score:
            signal
              .totalScore,

          reason:
            "BUY_SIGNAL",
        });
      }
    }

    const openPositionValue =
      position
        ? position
            .quantity *
          price
        : 0;

    equityCurve.push({
      time:
        candle.time,

      equity:
        cash +
        openPositionValue,
    });
  }

  const finalCandle =
    candles[
      candles.length -
        1
    ];

  const finalPrice =
    Number(
      finalCandle?.close,
    );

  /*
   * Walk-forward windows must end flat.
   *
   * Otherwise one test window could finish
   * with an unrealized position that cannot
   * be carried safely into the next window
   * after parameters are re-optimized.
   *
   * Normal backtests keep their historical
   * behavior because this option defaults
   * to false.
   */
  if (
    closeOpenPositionAtEnd &&
    position &&
    Number.isFinite(
      finalPrice,
    ) &&
    finalPrice >
      0
  ) {
    const grossProceeds =
      position.quantity *
      finalPrice;

    const exitFee =
      grossProceeds *
      feeRate;

    const netProceeds =
      grossProceeds -
      exitFee;

    cash +=
      netProceeds;

    totalFees +=
      exitFee;

    const profit =
      netProceeds -
      position.entryValue -
      position.entryFee;

    const tradeReturn =
      position.entryValue >
      0
        ? (
            profit /
            position.entryValue
          ) *
          100
        : 0;

    const closedTrade = {
      entryTime:
        position.entryTime,

      exitTime:
        finalCandle.time,

      entryPrice:
        position.entryPrice,

      exitPrice:
        finalPrice,

      quantity:
        position.quantity,

      entryValue:
        position.entryValue,

      exitValue:
        grossProceeds,

      entryFee:
        position.entryFee,

      exitFee,

      totalFees:
        position.entryFee +
        exitFee,

      profit,

      returnPercent:
        tradeReturn,

      exitReason:
        "WINDOW_END",

      entryConfidence:
        position.entryConfidence,

      entryScore:
        position.entryScore,

      exitConfidence:
        null,

      exitScore:
        null,
    };

    closedTrades.push(
      closedTrade,
    );

    orders.push({
      side:
        "SELL",

      time:
        finalCandle.time,

      price:
        finalPrice,

      quantity:
        position.quantity,

      fee:
        exitFee,

      confidence:
        null,

      score:
        null,

      reason:
        "WINDOW_END",

      realizedProfit:
        profit,
    });

    position =
      null;

    /*
     * Replace the final marked-to-market point
     * with the fully realized post-fee equity.
     */
    if (
      equityCurve.length >
      0
    ) {
      equityCurve[
        equityCurve.length -
          1
      ] = {
        time:
          finalCandle.time,

        equity:
          cash,
      };
    }
  }
    const openPositionValue =
    position &&
    Number.isFinite(
      finalPrice,
    )
      ? position.quantity *
        finalPrice
      : 0;

  const endingEquity =
    cash +
    openPositionValue;

  const totalProfit =
    endingEquity -
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

  const winningTrades =
    closedTrades.filter(
      (
        trade,
      ) =>
        trade.profit >
        0,
    );

  const losingTrades =
    closedTrades.filter(
      (
        trade,
      ) =>
        trade.profit <
        0,
    );

  const winRate =
    closedTrades.length >
    0
      ? (
          winningTrades.length /
          closedTrades.length
        ) *
        100
      : 0;

  const grossProfit =
    winningTrades.reduce(
      (
        total,
        trade,
      ) =>
        total +
        trade.profit,
      0,
    );

  const grossLoss =
    Math.abs(
      losingTrades.reduce(
        (
          total,
          trade,
        ) =>
          total +
          trade.profit,
        0,
      ),
    );

  const maximumDrawdown =
    calculateMaximumDrawdown(
      equityCurve,
    );

  return {
    symbol,
    timeframe,

    candleCount:
      candles.length,

    settings: {
      startingCash,
      buyAmount,
      feeRate,
      minimumScore,
      minimumConfidence,
      stopLossPercent,
      takeProfitPercent,
      minimumHistory,
      closeOpenPositionAtEnd,
    },

    startingCash,

    endingCash:
      cash,

    endingEquity,

    totalProfit,

    totalReturnPercent,

    totalFees,

    closedTradeCount:
      closedTrades.length,

    orderCount:
      orders.length,

    wins:
      winningTrades.length,

    losses:
      losingTrades.length,

    winRate,

    grossProfit,

    grossLoss,

    profitFactor:
      calculateProfitFactor(
        closedTrades,
      ),

    averageTrade:
      closedTrades.length >
      0
        ? closedTrades.reduce(
            (
              total,
              trade,
            ) =>
              total +
              trade.profit,
            0,
          ) /
          closedTrades.length
        : 0,

    maximumDrawdownAmount:
      maximumDrawdown.amount,

    maximumDrawdownPercent:
      maximumDrawdown.percent,

    openPosition:
      position,

    orders,

    closedTrades,

    equityCurve,

    completedAt:
      Date.now(),
  };
}

export async function runAndSaveBacktest(
  settings,
) {
  const candles =
    await fetchHistoricalCandles(
      settings,
    );

  const result =
    runStrategyBacktest({
      ...settings,
      candles,
    });

  const id =
    crypto.randomUUID();

  const createdAt =
    Date.now();

  const storedOrders =
    result.orders.slice(
      -200,
    );

  const storedClosedTrades =
    result.closedTrades.slice(
      -200,
    );

  const storedEquityCurve =
    result.equityCurve.filter(
      (
        _,
        index,
      ) =>
        index %
          5 ===
          0 ||
        index ===
          result.equityCurve.length -
            1,
    );

  database
    .prepare(
      `
        INSERT INTO backtests (
          id,
          symbol,
          timeframe,
          candle_count,

          starting_cash,
          ending_cash,
          ending_equity,
          total_profit,
          total_return_percent,
          total_fees,

          closed_trade_count,
          order_count,
          wins,
          losses,
          win_rate,
          gross_profit,
          gross_loss,

          profit_factor,
          average_trade,

          maximum_drawdown_amount,
          maximum_drawdown_percent,

          settings_json,
          open_position_json,
          orders_json,
          closed_trades_json,
          equity_curve_json,

          completed_at,
          created_at
        )
        VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?,
          ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?
        )
      `,
    )
    .run(
      id,

      result.symbol,

      result.timeframe,

      result.candleCount,

      result.startingCash,

      result.endingCash,

      result.endingEquity,

      result.totalProfit,

      result.totalReturnPercent,

      result.totalFees,

      result.closedTradeCount,

      result.orderCount,

      result.wins,

      result.losses,

      result.winRate,

      result.grossProfit,

      result.grossLoss,

      result.profitFactor,

      result.averageTrade,

      result.maximumDrawdownAmount,

      result.maximumDrawdownPercent,

      JSON.stringify(
        result.settings,
      ),

      result.openPosition
        ? JSON.stringify(
            result.openPosition,
          )
        : null,

      JSON.stringify(
        storedOrders,
      ),

      JSON.stringify(
        storedClosedTrades,
      ),

      JSON.stringify(
        storedEquityCurve,
      ),

      result.completedAt,

      createdAt,
    );

  return {
    id,

    ...result,

    createdAt,
  };
}

function uniqueNumbers(
  values,
  {
    minimum = 0,
    maximum = Infinity,
    decimals = 8,
  } = {},
) {
  const unique =
    new Set();

  for (
    const value of
    values
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
      continue;
    }

    const bounded =
      Math.min(
        Math.max(
          number,
          minimum,
        ),
        maximum,
      );

    unique.add(
      Number(
        bounded.toFixed(
          decimals,
        ),
      ),
    );
  }

  return [
    ...unique,
  ];
}

function normalizeParameterGrid({
  minimumScore,
  minimumConfidence,
  stopLossPercent,
  takeProfitPercent,
  parameterGrid,
}) {
  /*
   * Keep the default optimization grid
   * deliberately compact.
   *
   * The signal cache removes the most
   * expensive repeated indicator work,
   * but every candidate still performs
   * a complete portfolio simulation.
   */
  const minimumScores =
    uniqueNumbers(
      Array.isArray(
        parameterGrid
          ?.minimumScore,
      )
        ? parameterGrid.minimumScore
        : [
            minimumScore,
            Number(
              minimumScore,
            ) +
              10,
          ],
      {
        minimum:
          0,

        maximum:
          100,

        decimals:
          2,
      },
    );

  const minimumConfidences =
    uniqueNumbers(
      Array.isArray(
        parameterGrid
          ?.minimumConfidence,
      )
        ? parameterGrid.minimumConfidence
        : [
            minimumConfidence,
            Number(
              minimumConfidence,
            ) +
              10,
          ],
      {
        minimum:
          0,

        maximum:
          100,

        decimals:
          2,
      },
    );

  const stopLossPercents =
    uniqueNumbers(
      Array.isArray(
        parameterGrid
          ?.stopLossPercent,
      )
        ? parameterGrid.stopLossPercent
        : [
            Math.max(
              Number(
                stopLossPercent,
              ) -
                0.5,
              0.1,
            ),

            stopLossPercent,

            Number(
              stopLossPercent,
            ) +
              0.5,
          ],
      {
        minimum:
          0.1,

        maximum:
          100,

        decimals:
          4,
      },
    );

  const takeProfitPercents =
    uniqueNumbers(
      Array.isArray(
        parameterGrid
          ?.takeProfitPercent,
      )
        ? parameterGrid.takeProfitPercent
        : [
            Math.max(
              Number(
                takeProfitPercent,
              ) -
                1,
              0.1,
            ),

            takeProfitPercent,

            Number(
              takeProfitPercent,
            ) +
              1,
          ],
      {
        minimum:
          0.1,

        maximum:
          1000,

        decimals:
          4,
      },
    );

  const candidates =
    [];

  for (
    const candidateMinimumScore
    of minimumScores
  ) {
    for (
      const candidateMinimumConfidence
      of minimumConfidences
    ) {
      for (
        const candidateStopLossPercent
        of stopLossPercents
      ) {
        for (
          const candidateTakeProfitPercent
          of takeProfitPercents
        ) {
          candidates.push({
            minimumScore:
              candidateMinimumScore,

            minimumConfidence:
              candidateMinimumConfidence,

            stopLossPercent:
              candidateStopLossPercent,

            takeProfitPercent:
              candidateTakeProfitPercent,
          });
        }
      }
    }
  }

  return {
    minimumScore:
      minimumScores,

    minimumConfidence:
      minimumConfidences,

    stopLossPercent:
      stopLossPercents,

    takeProfitPercent:
      takeProfitPercents,

    candidates,
  };
}

function scoreTrainingResult(
  result,
) {
  if (
    !result ||
    result.closedTradeCount <=
      0
  ) {
    return Number
      .NEGATIVE_INFINITY;
  }

  /*
   * Training optimization objective.
   *
   * Reward:
   * - return
   * - profit factor
   * - larger closed-trade samples
   *
   * Penalize:
   * - drawdown
   *
   * This score is used ONLY inside the
   * training window. The following test
   * window remains completely unseen.
   */
  const profitFactorContribution =
    result.profitFactor ===
    null
      ? 6
      : Math.min(
          Math.max(
            Number(
              result.profitFactor,
            ) ||
              0,
            0,
          ),
          3,
        ) *
        2;

  const sampleContribution =
    Math.min(
      Number(
        result.closedTradeCount,
      ) ||
        0,
      20,
    ) *
    0.05;

  return (
    Number(
      result.totalReturnPercent,
    ) +
    profitFactorContribution +
    sampleContribution -
    (
      Number(
        result.maximumDrawdownPercent,
      ) ||
      0
    ) *
      0.5
  );
}

/*
 * =========================================================
 * TRAINING WINDOW OPTIMIZATION
 * =========================================================
 *
 * IMPORTANT PERFORMANCE CHANGE:
 *
 * The signal stream is calculated ONCE for
 * this training window.
 *
 * Every parameter candidate then reuses the
 * exact same signal stream.
 *
 * Previously each candidate independently
 * recalculated indicators and signals for
 * every candle. With the default 36-candidate
 * grid that repeated the expensive work
 * dozens of times.
 */
export function optimizeTrainingWindow({
  candles,
  symbol,
  timeframe,
  startingCash,
  buyAmount,
  feeRate,
  minimumHistory,
  minimumScore,
  minimumConfidence,
  stopLossPercent,
  takeProfitPercent,
  parameterGrid = null,
}) {
  const grid =
    normalizeParameterGrid({
      minimumScore,
      minimumConfidence,
      stopLossPercent,
      takeProfitPercent,
      parameterGrid,
    });

  const trainingSignalCache =
    buildSignalCache({
      candles,

      minimumHistory,
    });

  let best =
    null;

  const candidateSummaries =
    [];

  for (
    const candidate of
    grid.candidates
  ) {
    const result =
      runStrategyBacktest({
        candles,
        symbol,
        timeframe,
        startingCash,
        buyAmount,
        feeRate,
        minimumHistory,

        ...candidate,

        closeOpenPositionAtEnd:
          true,

        /*
         * This is the optimization:
         * reuse the precomputed signal stream.
         */
        signalCache:
          trainingSignalCache,
      });

    const optimizationScore =
      scoreTrainingResult(
        result,
      );

    const candidateSummary = {
      settings: {
        ...candidate,
      },

      optimizationScore:
        Number.isFinite(
          optimizationScore,
        )
          ? optimizationScore
          : null,

      totalProfit:
        result.totalProfit,

      totalReturnPercent:
        result.totalReturnPercent,

      closedTradeCount:
        result.closedTradeCount,

      winRate:
        result.winRate,

      profitFactor:
        result.profitFactor,

      maximumDrawdownPercent:
        result.maximumDrawdownPercent,
    };

    candidateSummaries.push(
      candidateSummary,
    );

    if (
      !best ||
      optimizationScore >
        best.optimizationScore
    ) {
      best = {
        settings: {
          ...candidate,
        },

        optimizationScore,

        result,
      };
    }
  }

  /*
   * Every candidate can theoretically produce
   * zero closed trades.
   *
   * Fall back to the caller's original
   * settings rather than failing the entire
   * walk-forward test.
   */
  if (
    !best ||
    !Number.isFinite(
      best.optimizationScore,
    )
  ) {
    const fallbackSettings = {
      minimumScore:
        Math.abs(
          Number(
            minimumScore,
          ) ||
            60,
        ),

      minimumConfidence:
        Math.abs(
          Number(
            minimumConfidence,
          ) ||
            60,
        ),

      stopLossPercent:
        Math.max(
          Number(
            stopLossPercent,
          ) ||
            2,
          0.1,
        ),

      takeProfitPercent:
        Math.max(
          Number(
            takeProfitPercent,
          ) ||
            4,
          0.1,
        ),
    };

    const fallbackResult =
      runStrategyBacktest({
        candles,
        symbol,
        timeframe,
        startingCash,
        buyAmount,
        feeRate,
        minimumHistory,

        ...fallbackSettings,

        closeOpenPositionAtEnd:
          true,

        /*
         * Reuse the same cache for the
         * fallback simulation too.
         */
        signalCache:
          trainingSignalCache,
      });

    best = {
      settings:
        fallbackSettings,

      optimizationScore:
        scoreTrainingResult(
          fallbackResult,
        ),

      result:
        fallbackResult,
    };
  }

  return {
    selectedSettings: {
      ...best.settings,
    },

    optimizationScore:
      Number.isFinite(
        best.optimizationScore,
      )
        ? best.optimizationScore
        : null,

    trainingResult:
      best.result,

    candidateCount:
      grid.candidates.length,

    parameterGrid: {
      minimumScore:
        grid.minimumScore,

      minimumConfidence:
        grid.minimumConfidence,

      stopLossPercent:
        grid.stopLossPercent,

      takeProfitPercent:
        grid.takeProfitPercent,
    },

    /*
     * Store summaries rather than every full
     * candidate backtest to keep the response
     * and SQLite payload manageable.
     */
    candidates:
      candidateSummaries,
  };
}

export function runWalkForwardTest({
  candles,
  symbol,
  timeframe,
  startingCash = 10000,
  buyAmount = 500,
  feeRate = 0.001,
  minimumScore = 60,
  minimumConfidence = 60,
  stopLossPercent = 2,
  takeProfitPercent = 4,
  minimumHistory = 210,
  trainingWindow = 500,
  testingWindow = 150,
  stepSize = null,
  parameterGrid = null,
}) {
  if (
    !Array.isArray(
      candles,
    )
  ) {
    throw new Error(
      "Walk-forward testing requires historical candles.",
    );
  }

  const safeMinimumHistory =
    Math.max(
      Math.floor(
        Number(
          minimumHistory,
        ) ||
          210,
      ),
      20,
    );

  const safeTrainingWindow =
    Math.max(
      Math.floor(
        Number(
          trainingWindow,
        ) ||
          500,
      ),
      safeMinimumHistory +
        25,
    );

  const safeTestingWindow =
    Math.max(
      Math.floor(
        Number(
          testingWindow,
        ) ||
          150,
      ),
      10,
    );

  const safeStepSize =
    Math.max(
      Math.floor(
        Number(
          stepSize,
        ) ||
          safeTestingWindow,
      ),
      1,
    );

  const requiredCandles =
    safeTrainingWindow +
    safeTestingWindow;

  if (
    candles.length <
    requiredCandles
  ) {
    throw new Error(
      `Walk-forward testing requires at least ${requiredCandles} candles for the configured training and testing windows.`,
    );
  }

  const windows =
    [];

  const allOrders =
    [];

  const allClosedTrades =
    [];

  const outOfSampleEquityCurve =
    [];

  let currentCapital =
    Number(
      startingCash,
    );

  let windowIndex =
    0;

  for (
    let trainingStart =
      0;

    trainingStart +
      safeTrainingWindow +
      safeTestingWindow <=
    candles.length;

    trainingStart +=
      safeStepSize
  ) {
    const trainingEnd =
      trainingStart +
      safeTrainingWindow;

    const testingStart =
      trainingEnd;

    const testingEnd =
      testingStart +
      safeTestingWindow;

    const trainingCandles =
      candles.slice(
        trainingStart,
        trainingEnd,
      );

    /*
     * The test run receives warm-up candles
     * from the END of the training period.
     *
     * These warm-up candles are used only for
     * indicator calculation.
     *
     * Trading decisions begin at testingStart.
     */
    const warmupStart =
      Math.max(
        testingStart -
          safeMinimumHistory,
        trainingStart,
      );

    const testWithWarmup =
      candles.slice(
        warmupStart,
        testingEnd,
      );

    const testMinimumHistory =
      testingStart -
      warmupStart;

    if (
      testMinimumHistory <
      safeMinimumHistory
    ) {
      continue;
    }

    /*
     * Optimize parameters using ONLY the
     * training window.
     *
     * optimizeTrainingWindow() now builds one
     * signal cache and reuses it across all
     * candidate parameter simulations.
     */
    const optimization =
      optimizeTrainingWindow({
        candles:
          trainingCandles,

        symbol,
        timeframe,

        startingCash:
          currentCapital,

        buyAmount,
        feeRate,

        minimumHistory:
          safeMinimumHistory,

        minimumScore,
        minimumConfidence,
        stopLossPercent,
        takeProfitPercent,

        parameterGrid,
      });

    /*
     * Build the out-of-sample signal stream
     * exactly once.
     *
     * The selected training parameters are
     * then applied to this unseen test data.
     */
    const testingSignalCache =
      buildSignalCache({
        candles:
          testWithWarmup,

        minimumHistory:
          testMinimumHistory,
      });

    const testResult =
      runStrategyBacktest({
        candles:
          testWithWarmup,

        symbol,
        timeframe,

        startingCash:
          currentCapital,

        buyAmount,
        feeRate,

        minimumHistory:
          testMinimumHistory,

        ...optimization
          .selectedSettings,

        closeOpenPositionAtEnd:
          true,

        signalCache:
          testingSignalCache,
      });

    const trainingResult =
      optimization
        .trainingResult;

    const returnDegradationPercent =
      Number(
        trainingResult
          .totalReturnPercent,
      ) -
      Number(
        testResult
          .totalReturnPercent,
      );

    const window = {
      index:
        windowIndex,

      training: {
        startIndex:
          trainingStart,

        endIndex:
          trainingEnd -
          1,

        startTime:
          trainingCandles[0]
            ?.time ||
          null,

        endTime:
          trainingCandles[
            trainingCandles.length -
              1
          ]?.time ||
          null,

        candleCount:
          trainingCandles.length,

        totalProfit:
          trainingResult
            .totalProfit,

        totalReturnPercent:
          trainingResult
            .totalReturnPercent,

        closedTradeCount:
          trainingResult
            .closedTradeCount,

        winRate:
          trainingResult
            .winRate,

        profitFactor:
          trainingResult
            .profitFactor,

        maximumDrawdownPercent:
          trainingResult
            .maximumDrawdownPercent,

        optimizationScore:
          optimization
            .optimizationScore,
      },

      testing: {
        startIndex:
          testingStart,

        endIndex:
          testingEnd -
          1,

        startTime:
          candles[
            testingStart
          ]?.time ||
          null,

        endTime:
          candles[
            testingEnd -
              1
          ]?.time ||
          null,

        candleCount:
          safeTestingWindow,

        startingCash:
          testResult
            .startingCash,

        endingEquity:
          testResult
            .endingEquity,

        totalProfit:
          testResult
            .totalProfit,

        totalReturnPercent:
          testResult
            .totalReturnPercent,

        totalFees:
          testResult
            .totalFees,

        closedTradeCount:
          testResult
            .closedTradeCount,

        orderCount:
          testResult
            .orderCount,

        wins:
          testResult.wins,

        losses:
          testResult.losses,

        winRate:
          testResult.winRate,

        profitFactor:
          testResult
            .profitFactor,

        averageTrade:
          testResult
            .averageTrade,

        maximumDrawdownAmount:
          testResult
            .maximumDrawdownAmount,

        maximumDrawdownPercent:
          testResult
            .maximumDrawdownPercent,
      },

      selectedSettings: {
        ...optimization
          .selectedSettings,
      },

      candidateCount:
        optimization
          .candidateCount,

      returnDegradationPercent,
    };

    windows.push(
      window,
    );

    for (
      const order of
      testResult.orders
    ) {
      allOrders.push({
        ...order,

        walkForwardWindow:
          windowIndex,
      });
    }

    for (
      const trade of
      testResult.closedTrades
    ) {
      allClosedTrades.push({
        ...trade,

        walkForwardWindow:
          windowIndex,
      });
    }

    for (
      const point of
      testResult.equityCurve
    ) {
      outOfSampleEquityCurve.push({
        ...point,

        walkForwardWindow:
          windowIndex,
      });
    }

    currentCapital =
      testResult
        .endingEquity;

    windowIndex +=
      1;
  }

  if (
    windows.length ===
    0
  ) {
    throw new Error(
      "No complete walk-forward windows could be created.",
    );
  }

  const winningTrades =
    allClosedTrades.filter(
      (
        trade,
      ) =>
        Number(
          trade.profit,
        ) >
        0,
    );

  const losingTrades =
    allClosedTrades.filter(
      (
        trade,
      ) =>
        Number(
          trade.profit,
        ) <
        0,
    );

  const grossProfit =
    winningTrades.reduce(
      (
        total,
        trade,
      ) =>
        total +
        Number(
          trade.profit,
        ),
      0,
    );

  const grossLoss =
    Math.abs(
      losingTrades.reduce(
        (
          total,
          trade,
        ) =>
          total +
          Number(
            trade.profit,
          ),
        0,
      ),
    );

  const totalFees =
    windows.reduce(
      (
        total,
        window,
      ) =>
        total +
        Number(
          window.testing
            .totalFees,
        ),
      0,
    );

  const profitableWindows =
    windows.filter(
      (
        window,
      ) =>
        Number(
          window.testing
            .totalProfit,
        ) >
        0,
    ).length;

  const losingWindows =
    windows.filter(
      (
        window,
      ) =>
        Number(
          window.testing
            .totalProfit,
        ) <
        0,
    ).length;

  const breakEvenWindows =
    windows.length -
    profitableWindows -
    losingWindows;

  const totalProfit =
    currentCapital -
    Number(
      startingCash,
    );

  const totalReturnPercent =
    Number(
      startingCash,
    ) >
    0
      ? (
          totalProfit /
          Number(
            startingCash,
          )
        ) *
        100
      : 0;

  const winRate =
    allClosedTrades.length >
    0
      ? (
          winningTrades.length /
          allClosedTrades.length
        ) *
        100
      : 0;

  const maximumDrawdown =
    calculateMaximumDrawdown(
      outOfSampleEquityCurve,
    );

  const averageTrainingReturnPercent =
    windows.reduce(
      (
        total,
        window,
      ) =>
        total +
        Number(
          window.training
            .totalReturnPercent,
        ),
      0,
    ) /
    windows.length;

  const averageTestingReturnPercent =
    windows.reduce(
      (
        total,
        window,
      ) =>
        total +
        Number(
          window.testing
            .totalReturnPercent,
        ),
      0,
    ) /
    windows.length;

  const averageReturnDegradationPercent =
    windows.reduce(
      (
        total,
        window,
      ) =>
        total +
        Number(
          window
            .returnDegradationPercent,
        ),
      0,
    ) /
    windows.length;

  const completedAt =
    Date.now();

  return {
    symbol,
    timeframe,

    candleCount:
      candles.length,

    settings: {
      startingCash,
      buyAmount,
      feeRate,
      minimumScore,
      minimumConfidence,
      stopLossPercent,
      takeProfitPercent,

      minimumHistory:
        safeMinimumHistory,

      trainingWindow:
        safeTrainingWindow,

      testingWindow:
        safeTestingWindow,

      stepSize:
        safeStepSize,

      parameterGrid:
        normalizeParameterGrid({
          minimumScore,
          minimumConfidence,
          stopLossPercent,
          takeProfitPercent,
          parameterGrid,
        }),
    },

    methodology: {
      type:
        "ROLLING_WALK_FORWARD",

      optimization:
        "TRAIN_ONLY",

      performanceScope:
        "OUT_OF_SAMPLE_TEST_WINDOWS_ONLY",

      warmup:
        "PRECEDING_TRAINING_CANDLES",

      positionHandling:
        "FORCE_FLAT_AT_WINDOW_END",

      signalCaching:
        "ENABLED",
    },

    trainingWindow:
      safeTrainingWindow,

    testingWindow:
      safeTestingWindow,

    stepSize:
      safeStepSize,

    windowCount:
      windows.length,

    profitableWindows,

    losingWindows,

    breakEvenWindows,

    profitableWindowRate:
      (
        profitableWindows /
        windows.length
      ) *
      100,

    startingCash:
      Number(
        startingCash,
      ),

    endingEquity:
      currentCapital,

    totalProfit,

    totalReturnPercent,

    totalFees,

    closedTradeCount:
      allClosedTrades.length,

    orderCount:
      allOrders.length,

    wins:
      winningTrades.length,

    losses:
      losingTrades.length,

    winRate,

    grossProfit,

    grossLoss,

    profitFactor:
      calculateProfitFactor(
        allClosedTrades,
      ),

    averageTrade:
      allClosedTrades.length >
      0
        ? allClosedTrades.reduce(
            (
              total,
              trade,
            ) =>
              total +
              Number(
                trade.profit,
              ),
            0,
          ) /
          allClosedTrades.length
        : 0,

    outOfSampleExpectancy:
      allClosedTrades.length >
      0
        ? totalProfit /
          allClosedTrades.length
        : 0,

    maximumDrawdownAmount:
      maximumDrawdown
        .amount,

    maximumDrawdownPercent:
      maximumDrawdown
        .percent,

    averageTrainingReturnPercent,

    averageTestingReturnPercent,

    averageReturnDegradationPercent,

    windows,

    orders:
      allOrders,

    closedTrades:
      allClosedTrades,

    equityCurve:
      outOfSampleEquityCurve,

    completedAt,
  };
}

export async function runAndSaveWalkForwardTest(
  settings,
) {
  const candles =
    await fetchHistoricalCandles({
      ...settings,

      /*
       * Walk-forward testing benefits from
       * more history than a normal backtest.
       */
      limit:
        Number(
          settings?.limit,
        ) ||
        3000,
    });

  const result =
    runWalkForwardTest({
      ...settings,
      candles,
    });

  const id =
    crypto.randomUUID();

  const createdAt =
    Date.now();

  /*
   * Keep enough detail for diagnostics without
   * allowing one test to create an enormous
   * SQLite row.
   */
  const storedWindows =
    result.windows.slice(
      -100,
    );

  const storedClosedTrades =
    result.closedTrades.slice(
      -500,
    );

  const storedEquityCurve =
    result.equityCurve.filter(
      (
        _,
        index,
      ) =>
        index %
          5 ===
          0 ||
        index ===
          result
            .equityCurve
            .length -
            1,
    );

  database
    .prepare(
      `
        INSERT INTO walk_forward_tests (
          id,
          symbol,
          timeframe,
          candle_count,

          training_window,
          testing_window,
          step_size,
          window_count,

          starting_cash,
          ending_equity,
          total_profit,
          total_return_percent,
          total_fees,

          closed_trade_count,
          order_count,
          wins,
          losses,
          win_rate,
          gross_profit,
          gross_loss,
          profit_factor,
          average_trade,

          maximum_drawdown_amount,
          maximum_drawdown_percent,

          profitable_windows,
          losing_windows,
          break_even_windows,
          profitable_window_rate,
          average_training_return_percent,
          average_testing_return_percent,
          average_return_degradation_percent,

          settings_json,
          windows_json,
          closed_trades_json,
          equity_curve_json,

          completed_at,
          created_at
        )
        VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?
        )
      `,
    )

        .run(
      id,

      result.symbol,

      result.timeframe,

      result.candleCount,

      result.trainingWindow,

      result.testingWindow,

      result.stepSize,

      result.windowCount,

      result.startingCash,

      result.endingEquity,

      result.totalProfit,

      result
        .totalReturnPercent,

      result.totalFees,

      result
        .closedTradeCount,

      result.orderCount,

      result.wins,

      result.losses,

      result.winRate,

      result.grossProfit,

      result.grossLoss,

      result.profitFactor,

      result.averageTrade,

      result
        .maximumDrawdownAmount,

      result
        .maximumDrawdownPercent,

      result
        .profitableWindows,

      result
        .losingWindows,

      result
        .breakEvenWindows,

      result
        .profitableWindowRate,

      result
        .averageTrainingReturnPercent,

      result
        .averageTestingReturnPercent,

      result
        .averageReturnDegradationPercent,

      JSON.stringify(
        result.settings,
      ),

      JSON.stringify(
        storedWindows,
      ),

      JSON.stringify(
        storedClosedTrades,
      ),

      JSON.stringify(
        storedEquityCurve,
      ),

      result.completedAt,

      createdAt,
    );

  return {
    id,

    ...result,

    createdAt,
  };
}

export async function getRecentWalkForwardTests(
  limit = 10,
) {
  const safeLimit =
    Math.min(
      Math.max(
        Number(
          limit,
        ) ||
          10,
        1,
      ),
      50,
    );

  const rows =
    database
      .prepare(
        `
          SELECT *
          FROM walk_forward_tests
          ORDER BY created_at DESC
          LIMIT ?
        `,
      )
      .all(
        safeLimit,
      );

  return rows.map(
    (
      row,
    ) => ({
      id:
        row.id,

      symbol:
        row.symbol,

      timeframe:
        row.timeframe,

      candleCount:
        Number(
          row.candle_count,
        ),

      trainingWindow:
        Number(
          row.training_window,
        ),

      testingWindow:
        Number(
          row.testing_window,
        ),

      stepSize:
        Number(
          row.step_size,
        ),

      windowCount:
        Number(
          row.window_count,
        ),

      startingCash:
        Number(
          row.starting_cash,
        ),

      endingEquity:
        Number(
          row.ending_equity,
        ),

      totalProfit:
        Number(
          row.total_profit,
        ),

      totalReturnPercent:
        Number(
          row
            .total_return_percent,
        ),

      totalFees:
        Number(
          row.total_fees,
        ),

      closedTradeCount:
        Number(
          row
            .closed_trade_count,
        ),

      orderCount:
        Number(
          row.order_count,
        ),

      wins:
        Number(
          row.wins,
        ),

      losses:
        Number(
          row.losses,
        ),

      winRate:
        Number(
          row.win_rate,
        ),

      grossProfit:
        Number(
          row.gross_profit,
        ),

      grossLoss:
        Number(
          row.gross_loss,
        ),

      profitFactor:
        row.profit_factor ===
        null
          ? null
          : Number(
              row.profit_factor,
            ),

      averageTrade:
        Number(
          row.average_trade,
        ),

      maximumDrawdownAmount:
        Number(
          row
            .maximum_drawdown_amount,
        ),

      maximumDrawdownPercent:
        Number(
          row
            .maximum_drawdown_percent,
        ),

      profitableWindows:
        Number(
          row
            .profitable_windows,
        ),

      losingWindows:
        Number(
          row.losing_windows,
        ),

      breakEvenWindows:
        Number(
          row
            .break_even_windows,
        ),

      profitableWindowRate:
        Number(
          row
            .profitable_window_rate,
        ),

      averageTrainingReturnPercent:
        Number(
          row
            .average_training_return_percent,
        ),

      averageTestingReturnPercent:
        Number(
          row
            .average_testing_return_percent,
        ),

      averageReturnDegradationPercent:
        Number(
          row
            .average_return_degradation_percent,
        ),

      settings:
        parseJson(
          row.settings_json,
          {},
        ),

      windows:
        parseJson(
          row.windows_json,
          [],
        ),

      closedTrades:
        parseJson(
          row
            .closed_trades_json,
          [],
        ),

      equityCurve:
        parseJson(
          row
            .equity_curve_json,
          [],
        ),

      completedAt:
        Number(
          row.completed_at,
        ),

      createdAt:
        Number(
          row.created_at,
        ),
    }),
  );
}

export async function getRecentBacktests(
  limit = 10,
) {
  const safeLimit =
    Math.min(
      Math.max(
        Number(
          limit,
        ) ||
          10,
        1,
      ),
      50,
    );

  const rows =
    database
      .prepare(
        `
          SELECT *
          FROM backtests
          ORDER BY created_at DESC
          LIMIT ?
        `,
      )
      .all(
        safeLimit,
      );

  return rows.map(
    (
      row,
    ) => ({
      id:
        row.id,

      symbol:
        row.symbol,

      timeframe:
        row.timeframe,

      candleCount:
        Number(
          row.candle_count,
        ),

      settings:
        parseJson(
          row.settings_json,
          {},
        ),

      startingCash:
        Number(
          row.starting_cash,
        ),

      endingCash:
        Number(
          row.ending_cash,
        ),

      endingEquity:
        Number(
          row.ending_equity,
        ),

      totalProfit:
        Number(
          row.total_profit,
        ),

      totalReturnPercent:
        Number(
          row
            .total_return_percent,
        ),

      totalFees:
        Number(
          row.total_fees,
        ),

      closedTradeCount:
        Number(
          row
            .closed_trade_count,
        ),

      orderCount:
        Number(
          row.order_count,
        ),

      wins:
        Number(
          row.wins,
        ),

      losses:
        Number(
          row.losses,
        ),

      winRate:
        Number(
          row.win_rate,
        ),

      grossProfit:
        Number(
          row.gross_profit,
        ),

      grossLoss:
        Number(
          row.gross_loss,
        ),

      profitFactor:
        row.profit_factor ===
        null
          ? null
          : Number(
              row.profit_factor,
            ),

      averageTrade:
        Number(
          row.average_trade,
        ),

      maximumDrawdownAmount:
        Number(
          row
            .maximum_drawdown_amount,
        ),

      maximumDrawdownPercent:
        Number(
          row
            .maximum_drawdown_percent,
        ),

      openPosition:
        parseJson(
          row
            .open_position_json,
          null,
        ),

      orders:
        parseJson(
          row.orders_json,
          [],
        ),

      closedTrades:
        parseJson(
          row
            .closed_trades_json,
          [],
        ),

      equityCurve:
        parseJson(
          row
            .equity_curve_json,
          [],
        ),

      completedAt:
        Number(
          row.completed_at,
        ),

      createdAt:
        Number(
          row.created_at,
        ),
    }),
  );
}