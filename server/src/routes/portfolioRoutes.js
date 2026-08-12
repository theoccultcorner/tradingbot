import {
  Router,
} from "express";

import {
  getPaperPortfolio,
  placePaperOrder,
  resetPaperPortfolio,
} from "../services/paperPortfolioService.js";

/*
 * IMPORTANT:
 *
 * This route imports ONLY the SQLite
 * paper-portfolio implementation.
 *
 * There should be NO:
 *
 * firebase
 * firestore
 * firebase-admin
 * firestorePortfolioService
 *
 * imports in this file.
 */

function normalizeStartingCash(
  value,
) {
  const number =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      number,
    ) ||
    number <=
      0
  ) {
    throw new Error(
      "Starting cash must be greater than zero.",
    );
  }

  return number;
}

function normalizeOrder(
  body = {},
) {
  const symbol =
    String(
      body.symbol ||
        "",
    )
      .trim()
      .toUpperCase();

  const side =
    String(
      body.side ||
        "",
    )
      .trim()
      .toUpperCase();

  const quantity =
    Number(
      body.quantity,
    );

  const price =
    Number(
      body.price,
    );

  if (
    !/^[A-Z0-9]{5,20}$/.test(
      symbol,
    )
  ) {
    throw new Error(
      "A valid trading symbol is required.",
    );
  }

  if (
    ![
      "BUY",
      "SELL",
    ].includes(
      side,
    )
  ) {
    throw new Error(
      "Order side must be BUY or SELL.",
    );
  }

  if (
    !Number.isFinite(
      quantity,
    ) ||
    quantity <=
      0
  ) {
    throw new Error(
      "Quantity must be greater than zero.",
    );
  }

  if (
    !Number.isFinite(
      price,
    ) ||
    price <=
      0
  ) {
    throw new Error(
      "Price must be greater than zero.",
    );
  }

  return {
    symbol,
    side,
    quantity,
    price,
  };
}

