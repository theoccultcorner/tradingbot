import crypto from "node:crypto";

import {
  database,
} from "../config/database.js";

import {
  getPaperPortfolio,
} from "./paperPortfolioService.js";

import {
  executeIdempotentPaperOrder,
} from "./idempotentOrderService.js";

import {
  loadLocalSettings,
  saveLocalSettings,
} from "./localSettingsService.js";

const BINANCE_REST_URL =
  process.env.BINANCE_BASE_URL ||
  "https://api.binance.us";

const LOCAL_SETTINGS_KEY =
  "positionRiskMonitor";

const DEFAULT_INTERVAL_MS =
  5000;

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
      ) || null,

      Number(
        event.quantity,
      ) || null,

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

async function fetchPrices(
  symbols,
) {
  if (
    !Array.isArray(
      symbols,
    ) ||
    symbols.length === 0
  ) {
    return {};
  }

  const uniqueSymbols = [
    ...new Set(
      symbols.map(
        (symbol) =>
          String(
            symbol,
          )
            .trim()
            .toUpperCase(),
      ),
    ),
  ];

  const query =
    new URLSearchParams();

  query.set(
    "symbols",
    JSON.stringify(
      uniqueSymbols,
    ),
  );

  const response =
    await fetch(
      `${BINANCE_REST_URL}/api/v3/ticker/price?${query}`,
    );

  const data =
    await response.json();

  if (
    !response.ok
  ) {
    throw new Error(
      data?.msg ||
        "Could not load position prices.",
    );
  }

  const rows =
    Array.isArray(
      data,
    )
      ? data
      : [
          data,
        ];

  const prices =
    {};

  for (
    const row of rows
  ) {
    const symbol =
      String(
        row?.symbol ||
          "",
      ).toUpperCase();

    const price =
      Number(
        row?.price,
      );

    if (
      symbol &&
      Number.isFinite(
        price,
      ) &&
      price > 0
    ) {
      prices[
        symbol
      ] =
        price;
    }
  }

  return prices;
}

export class PositionRiskMonitorService {
  constructor({
    getTradingSettings,
    getActiveSymbol,
    onRiskEvent,
    intervalMs =
      Number(
        process.env
          .POSITION_RISK_INTERVAL_MS,
      ) ||
      DEFAULT_INTERVAL_MS,
  } = {}) {
    this.getTradingSettings =
      getTradingSettings;

    this.getActiveSymbol =
      getActiveSymbol;

    this.onRiskEvent =
      onRiskEvent;

    this.intervalMs =
      Math.max(
        Number(
          intervalMs,
        ) ||
          DEFAULT_INTERVAL_MS,

        1000,
      );

    this.timer =
      null;

    this.running =
      false;

    this.processing =
      false;

    this.highWaterMarks =
      {};

    this.lastCheck =
      null;

    this.lastRiskEvent =
      null;

    this.lastError =
      null;

    this.initialized =
      false;
  }

  async initialize() {
    const saved =
      await loadLocalSettings(
        LOCAL_SETTINGS_KEY,
        {
          highWaterMarks:
            {},

          lastRiskEvent:
            null,
        },
      );

    this.highWaterMarks =
      saved
        ?.highWaterMarks &&
      typeof saved
        .highWaterMarks ===
        "object"
        ? saved.highWaterMarks
        : {};

    this.lastRiskEvent =
      saved
        ?.lastRiskEvent ||
      null;

    this.initialized =
      true;

    return this.getState();
  }

  getState() {
    return {
      initialized:
        this.initialized,

      running:
        this.running,

      processing:
        this.processing,

      intervalMs:
        this.intervalMs,

      highWaterMarks: {
        ...this.highWaterMarks,
      },

      lastCheck:
        this.lastCheck,

      lastRiskEvent:
        this.lastRiskEvent,

      lastError:
        this.lastError,
    };
  }

  async persistState() {
    await saveLocalSettings(
      LOCAL_SETTINGS_KEY,
      {
        highWaterMarks: {
          ...this.highWaterMarks,
        },

        lastRiskEvent:
          this.lastRiskEvent,
      },
    );
  }

  start() {
    if (
      this.running
    ) {
      return;
    }

    this.running =
      true;

    this.runOnce()
      .catch(
        (error) => {
          console.error(
            "Position risk monitor failed:",
            error,
          );
        },
      );

    this.timer =
      setInterval(
        () => {
          this.runOnce()
            .catch(
              (error) => {
                console.error(
                  "Position risk monitor failed:",
                  error,
                );
              },
            );
        },

        this.intervalMs,
      );
  }

  stop() {
    this.running =
      false;

    if (
      this.timer
    ) {
      clearInterval(
        this.timer,
      );

      this.timer =
        null;
    }
  }

