import cors from "cors";
import express from "express";

import {
  createActivityRouter,
} from "./routes/activityRoutes.js";

import {
  createAutoSelectorRouter,
} from "./routes/autoSelectorRoutes.js";

import {
  createBacktestRouter,
} from "./routes/backtestRoutes.js";

import {
  createDiagnosticsRouter,
} from "./routes/diagnosticsRoutes.js";

import {
  createHealthRouter,
} from "./routes/healthRoutes.js";

import {
  createMarketRouter,
} from "./routes/marketRoutes.js";

import {
  createMultiChartRouter,
} from "./routes/multiChartRoutes.js";

import {
  createPerformanceRouter,
} from "./routes/performanceRoutes.js";

import {
  createPortfolioRouter,
} from "./routes/portfolioRoutes.js";

import {
  createScannerRouter,
} from "./routes/scannerRoutes.js";

import {
  createSettingsRouter,
} from "./routes/settingsRoutes.js";

import {
  createTradingEngineRouter,
} from "./routes/tradingEngineRoutes.js";

import {
  createWalletRouter,
} from "./routes/walletRoutes.js";

export function createApp({
  marketService,
  autoSelectorService,
  tradingEngineService,
  performanceService,
  getLatestMarketState,
}) {
  const app =
    express();

  const allowedOrigin =
    process.env.CLIENT_URL ||
    "http://localhost:5173";

  app.use(
    cors({
      origin:
        allowedOrigin,
    }),
  );

  app.use(
    express.json(),
  );

  /*
   * Health
   */
  app.use(
    "/api/health",
    createHealthRouter({
      getLatestMarketState,
    }),
  );

  /*
   * Main active trading market.
   */
  app.use(
    "/api/market",
    createMarketRouter({
      marketService,
      getLatestMarketState,
    }),
  );

  /*
   * Four-chart historical market data.
   *
   * Example:
   *
   * GET
   * /api/multi-chart/candles
   * ?symbol=BTCUSD
   * &timeframe=1m
   */
  app.use(
    "/api/multi-chart",
    createMultiChartRouter(),
  );

  /*
   * SQLite paper portfolio.
   *
   * Pass Trading Engine 2.0 into the
   * portfolio router so a wallet reset can
   * also clear stale engine runtime state.
   */
  app.use(
    "/api/portfolio",
    createPortfolioRouter({
      tradingEngineService,
    }),
  );

  /*
   * Wallet.
   *
   * Shows:
   *
   * USD cash
   * crypto quantities
   * available balances
   * live USD valuation
   * total account balance
   */
  app.use(
    "/api/wallet",
    createWalletRouter(),
  );

  /*
   * Local bot settings.
   */
  app.use(
    "/api/settings",
    createSettingsRouter(),
  );

  /*
   * Market scanner.
   */
  app.use(
    "/api/scanner",
    createScannerRouter(),
  );

  /*
   * Best-market selector.
   *
   * Keep BOTH routes working because
   * some frontend code may reference
   * /api/selector while older code may
   * still use /api/auto-selector.
   */
  app.use(
    "/api/selector",
    createAutoSelectorRouter({
      autoSelectorService,
    }),
  );

  app.use(
    "/api/auto-selector",
    createAutoSelectorRouter({
      autoSelectorService,
    }),
  );

  /*
   * Server trading engine.
   */
  app.use(
    "/api/trading-engine",
    createTradingEngineRouter({
      tradingEngineService,
    }),
  );

  /*
   * Server activity.
   */
  app.use(
    "/api/activity",
    createActivityRouter(),
  );

  /*
   * Backtesting.
   */
  app.use(
    "/api/backtest",
    createBacktestRouter(),
  );

  /*
   * Performance tracking.
   */
  app.use(
    "/api/performance",
    createPerformanceRouter({
      performanceService,
    }),
  );

  /*
   * Diagnostics.
   */
  app.use(
    "/api/diagnostics",
    createDiagnosticsRouter({
      getLatestMarketState,
      tradingEngineService,
      autoSelectorService,
    }),
  );

  /*
   * 404 handler.
   *
   * IMPORTANT:
   *
   * Every real API route must be
   * registered ABOVE this handler.
   */
  app.use(
    (
      request,
      response,
    ) => {
      response
        .status(
          404,
        )
        .json({
          success:
            false,

          message:
            "Route not found.",

          method:
            request.method,

          path:
            request.originalUrl,
        });
    },
  );

  /*
   * Global Express error handler.
   *
   * Keep this LAST.
   */
  app.use(
    (
      error,
      request,
      response,
      next,
    ) => {
      console.error(
        "Unhandled server error:",
        error,
      );

      response
        .status(
          500,
        )
        .json({
          success:
            false,

          message:
            error.message ||
            "An unexpected server error occurred.",
        });
    },
  );

  return app;
}