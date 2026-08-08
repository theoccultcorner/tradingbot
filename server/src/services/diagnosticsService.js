import {
  database,
} from "../config/database.js";

function createCheck({
  ok,
  name,
  message,
  details = null,
}) {
  return {
    ok: Boolean(ok),
    name,
    message,
    details,
    checkedAt:
      Date.now(),
  };
}

async function checkDatabase() {
  try {
    const result =
      database
        .prepare(
          `
            SELECT
              1 AS healthy
          `,
        )
        .get();

    const portfolio =
      database
        .prepare(
          `
            SELECT
              id,
              starting_cash,
              cash,
              realized_profit,
              fee_rate,
              updated_at
            FROM portfolio
            WHERE id = ?
          `,
        )
        .get(
          "paper",
        );

    return createCheck({
      ok:
        result?.healthy ===
        1,

      name:
        "SQLite",

      message:
        "SQLite database is connected.",

      details: {
        storage:
          "sqlite",

        portfolioExists:
          Boolean(
            portfolio,
          ),

        portfolio:
          portfolio
            ? {
                startingCash:
                  Number(
                    portfolio
                      .starting_cash,
                  ),

                cash:
                  Number(
                    portfolio.cash,
                  ),

                realizedProfit:
                  Number(
                    portfolio
                      .realized_profit,
                  ),

                feeRate:
                  Number(
                    portfolio
                      .fee_rate,
                  ),
              }
            : null,
      },
    });
  } catch (error) {
    return createCheck({
      ok:
        false,

      name:
        "SQLite",

      message:
        error.message ||
        "SQLite database check failed.",

      details:
        null,
    });
  }
}

function checkMarket(
  getLatestMarketState,
) {
  try {
    const state =
      typeof getLatestMarketState ===
      "function"
        ? getLatestMarketState()
        : null;

    if (!state) {
      return createCheck({
        ok:
          false,

        name:
          "Market",

        message:
          "Market data has not initialized yet.",
      });
    }

    const price =
      Number(
        state.price,
      );

    const connected =
      Boolean(
        state.symbol,
      ) &&
      Number.isFinite(
        price,
      ) &&
      price > 0;

    return createCheck({
      ok:
        connected,

      name:
        "Market",

      message:
        connected
          ? "Live market data is available."
          : "Live market data is incomplete.",

      details: {
        symbol:
          state.symbol ||
          null,

        timeframe:
          state.timeframe ||
          null,

        price:
          Number.isFinite(
            price,
          )
            ? price
            : null,

        connectionStatus:
          state.connectionStatus ||
          null,

        candleCount:
          Array.isArray(
            state.candles,
          )
            ? state.candles
                .length
            : 0,
      },
    });
  } catch (error) {
    return createCheck({
      ok:
        false,

      name:
        "Market",

      message:
        error.message ||
        "Market check failed.",
    });
  }
}

function checkTradingEngine(
  tradingEngineService,
) {
  try {
    if (
      !tradingEngineService
    ) {
      return createCheck({
        ok:
          false,

        name:
          "Trading Engine",

        message:
          "Trading engine service is unavailable.",
      });
    }

    const state =
      tradingEngineService
        .getState();

    const initialized =
      Boolean(
        tradingEngineService
          .initialized,
      );

    return createCheck({
      ok:
        initialized,

      name:
        "Trading Engine",

      message:
        initialized
          ? "Server trading engine is initialized."
          : "Server trading engine has not initialized.",

      details: {
        enabled:
          Boolean(
            state.settings
              ?.enabled,
          ),

        emergencyStop:
          Boolean(
            state.settings
              ?.emergencyStop,
          ),

        status:
          state.status ||
          null,

        processing:
          Boolean(
            state.processing,
          ),

        lastProcessedCandle:
          state
            .lastProcessedCandle ||
          null,

        lastTradeTime:
          Number(
            state
              .lastTradeTime,
          ) || 0,

        lastDecision:
          state
            .lastDecision ||
          null,

        lastRiskEvent:
          state
            .lastRiskEvent ||
          null,
      },
    });
  } catch (error) {
    return createCheck({
      ok:
        false,

      name:
        "Trading Engine",

      message:
        error.message ||
        "Trading engine check failed.",
    });
  }
}

