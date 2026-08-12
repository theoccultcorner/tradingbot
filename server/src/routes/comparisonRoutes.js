import {
  Router,
} from "express";

import {
  PaperBacktestComparisonService,
} from "../services/paperBacktestComparisonService.js";

export function createComparisonRouter({
  performanceService,
}) {
  const router =
    Router();

  /*
   * Create one comparison service instance
   * using the existing server performance
   * tracking service.
   */
  const comparisonService =
    new PaperBacktestComparisonService({
      performanceService,
    });

  /*
   * =====================================================
   * COMPLETE STEP 9 REPORT
   * =====================================================
   *
   * GET
   * /api/comparison
   *
   * Optional query parameters:
   *
   * ?symbol=SOLUSD
   * &timeframe=1m
   *
   * Returns:
   *
   * - Paper vs standard backtest
   * - Paper vs walk-forward test
   * - Combined match score
   * - Combined status
   */
  router.get(
    "/",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const symbol =
          request.query
            ?.symbol
            ? String(
                request.query
                  .symbol,
              )
                .trim()
                .toUpperCase()
            : null;

        const timeframe =
          request.query
            ?.timeframe
            ? String(
                request.query
                  .timeframe,
              ).trim()
            : null;

        const report =
          await comparisonService
            .getComparisonReport({
              symbol,
              timeframe,
            });

        return response.json({
          success:
            report.success,

          report,
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
   * =====================================================
   * PAPER VS STANDARD BACKTEST
   * =====================================================
   *
   * GET
   * /api/comparison/standard
   *
   * Optional:
   *
   * ?symbol=SOLUSD
   * &timeframe=1m
   * &backtestId=...
   */
  router.get(
    "/standard",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const symbol =
          request.query
            ?.symbol
            ? String(
                request.query
                  .symbol,
              )
                .trim()
                .toUpperCase()
            : null;

        const timeframe =
          request.query
            ?.timeframe
            ? String(
                request.query
                  .timeframe,
              ).trim()
            : null;

        const backtestId =
          request.query
            ?.backtestId
            ? String(
                request.query
                  .backtestId,
              ).trim()
            : null;

        const result =
          await comparisonService
            .compareStandard({
              symbol,
              timeframe,
              backtestId,
            });

        return response.json({
          success:
            result.success,

          comparison:
            result,
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
   * =====================================================
   * PAPER VS WALK-FORWARD
   * =====================================================
   *
   * GET
   * /api/comparison/walk-forward
   *
   * Optional:
   *
   * ?symbol=SOLUSD
   * &timeframe=1m
   * &walkForwardId=...
   */
  router.get(
    "/walk-forward",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const symbol =
          request.query
            ?.symbol
            ? String(
                request.query
                  .symbol,
              )
                .trim()
                .toUpperCase()
            : null;

        const timeframe =
          request.query
            ?.timeframe
            ? String(
                request.query
                  .timeframe,
              ).trim()
            : null;

        const walkForwardId =
          request.query
            ?.walkForwardId
            ? String(
                request.query
                  .walkForwardId,
              ).trim()
            : null;

        const result =
          await comparisonService
            .compareWalkForward({
              symbol,
              timeframe,
              walkForwardId,
            });

        return response.json({
          success:
            result.success,

          comparison:
            result,
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

export default createComparisonRouter;