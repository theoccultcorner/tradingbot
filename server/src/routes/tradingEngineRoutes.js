import {
  Router,
} from "express";

export function createTradingEngineRouter({
  tradingEngineService,
}) {
  const router =
    Router();

  /*
   * =========================================================
   * ENGINE STATE
   * =========================================================
   *
   * GET
   * /api/trading-engine/state
   */
  router.get(
    "/state",
    (
      request,
      response,
    ) => {
      response.json({
        success:
          true,

        engine:
          tradingEngineService
            .getState(),
      });
    },
  );

  /*
   * =========================================================
   * KILL SWITCH STATE
   * =========================================================
   *
   * GET
   * /api/trading-engine/kill-switch
   *
   * Gives the frontend a simple endpoint
   * specifically for emergency-stop status.
   */
  router.get(
    "/kill-switch",
    (
      request,
      response,
    ) => {
      const engine =
        tradingEngineService
          .getState();

      response.json({
        success:
          true,

        emergencyStop:
          Boolean(
            engine
              ?.settings
              ?.emergencyStop,
          ),

        killSwitch:
          engine
            ?.killSwitchState ||
          {
            active:
              false,

            type:
              null,

            reason:
              null,

            triggeredAt:
              null,
          },

        priceSafetyFailureCount:
          Number(
            engine
              ?.priceSafetyFailureCount,
          ) ||
          0,

        status:
          engine
            ?.status ||
          "Unknown",
      });
    },
  );

  /*
   * =========================================================
   * SETTINGS
   * =========================================================
   *
   * POST
   * /api/trading-engine/settings
   */
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
              request.body ||
              {},
            );

        response.json({
          success:
            true,

          engine,
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
   * ENABLE ENGINE
   * =========================================================
   */
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
              enabled:
                true,
            });

        response.json({
          success:
            true,

          engine,
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
   * DISABLE ENGINE
   * =========================================================
   */
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
              enabled:
                false,
            });

        response.json({
          success:
            true,

          engine,
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
   * MANUAL EMERGENCY STOP
   * =========================================================
   *
   * POST
   * /api/trading-engine/emergency-stop
   *
   * Body:
   *
   * {
   *   "active": true
   * }
   */
  router.post(
    "/emergency-stop",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const active =
          Boolean(
            request.body
              ?.active,
          );

        const engine =
          await tradingEngineService
            .updateSettings({
              emergencyStop:
                active,
            });

        response.json({
          success:
            true,

          message:
            active
              ? "Emergency stop activated."
              : "Emergency stop cleared.",

          engine,
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
   * SAFE PAPER-MODE KILL SWITCH TEST
   * =========================================================
   *
   * POST
   * /api/trading-engine/kill-switch/test
   *
   * This does NOT require intentionally losing
   * money or feeding corrupted price data.
   *
   * IMPORTANT:
   * This endpoint refuses to run outside
   * paper-trading mode.
   */
  router.post(
    "/kill-switch/test",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const tradingMode =
          String(
            process.env
              .TRADING_MODE ||
              "paper",
          )
            .trim()
            .toLowerCase();

        if (
          tradingMode !==
          "paper"
        ) {
          return response
            .status(
              403,
            )
            .json({
              success:
                false,

              message:
                "Kill-switch testing is only allowed in paper-trading mode.",
            });
        }

        const reason =
          String(
            request.body
              ?.reason ||
              "Manual paper-mode kill-switch test.",
          ).trim();

        const state = {
          symbol:
            String(
              request.body
                ?.symbol ||
                "TEST",
            )
              .trim()
              .toUpperCase(),

          timeframe:
            String(
              request.body
                ?.timeframe ||
                "test",
            ).trim(),

          price:
            Number(
              request.body
                ?.price,
            ) ||
            null,
        };

        const engine =
          await tradingEngineService
            .triggerEmergencyStop({
              type:
                "PAPER_MODE_TEST",

              reason,

              state,
            });

        return response.json({
          success:
            true,

          message:
            "Paper-mode automatic kill switch test triggered successfully.",

          engine,
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
   * SAFE PAPER-MODE KILL SWITCH RESET
   * =========================================================
   *
   * POST
   * /api/trading-engine/kill-switch/reset-test
   *
   * This only clears the emergency stop while
   * the server is explicitly in paper mode.
   */
  router.post(
    "/kill-switch/reset-test",
    async (
      request,
      response,
      next,
    ) => {
      try {
        const tradingMode =
          String(
            process.env
              .TRADING_MODE ||
              "paper",
          )
            .trim()
            .toLowerCase();

        if (
          tradingMode !==
          "paper"
        ) {
          return response
            .status(
              403,
            )
            .json({
              success:
                false,

              message:
                "Kill-switch testing can only be reset through this endpoint in paper-trading mode.",
            });
        }

        const engine =
          await tradingEngineService
            .updateSettings({
              emergencyStop:
                false,
            });

        return response.json({
          success:
            true,

          message:
            "Paper-mode kill switch test reset successfully.",

          engine,
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