function checkAutoSelector(
  autoSelectorService,
) {
  try {
    if (
      !autoSelectorService
    ) {
      return createCheck({
        ok:
          false,

        name:
          "Auto Selector",

        message:
          "Auto market selector service is unavailable.",
      });
    }

    const state =
      autoSelectorService
        .getState();

    const initialized =
      Boolean(
        autoSelectorService
          .initialized,
      );

    return createCheck({
      ok:
        initialized,

      name:
        "Auto Selector",

      message:
        initialized
          ? "Auto market selector is initialized."
          : "Auto market selector has not initialized.",

      details: {
        enabled:
          Boolean(
            state.settings
              ?.enabled,
          ),

        running:
          Boolean(
            state.running,
          ),

        timeframe:
          state.settings
            ?.timeframe ||
          null,

        minimumScore:
          Number(
            state.settings
              ?.minimumScore,
          ) || 0,

        minimumConfidence:
          Number(
            state.settings
              ?.minimumConfidence,
          ) || 0,

        lastSelection:
          state
            .lastSelection ||
          null,
      },
    });
  } catch (error) {
    return createCheck({
      ok:
        false,

      name:
        "Auto Selector",

      message:
        error.message ||
        "Auto selector check failed.",
    });
  }
}

function checkLocalSettings(
  tradingEngineService,
  autoSelectorService,
) {
  try {
    const engineReady =
      Boolean(
        tradingEngineService
          ?.initialized,
      );

    const selectorReady =
      Boolean(
        autoSelectorService
          ?.initialized,
      );

    return createCheck({
      ok:
        engineReady &&
        selectorReady,

      name:
        "Local Settings",

      message:
        engineReady &&
        selectorReady
          ? "Local bot settings are loaded."
          : "One or more local settings services are not initialized.",

      details: {
        storage:
          "server/data/server-settings.json",

        tradingEngineLoaded:
          engineReady,

        autoSelectorLoaded:
          selectorReady,
      },
    });
  } catch (error) {
    return createCheck({
      ok:
        false,

      name:
        "Local Settings",

      message:
        error.message ||
        "Local settings check failed.",
    });
  }
}

export async function runDiagnostics({
  getLatestMarketState,
  tradingEngineService,
  autoSelectorService,
}) {
  const [
    databaseCheck,
  ] =
    await Promise.all([
      checkDatabase(),
    ]);

  const marketCheck =
    checkMarket(
      getLatestMarketState,
    );

  const tradingEngineCheck =
    checkTradingEngine(
      tradingEngineService,
    );

  const autoSelectorCheck =
    checkAutoSelector(
      autoSelectorService,
    );

  const localSettingsCheck =
    checkLocalSettings(
      tradingEngineService,
      autoSelectorService,
    );

  const checks = {
    database:
      databaseCheck,

    market:
      marketCheck,

    tradingEngine:
      tradingEngineCheck,

    autoSelector:
      autoSelectorCheck,

    localSettings:
      localSettingsCheck,
  };

  /*
   * An intentionally disabled trading engine
   * or selector is not considered unhealthy.
   *
   * They simply need to initialize correctly.
   */
  const healthy =
    databaseCheck.ok &&
    marketCheck.ok &&
    tradingEngineCheck.ok &&
    autoSelectorCheck.ok &&
    localSettingsCheck.ok;

  return {
    healthy,

    storage: {
      database:
        "sqlite",

      settings:
        "local-json",

      temporaryData:
        "memory/browser",

    },

    checks,

    generatedAt:
      Date.now(),
  };
}