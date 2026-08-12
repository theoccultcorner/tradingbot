import crypto from "node:crypto";

import {
  database,
} from "../config/database.js";

import {
  loadLocalSettings,
  saveLocalSettings,
} from "./localSettingsService.js";

import {
  getPaperPortfolio,
} from "./paperPortfolioService.js";

import {
  executeIdempotentPaperOrder,
} from "./idempotentOrderService.js";

const LOCAL_SETTINGS_KEY =
  "serverTradingEngine";

const DEFAULT_SETTINGS = {
  enabled: false,
  emergencyStop: false,

  /*
   * BUY signal requirements.
   */
  minimumBuyConfidence: 45,
  minimumBuyScore: 40,

  /*
   * SELL signal requirements.
   *
   * SELL scores from the signal engine are
   * expected to be negative.
   *
   * Example:
   *
   * minimumSellScore = 40
   *
   * requires:
   *
   * signal.totalScore <= -40
   */
  minimumSellConfidence: 45,
  minimumSellScore: 40,

  /*
   * Position sizing.
   */
  buyAmount: 40,
  maximumPositionValue: 120,

  /*
   * Zero means no time-based cooldown.
   *
   * Duplicate trades are still prevented
   * by closed-candle processing and the
   * idempotent order key.
   */
  cooldownMinutes: 0,

  /*
   * Automatic position exits.
   */
  stopLossPercent: 1.5,
  takeProfitPercent: 3,

  trailingStopEnabled: true,
  trailingStopPercent: 1,

  /*
   * Financial risk limit.
   */
  dailyLossLimit: 30,

  /*
   * Zero means unlimited daily trades.
   *
   * This remains in settings for frontend
   * compatibility, but zero disables the
   * arbitrary daily trade-count limit.
   */
  maximumTradesPerDay: 0,
};

/*
 * Ensure the local SQLite risk-events
 * table exists.
 */
database.exec(`
  CREATE TABLE IF NOT EXISTS risk_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    symbol TEXT NOT NULL,
    timeframe TEXT,
    price REAL,
    quantity REAL,
    executed INTEGER NOT NULL DEFAULT 0,
    order_key TEXT,
    message TEXT,
    timestamp INTEGER NOT NULL
  );
`);

