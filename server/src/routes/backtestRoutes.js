import {
  Router,
} from "express";

import {
  getRecentBacktests,
  getRecentWalkForwardTests,
  runAndSaveBacktest,
  runAndSaveWalkForwardTest,
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

function normalizeSymbol(
  value,
) {
  const symbol =
    String(
      value ||
        "SOLUSD",
    )
      .trim()
      .toUpperCase();

  if (
    !/^[A-Z0-9]{5,20}$/.test(
      symbol,
    )
  ) {
    throw new Error(
      "A valid symbol is required.",
    );
  }

  return symbol;
}

function normalizeTimeframe(
  value,
) {
  const timeframe =
    String(
      value ||
        "15m",
    ).trim();

  if (
    !VALID_TIMEFRAMES.has(
      timeframe,
    )
  ) {
    throw new Error(
      "Unsupported timeframe.",
    );
  }

  return timeframe;
}

function numberOrFallback(
  value,
  fallback,
) {
  const number =
    Number(
      value,
    );

  return Number.isFinite(
    number,
  )
    ? number
    : fallback;
}

function positiveNumberOrFallback(
  value,
  fallback,
) {
  const number =
    Number(
      value,
    );

  return (
    Number.isFinite(
      number,
    ) &&
    number >
      0
  )
    ? number
    : fallback;
}

function nonNegativeNumberOrFallback(
  value,
  fallback,
) {
  const number =
    Number(
      value,
    );

  return (
    Number.isFinite(
      number,
    ) &&
    number >=
      0
  )
    ? number
    : fallback;
}

function integerInRange(
  value,
  fallback,
  minimum,
  maximum,
) {
  const number =
    Math.floor(
      Number(
        value,
      ),
    );

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return fallback;
  }

  return Math.min(
    Math.max(
      number,
      minimum,
    ),
    maximum,
  );
}

function normalizeParameterGrid(
  value,
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value,
    )
  ) {
    return null;
  }

  const result =
    {};

  const allowedKeys = [
    "minimumScore",
    "minimumConfidence",
    "stopLossPercent",
    "takeProfitPercent",
  ];

  for (
    const key of
    allowedKeys
  ) {
    if (
      !Array.isArray(
        value[key],
      )
    ) {
      continue;
    }

    const values =
      value[key]
        .map(
          (
            item,
          ) =>
            Number(
              item,
            ),
        )
        .filter(
          (
            item,
          ) =>
            Number.isFinite(
              item,
            ),
        )
        .slice(
          0,
          10,
        );

    if (
      values.length >
      0
    ) {
      result[key] =
        values;
    }
  }

  return Object.keys(
    result,
  ).length >
    0
    ? result
    : null;
}

