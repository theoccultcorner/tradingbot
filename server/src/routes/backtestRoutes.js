import {
  Router,
} from "express";

import {
  getRecentBacktests,
  runAndSaveBacktest,
} from "../services/backtestService.js";

const VALID_TIMEFRAMES =
  new Set([
    "1m",
    "3m",
    "5m",
    "15m",
    "30m",
    "1h",
    "2h",
    "4h",
    "6h",
    "8h",
    "12h",
    "1d",
    "3d",
    "1w",
  ]);

export function createBacktestRouter() {
  const router = Router();

  router.post(
    "/run",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const symbol = String(
          request.body?.symbol ||
            "SOLUSD",
        )
          .trim()
          .toUpperCase();

        const timeframe = String(
          request.body?.timeframe ||
            "15m",
        ).trim();

        if (
          !/^[A-Z0-9]{5,20}$/.test(
            symbol,
          )
        ) {
          return response
            .status(400)
            .json({
              success: false,
              message:
                "A valid symbol is required.",
            });
        }

        if (
          !VALID_TIMEFRAMES.has(
            timeframe,
          )
        ) {
          return response
            .status(400)
            .json({
              success: false,
              message:
                "Unsupported timeframe.",
            });
        }

        const result =
          await runAndSaveBacktest({
            symbol,
            timeframe,

            limit:
              request.body?.limit ||
              1000,

            startingCash:
              Number(
                request.body
                  ?.startingCash,
              ) || 10000,

            buyAmount:
              Number(
                request.body
                  ?.buyAmount,
              ) || 500,

            feeRate:
              Number(
                request.body
                  ?.feeRate,
              ) || 0.001,

            minimumConfidence:
              Number(
                request.body
                  ?.minimumConfidence,
              ) || 60,

            stopLossPercent:
              Number(
                request.body
                  ?.stopLossPercent,
              ) || 2,

            takeProfitPercent:
              Number(
                request.body
                  ?.takeProfitPercent,
              ) || 4,
          });

        response.json({
          success: true,
          result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/recent",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const backtests =
          await getRecentBacktests(
            request.query.limit,
          );

        response.json({
          success: true,
          backtests,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