function cleanSettings(
  value = {},
) {
  const cooldownValue =
    Number(
      value.cooldownMinutes,
    );

  const maximumTradesValue =
    Number(
      value.maximumTradesPerDay,
    );

  /*
   * Backward compatibility.
   *
   * If server-settings.json still contains
   * the old minimumScore/minimumConfidence
   * values, use them until the new BUY/SELL
   * settings are explicitly saved.
   */
  const legacyScore =
    Number(
      value.minimumScore,
    );

  const legacyConfidence =
    Number(
      value.minimumConfidence,
    );

  const buyScore =
    Number(
      value.minimumBuyScore,
    );

  const buyConfidence =
    Number(
      value.minimumBuyConfidence,
    );

  const sellScore =
    Number(
      value.minimumSellScore,
    );

  const sellConfidence =
    Number(
      value.minimumSellConfidence,
    );

  return {
    enabled:
      Boolean(
        value.enabled,
      ),

    emergencyStop:
      Boolean(
        value.emergencyStop,
      ),

    minimumBuyConfidence:
      Math.max(
        Number.isFinite(
          buyConfidence,
        )
          ? buyConfidence
          : Number.isFinite(
                legacyConfidence,
              )
            ? legacyConfidence
            : 45,
        0,
      ),

    minimumBuyScore:
      Math.max(
        Number.isFinite(
          buyScore,
        )
          ? buyScore
          : Number.isFinite(
                legacyScore,
              )
            ? Math.abs(
                legacyScore,
              )
            : 40,
        0,
      ),

    minimumSellConfidence:
      Math.max(
        Number.isFinite(
          sellConfidence,
        )
          ? sellConfidence
          : Number.isFinite(
                legacyConfidence,
              )
            ? legacyConfidence
            : 45,
        0,
      ),

    minimumSellScore:
      Math.max(
        Number.isFinite(
          sellScore,
        )
          ? Math.abs(
              sellScore,
            )
          : Number.isFinite(
                legacyScore,
              )
            ? Math.abs(
                legacyScore,
              )
            : 40,
        0,
      ),

    buyAmount:
      Math.max(
        Number(
          value.buyAmount,
        ) ||
          40,
        1,
      ),

    maximumPositionValue:
      Math.max(
        Number(
          value.maximumPositionValue,
        ) ||
          120,
        1,
      ),

    /*
     * Zero is a valid value.
     */
    cooldownMinutes:
      Number.isFinite(
        cooldownValue,
      )
        ? Math.max(
            cooldownValue,
            0,
          )
        : 0,

    stopLossPercent:
      Math.max(
        Number(
          value.stopLossPercent,
        ) ||
          1.5,
        0.1,
      ),

    takeProfitPercent:
      Math.max(
        Number(
          value.takeProfitPercent,
        ) ||
          3,
        0.1,
      ),

    trailingStopEnabled:
      value.trailingStopEnabled !==
      false,

    trailingStopPercent:
      Math.max(
        Number(
          value.trailingStopPercent,
        ) ||
          1,
        0.1,
      ),

    dailyLossLimit:
      Math.max(
        Number(
          value.dailyLossLimit,
        ) ||
          30,
        1,
      ),

    /*
     * Zero = unlimited.
     */
    maximumTradesPerDay:
      Number.isFinite(
        maximumTradesValue,
      )
        ? Math.max(
            Math.floor(
              maximumTradesValue,
            ),
            0,
          )
        : 0,
  };
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

function findLatestClosedCandle(
  candles = [],
) {
  for (
    let index =
      candles.length - 1;

    index >= 0;

    index -=
      1
  ) {
    if (
      candles[
        index
      ]?.closed
    ) {
      return candles[
        index
      ];
    }
  }

  return null;
}

/*
 * =========================================================
 * MARKET PRICE SAFETY
 * =========================================================
 *
 * These checks are deliberately generous.
 *
 * They are not intended to reject ordinary
 * volatility.
 *
 * Their purpose is to catch catastrophic
 * symbol/price contamination such as:
 *
 * DOGEUSD
 * expected ~$0.07
 * received ~$74.89
 */
const MAX_CANDLE_PRICE_DEVIATION_PERCENT =
  25;

const MAX_POSITION_PRICE_MULTIPLIER =
  10;

const MIN_POSITION_PRICE_MULTIPLIER =
  0.1;

function calculatePercentDifference(
  left,
  right,
) {
  const leftNumber =
    Number(
      left,
    );

  const rightNumber =
    Number(
      right,
    );

  if (
    !Number.isFinite(
      leftNumber,
    ) ||
    !Number.isFinite(
      rightNumber,
    ) ||
    leftNumber <= 0 ||
    rightNumber <= 0
  ) {
    return null;
  }

  return (
    Math.abs(
      leftNumber -
      rightNumber,
    ) /
    rightNumber
  ) * 100;
}

function validateMarketPrice({
  state,
  referencePrice = null,
}) {
  const symbol =
    String(
      state?.symbol ||
        "",
    )
      .trim()
      .toUpperCase();

  const marketPrice =
    Number(
      state?.price,
    );

  if (
    !symbol ||
    !Number.isFinite(
      marketPrice,
    ) ||
    marketPrice <= 0
  ) {
    return {
      valid: false,

      price:
        marketPrice,

      reason:
        "current market price is invalid",
    };
  }

  /*
   * Compare the current live price with the
   * most recent CLOSED candle.
   *
   * A 25% gap from the last closed candle is
   * already extreme for the markets and
   * intervals used by this bot.
   */
  const latestClosedCandle =
    findLatestClosedCandle(
      state?.candles,
    );

  const candleClose =
    Number(
      latestClosedCandle
        ?.close,
    );

  if (
    Number.isFinite(
      candleClose,
    ) &&
    candleClose > 0
  ) {
    const candleDeviation =
      calculatePercentDifference(
        marketPrice,
        candleClose,
      );

    if (
      candleDeviation !==
        null &&
      candleDeviation >
        MAX_CANDLE_PRICE_DEVIATION_PERCENT
    ) {
      return {
        valid: false,

        price:
          marketPrice,

        reason:
          `${symbol} price safety check failed: live price ${marketPrice} differs from the latest closed candle ${candleClose} by ${candleDeviation.toFixed(
            2,
          )}%.`,
      };
    }
  }

  /*
   * For an existing position, also compare
   * against the position's reference price.
   *
   * This is an intentionally huge range:
   *
   * minimum = 0.1x
   * maximum = 10x
   *
   * Therefore normal gains/losses are not
   * blocked, but a thousand-fold symbol
   * mismatch is.
   */
  const reference =
    Number(
      referencePrice,
    );

  if (
    Number.isFinite(
      reference,
    ) &&
    reference > 0
  ) {
    const multiplier =
      marketPrice /
      reference;

    if (
      multiplier >
        MAX_POSITION_PRICE_MULTIPLIER ||
      multiplier <
        MIN_POSITION_PRICE_MULTIPLIER
    ) {
      return {
        valid: false,

        price:
          marketPrice,

        reason:
          `${symbol} price safety check failed: live price ${marketPrice} is ${multiplier.toFixed(
            4,
          )}x the position reference price ${reference}.`,
      };
    }
  }

  return {
    valid: true,

    price:
      marketPrice,

    reason:
      "clear",
  };
}

function createDecision({
  state,
  candle,
  signal,
  action,
  message,
  executed = false,
  quantity = 0,
  orderType = null,
  orderKey = null,
}) {
  return {
    symbol:
      state.symbol,

    timeframe:
      state.timeframe,

    candleTime:
      candle?.time ||
      null,

    action:
      action ||
      signal?.action ||
      "WAIT",

    label:
      signal?.label ||
      "Unavailable",

    score:
      Number(
        signal?.totalScore,
      ) ||
      0,

    confidence:
      Number(
        signal?.confidence,
      ) ||
      0,

    price:
      Number(
        state.price,
      ) ||
      null,

    executed,

    quantity,

    orderType,

    orderKey,

    message,

    timestamp:
      Date.now(),
  };
}

function saveRiskEvent(
  event,
) {
  const id =
    event.id ||
    crypto.randomUUID();

  database
    .prepare(
      `
        INSERT INTO risk_events (
          id,
          type,
          symbol,
          timeframe,
          price,
          quantity,
          executed,
          order_key,
          message,
          timestamp
        )
        VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `,
    )
    .run(
      id,

      event.type,

      event.symbol,

      event.timeframe ||
        null,

      Number(
        event.price,
      ) ||
        null,

      Number(
        event.quantity,
      ) ||
        null,

      event.executed
        ? 1
        : 0,

      event.orderKey ||
        null,

      event.message ||
        "",

      Number(
        event.timestamp,
      ) ||
        Date.now(),
    );

  return {
    ...event,

    id,
  };
}

export class ServerTradingEngineService {
  constructor() {
    this.settings = {
      ...DEFAULT_SETTINGS,
    };

    this.status =
      "Disabled";

    this.lastDecision =
      null;

    this.lastRiskEvent =
      null;

    this.lastProcessedCandle =
      null;

    this.lastTradeTime =
      0;

    this.highWaterMarks =
      {};

    this.processing =
      false;

    this.initialized =
      false;
  }

  async initialize() {
    const saved =
      await loadLocalSettings(
        LOCAL_SETTINGS_KEY,
        {
          settings: {
            ...DEFAULT_SETTINGS,
          },

          runtime: {
            lastProcessedCandle:
              null,

            lastTradeTime:
              0,

            highWaterMarks:
              {},

            lastDecision:
              null,

            lastRiskEvent:
              null,
          },
        },
      );

    this.settings =
      cleanSettings({
        ...DEFAULT_SETTINGS,

        ...(
          saved.settings ||
          {}
        ),
      });

    const runtime =
      saved.runtime &&
      typeof saved.runtime ===
        "object"
        ? saved.runtime
        : {};

    this.lastProcessedCandle =
      runtime
        .lastProcessedCandle ||
      null;

    this.lastTradeTime =
      Number(
        runtime
          .lastTradeTime,
      ) ||
      0;

    this.highWaterMarks =
      runtime
          .highWaterMarks &&
        typeof runtime
          .highWaterMarks ===
          "object"
        ? runtime
            .highWaterMarks
        : {};

    this.lastDecision =
      runtime
        .lastDecision ||
      null;

    this.lastRiskEvent =
      runtime
        .lastRiskEvent ||
      null;

    this.initialized =
      true;

    this.status =
      this.settings
        .emergencyStop
        ? "Emergency stop active"
        : this.settings
            .enabled
          ? "Monitoring"
          : "Disabled";

    return this.getState();
  }

  getState() {
    return {
      settings: {
        ...this.settings,
      },

      status:
        this.status,

      processing:
        this.processing,

      lastDecision:
        this.lastDecision,

      lastRiskEvent:
        this.lastRiskEvent,

      lastProcessedCandle:
        this.lastProcessedCandle,

      lastTradeTime:
        this.lastTradeTime,

      highWaterMarks: {
        ...this.highWaterMarks,
      },
    };
  }

  async persistRuntime() {
    await saveLocalSettings(
      LOCAL_SETTINGS_KEY,
      {
        settings: {
          ...this.settings,
        },

        runtime: {
          lastProcessedCandle:
            this
              .lastProcessedCandle,

          lastTradeTime:
            this
              .lastTradeTime,

          highWaterMarks:
            this
              .highWaterMarks,

          lastDecision:
            this
              .lastDecision,

          lastRiskEvent:
            this
              .lastRiskEvent,
        },
      },
    );
  }

  async resetRuntime() {
    /*
     * =========================================================
     * RESET TRADING ENGINE RUNTIME
     * =========================================================
     *
     * Used when the paper portfolio is reset.
     *
     * IMPORTANT:
     * This does NOT change trading settings.
     *
     * It only removes runtime state that belongs
     * to the old portfolio.
     */

    this.lastDecision =
      null;

    this.lastRiskEvent =
      null;

    this.lastProcessedCandle =
      null;

    this.lastTradeTime =
      0;

    this.highWaterMarks =
      {};

    this.processing =
      false;

    /*
     * Keep the engine in the correct operational
     * state after the runtime reset.
     */
    this.status =
      this.settings
        .emergencyStop
        ? "Emergency stop active"
        : this.settings
            .enabled
          ? "Monitoring"
          : "Disabled";

    /*
     * Persist the cleared runtime.
     *
     * Without this, old runtime values could be
     * restored the next time the server starts.
     */
    await this
      .persistRuntime();

    return this.getState();
  }

  async updateSettings(
    nextSettings = {},
  ) {
    this.settings =
      cleanSettings({
        ...this.settings,

        ...nextSettings,
      });

    await saveLocalSettings(
      LOCAL_SETTINGS_KEY,
      {
        settings: {
          ...this.settings,
        },
      },
    );

    this.status =
      this.settings
        .emergencyStop
        ? "Emergency stop active"
        : this.settings
            .enabled
          ? "Monitoring"
          : "Disabled";

    return this.getState();
  }

  async handleMarketUpdate(
    state,
  ) {
    if (
      !state ||
      this.processing ||
      !this.initialized
    ) {
      return;
    }

    /*
     * Manage an existing position first.
     *
     * This lets stop loss, take profit, and
     * trailing stop act without waiting for
     * a new signal.
     */
    await this.evaluateRisk(
      state,
    );

    if (
      !this.settings
        .enabled ||
      this.settings
        .emergencyStop
    ) {
      return;
    }

    const candle =
      findLatestClosedCandle(
        state.candles,
      );

    if (!candle) {
      this.status =
        "Waiting for a closed candle";

      return;
    }

    /*
     * Only evaluate one signal decision for
     * each closed candle.
     *
     * This prevents rapid duplicate entries
     * from repeated WebSocket updates.
     */
    if (
      this
        .lastProcessedCandle ===
      candle.time
    ) {
      return;
    }

    this.lastProcessedCandle =
      candle.time;

    await this
      .persistRuntime();

    await this.evaluateSignal(
      state,
      candle,
    );
  }

  getRiskGate(
    portfolio,
  ) {
    const trades =
      Array.isArray(
        portfolio.trades,
      )
        ? portfolio.trades
        : [];

    const todaysTrades =
      trades.filter(
        (
          trade,
        ) =>
          isToday(
            trade.timestamp,
          ),
      );

    const realizedProfitToday =
      todaysTrades.reduce(
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

    /*
     * Money-based daily protection remains.
     */
    if (
      realizedProfitToday <=
      -Math.abs(
        this.settings
          .dailyLossLimit,
      )
    ) {
      return {
        allowed:
          false,

        reason:
          "daily loss limit reached",
      };
    }

    /*
     * Optional daily transaction limit.
     *
     * Zero means unlimited.
     */
    if (
      this.settings
        .maximumTradesPerDay >
        0 &&
      todaysTrades.length >=
        this.settings
          .maximumTradesPerDay
    ) {
      return {
        allowed:
          false,

        reason:
          "daily trade limit reached",
      };
    }

    return {
      allowed:
        true,

      reason:
        "clear",
    };
  }

  async evaluateSignal(
    state,
    candle,
  ) {
    this.processing =
      true;

    try {
      const signal =
        state.signal;

      if (!signal) {
        await this
          .recordDecision(
            createDecision({
              state,
              candle,
              signal,

              message:
                "Skipped because no server signal was available.",
            }),
          );

        return;
      }

      if (
        signal.action ===
        "WAIT"
      ) {
        await this
          .recordDecision(
            createDecision({
              state,
              candle,
              signal,

              message:
                `No trade: ${signal.label}.`,
            }),
          );

        return;
      }

      const signalScore =
        Number(
          signal.totalScore,
        ) ||
        0;

      const signalConfidence =
        Number(
          signal.confidence,
        ) ||
        0;

      /*
       * BUY and SELL have independent
       * thresholds.
       */
      if (
        signal.action ===
        "BUY"
      ) {
        if (
          signalScore <
            this.settings
              .minimumBuyScore ||
          signalConfidence <
            this.settings
              .minimumBuyConfidence
        ) {
          await this
            .recordDecision(
              createDecision({
                state,
                candle,
                signal,

                message:
                  `BUY skipped. Requires score >= ${this.settings.minimumBuyScore} and confidence >= ${this.settings.minimumBuyConfidence}%.`,
              }),
            );

          return;
        }
      } else if (
        signal.action ===
        "SELL"
      ) {
        if (
          signalScore >
            -Math.abs(
              this.settings
                .minimumSellScore,
            ) ||
          signalConfidence <
            this.settings
              .minimumSellConfidence
        ) {
          await this
            .recordDecision(
              createDecision({
                state,
                candle,
                signal,

                message:
                  `SELL skipped. Requires score <= -${this.settings.minimumSellScore} and confidence >= ${this.settings.minimumSellConfidence}%.`,
              }),
            );

          return;
        }
      } else {
        await this
          .recordDecision(
            createDecision({
              state,
              candle,
              signal,

              message:
                `Unsupported signal action: ${signal.action}.`,
            }),
          );

        return;
      }

      /*
       * Optional cooldown.
       *
       * Zero disables it completely.
       */
      const cooldownMilliseconds =
        Math.max(
          Number(
            this.settings
              .cooldownMinutes,
          ) ||
            0,
          0,
        ) *
        60 *
        1000;

      if (
        cooldownMilliseconds >
          0 &&
        this.lastTradeTime >
          0 &&
        Date.now() -
          this.lastTradeTime <
          cooldownMilliseconds
      ) {
        await this
          .recordDecision(
            createDecision({
              state,
              candle,
              signal,

              message:
                "Skipped because the trade cooldown is active.",
            }),
          );

        return;
      }

      const portfolio =
        await getPaperPortfolio({
          tradeLimit:
            500,
        });

      const position =
        portfolio
          .positions?.[
            state.symbol
          ] ||
        null;

      /*
       * =====================================================
       * BUY
       * =====================================================
       */
      if (
        signal.action ===
        "BUY"
      ) {
        const riskGate =
          this.getRiskGate(
            portfolio,
          );

        if (
          !riskGate.allowed
        ) {
          await this
            .recordDecision(
              createDecision({
                state,
                candle,
                signal,

                message:
                  `BUY skipped: ${riskGate.reason}.`,
              }),
            );

          return;
        }

        /*
         * Last line of defense before using
         * state.price for position sizing.
         */
        const priceSafety =
          validateMarketPrice({
            state,
          });

        if (
          !priceSafety.valid
        ) {
          console.warn(
            "BUY blocked by market-price safety check:",
            priceSafety.reason,
          );

          await this
            .recordDecision(
              createDecision({
                state,
                candle,
                signal,

                message:
                  `BUY blocked: ${priceSafety.reason}`,
              }),
            );

          return;
        }

        const marketPrice =
          priceSafety.price;

        const currentPositionValue =
          position
            ? Number(
                position
                  .quantity,
              ) *
              marketPrice
            : 0;

        const cash =
          Math.max(
            Number(
              portfolio.cash,
            ) ||
              0,
            0,
          );

        const startingCash =
          Math.max(
            Number(
              portfolio
                .startingCash,
            ) ||
              cash,
            0,
          );

        /*
         * One new BUY can use up to 15%
         * of starting capital.
         *
         * $300 account = $45 maximum
         * per individual entry.
         */
        const dynamicBuyCap =
          Math.max(
            startingCash *
              0.15,
            1,
          );

        /*
         * One symbol can occupy up to
         * 40% of starting capital.
         *
         * $300 account = $120.
         */
        const dynamicPositionCap =
          Math.max(
            startingCash *
              0.40,
            1,
          );

        const effectivePositionLimit =
          Math.min(
            this.settings
              .maximumPositionValue,

            dynamicPositionCap,
          );

        if (
          currentPositionValue >=
          effectivePositionLimit
        ) {
          await this
            .recordDecision(
              createDecision({
                state,
                candle,
                signal,

                message:
                  "BUY skipped because the maximum position value is already reached.",
              }),
            );

          return;
        }

        const remainingAllowance =
          effectivePositionLimit -
          currentPositionValue;

        const feeRate =
          Math.max(
            Number(
              portfolio
                .feeRate,
            ) ||
              0.001,
            0,
          );

        /*
         * Keep 2% of starting capital in
         * reserve for fees/rounding and to
         * avoid exhausting the account.
         */
        const reserveCash =
          startingCash *
          0.02;

        const spendableCash =
          Math.max(
            cash -
              reserveCash,
            0,
          );

        /*
         * Because BUY fees are paid in cash,
         * convert spendable cash into the
         * maximum safe gross order value.
         */
        const maximumGrossFromCash =
          feeRate >
          0
            ? spendableCash /
              (
                1 +
                feeRate
              )
            : spendableCash;

        const buyValue =
          Math.min(
            this.settings
              .buyAmount,

            dynamicBuyCap,

            remainingAllowance,

            maximumGrossFromCash,
          );

        if (
          !Number.isFinite(
            buyValue,
          ) ||
          buyValue <=
            0
        ) {
          await this
            .recordDecision(
              createDecision({
                state,
                candle,
                signal,

                message:
                  "BUY skipped because there is not enough available cash or position capacity.",
              }),
            );

          return;
        }

        const quantity =
          buyValue /
          marketPrice;

        if (
          !Number.isFinite(
            quantity,
          ) ||
          quantity <=
            0
        ) {
          await this
            .recordDecision(
              createDecision({
                state,
                candle,
                signal,

                message:
                  "BUY skipped because the calculated quantity is invalid.",
              }),
            );

          return;
        }

        /*
         * The closed candle makes this order
         * key deterministic. Repeated server
         * updates cannot execute it twice.
         */
        const orderKey =
          [
            "signal",
            state.symbol,
            state.timeframe,
            candle.time,
            "BUY",
          ].join(
            "_",
          );

        const result =
          await executeIdempotentPaperOrder({
            orderKey,

            order: {
              symbol:
                state.symbol,

              side:
                "BUY",

              quantity,

              price:
                marketPrice,
            },

            /*
             * ROADMAP #7
             *
             * Preserve signal identity with
             * the trade for later strategy
             * performance analysis.
             */
            metadata: {
              source:
                "SERVER_TRADING_ENGINE",

              strategy:
                "SIGNAL_ENGINE",

              signalAction:
                signal.action,

              label:
                signal.label ||
                "Unknown",

              candleTime:
                candle.time,

              timeframe:
                state.timeframe,

              score:
                signalScore,

              confidence:
                signalConfidence,

              minimumBuyScore:
                this.settings
                  .minimumBuyScore,

              minimumBuyConfidence:
                this.settings
                  .minimumBuyConfidence,
            },
          });

        if (
          result.success &&
          !result.duplicate
        ) {
          this.lastTradeTime =
            Date.now();
        }

        await this
          .recordDecision(
            createDecision({
              state,
              candle,
              signal,

              action:
                "BUY",

              executed:
                Boolean(
                  result.success,
                ),

              quantity,

              orderType:
                "SIGNAL_BUY",

              orderKey,

              message:
                result.message ||
                (
                  result.success
                    ? "BUY order executed."
                    : "BUY order was not executed."
                ),
            }),
          );

        return;
      }

      /*
       * =====================================================
       * SELL
       * =====================================================
       */
      if (
        signal.action ===
        "SELL"
      ) {
        if (
          !position ||
          Number(
            position
              .quantity,
          ) <=
            0
        ) {
          await this
            .recordDecision(
              createDecision({
                state,
                candle,
                signal,

                message:
                  "SELL skipped because there is no open position in this market.",
              }),
            );

          return;
        }

        const quantity =
          Number(
            position
              .quantity,
          );

        /*
         * Compare the incoming SELL price with
         * both the latest candle and the actual
         * position entry price.
         */
        const priceSafety =
          validateMarketPrice({
            state,

            referencePrice:
              position
                .averageEntryPrice,
          });

        if (
          !priceSafety.valid
        ) {
          console.warn(
            "SELL blocked by market-price safety check:",
            priceSafety.reason,
          );

          await this
            .recordDecision(
              createDecision({
                state,
                candle,
                signal,

                message:
                  `SELL blocked: ${priceSafety.reason}`,
              }),
            );

          return;
        }

        const marketPrice =
          priceSafety.price;

        const orderKey =
          `${state.symbol}-${state.timeframe}-${candle.time}-SELL`;

        const result =
          await executeIdempotentPaperOrder({
            orderKey,

            order: {
              symbol:
                state.symbol,

              side:
                "SELL",

              quantity,

              price:
                marketPrice,
            },

            /*
             * ROADMAP #7
             *
             * Preserve signal identity with
             * signal-driven exits.
             */
            metadata: {
              source:
                "SERVER_TRADING_ENGINE",

              strategy:
                "SIGNAL_ENGINE",

              signalAction:
                signal.action,

              label:
                signal.label ||
                "Unknown",

              candleTime:
                candle.time,

              timeframe:
                state.timeframe,

              score:
                signalScore,

              confidence:
                signalConfidence,

              minimumSellScore:
                this.settings
                  .minimumSellScore,

              minimumSellConfidence:
                this.settings
                  .minimumSellConfidence,
            },
          });

        if (
          result.success &&
          !result.duplicate
        ) {
          this.lastTradeTime =
            Date.now();

          delete this
            .highWaterMarks[
              state.symbol
            ];

          await this
            .persistRuntime();
        }

        await this
          .recordDecision(
            createDecision({
              state,
              candle,
              signal,

              action:
                "SELL",

              message:
                result.message,

              /*
               * A duplicate historical result
               * is not a new execution.
               */
              executed:
                Boolean(
                  result.success &&
                  !result.duplicate,
                ),

              quantity,

              orderType:
                "SIGNAL_EXIT",

              orderKey,
            }),
          );

        return;
      }
    } catch (
      error
    ) {
      console.error(
        "Server trading engine failed:",
        error,
      );

      this.status =
        "Trading engine error";
    } finally {
      this.processing =
        false;
    }
  }

  /*
   * =========================================================
   * AUTOMATIC POSITION RISK MANAGEMENT
   * =========================================================
   */
  async evaluateRisk(
    state,
  ) {
    if (
      !this.settings
        .enabled ||
      this.settings
        .emergencyStop ||
      this.processing
    ) {
      return;
    }

    const price =
      Number(
        state.price,
      );

    if (
      !Number.isFinite(
        price,
      ) ||
      price <=
        0
    ) {
      return;
    }

    const portfolio =
      await getPaperPortfolio({
        tradeLimit:
          500,
      });

    const position =
      portfolio
        .positions?.[
          state.symbol
        ];

    if (
      !position ||
      Number(
        position
          .quantity,
      ) <=
        0
    ) {
      if (
        this
          .highWaterMarks[
            state.symbol
          ]
      ) {
        delete this
          .highWaterMarks[
            state.symbol
          ];

        await this
          .persistRuntime();
      }

      return;
    }

    const entryPrice =
      Number(
        position
          .averageEntryPrice,
      );

    if (
      !Number.isFinite(
        entryPrice,
      ) ||
      entryPrice <=
        0
    ) {
      return;
    }

    /*
     * =====================================================
     * RISK EXIT PRICE SAFETY
     * =====================================================
     *
     * Do this BEFORE calculating stop-loss,
     * take-profit or trailing-stop percentages.
     *
     * This specifically prevents a corrupted
     * price from becoming a real SELL.
     */
    const priceSafety =
      validateMarketPrice({
        state,

        referencePrice:
          entryPrice,
      });

    if (
      !priceSafety.valid
    ) {
      console.error(
        "Risk exit blocked by market-price safety check:",
        priceSafety.reason,
      );

      this.status =
        "Price safety block";

      this.lastRiskEvent =
        saveRiskEvent({
          type:
            "PRICE_SAFETY_BLOCK",

          symbol:
            state.symbol,

          timeframe:
            state.timeframe,

          price,

          quantity:
            Number(
              position.quantity,
            ) ||
            0,

          executed:
            false,

          orderKey:
            null,

          message:
            priceSafety.reason,

          timestamp:
            Date.now(),
        });

      await this
        .persistRuntime();

      return;
    }

    const previousHigh =
      Number(
        this
          .highWaterMarks[
            state.symbol
          ],
      ) ||
      entryPrice;

    const highWaterMark =
      Math.max(
        previousHigh,
        price,
      );

    if (
      highWaterMark !==
      previousHigh
    ) {
      this.highWaterMarks[
        state.symbol
      ] =
        highWaterMark;

      await this
        .persistRuntime();
    } else if (
      !this
        .highWaterMarks[
          state.symbol
        ]
    ) {
      this.highWaterMarks[
        state.symbol
      ] =
        highWaterMark;

      await this
        .persistRuntime();
    }

    const returnPercent =
      (
        (
          price -
          entryPrice
        ) /
        entryPrice
      ) *
      100;

    const trailingDropPercent =
      (
        (
          highWaterMark -
          price
        ) /
        highWaterMark
      ) *
      100;

    let type =
      null;

    let message =
      "";

    /*
     * STOP LOSS
     */
    if (
      returnPercent <=
      -Math.abs(
        Number(
          this.settings
            .stopLossPercent,
        ) ||
          1.5,
      )
    ) {
      type =
        "STOP_LOSS";

      message =
        `Stop-loss triggered at ${returnPercent.toFixed(
          2,
        )}%.`;
    }

    /*
     * TAKE PROFIT
     */
    else if (
      returnPercent >=
      Math.abs(
        Number(
          this.settings
            .takeProfitPercent,
        ) ||
          3,
      )
    ) {
      type =
        "TAKE_PROFIT";

      message =
        `Take-profit triggered at ${returnPercent.toFixed(
          2,
        )}%.`;
    }

    /*
     * TRAILING STOP
     */
    else if (
      this.settings
        .trailingStopEnabled &&
      highWaterMark >
        entryPrice &&
      trailingDropPercent >=
        Math.abs(
          Number(
            this.settings
              .trailingStopPercent,
          ) ||
            1,
        )
    ) {
      type =
        "TRAILING_STOP";

      message =
        `Trailing stop triggered after a ${trailingDropPercent.toFixed(
          2,
        )}% decline from the position high.`;
    }

    if (!type) {
      return;
    }

    this.processing =
      true;

    try {
      const quantity =
        Number(
          position
            .quantity,
        );

      if (
        !Number.isFinite(
          quantity,
        ) ||
        quantity <=
          0
      ) {
        return;
      }

      const candle =
        findLatestClosedCandle(
          state.candles,
        );

      const eventKey =
        `${state.symbol}-${state.timeframe}-${candle?.time || Date.now()}-${type}`;

      const result =
        await executeIdempotentPaperOrder({
          orderKey:
            eventKey,

          order: {
            symbol:
              state.symbol,

            side:
              "SELL",

            quantity,

            price,
          },

          /*
           * ROADMAP #7
           *
           * Risk exits get their own strategy
           * identity so STOP_LOSS,
           * TAKE_PROFIT and TRAILING_STOP can
           * be measured independently.
           */
          metadata: {
            source:
              "SERVER_RISK_MANAGER",

            strategy:
              "RISK_MANAGER",

            signalAction:
              "SELL",

            label:
              type,

            type,

            timeframe:
              state.timeframe,

            candleTime:
              candle?.time ||
              null,

            entryPrice,

            currentPrice:
              price,

            returnPercent,

            highWaterMark,

            trailingDropPercent,
          },
        });

      const event =
        saveRiskEvent({
          type,

          symbol:
            state.symbol,

          timeframe:
            state.timeframe,

          price,

          quantity,

          /*
           * A duplicate risk order is not
           * a new executed exit.
           */
          executed:
            Boolean(
              result.success &&
              !result.duplicate,
            ),

          orderKey:
            eventKey,

          message:
            `${message} ${result.message || ""}`,

          timestamp:
            Date.now(),
        });

      this.lastRiskEvent =
        event;

      if (
        result.success &&
        !result.duplicate
      ) {
        this.lastTradeTime =
          Date.now();

        delete this
          .highWaterMarks[
            state.symbol
          ];

        this.status =
          `${type} executed`;
      }

      await this
        .persistRuntime();
    } catch (
      error
    ) {
      console.error(
        "Server risk exit failed:",
        error,
      );

      this.status =
        "Risk exit failed";
    } finally {
      this.processing =
        false;
    }
  }

  async recordDecision(
    decision,
  ) {
    /*
     * Routine decisions remain local rather
     * than generating a SQLite row for every
     * WAIT or rejected signal.
     */
    this.lastDecision = {
      ...decision,
    };

    this.status =
      decision.executed
        ? `${decision.action} executed`
        : "Monitoring";

    await this
      .persistRuntime();
  }
}