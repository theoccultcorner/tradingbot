import {
  Router,
} from "express";

import {
  getPaperPortfolio,
} from "../services/paperPortfolioService.js";

const BINANCE_REST_URL =
  process.env.BINANCE_BASE_URL ||
  "https://api.binance.us";

async function getLivePrice(
  symbol,
) {
  const query =
    new URLSearchParams({
      symbol,
    });

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
        `Could not load ${symbol} price.`,
    );
  }

  const price =
    Number(
      data.price,
    );

  if (
    !Number.isFinite(
      price,
    ) ||
    price <= 0
  ) {
    throw new Error(
      `Invalid price returned for ${symbol}.`,
    );
  }

  return price;
}

export function createWalletRouter() {
  const router =
    Router();

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
              1,
          });

        const positions =
          portfolio.positions ||
          {};

        const entries =
          Object.entries(
            positions,
          );

        const priceResults =
          await Promise.allSettled(
            entries.map(
              async ([
                symbol,
                position,
              ]) => {
                const quantity =
                  Number(
                    position.quantity,
                  ) || 0;

                const averageEntryPrice =
                  Number(
                    position.averageEntryPrice,
                  ) || 0;

                const price =
                  await getLivePrice(
                    symbol,
                  );

                const marketValue =
                  quantity *
                  price;

                const costBasis =
                  quantity *
                  averageEntryPrice;

                const unrealizedProfit =
                  marketValue -
                  costBasis;

                const unrealizedPercent =
                  costBasis >
                  0
                    ? (
                        unrealizedProfit /
                        costBasis
                      ) *
                      100
                    : 0;

                return {
                  symbol,

                  asset:
                    symbol.replace(
                      /USD$/,
                      "",
                    ),

                  quantity,

                  price,

                  averageEntryPrice,

                  costBasis,

                  marketValue,

                  unrealizedProfit,

                  unrealizedPercent,
                };
              },
            ),
          );

        const balances = [];

        const errors = [];

        priceResults.forEach(
          (
            result,
            index,
          ) => {
            if (
              result.status ===
              "fulfilled"
            ) {
              balances.push(
                result.value,
              );
            } else {
              const [
                symbol,
                position,
              ] =
                entries[
                  index
                ];

              /*
               * If Binance pricing fails,
               * still show the holding using
               * the average entry price.
               */
              const quantity =
                Number(
                  position
                    ?.quantity,
                ) || 0;

              const fallbackPrice =
                Number(
                  position
                    ?.averageEntryPrice,
                ) || 0;

              balances.push({
                symbol,

                asset:
                  symbol.replace(
                    /USD$/,
                    "",
                  ),

                quantity,

                price:
                  fallbackPrice,

                averageEntryPrice:
                  fallbackPrice,

                costBasis:
                  quantity *
                  fallbackPrice,

                marketValue:
                  quantity *
                  fallbackPrice,

                unrealizedProfit:
                  0,

                unrealizedPercent:
                  0,

                priceUnavailable:
                  true,
              });

              errors.push({
                symbol,

                message:
                  result.reason
                    ?.message ||
                  "Price unavailable.",
              });
            }
          },
        );

        balances.sort(
          (
            left,
            right,
          ) =>
            right.marketValue -
            left.marketValue,
        );

        const cash =
          Number(
            portfolio.cash,
          ) || 0;

        const cryptoValue =
          balances.reduce(
            (
              total,
              balance,
            ) =>
              total +
              Number(
                balance.marketValue ||
                  0,
              ),
            0,
          );

        const totalBalance =
          cash +
          cryptoValue;

        const startingCash =
          Number(
            portfolio.startingCash,
          ) ||
          10000;

        const totalProfit =
          totalBalance -
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

        response.json({
          success:
            true,

          wallet: {
            cash,

            cryptoValue,

            totalBalance,

            startingCash,

            totalProfit,

            totalReturnPercent,

            realizedProfit:
              Number(
                portfolio.realizedProfit,
              ) || 0,

            assetCount:
              balances.length,

            balances,

            errors,

            updatedAt:
              Date.now(),
          },
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