import {
  useState,
} from "react";

import "./App.css";

import AnalyticsPanel from "./components/AnalyticsPanel";
import AutoMarketSelectorPanel from "./components/AutoMarketSelectorPanel";
import BacktestPanel from "./components/BacktestPanel";
import FourMarketCharts from "./components/FourMarketCharts";
import IndicatorPanel from "./components/IndicatorPanel";
import MarketScannerPanel from "./components/MarketScannerPanel";
import MarketStats from "./components/MarketStats";
import NavigationMenu from "./components/NavigationMenu";
import OrderBook from "./components/OrderBook";
import PaperBacktestComparisonPanel from "./components/PaperBacktestComparisonPanel";
import PortfolioPanel from "./components/PortfolioPanel";
import RecentTrades from "./components/RecentTrades";
import RiskManagerPanel from "./components/RiskManagerPanel";
import ServerActivityPanel from "./components/ServerActivityPanel";
import ServerPerformancePanel from "./components/ServerPerformancePanel";
import ServerTradingEnginePanel from "./components/ServerTradingEnginePanel";
import SignalPanel from "./components/SignalPanel";
import TradingChart from "./components/TradingChart";

import useAutoMarketSelector from "./hooks/useAutoMarketSelector";
import useBinanceMarket from "./hooks/useBinanceMarket";
import useMarketPrices from "./hooks/useMarketPrices";
import usePaperPortfolio from "./hooks/usePaperPortfolio";
import usePortfolioAnalytics from "./hooks/usePortfolioAnalytics";
import useServerActivity from "./hooks/useServerActivity";
import useServerPerformance from "./hooks/useServerPerformance";
import useServerTradingEngine from "./hooks/useServerTradingEngine";

const SUPPORTED_SYMBOLS = [
  "BTCUSD",
  "ETHUSD",
  "SOLUSD",
  "DOGEUSD",
  "ADAUSD",
  "LINKUSD",
  "AVAXUSD",
  "XRPUSD",
];

const TIMEFRAMES = [
  {
    label:
      "1m",
    value:
      "1m",
  },

  {
    label:
      "5m",
    value:
      "5m",
  },

  {
    label:
      "15m",
    value:
      "15m",
  },

  {
    label:
      "30m",
    value:
      "30m",
  },

  {
    label:
      "1h",
    value:
      "1h",
  },

  {
    label:
      "4h",
    value:
      "4h",
  },

  {
    label:
      "1D",
    value:
      "1d",
  },
];

const VIEW_TITLES = {
  dashboard:
    "Dashboard",

  market:
    "Live Market",

  charts:
    "Charts",

  wallet:
    "Wallet",

  orders:
    "Orders & Trades",

  engine:
    "Trading Engine",

  selector:
    "Auto Market Selector",

  scanner:
    "Market Scanner",

  risk:
    "Risk Manager",

  signals:
    "Signals",

  indicators:
    "Indicators",

  analytics:
    "Trading Analytics",

  performance:
    "Server Performance",

  backtest:
    "Backtesting",

  comparison:
    "Paper vs Backtest",

  activity:
    "Server Activity",
};

function formatMoney(
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
    return "—";
  }

  return number.toLocaleString(
    "en-US",
    {
      style:
        "currency",

      currency:
        "USD",

      maximumFractionDigits:
        2,
    },
  );
}

