import {
  Router,
} from "express";

export function createAutoSelectorRouter({
  autoSelectorService,
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

        selector:
          autoSelectorService.getState(),
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
        const selector =
          await autoSelectorService.updateSettings(
            request.body || {},
          );

        response.json({
          success: true,
          selector,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/run",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const result =
          await autoSelectorService.runOnce();

        response.json({
          success: true,
          ...result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}