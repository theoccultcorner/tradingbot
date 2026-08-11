import WebSocket from "ws";

import {
  calculateAllIndicators,
} from "../utils/indicators.js";

import {
  calculateTradingSignal,
} from "../utils/signalEngine.js";

const BINANCE_STREAM_URL =
  "wss://stream.binance.us:9443/stream";

const BINANCE_REST_URL =
  process.env.BINANCE_BASE_URL ||
  "https://api.binance.us";

const MIN_INDICATOR_CANDLES = 500;

const CANDLES_PER_24_HOURS = {
  "1m": 1440,
  "5m": 288,
  "15m": 96,
  "30m": 48,
  "1h": 24,
  "4h": 6,
  "1d": 1,
};

const MAX_TRADES = 50;

const MAX_DEPTH_LEVELS = 10;

/*
 * Limit expensive full-state cloning, WebSocket
 * broadcasting, and downstream async processing.
 *
 * 250 ms = at most 4 full publishes per second.
 */
const PUBLISH_INTERVAL_MS = 250;

function getMaximumCandles(
  timeframe,
) {
  return Math.max(
    MIN_INDICATOR_CANDLES,

    CANDLES_PER_24_HOURS[
      timeframe
    ] || 500,
  );
}

function normalizeHistoricalCandle(
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

function normalizeLiveCandle(
  kline,
) {
  return {
    time:
      Math.floor(
        Number(
          kline.t,
        ) / 1000,
      ),

    open:
      Number(
        kline.o,
      ),

    high:
      Number(
        kline.h,
      ),

    low:
      Number(
        kline.l,
      ),

    close:
      Number(
        kline.c,
      ),

    volume:
      Number(
        kline.v,
      ),

    closeTime:
      Number(
        kline.T,
      ),

    closed:
      Boolean(
        kline.x,
      ),
  };
}

function normalizeDepthLevels(
  levels = [],
) {
  if (
    !Array.isArray(
      levels,
    )
  ) {
    return [];
  }

  return levels
    .map(
      ([
        price,
        quantity,
      ]) => ({
        price:
          Number(
            price,
          ),

        quantity:
          Number(
            quantity,
          ),
      }),
    )
    .filter(
      (level) =>
        Number.isFinite(
          level.price,
        ) &&
        Number.isFinite(
          level.quantity,
        ) &&
        level.quantity >
          0,
    )
    .slice(
      0,
      MAX_DEPTH_LEVELS,
    );
}

function mergeCandle(
  candles,
  candle,
  timeframe,
) {
  if (!candle) {
    return candles;
  }

  const nextCandles = [
    ...candles,
  ];

  const lastIndex =
    nextCandles.length -
    1;

  const latestCandle =
    nextCandles[
      lastIndex
    ];

  if (!latestCandle) {
    return [
      candle,
    ];
  }

  if (
    latestCandle.time ===
    candle.time
  ) {
    nextCandles[
      lastIndex
    ] =
      candle;
  } else if (
    candle.time >
    latestCandle.time
  ) {
    nextCandles.push(
      candle,
    );
  }

  const maximumCandles =
    getMaximumCandles(
      timeframe,
    );

  return nextCandles.slice(
    -maximumCandles,
  );
}

function createInitialState(
  symbol,
  timeframe,
) {
  return {
    symbol,
    timeframe,

    connectionStatus:
      "Connecting",

    error:
      null,

    price:
      null,

    previousPrice:
      null,

    priceDirection:
      "same",

    bid:
      null,

    ask:
      null,

    spread:
      null,

    priceChangePercent:
      null,

    high24h:
      null,

    low24h:
      null,

    volume24h:
      null,

    quoteVolume24h:
      null,

    candles: [],
    bids: [],
    asks: [],
    trades: [],

    indicators: {},

    signal:
      null,

    updatedAt:
      null,
  };
}

export class BinanceMarketDataService {
  constructor({
    symbol = "SOLUSD",
    timeframe = "1m",
    onUpdate,
  } = {}) {
    this.symbol =
      String(
        symbol,
      ).toUpperCase();

    this.timeframe =
      String(
        timeframe,
      );

    this.onUpdate =
      onUpdate;

    this.state =
      createInitialState(
        this.symbol,
        this.timeframe,
      );

    this.socket =
      null;

    this.reconnectTimer =
      null;

    this.reconnectAttempts =
      0;

    /*
     * Publish throttling / backpressure.
     *
     * Binance can send many messages per second.
     * We keep internal state current immediately,
     * but only clone and publish the full state at
     * a controlled rate.
     */
    this.publishTimer =
      null;

    this.publishPending =
      false;

    this.publishInFlight =
      false;

    this.lastPublishTime =
      0;

    this.stopped =
      true;
  }

  getState() {
    return structuredClone(
      this.state,
    );
  }

  async start() {
    if (
      !this.stopped
    ) {
      return this.getState();
    }

    this.stopped =
      false;

    await this
      .loadHistoricalCandles();

    if (
      !this.stopped
    ) {
      this.connect();
    }

    return this.getState();
  }

  stop() {
    this.stopped =
      true;

    clearTimeout(
      this.reconnectTimer,
    );

    this.reconnectTimer =
      null;

    clearTimeout(
      this.publishTimer,
    );

    this.publishTimer =
      null;

    this.publishPending =
      false;

    const socket =
      this.socket;

    /*
     * Detach immediately so any later
     * events from this socket are stale.
     */
    this.socket =
      null;

    if (socket) {
      socket.removeAllListeners(
        "open",
      );

      socket.removeAllListeners(
        "message",
      );

      socket.removeAllListeners(
        "close",
      );

      socket.removeAllListeners(
        "error",
      );

      /*
       * A socket that is still CONNECTING
       * can emit an error when deliberately
       * terminated during market rotation.
       *
       * Swallow errors from this old socket.
       */
      socket.on(
        "error",
        () => {},
      );

      try {
        if (
          socket.readyState ===
          WebSocket.CONNECTING
        ) {
          socket.terminate();
        } else if (
          socket.readyState ===
          WebSocket.OPEN
        ) {
          socket.close(
            1000,
            "Market connection replaced",
          );
        } else if (
          socket.readyState ===
          WebSocket.CLOSING
        ) {
          socket.terminate();
        }
      } catch {
        /*
         * Ignore shutdown errors from an
         * intentionally replaced socket.
         */
      }
    }

    this.state
      .connectionStatus =
      "Stopped";

    this.state.updatedAt =
      Date.now();

    this.publish({
      immediate: true,
    });
  }

  async changeMarket({
    symbol =
      this.symbol,

    timeframe =
      this.timeframe,
  }) {
    const nextSymbol =
      String(
        symbol,
      ).toUpperCase();

    const nextTimeframe =
      String(
        timeframe,
      );

    /*
     * React sends the current market
     * immediately after connecting.
     *
     * Do not restart an identical
     * active market stream.
     */
    if (
      nextSymbol ===
        this.symbol &&
      nextTimeframe ===
        this.timeframe &&
      !this.stopped
    ) {
      return this.getState();
    }

    this.stop();

    this.symbol =
      nextSymbol;

    this.timeframe =
      nextTimeframe;

    this.reconnectAttempts =
      0;

    this.state =
      createInitialState(
        this.symbol,
        this.timeframe,
      );

    await this.start();

    return this.getState();
  }

  updateAnalysis() {
    this.state.indicators =
      calculateAllIndicators(
        this.state
          .candles,
      );

    this.state.signal =
      calculateTradingSignal({
        price:
          this.state
            .price,

        candles:
          this.state
            .candles,

        indicators:
          this.state
            .indicators,
      });
  }

  async loadHistoricalCandles() {
    try {
      const targetCount =
        getMaximumCandles(
          this.timeframe,
        );

      const allCandles = [];

      let endTime =
        Date.now();

      while (
        allCandles.length <
        targetCount
      ) {
        if (
          this.stopped
        ) {
          return;
        }

        const remaining =
          targetCount -
          allCandles.length;

        /*
         * Load at most 1000 candles per
         * REST request.
         *
         * The 1m timeframe therefore
         * uses two requests to reach
         * 1,440 candles.
         */
        const requestLimit =
          Math.min(
            remaining,
            1000,
          );

        const query =
          new URLSearchParams({
            symbol:
              this.symbol,

            interval:
              this.timeframe,

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
            "Binance returned invalid candle data.",
          );
        }

        if (
          data.length ===
          0
        ) {
          break;
        }

        const batch =
          data.map(
            normalizeHistoricalCandle,
          );

        /*
         * Older batches belong before
         * the candles already loaded.
         */
        allCandles.unshift(
          ...batch,
        );

        /*
         * Move the next request back to
         * immediately before the oldest
         * candle from this request.
         */
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

        /*
         * If Binance returned fewer
         * records than requested there
         * may be no additional history.
         */
        if (
          data.length <
          requestLimit
        ) {
          break;
        }
      }

      if (
        this.stopped
      ) {
        return;
      }

      /*
       * Deduplicate candles by timestamp.
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

      this.state.candles =
        [
          ...candleMap
            .values(),
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
            -targetCount,
          );

      const latestCandle =
        this.state
          .candles[
            this.state
              .candles
              .length -
            1
          ];

      if (
        latestCandle
      ) {
        this.state.price =
          latestCandle
            .close;

        this.state.previousPrice =
          latestCandle
            .close;
      }

      this.updateAnalysis();

      this.state.error =
        null;

      this.state.updatedAt =
        Date.now();

      this.publish();

      console.log(
        `Loaded ${this.state.candles.length} historical candles: ${this.symbol} ${this.timeframe}`,
      );
    } catch (
      error
    ) {
      if (
        this.stopped
      ) {
        return;
      }

      this.state.error =
        error.message;

      this.state.updatedAt =
        Date.now();

      this.publish();

      console.error(
        "Historical candle error:",
        error,
      );
    }
  }

  connect() {
    if (
      this.stopped
    ) {
      return;
    }

    clearTimeout(
      this.reconnectTimer,
    );

    this.reconnectTimer =
      null;

    this.state
      .connectionStatus =
      this.reconnectAttempts ===
      0
        ? "Connecting"
        : "Reconnecting";

    this.state.updatedAt =
      Date.now();

    this.publish();

    const streamSymbol =
      this.symbol
        .toLowerCase();

    const streams = [
      `${streamSymbol}@trade`,
      `${streamSymbol}@bookTicker`,
      `${streamSymbol}@kline_${this.timeframe}`,
      `${streamSymbol}@depth10@100ms`,
      `${streamSymbol}@ticker`,
    ].join(
      "/",
    );

    const socket =
      new WebSocket(
        `${BINANCE_STREAM_URL}?streams=${streams}`,
      );

    this.socket =
      socket;

    socket.on(
      "open",
      () => {
        /*
         * This socket might have been
         * replaced while connecting.
         */
        if (
          this.stopped ||
          this.socket !==
            socket
        ) {
          socket.removeAllListeners();

          socket.on(
            "error",
            () => {},
          );

          try {
            socket.terminate();
          } catch {
            /*
             * Ignore stale socket
             * shutdown.
             */
          }

          return;
        }

        this.reconnectAttempts =
          0;

        this.state
          .connectionStatus =
          "Live";

        this.state.error =
          null;

        this.state.updatedAt =
          Date.now();

        this.publish();

        console.log(
          `Binance stream connected: ${this.symbol} ${this.timeframe}`,
        );
      },
    );

    socket.on(
      "message",
      (
        rawMessage,
      ) => {
        if (
          this.stopped ||
          this.socket !==
            socket
        ) {
          return;
        }

        try {
          const message =
            JSON.parse(
              rawMessage
                .toString(),
            );

          this.processMessage(
            message,
          );
        } catch (
          error
        ) {
          console.error(
            "Could not process Binance message:",
            error,
          );
        }
      },
    );

    socket.on(
      "error",
      (
        error,
      ) => {
        /*
         * Ignore errors from sockets
         * already replaced by a newer
         * market connection.
         */
        if (
          this.socket !==
            socket
        ) {
          return;
        }

        if (
          this.stopped
        ) {
          return;
        }

        this.state
          .connectionStatus =
          "Connection error";

        this.state.error =
          error.message;

        this.state.updatedAt =
          Date.now();

        this.publish();

        console.error(
          "Binance WebSocket error:",
          error.message,
        );
      },
    );

    socket.on(
      "close",
      () => {
        /*
         * Ignore close events from a socket
         * already replaced by another one.
         */
        if (
          this.socket !==
            socket
        ) {
          return;
        }

        this.socket =
          null;

        if (
          this.stopped
        ) {
          return;
        }

        this.scheduleReconnect();
      },
    );
  }

  scheduleReconnect() {
    if (
      this.stopped
    ) {
      return;
    }

    this.reconnectAttempts +=
      1;

    const delay =
      Math.min(
        1000 *
          2 **
            Math.max(
              this.reconnectAttempts -
                1,
              0,
            ),

        30000,
      );

    this.state
      .connectionStatus =
      "Reconnecting";

    this.state.updatedAt =
      Date.now();

    this.publish();

    clearTimeout(
      this.reconnectTimer,
    );

    this.reconnectTimer =
      setTimeout(
        () => {
          this.reconnectTimer =
            null;

          if (
            !this.stopped
          ) {
            this.connect();
          }
        },

        delay,
      );
  }

  processMessage(
    message,
  ) {
    const {
      stream,
      data,
    } =
      message;

    if (
      !stream ||
      !data
    ) {
      return;
    }

    if (
      stream.endsWith(
        "@trade",
      )
    ) {
      this.processTrade(
        data,
      );
    } else if (
      stream.endsWith(
        "@bookTicker",
      )
    ) {
      this.processBookTicker(
        data,
      );
    } else if (
      stream.includes(
        "@kline_",
      )
    ) {
      this.processKline(
        data,
      );
    } else if (
      stream.includes(
        "@depth10",
      )
    ) {
      this.processDepth(
        data,
      );
    } else if (
      stream.endsWith(
        "@ticker",
      )
    ) {
      this.processTicker(
        data,
      );
    }

    this.state.updatedAt =
      Date.now();

    /*
     * Do not clone/broadcast the entire market
     * state for every raw Binance message.
     * publish() coalesces bursts into one update.
     */
    this.publish();
  }

  processTrade(
    data,
  ) {
    const nextPrice =
      Number(
        data.p,
      );

    const previousPrice =
      Number(
        this.state
          .price,
      );

    if (
      Number.isFinite(
        nextPrice,
      )
    ) {
      if (
        Number.isFinite(
          previousPrice,
        )
      ) {
        if (
          nextPrice >
          previousPrice
        ) {
          this.state
            .priceDirection =
            "up";
        } else if (
          nextPrice <
          previousPrice
        ) {
          this.state
            .priceDirection =
            "down";
        } else {
          this.state
            .priceDirection =
            "same";
        }
      }

      this.state.previousPrice =
        previousPrice;

      this.state.price =
        nextPrice;
    }

    const trade = {
      id:
        data.t,

      price:
        Number(
          data.p,
        ),

      quantity:
        Number(
          data.q,
        ),

      time:
        Number(
          data.T,
        ),

      buyerIsMaker:
        Boolean(
          data.m,
        ),

      side:
        data.m
          ? "sell"
          : "buy",
    };

    this.state.trades = [
      trade,
      ...this.state
        .trades,
    ].slice(
      0,
      MAX_TRADES,
    );
  }

  processBookTicker(
    data,
  ) {
    const bid =
      Number(
        data.b,
      );

    const ask =
      Number(
        data.a,
      );

    this.state.bid =
      Number.isFinite(
        bid,
      )
        ? bid
        : null;

    this.state.ask =
      Number.isFinite(
        ask,
      )
        ? ask
        : null;

    this.state.spread =
      Number.isFinite(
        bid,
      ) &&
      Number.isFinite(
        ask,
      )
        ? ask -
          bid
        : null;
  }

  processKline(
    data,
  ) {
    if (
      !data?.k
    ) {
      return;
    }

    const candle =
      normalizeLiveCandle(
        data.k,
      );

    this.state.candles =
      mergeCandle(
        this.state
          .candles,

        candle,

        this.timeframe,
      );

    this.state.price =
      candle.close;

    this.updateAnalysis();
  }

  processDepth(
    data,
  ) {
    /*
     * Support both Binance depth
     * payload formats.
     */
    const bids =
      data.bids ||
      data.b ||
      [];

    const asks =
      data.asks ||
      data.a ||
      [];

    this.state.bids =
      normalizeDepthLevels(
        bids,
      );

    this.state.asks =
      normalizeDepthLevels(
        asks,
      );
  }

  processTicker(
    data,
  ) {
    const priceChangePercent =
      Number(
        data.P,
      );

    const high24h =
      Number(
        data.h,
      );

    const low24h =
      Number(
        data.l,
      );

    const volume24h =
      Number(
        data.v,
      );

    const quoteVolume24h =
      Number(
        data.q,
      );

    this.state
      .priceChangePercent =
      Number.isFinite(
        priceChangePercent,
      )
        ? priceChangePercent
        : null;

    this.state.high24h =
      Number.isFinite(
        high24h,
      )
        ? high24h
        : null;

    this.state.low24h =
      Number.isFinite(
        low24h,
      )
        ? low24h
        : null;

    this.state.volume24h =
      Number.isFinite(
        volume24h,
      )
        ? volume24h
        : null;

    this.state.quoteVolume24h =
      Number.isFinite(
        quoteVolume24h,
      )
        ? quoteVolume24h
        : null;
  }

  publish({
    immediate = false,
  } = {}) {
    if (
      typeof this
        .onUpdate !==
      "function"
    ) {
      return;
    }

    /*
     * Mark that consumers need the latest state.
     * Multiple Binance messages can collapse into
     * a single publish.
     */
    this.publishPending =
      true;

    /*
     * Never start another expensive update while
     * the previous async onUpdate() is still
     * running. This provides backpressure and
     * prevents a growing Promise/task backlog.
     */
    if (
      this.publishInFlight
    ) {
      return;
    }

    if (
      immediate
    ) {
      clearTimeout(
        this.publishTimer,
      );

      this.publishTimer =
        null;

      void this
        .flushPublish();

      return;
    }

    if (
      this.publishTimer
    ) {
      return;
    }

    const elapsed =
      Date.now() -
      this.lastPublishTime;

    const delay =
      Math.max(
        PUBLISH_INTERVAL_MS -
          elapsed,
        0,
      );

    this.publishTimer =
      setTimeout(
        () => {
          this.publishTimer =
            null;

          void this
            .flushPublish();
        },
        delay,
      );
  }

  async flushPublish() {
    if (
      this.publishInFlight ||
      !this.publishPending ||
      typeof this
        .onUpdate !==
        "function"
    ) {
      return;
    }

    this.publishPending =
      false;

    this.publishInFlight =
      true;

    this.lastPublishTime =
      Date.now();

    try {
      /*
       * This is the expensive operation:
       * structuredClone() copies candles,
       * indicators, trades, depth, and signal.
       * It now happens at a controlled rate.
       */
      const snapshot =
        this.getState();

      await this.onUpdate(
        snapshot,
      );
    } catch (error) {
      console.error(
        "Market update consumer failed:",
        error?.message ||
          error,
      );
    } finally {
      this.publishInFlight =
        false;

      /*
       * If Binance changed state while the previous
       * update was running, schedule exactly one more
       * publish for the newest state.
       */
      if (
        this.publishPending
      ) {
        this.publish();
      }
    }
  }
}