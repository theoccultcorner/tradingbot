import {
  Router,
} from "express";

import {
  DEFAULT_SYMBOLS,
  scanMarkets,
} from "../services/marketScannerService.js";

export function createScannerRouter() {
  const router =
    Router();

  router.post(
    "/run",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const scan =
          await scanMarkets({
            symbols:
              request.body
                ?.symbols ||
              DEFAULT_SYMBOLS,

            timeframe:
              request.body
                ?.timeframe ||
              "15m",

            limit:
              request.body
                ?.limit ||
              300,
          });

        response.json({
          success: true,
          scan,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/defaults",
    (
      request,
      response,
    ) => {
      response.json({
        success: true,
        symbols:
          DEFAULT_SYMBOLS,
      });
    },
  );

  return router;
}