export function createPortfolioRouter({
  tradingEngineService,
} = {}) {
  const router =
    Router();

  /*
   * ---------------------------------------------------------
   * GET /api/portfolio
   * ---------------------------------------------------------
   *
   * Returns the authoritative SQLite wallet.
   */
  router.get(
    "/",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const portfolio =
          await getPaperPortfolio({
            tradeLimit:
              500,
          });

        response.json({
          success:
            true,

          portfolio,

          updatedAt:
            Date.now(),
        });
      } catch (
        error
      ) {
        next(
          error,
        );
      }
    },
  );

  /*
   * ---------------------------------------------------------
   * POST /api/portfolio/order
   * ---------------------------------------------------------
   *
   * Executes against SQLite and returns the
   * complete wallet AFTER the transaction.
   *
   * This is especially important for SELL:
   *
   * crypto position decreases
   * cash increases
   */
  router.post(
    "/order",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const order =
          normalizeOrder(
            request.body,
          );

        const result =
          await placePaperOrder({
            ...order,

            metadata: {
              source:
                "MANUAL_ORDER",

              timeframe:
                request.body
                  ?.timeframe ||
                null,
            },
          });

        /*
         * paperPortfolioService already
         * returns its post-trade portfolio.
         *
         * But if an older implementation
         * doesn't, load it explicitly.
         */
        const portfolio =
          result.portfolio ||
          await getPaperPortfolio({
            tradeLimit:
              500,
          });

        response.json({
          success:
            true,

          message:
            result.message ||
            `${order.side} order completed.`,

          trade:
            result.trade ||
            null,

          portfolio,

          reconciliation: {
            cash:
              Number(
                portfolio.cash,
              ) ||
              0,

            startingCash:
              Number(
                portfolio
                  .startingCash,
              ) ||
              0,

            positionCount:
              Object.keys(
                portfolio
                  .positions ||
                  {},
              ).length,

            realizedProfit:
              Number(
                portfolio
                  .realizedProfit,
              ) ||
              0,
          },

          updatedAt:
            Date.now(),
        });
      } catch (
        error
      ) {
        next(
          error,
        );
      }
    },
  );

  /*
   * ---------------------------------------------------------
   * POST /api/portfolio/reset
   * ---------------------------------------------------------
   *
   * Reset BOTH:
   *
   * 1. SQLite paper portfolio
   * 2. Trading Engine runtime
   *
   * Trading settings remain unchanged.
   */
  router.post(
    "/reset",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const startingCash =
          normalizeStartingCash(
            request.body
              ?.startingCash ??
              300,
          );

        /*
         * First reset the authoritative
         * SQLite paper account.
         */
        const resetResult =
          await resetPaperPortfolio({
            startingCash,
          });

        /*
         * =====================================================
         * TRADING ENGINE RUNTIME RESET
         * =====================================================
         *
         * Clear old:
         *
         * lastDecision
         * lastRiskEvent
         * lastProcessedCandle
         * lastTradeTime
         * highWaterMarks
         *
         * Do NOT change engine settings.
         */
        let engine =
          null;

        if (
          tradingEngineService &&
          typeof tradingEngineService
            .resetRuntime ===
            "function"
        ) {
          engine =
            await tradingEngineService
              .resetRuntime();
        }

        /*
         * SQLite reset service currently
         * returns the portfolio directly.
         *
         * Support both possible return shapes.
         */
        const portfolio =
          resetResult
            ?.portfolio ||
          resetResult ||
          await getPaperPortfolio({
            tradeLimit:
              500,
          });

        response.json({
          success:
            true,

          message:
            `Paper portfolio reset to $${startingCash.toFixed(
              2,
            )}.`,

          portfolio,

          /*
           * Include the new engine state in
           * the response so frontend/debugging
           * can immediately verify the runtime
           * was cleared.
           */
          engine,

          reset: {
            portfolio:
              true,

            tradingEngineRuntime:
              Boolean(
                engine,
              ),
          },

          updatedAt:
            Date.now(),
        });
      } catch (
        error
      ) {
        next(
          error,
        );
      }
    },
  );

  /*
   * ---------------------------------------------------------
   * GET /api/portfolio/reconcile
   * ---------------------------------------------------------
   *
   * Diagnostic endpoint.
   *
   * Open this in the browser whenever the
   * wallet looks suspicious.
   *
   * http://localhost:5000/api/portfolio/reconcile
   */
  router.get(
    "/reconcile",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const portfolio =
          await getPaperPortfolio({
            tradeLimit:
              500,
          });

        const positions =
          Object.entries(
            portfolio.positions ||
              {},
          ).map(
            ([
              symbol,
              position,
            ]) => ({
              symbol,

              quantity:
                Number(
                  position
                    .quantity,
                ) ||
                0,

              averageEntryPrice:
                Number(
                  position
                    .averageEntryPrice,
                ) ||
                0,

              totalCost:
                Number(
                  position
                    .totalCost,
                ) ||
                0,
            }),
          );

        const latestTrades =
          (
            Array.isArray(
              portfolio.trades,
            )
              ? portfolio.trades
              : []
          )
            .slice(
              0,
              20,
            )
            .map(
              (
                trade,
              ) => ({
                id:
                  trade.id,

                symbol:
                  trade.symbol,

                side:
                  trade.side,

                quantity:
                  Number(
                    trade.quantity,
                  ) ||
                  0,

                price:
                  Number(
                    trade.price,
                  ) ||
                  0,

                grossValue:
                  Number(
                    trade
                      .grossValue,
                  ) ||
                  0,

                fee:
                  Number(
                    trade.fee,
                  ) ||
                  0,

                realizedProfit:
                  Number(
                    trade
                      .realizedProfit,
                  ) ||
                  0,

                source:
                  trade.source ||
                  null,

                timestamp:
                  trade.timestamp,
              }),
            );

        response.json({
          success:
            true,

          source:
            "SQLite paperPortfolioService",

          startingCash:
            Number(
              portfolio
                .startingCash,
            ) ||
            0,

          cash:
            Number(
              portfolio.cash,
            ) ||
            0,

          realizedProfit:
            Number(
              portfolio
                .realizedProfit,
            ) ||
            0,

          feeRate:
            Number(
              portfolio
                .feeRate,
            ) ||
            0,

          positions,

          latestTrades,

          updatedAt:
            Date.now(),
        });
      } catch (
        error
      ) {
        next(
          error,
        );
      }
    },
  );

  return router;
}