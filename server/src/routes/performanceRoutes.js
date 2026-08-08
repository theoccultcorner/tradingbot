import {
  Router,
} from "express";

export function createPerformanceRouter({
  performanceService,
}) {
  const router =
    Router();

  router.get(
    "/summary",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const summary =
          await performanceService
            .getSummary();

        response.json({
          success: true,
          summary,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/equity",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const history =
          await performanceService
            .getEquityHistory(
              request.query
                .limit,
            );

        response.json({
          success: true,
          history,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/trades",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const trades =
          await performanceService
            .getTrades(
              request.query
                .limit,
            );

        response.json({
          success: true,
          trades,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/snapshot",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const snapshot =
          await performanceService
            .createSnapshot(
              request.body ||
                {},
            );

        response.json({
          success: true,
          snapshot,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/trades.csv",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const csv =
          await performanceService
            .exportTradesCsv();

        response.setHeader(
          "Content-Type",
          "text/csv; charset=utf-8",
        );

        response.setHeader(
          "Content-Disposition",
          'attachment; filename="trading-report.csv"',
        );

        response.send(
          csv,
        );
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
