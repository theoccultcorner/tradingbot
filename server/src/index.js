import "dotenv/config";

import {
  createApp,
} from "./app.js";

import {
  AutoMarketSelectorService,
} from "./services/autoMarketSelectorService.js";

import {
  BinanceMarketDataService,
} from "./services/marketDataService.js";

import {
  PerformanceTrackingService,
} from "./services/performanceTrackingService.js";

import {
  PositionRiskMonitorService,
} from "./services/positionRiskMonitorService.js";

import {
  ServerTradingEngineService,
} from "./services/serverTradingEngineService.js";

import {
  attachWebSocketServer,
} from "./websocket/websocketServer.js";

const port =
  Number(
    process.env.PORT,
  ) || 5000;

let latestMarketState =
  null;

let websocketController;

const tradingEngineService =
  new ServerTradingEngineService();

const performanceService =
  new PerformanceTrackingService({
    snapshotIntervalMs:
      10 *
      60 *
      1000,
  });

const marketService =
  new BinanceMarketDataService({
    symbol:
      process.env
        .DEFAULT_SYMBOL ||
      "SOLUSD",

    timeframe:
      process.env
        .DEFAULT_TIMEFRAME ||
      "1m",

    async onUpdate(
      state,
    ) {
      latestMarketState =
        state;

      websocketController
        ?.broadcast({
          type:
            "market:update",

          payload:
            state,
        });

      const results =
        await Promise.allSettled([
          tradingEngineService
            .handleMarketUpdate(
              state,
            ),

          performanceService
            .handleMarketUpdate(
              state,
            ),
        ]);

      if (
        results[0]
          ?.status ===
        "rejected"
      ) {
        console.error(
          "Trading engine update failed:",

          results[0]
            .reason
            ?.message ||
            results[0]
              .reason,
        );
      }

      if (
        results[1]
          ?.status ===
        "rejected"
      ) {
        console.error(
          "Performance tracker update failed:",

          results[1]
            .reason
            ?.message ||
            results[1]
              .reason,
        );
      }

      websocketController
        ?.broadcast({
          type:
            "trading-engine:update",

          payload:
            tradingEngineService
              .getState(),
        });
    },
  });

const autoSelectorService =
  new AutoMarketSelectorService({
    async onSelection(
      selection,
    ) {
      if (
        !selection?.symbol
      ) {
        return;
      }

      const sameMarket =
        latestMarketState
          ?.symbol ===
          selection.symbol &&
        latestMarketState
          ?.timeframe ===
          selection.timeframe;

      if (
        !sameMarket
      ) {
        await marketService
          .changeMarket({
            symbol:
              selection.symbol,

            timeframe:
              selection.timeframe,
          });
      }

      websocketController
        ?.broadcast({
          type:
            "selector:update",

          payload:
            autoSelectorService
              .getState(),
        });
    },
  });

const positionRiskMonitorService =
  new PositionRiskMonitorService({
    /*
     * Use the exact same risk settings
     * as the main server trading engine.
     */
    getTradingSettings() {
      return {
        ...tradingEngineService
          .settings,
      };
    },

    /*
     * The current active market is already
     * protected by ServerTradingEngineService.
     *
     * The background monitor protects all
     * other open positions.
     */
    getActiveSymbol() {
      return (
        latestMarketState
          ?.symbol ||
        null
      );
    },

    /*
     * Keep the main trading-engine UI aware
     * of background risk exits.
     */
    async onRiskEvent(
      event,
    ) {
      await tradingEngineService
        .recordExternalRiskEvent(
          event,
        );

      websocketController
        ?.broadcast({
          type:
            "trading-engine:update",

          payload:
            tradingEngineService
              .getState(),
        });
    },
  });

const initializationResults =
  await Promise.allSettled([
    tradingEngineService
      .initialize(),

    autoSelectorService
      .initialize(),

    positionRiskMonitorService
      .initialize(),
  ]);

const serviceNames = [
  "Server Trading Engine",
  "Auto Market Selector",
  "Position Risk Monitor",
];

initializationResults
  .forEach(
    (
      result,
      index,
    ) => {
      if (
        result.status !==
        "rejected"
      ) {
        return;
      }

      console.error(
        `${
          serviceNames[
            index
          ]
        } initialization failed:`,

        result.reason
          ?.message ||
          result.reason,
      );
    },
  );

const app =
  createApp({
    marketService,

    autoSelectorService,

    tradingEngineService,

    performanceService,

    getLatestMarketState() {
      return latestMarketState;
    },
  });

const httpServer =
  app.listen(
    port,

    async () => {
      console.log(
        `Trading server running at http://localhost:${port}`,
      );

      console.log(
        `Trading mode: ${
          process.env
            .TRADING_MODE ||
          "paper"
        }`,
      );

      console.log(
        `Server trading engine: ${
          tradingEngineService
            .settings
            ?.enabled
            ? "enabled"
            : "disabled"
        }`,
      );

      console.log(
        `Auto market selector: ${
          autoSelectorService
            .settings
            ?.enabled
            ? "enabled"
            : "disabled"
        }`,
      );

      /*
       * Start monitoring all background
       * positions.
       */
      positionRiskMonitorService
        .start();

      console.log(
        `Position risk monitor: running every ${
          positionRiskMonitorService
            .intervalMs /
          1000
        } seconds`,
      );

      try {
        await marketService
          .start();
      } catch (
        error
      ) {
        console.error(
          "Could not start market service:",
          error,
        );
      }
    },
  );

websocketController =
  attachWebSocketServer({
    httpServer,

    path:
      "/ws",

    marketService,

    getLatestMarketState() {
      return latestMarketState;
    },
  });

function shutdown(
  signal,
) {
  console.log(
    `Received ${signal}. Shutting down...`,
  );

  try {
    positionRiskMonitorService
      .stop();
  } catch (
    error
  ) {
    console.error(
      "Could not stop position risk monitor:",
      error,
    );
  }

  try {
    autoSelectorService
      .stop();
  } catch (
    error
  ) {
    console.error(
      "Could not stop auto selector:",
      error,
    );
  }

  try {
    marketService
      .stop();
  } catch (
    error
  ) {
    console.error(
      "Could not stop market service:",
      error,
    );
  }

  try {
    websocketController
      ?.close();
  } catch (
    error
  ) {
    console.error(
      "Could not close WebSocket server:",
      error,
    );
  }

  httpServer.close(
    () => {
      process.exit(
        0,
      );
    },
  );

  setTimeout(
    () => {
      process.exit(
        1,
      );
    },

    10000,
  ).unref();
}

process.on(
  "SIGINT",

  () =>
    shutdown(
      "SIGINT",
    ),
);

process.on(
  "SIGTERM",

  () =>
    shutdown(
      "SIGTERM",
    ),
);