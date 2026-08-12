import {
  Router,
} from "express";

export function createReadinessRouter({
  goLiveReadinessService,
}) {
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
          await goLiveReadinessService
            .getReadinessReport({
              symbol,
              timeframe,
            });

        response.json({
          success:
            true,

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

  return router;
}

export default createReadinessRouter;