function App() {
  const [
    activeView,
    setActiveView,
  ] =
    useState(
      "dashboard",
    );

  const [
    symbol,
    setSymbol,
  ] =
    useState(
      "SOLUSD",
    );

  const [
    timeframe,
    setTimeframe,
  ] =
    useState(
      "1m",
    );

  const [
    quantity,
    setQuantity,
  ] =
    useState(
      "0.1",
    );

  const [
    orderMessage,
    setOrderMessage,
  ] =
    useState(
      "",
    );

  const [
    orderLoadingSide,
    setOrderLoadingSide,
  ] =
    useState(
      null,
    );

  const orderLoading =
    orderLoadingSide !==
    null;

  /*
   * =========================================================
   * SELECTED MARKET
   * =========================================================
   *
   * This remains responsible for candles,
   * indicators, order book, trades, etc.
   */
  const market =
    useBinanceMarket({
      symbol,
      timeframe,
    });

  /*
   * =========================================================
   * ALL PORTFOLIO MARKET PRICES
   * =========================================================
   *
   * Every supported holding gets priced
   * simultaneously for portfolio equity.
   */
  const portfolioMarkets =
    useMarketPrices({
      symbols:
        SUPPORTED_SYMBOLS,

      refreshMs:
        5000,
    });

  /*
   * Make the selected live market price
   * authoritative for the selected symbol.
   */
  const allLivePrices = {
    ...portfolioMarkets
      .prices,

    ...(
      Number.isFinite(
        Number(
          market.price,
        ),
      ) &&
      Number(
        market.price,
      ) >
        0
        ? {
            [symbol]:
              Number(
                market.price,
              ),
          }
        : {}
    ),
  };

  /*
   * =========================================================
   * PAPER PORTFOLIO
   * =========================================================
   */
  const portfolio =
    usePaperPortfolio({
      prices:
        allLivePrices,

      feeRate:
        0.001,
    });

  const analyticsState =
    usePortfolioAnalytics({
      portfolio,
    });

  const autoSelector =
    useAutoMarketSelector();

  const serverEngine =
    useServerTradingEngine();

  const serverPerformance =
    useServerPerformance();

  const serverActivity =
    useServerActivity();

  const tradingSignal =
    market.signal;

  /*
   * Automated trading and automated risk execution
   * are now controlled only by the Server Trading Engine.
   *
   * The old browser-side Auto Trader and Risk Manager
   * execution hooks have been retired.
   */

  const estimatedOrderValue =
    Number(
      market.price,
    ) *
    Number(
      quantity,
    );

  /*
   * =========================================================
   * SERVER ENGINE / RISK STATE
   * =========================================================
   */
  const serverSettings =
    serverEngine
      .engine
      ?.settings ||
    {};

  const serverStatus =
    serverEngine
      .engine
      ?.status ||
    "Loading";

  const emergencyStop =
    Boolean(
      serverSettings
        .emergencyStop,
    );

  const serverRiskLoaded =
    Boolean(
      serverEngine
        .engine,
    );

  const manualBuyAllowed =
    serverRiskLoaded &&
    !emergencyStop;

  const manualRiskStatus =
    !serverRiskLoaded
      ? "Loading server risk controls"
      : emergencyStop
        ? "Emergency stop active"
        : "New entries allowed";

  /*
   * =========================================================
   * MANUAL ORDER
   * =========================================================
   */
  async function submitOrder(
    side,
  ) {
    if (
      orderLoading
    ) {
      return;
    }

    setOrderLoadingSide(
      side,
    );

    setOrderMessage(
      "",
    );

    try {
      const numericQuantity =
        Number(
          quantity,
        );

      const currentPrice =
        Number(
          market.price,
        );

      if (
        !Number.isFinite(
          numericQuantity,
        ) ||
        numericQuantity <=
          0
      ) {
        throw new Error(
          "Enter a quantity greater than zero.",
        );
      }

      if (
        !Number.isFinite(
          currentPrice,
        ) ||
        currentPrice <=
          0
      ) {
        throw new Error(
          "A valid live market price is required.",
        );
      }

      if (
        side ===
          "BUY" &&
        !manualBuyAllowed
      ) {
        throw new Error(
          `New entries are blocked: ${manualRiskStatus}.`,
        );
      }

      const result =
        await portfolio
          .placePaperOrder({
            symbol,

            side,

            quantity:
              numericQuantity,

            price:
              currentPrice,
          });

      if (
        !result.success
      ) {
        throw new Error(
          result.message ||
            "The paper order failed.",
        );
      }

      setOrderMessage(
        result.message ||
          "Paper order completed.",
      );
    } catch (
      error
    ) {
      setOrderMessage(
        error.message ||
          "The paper order failed.",
      );
    } finally {
      setOrderLoadingSide(
        null,
      );
    }
  }

  /*
   * =========================================================
   * RESET
   * =========================================================
   */
  async function resetPaperPortfolio() {
    const approved =
      window.confirm(
        "Reset the paper account back to $300? This deletes its trade history.",
      );

    if (
      !approved
    ) {
      return;
    }

    setOrderLoadingSide(
      "RESET",
    );

    setOrderMessage(
      "",
    );

    try {
      const result =
        await portfolio
          .resetPortfolio(
            300,
          );

      if (
        !result.success
      ) {
        throw new Error(
          result.message ||
            "Could not reset the paper portfolio.",
        );
      }

      analyticsState
        .resetEquityHistory();

      setOrderMessage(
        result.message ||
          "Paper portfolio reset successfully to $300.",
      );
    } catch (
      error
    ) {
      setOrderMessage(
        error.message ||
          "Could not reset the paper portfolio.",
      );
    } finally {
      setOrderLoadingSide(
        null,
      );
    }
  }

  /*
   * =========================================================
   * MARKET SELECTION
   * =========================================================
   */
  function handleSymbolChange(
    event,
  ) {
    const nextSymbol =
      event.target
        .value;

    setSymbol(
      nextSymbol,
    );

    setOrderMessage(
      "",
    );
  }

  function selectSymbol(
    nextSymbol,
  ) {
    setSymbol(
      nextSymbol,
    );

    setOrderMessage(
      "",
    );

    setActiveView(
      "market",
    );
  }

  function handleTimeframeChange(
    nextTimeframe,
  ) {
    setTimeframe(
      nextTimeframe,
    );

    setOrderMessage(
      "",
    );
  }

  /*
   * =========================================================
   * MANUAL ORDER PANEL
   * =========================================================
   */
  function renderPaperOrderPanel() {
    const numericQuantity =
      Number(
        quantity,
      );

    const currentPrice =
      Number(
        market.price,
      );

    const validQuantity =
      Number.isFinite(
        numericQuantity,
      ) &&
      numericQuantity >
        0;

    const validPrice =
      Number.isFinite(
        currentPrice,
      ) &&
      currentPrice >
        0;

    return (
      <section className="panel order-entry-panel">
        <div className="panel-header">
          <div>
            <p className="panel-eyebrow">
              PAPER EXECUTION
            </p>

            <h2>
              Manual Order
            </h2>
          </div>

          <span
            className={
              market
                .connectionStatus ===
              "Connected"
                ? "positive"
                : "neutral"
            }
          >
            {market
              .connectionStatus ||
              "Market"}
          </span>
        </div>

        <label className="order-input">
          <span>
            Quantity
          </span>

          <input
            type="number"
            min="0"
            step="any"
            value={
              quantity
            }
            onChange={(
              event,
            ) =>
              setQuantity(
                event.target
                  .value,
              )
            }
          />
        </label>

        <p className="estimated-value">
          Market:{" "}

          <strong>
            {symbol.replace(
              "USD",
              "/USD",
            )}
          </strong>
        </p>

        <p className="estimated-value">
          Current price:{" "}

          <strong>
            {formatMoney(
              market.price,
            )}
          </strong>
        </p>

        <p className="estimated-value">
          Estimated value:{" "}

          <strong>
            {Number.isFinite(
              estimatedOrderValue,
            )
              ? formatMoney(
                  estimatedOrderValue,
                )
              : "—"}
          </strong>
        </p>

        <p className="estimated-value">
          Available cash:{" "}

          <strong>
            {formatMoney(
              portfolio.cash,
            )}
          </strong>
        </p>

        <p className="estimated-value">
          Total crypto value:{" "}

          <strong>
            {formatMoney(
              portfolio
                .marketValue,
            )}
          </strong>
        </p>

        <p className="estimated-value">
          Total equity:{" "}

          <strong>
            {formatMoney(
              portfolio
                .totalEquity,
            )}
          </strong>
        </p>

        <p className="estimated-value">
          Risk status:{" "}

          <strong
            className={
              !serverRiskLoaded
                ? "neutral"
                : manualBuyAllowed
                  ? "positive"
                  : "negative"
            }
          >
            {
              manualRiskStatus
            }
          </strong>
        </p>

        {portfolioMarkets
          .error && (
          <p className="scanner-error">
            {
              portfolioMarkets
                .error
            }
          </p>
        )}

        <div className="order-buttons">
          <button
            type="button"
            className="buy-button"
            disabled={
              orderLoading ||
              !validQuantity ||
              !validPrice ||
              !serverRiskLoaded
            }
            onClick={() =>
              submitOrder(
                "BUY",
              )
            }
          >
            {orderLoadingSide ===
            "BUY"
              ? "Buying…"
              : "Buy"}
          </button>

          <button
            type="button"
            className="sell-button"
            disabled={
              orderLoading ||
              !validQuantity ||
              !validPrice
            }
            onClick={() =>
              submitOrder(
                "SELL",
              )
            }
          >
            {orderLoadingSide ===
            "SELL"
              ? "Selling…"
              : "Sell"}
          </button>
        </div>

        {orderMessage && (
          <p className="order-message">
            {
              orderMessage
            }
          </p>
        )}
      </section>
    );
  }

  /*
   * =========================================================
   * DASHBOARD
   * =========================================================
   */
  function renderDashboard() {
    return (
      <div className="dashboard-home">
        <section className="dashboard-summary-grid">
          <article className="dashboard-summary-card">
            <span>
              Total equity
            </span>

            <strong>
              {formatMoney(
                portfolio
                  .totalEquity,
              )}
            </strong>

            <small>
              Cash + all crypto holdings
            </small>
          </article>

          <article className="dashboard-summary-card">
            <span>
              Available cash
            </span>

            <strong>
              {formatMoney(
                portfolio.cash,
              )}
            </strong>

            <small>
              Ready to trade
            </small>
          </article>

          <article className="dashboard-summary-card">
            <span>
              Crypto value
            </span>

            <strong>
              {formatMoney(
                portfolio
                  .marketValue,
              )}
            </strong>

            <small>
              All open positions
            </small>
          </article>

          <article className="dashboard-summary-card">
            <span>
              Total profit
            </span>

            <strong
              className={
                Number(
                  portfolio
                    .totalProfit,
                ) >
                0
                  ? "positive"
                  : Number(
                        portfolio
                          .totalProfit,
                      ) <
                      0
                    ? "negative"
                    : "neutral"
              }
            >
              {formatMoney(
                portfolio
                  .totalProfit,
              )}
            </strong>

            <small>
              Equity − starting cash
            </small>
          </article>

          <article className="dashboard-summary-card">
            <span>
              Unrealized P/L
            </span>

            <strong
              className={
                Number(
                  portfolio
                    .unrealizedProfit,
                ) >
                0
                  ? "positive"
                  : Number(
                        portfolio
                          .unrealizedProfit,
                      ) <
                      0
                    ? "negative"
                    : "neutral"
              }
            >
              {formatMoney(
                portfolio
                  .unrealizedProfit,
              )}
            </strong>

            <small>
              Open positions
            </small>
          </article>

          <article className="dashboard-summary-card">
            <span>
              Realized P/L
            </span>

            <strong
              className={
                Number(
                  portfolio
                    .realizedProfit,
                ) >
                0
                  ? "positive"
                  : Number(
                        portfolio
                          .realizedProfit,
                      ) <
                      0
                    ? "negative"
                    : "neutral"
              }
            >
              {formatMoney(
                portfolio
                  .realizedProfit,
              )}
            </strong>

            <small>
              Closed positions
            </small>
          </article>

          <article className="dashboard-summary-card">
            <span>
              Price coverage
            </span>

            <strong
              className={
                portfolio
                  .valuationComplete
                  ? "positive"
                  : "neutral"
              }
            >
              {portfolio
                .liveValuedPositions}
              {" / "}
              {Object.keys(
                portfolio
                  .positions ||
                  {},
              ).length}
              {" live"}
            </strong>

            <small>
              Missing quotes use entry price
            </small>
          </article>

          <article className="dashboard-summary-card">
            <span>
              Trading engine
            </span>

            <strong
              className={
                emergencyStop
                  ? "negative"
                  : serverSettings
                        .enabled
                    ? "positive"
                    : "neutral"
              }
            >
              {emergencyStop
                ? "STOPPED"
                : serverStatus}
            </strong>

            <small>
              Server automation
            </small>
          </article>
        </section>

        <div className="dashboard-main-grid">
          <div className="dashboard-main-chart">
            <TradingChart
              candles={
                market.candles
              }
              indicators={
                market.indicators
              }
              symbol={
                symbol
              }
              timeframe={
                timeframe
              }
            />
          </div>

          <div className="dashboard-side-stack">
            <SignalPanel
              signal={
                tradingSignal
              }
            />

            <MarketStats
              symbol={
                symbol
              }
              price={
                market.price
              }
              priceDirection={
                market
                  .priceDirection
              }
              connectionStatus={
                market
                  .connectionStatus
              }
              bid={
                market.bid
              }
              ask={
                market.ask
              }
              spread={
                market.spread
              }
              priceChangePercent={
                market
                  .priceChangePercent
              }
              high24h={
                market.high24h
              }
              low24h={
                market.low24h
              }
              volume24h={
                market.volume24h
              }
              quoteVolume24h={
                market
                  .quoteVolume24h
              }
            />
          </div>
        </div>
      </div>
    );
  }

  /*
   * =========================================================
   * VIEW ROUTING
   * =========================================================
   */
  function renderActiveView() {
    switch (
      activeView
    ) {
      case "dashboard":
        return renderDashboard();

      case "market":
        return (
          <div className="view-stack">
            <div className="market-view-grid">
              <MarketStats
                symbol={
                  symbol
                }
                price={
                  market.price
                }
                priceDirection={
                  market
                    .priceDirection
                }
                connectionStatus={
                  market
                    .connectionStatus
                }
                bid={
                  market.bid
                }
                ask={
                  market.ask
                }
                spread={
                  market.spread
                }
                priceChangePercent={
                  market
                    .priceChangePercent
                }
                high24h={
                  market.high24h
                }
                low24h={
                  market.low24h
                }
                volume24h={
                  market.volume24h
                }
                quoteVolume24h={
                  market
                    .quoteVolume24h
                }
              />

              {renderPaperOrderPanel()}
            </div>

            <TradingChart
              candles={
                market.candles
              }
              indicators={
                market.indicators
              }
              symbol={
                symbol
              }
              timeframe={
                timeframe
              }
            />

            <div className="two-panel-grid">
              <OrderBook
                bids={
                  market.bids
                }
                asks={
                  market.asks
                }
                spread={
                  market.spread
                }
                limit={
                  10
                }
              />

              <RecentTrades
                trades={
                  market.trades
                }
                limit={
                  25
                }
              />
            </div>
          </div>
        );

      case "charts":
        return (
          <div className="view-stack">
            <FourMarketCharts />

            <IndicatorPanel
              price={
                market.price
              }
              indicators={
                market.indicators
              }
            />
          </div>
        );

      case "wallet":
        return (
          <PortfolioPanel
            portfolio={
              portfolio
            }
            onReset={
              resetPaperPortfolio
            }
          />
        );

      case "orders":
        return (
          <div className="view-stack">
            {renderPaperOrderPanel()}

            <div className="two-panel-grid">
              <OrderBook
                bids={
                  market.bids
                }
                asks={
                  market.asks
                }
                spread={
                  market.spread
                }
                limit={
                  15
                }
              />

              <RecentTrades
                trades={
                  market.trades
                }
                limit={
                  50
                }
              />
            </div>
          </div>
        );

      case "engine":
        return (
          <ServerTradingEnginePanel
            serverEngine={
              serverEngine
            }
          />
        );

      case "selector":
        return (
          <AutoMarketSelectorPanel
            autoSelector={
              autoSelector
            }
          />
        );

      case "scanner":
        return (
          <MarketScannerPanel
            activeSymbol={
              symbol
            }
            onSelectSymbol={
              selectSymbol
            }
          />
        );

      case "risk":
        return (
          <RiskManagerPanel
            serverEngine={
              serverEngine
            }
          />
        );

      case "signals":
        return (
          <SignalPanel
            signal={
              tradingSignal
            }
          />
        );

      case "indicators":
        return (
          <IndicatorPanel
            price={
              market.price
            }
            indicators={
              market.indicators
            }
          />
        );

      case "analytics":
        return (
          <AnalyticsPanel
            portfolio={
              portfolio
            }
            analyticsState={
              analyticsState
            }
          />
        );

      case "performance":
        return (
          <ServerPerformancePanel
            performance={
              serverPerformance
            }
          />
        );

      case "backtest":
        return (
          <BacktestPanel
            candles={
              market.candles
            }
            symbol={
              symbol
            }
            timeframe={
              timeframe
            }
          />
        );

      case "comparison":
        return (
          <PaperBacktestComparisonPanel
            symbol={
              symbol
            }
            timeframe={
              timeframe
            }
          />
        );

      case "activity":
        return (
          <ServerActivityPanel
            serverActivity={
              serverActivity
            }
          />
        );

      default:
        return renderDashboard();
    }
  }

  return (
    <main className="app-shell navigation-app-shell">
      <NavigationMenu
        activeView={
          activeView
        }
        onNavigate={
          setActiveView
        }
        engineStatus={
          serverStatus
        }
        emergencyStop={
          emergencyStop
        }
      />

      <div className="navigation-app-content">
        <header className="topbar navigation-topbar">
          <div className="navigation-mobile-spacer" />

          <div className="brand">
            <div className="brand-mark">
              B
            </div>

            <div>
              <p className="brand-subtitle">
                AUTOMATED MARKET DASHBOARD
              </p>

              <h1>
                {VIEW_TITLES[
                  activeView
                ] ||
                  "Trading Bot"}
              </h1>
            </div>
          </div>

          <div className="topbar-controls">
            <label className="compact-control">
              <span>
                Trading pair
              </span>

              <select
                value={
                  symbol
                }
                onChange={
                  handleSymbolChange
                }
              >
                <option value="SOLUSD">
                  SOL/USD
                </option>

                <option value="BTCUSD">
                  BTC/USD
                </option>

                <option value="ETHUSD">
                  ETH/USD
                </option>

                <option value="DOGEUSD">
                  DOGE/USD
                </option>

                <option value="ADAUSD">
                  ADA/USD
                </option>

                <option value="LINKUSD">
                  LINK/USD
                </option>

                <option value="AVAXUSD">
                  AVAX/USD
                </option>

                <option value="XRPUSD">
                  XRP/USD
                </option>
              </select>
            </label>

            <span
              className={
                emergencyStop
                  ? "paper-mode-badge emergency"
                  : "paper-mode-badge"
              }
            >
              {emergencyStop
                ? "EMERGENCY STOP"
                : "PAPER TRADING"}
            </span>
          </div>
        </header>

        {(market.error ||
          portfolio.error) && (
          <div className="error-banner">
            {market.error ||
              portfolio.error}
          </div>
        )}

        <section className="timeframe-toolbar navigation-timeframe-toolbar">
          <span>
            Chart interval
          </span>

          <div className="timeframe-buttons">
            {TIMEFRAMES.map(
              (
                item,
              ) => (
                <button
                  type="button"
                  className={
                    timeframe ===
                    item.value
                      ? "timeframe-button active"
                      : "timeframe-button"
                  }
                  key={
                    item.value
                  }
                  onClick={() =>
                    handleTimeframeChange(
                      item.value,
                    )
                  }
                >
                  {
                    item.label
                  }
                </button>
              ),
            )}
          </div>
        </section>

        <section className="navigation-page-content">
          {
            renderActiveView()
          }
        </section>
      </div>
    </main>
  );
}

export default App;