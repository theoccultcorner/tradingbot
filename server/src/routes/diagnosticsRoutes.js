import {
  Router,
} from "express";

import {
  runDiagnostics,
} from "../services/diagnosticsService.js";

export function createDiagnosticsRouter({
  getLatestMarketState,
  tradingEngineService,
  autoSelectorService,
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
        const diagnostics =
          await runDiagnostics({
            getLatestMarketState,
            tradingEngineService,
            autoSelectorService,
          });

        response
          .status(
            diagnostics.healthy
              ? 200
              : 503,
          )
          .json({
            success:
              diagnostics.healthy,

            diagnostics,
          });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