export function createBacktestRouter() {
  const router =
    Router();

  /*
   * =========================================================
   * STANDARD BACKTEST
   * =========================================================
   *
   * POST /api/backtest/run
   */
  router.post(
    "/run",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const symbol =
          normalizeSymbol(
            request.body
              ?.symbol,
          );

        const timeframe =
          normalizeTimeframe(
            request.body
              ?.timeframe,
          );

        /*
         * Standard backtests remain capped at
         * 1000 candles by default.
         *
         * The underlying service can now fetch
         * more, but keeping the normal route
         * conservative avoids unnecessarily
         * expensive requests.
         */
        const limit =
          integerInRange(
            request.body
              ?.limit,
            1000,
            250,
            5000,
          );

        const startingCash =
          positiveNumberOrFallback(
            request.body
              ?.startingCash,
            10000,
          );

        const buyAmount =
          positiveNumberOrFallback(
            request.body
              ?.buyAmount,
            500,
          );

        const feeRate =
          nonNegativeNumberOrFallback(
            request.body
              ?.feeRate,
            0.001,
          );

        const minimumScore =
          nonNegativeNumberOrFallback(
            request.body
              ?.minimumScore,
            60,
          );

        const minimumConfidence =
          nonNegativeNumberOrFallback(
            request.body
              ?.minimumConfidence,
            60,
          );

        const stopLossPercent =
          positiveNumberOrFallback(
            request.body
              ?.stopLossPercent,
            2,
          );

        const takeProfitPercent =
          positiveNumberOrFallback(
            request.body
              ?.takeProfitPercent,
            4,
          );

        const minimumHistory =
          integerInRange(
            request.body
              ?.minimumHistory,
            210,
            20,
            1000,
          );

        const result =
          await runAndSaveBacktest({
            symbol,

            timeframe,

            limit,

            startingCash,

            buyAmount,

            feeRate,

            minimumScore,

            minimumConfidence,

            stopLossPercent,

            takeProfitPercent,

            minimumHistory,
          });

        return response.json({
          success:
            true,

          result,
        });
      } catch (
        error
      ) {
        /*
         * Input validation errors should return
         * 400 rather than becoming server errors.
         */
        if (
          [
            "A valid symbol is required.",
            "Unsupported timeframe.",
          ].includes(
            error.message,
          )
        ) {
          return response
            .status(
              400,
            )
            .json({
              success:
                false,

              message:
                error.message,
            });
        }

        next(
          error,
        );
      }
    },
  );

  /*
   * =========================================================
   * WALK-FORWARD TEST
   * =========================================================
   *
   * POST /api/backtest/walk-forward
   *
   * Example:
   *
   * {
   *   "symbol": "SOLUSD",
   *   "timeframe": "15m",
   *   "limit": 3000,
   *   "startingCash": 300,
   *   "buyAmount": 40,
   *   "minimumScore": 40,
   *   "minimumConfidence": 60,
   *   "stopLossPercent": 1.5,
   *   "takeProfitPercent": 3,
   *   "trainingWindow": 500,
   *   "testingWindow": 150,
   *   "stepSize": 150
   * }
   */
  router.post(
    "/walk-forward",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const symbol =
          normalizeSymbol(
            request.body
              ?.symbol,
          );

        const timeframe =
          normalizeTimeframe(
            request.body
              ?.timeframe,
          );

        /*
         * Walk-forward needs substantially more
         * history than a single backtest.
         */
        const limit =
          integerInRange(
            request.body
              ?.limit,
            3000,
            500,
            5000,
          );

        const startingCash =
          positiveNumberOrFallback(
            request.body
              ?.startingCash,
            300,
          );

        const buyAmount =
          positiveNumberOrFallback(
            request.body
              ?.buyAmount,
            40,
          );

        const feeRate =
          nonNegativeNumberOrFallback(
            request.body
              ?.feeRate,
            0.001,
          );

        const minimumScore =
          nonNegativeNumberOrFallback(
            request.body
              ?.minimumScore,
            40,
          );

        const minimumConfidence =
          nonNegativeNumberOrFallback(
            request.body
              ?.minimumConfidence,
            60,
          );

        const stopLossPercent =
          positiveNumberOrFallback(
            request.body
              ?.stopLossPercent,
            1.5,
          );

        const takeProfitPercent =
          positiveNumberOrFallback(
            request.body
              ?.takeProfitPercent,
            3,
          );

        const minimumHistory =
          integerInRange(
            request.body
              ?.minimumHistory,
            210,
            20,
            1000,
          );

        const trainingWindow =
          integerInRange(
            request.body
              ?.trainingWindow,
            500,
            minimumHistory +
              25,
            4000,
          );

        const testingWindow =
          integerInRange(
            request.body
              ?.testingWindow,
            150,
            10,
            2000,
          );

        const stepSize =
          integerInRange(
            request.body
              ?.stepSize,
            testingWindow,
            1,
            2000,
          );

        const parameterGrid =
          normalizeParameterGrid(
            request.body
              ?.parameterGrid,
          );

        /*
         * Make sure the requested candle history
         * can contain at least one complete
         * training + testing sequence.
         */
        if (
          limit <
          trainingWindow +
            testingWindow
        ) {
          return response
            .status(
              400,
            )
            .json({
              success:
                false,

              message:
                `Walk-forward limit must be at least ${
                  trainingWindow +
                  testingWindow
                } candles for the selected training and testing windows.`,
            });
        }

        const result =
          await runAndSaveWalkForwardTest({
            symbol,

            timeframe,

            limit,

            startingCash,

            buyAmount,

            feeRate,

            minimumScore,

            minimumConfidence,

            stopLossPercent,

            takeProfitPercent,

            minimumHistory,

            trainingWindow,

            testingWindow,

            stepSize,

            parameterGrid,
          });

        return response.json({
          success:
            true,

          result,
        });
      } catch (
        error
      ) {
        if (
          [
            "A valid symbol is required.",
            "Unsupported timeframe.",
          ].includes(
            error.message,
          )
        ) {
          return response
            .status(
              400,
            )
            .json({
              success:
                false,

              message:
                error.message,
            });
        }

        next(
          error,
        );
      }
    },
  );

  /*
   * =========================================================
   * RECENT STANDARD BACKTESTS
   * =========================================================
   *
   * GET /api/backtest/recent
   */
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
            request.query
              .limit,
          );

        return response.json({
          success:
            true,

          backtests,
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
   * =========================================================
   * RECENT WALK-FORWARD TESTS
   * =========================================================
   *
   * GET /api/backtest/walk-forward/recent
   *
   * IMPORTANT:
   *
   * Register this after POST /walk-forward.
   * Express distinguishes the methods, so
   * there is no conflict.
   */
  router.get(
    "/walk-forward/recent",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const tests =
          await getRecentWalkForwardTests(
            request.query
              .limit,
          );

        return response.json({
          success:
            true,

          tests,
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