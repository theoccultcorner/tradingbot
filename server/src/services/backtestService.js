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
        (trade) =>
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
          (trade) =>
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
    grossLoss === 0
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
  const safeLimit =
    Math.min(
      Math.max(
        Number(
          limit,
        ) || 500,
        250,
      ),
      1000,
    );

  const query =
    new URLSearchParams({
      symbol:
        String(
          symbol,
        ).toUpperCase(),

      interval:
        String(
          timeframe,
        ),

      limit:
        String(
          safeLimit,
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

  return data.map(
    normalizeCandle,
  );
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
    index += 1
  ) {
    const history =
      candles.slice(
        0,
        index + 1,
      );

    const candle =
      history[
        history.length -
          1
      ];

    const price =
      Number(
        candle.close,
      );

    if (
      !Number.isFinite(
        price,
      ) ||
      price <= 0
    ) {
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
              ) * 100
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

  const finalPrice =
    Number(
      candles[
        candles.length -
          1
      ].close,
    );

  const openPositionValue =
    position &&
    Number.isFinite(
      finalPrice,
    )
      ? position
          .quantity *
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
        ) * 100
      : 0;

  const winningTrades =
    closedTrades.filter(
      (trade) =>
        trade.profit >
        0,
    );

  const losingTrades =
    closedTrades.filter(
      (trade) =>
        trade.profit <
        0,
    );

  const winRate =
    closedTrades.length >
    0
      ? (
          winningTrades
            .length /
          closedTrades
            .length
        ) * 100
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
      winningTrades
        .length,

    losses:
      losingTrades
        .length,

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
      maximumDrawdown
        .amount,

    maximumDrawdownPercent:
      maximumDrawdown
        .percent,

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
        index % 5 ===
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

export async function getRecentBacktests(
  limit = 10,
) {
  const safeLimit =
    Math.min(
      Math.max(
        Number(
          limit,
        ) || 10,
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
    (row) => ({
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