import {
  Router,
} from "express";

export function createTradingEngineRouter({
  tradingEngineService,
}) {
  const router =
    Router();

  router.get(
    "/state",
    (
      request,
      response,
    ) => {
      response.json({
        success: true,
        engine:
          tradingEngineService.getState(),
      });
    },
  );

  router.post(
    "/settings",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const engine =
          await tradingEngineService
            .updateSettings(
              request.body || {},
            );

        response.json({
          success: true,
          engine,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/enable",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const engine =
          await tradingEngineService
            .updateSettings({
              enabled: true,
            });

        response.json({
          success: true,
          engine,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/disable",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const engine =
          await tradingEngineService
            .updateSettings({
              enabled: false,
            });

        response.json({
          success: true,
          engine,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/emergency-stop",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const engine =
          await tradingEngineService
            .updateSettings({
              emergencyStop:
                Boolean(
                  request.body
                    ?.active,
                ),
            });

        response.json({
          success: true,
          engine,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