  async runOnce() {
    if (
      this.processing
    ) {
      return this.getState();
    }

    this.processing =
      true;

    try {
      const settings =
        typeof this
          .getTradingSettings ===
        "function"
          ? this
              .getTradingSettings()
          : null;

      /*
       * If server automation is disabled,
       * do not perform automated risk exits.
       */
      if (
        !settings?.enabled ||
        settings
          ?.emergencyStop
      ) {
        this.lastCheck = {
          timestamp:
            Date.now(),

          positionCount:
            0,

          monitoredCount:
            0,

          message:
            settings
              ?.emergencyStop
              ? "Emergency stop active."
              : "Trading engine disabled.",
        };

        return this.getState();
      }

      const portfolio =
        await getPaperPortfolio({
          tradeLimit:
            500,
        });

      const positions =
        portfolio
          ?.positions ||
        {};

      const activeSymbol =
        typeof this
          .getActiveSymbol ===
        "function"
          ? this
              .getActiveSymbol()
          : null;

      /*
       * The existing server trading engine
       * already manages risk for the active
       * market.
       *
       * This monitor protects every OTHER
       * open position.
       */
      const symbols =
        Object.keys(
          positions,
        )
          .filter(
            (symbol) => {
              const position =
                positions[
                  symbol
                ];

              return (
                Number(
                  position
                    ?.quantity,
                ) >
                  0 &&
                symbol !==
                  activeSymbol
              );
            },
          );

      /*
       * Remove high-water marks belonging to
       * positions that no longer exist.
       */
      const openSymbols =
        new Set(
          Object.keys(
            positions,
          ),
        );

      let stateChanged =
        false;

      for (
        const symbol of Object.keys(
          this.highWaterMarks,
        )
      ) {
        if (
          !openSymbols.has(
            symbol,
          )
        ) {
          delete this
            .highWaterMarks[
              symbol
            ];

          stateChanged =
            true;
        }
      }

      if (
        stateChanged
      ) {
        await this
          .persistState();
      }

      if (
        symbols.length ===
        0
      ) {
        this.lastCheck = {
          timestamp:
            Date.now(),

          positionCount:
            Object.keys(
              positions,
            ).length,

          monitoredCount:
            0,

          activeSymbol:
            activeSymbol ||
            null,

          message:
            "No background positions require monitoring.",
        };

        this.lastError =
          null;

        return this.getState();
      }

      const prices =
        await fetchPrices(
          symbols,
        );

      let monitoredCount =
        0;

      for (
        const symbol of symbols
      ) {
        const position =
          positions[
            symbol
          ];

        const price =
          Number(
            prices[
              symbol
            ],
          );

        if (
          !Number.isFinite(
            price,
          ) ||
          price <= 0
        ) {
          continue;
        }

        monitoredCount +=
          1;

        await this
          .evaluatePosition({
            symbol,
            position,
            price,
            settings,
          });
      }

      this.lastCheck = {
        timestamp:
          Date.now(),

        positionCount:
          Object.keys(
            positions,
          ).length,

        monitoredCount,

        activeSymbol:
          activeSymbol ||
          null,

        message:
          `Monitored ${monitoredCount} background position${
            monitoredCount ===
            1
              ? ""
              : "s"
          }.`,
      };

      this.lastError =
        null;

      return this.getState();
    } catch (error) {
      this.lastError =
        error.message ||
        "Position risk monitor failed.";

      throw error;
    } finally {
      this.processing =
        false;
    }
  }

  async evaluatePosition({
    symbol,
    position,
    price,
    settings,
  }) {
    const quantity =
      Number(
        position
          ?.quantity,
      );

    const entryPrice =
      Number(
        position
          ?.averageEntryPrice,
      );

    if (
      !Number.isFinite(
        quantity,
      ) ||
      quantity <= 0 ||
      !Number.isFinite(
        entryPrice,
      ) ||
      entryPrice <= 0
    ) {
      return;
    }

    const previousHigh =
      Number(
        this
          .highWaterMarks[
            symbol
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
        symbol
      ] =
        highWaterMark;

      await this
        .persistState();
    } else if (
      !this
        .highWaterMarks[
          symbol
        ]
    ) {
      this.highWaterMarks[
        symbol
      ] =
        highWaterMark;

      await this
        .persistState();
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

    let reason =
      null;

    if (
      returnPercent <=
      -Math.abs(
        Number(
          settings
            .stopLossPercent,
        ) || 2,
      )
    ) {
      type =
        "STOP_LOSS";

      reason =
        `Background stop-loss triggered at ${returnPercent.toFixed(
          2,
        )}%.`;
    } else if (
      returnPercent >=
      Math.abs(
        Number(
          settings
            .takeProfitPercent,
        ) || 4,
      )
    ) {
      type =
        "TAKE_PROFIT";

      reason =
        `Background take-profit triggered at ${returnPercent.toFixed(
          2,
        )}%.`;
    } else if (
      settings
        .trailingStopEnabled &&
      highWaterMark >
        entryPrice &&
      trailingDropPercent >=
        Math.abs(
          Number(
            settings
              .trailingStopPercent,
          ) || 1.5,
        )
    ) {
      type =
        "TRAILING_STOP";

      reason =
        `Background trailing stop triggered after a ${trailingDropPercent.toFixed(
          2,
        )}% decline from the position high.`;
    }

    if (!type) {
      return;
    }

    /*
     * Bucket by minute.
     *
     * This prevents duplicate execution
     * attempts during repeated 5-second
     * checks while still allowing a retry
     * later if an execution genuinely fails.
     */
    const minuteBucket =
      Math.floor(
        Date.now() /
          60000,
      );

    const orderKey =
      `${symbol}-BACKGROUND-RISK-${type}-${minuteBucket}`;

    const result =
      await executeIdempotentPaperOrder({
        orderKey,

        order: {
          symbol,

          side:
            "SELL",

          quantity,

          price,
        },

        metadata: {
          source:
            "POSITION_RISK_MONITOR",

          type,

          entryPrice,

          highWaterMark,

          returnPercent,

          trailingDropPercent,
        },
      });

    const event =
      saveRiskEvent({
        type,

        symbol,

        timeframe:
          null,

        price,

        quantity,

        executed:
          Boolean(
            result.success,
          ),

        orderKey,

        message:
          `${reason} ${
            result.message ||
            ""
          }`,

        timestamp:
          Date.now(),
      });

    this.lastRiskEvent =
      event;

    if (
      result.success
    ) {
      delete this
        .highWaterMarks[
          symbol
        ];
    }

    await this
      .persistState();

    if (
      typeof this
        .onRiskEvent ===
      "function"
    ) {
      await this
        .onRiskEvent(
          event,
        );
    }
  }
}