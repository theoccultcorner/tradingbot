import { Router } from "express";
import {
  loadBotSettings,
  saveBotSettings,
} from "../services/botSettingsService.js";

const ALLOWED = new Set(["autoTrader", "riskManager"]);

function validateType(value) {
  const type = String(value || "").trim();
  if (!ALLOWED.has(type)) {
    throw new Error(
      "Settings type must be autoTrader or riskManager.",
    );
  }
  return type;
}

export function createSettingsRouter() {
  const router = Router();

  router.get("/:type", async (request, response, next) => {
    try {
      const type = validateType(request.params.type);
      const settings = await loadBotSettings(type);

      response.json({
        success: true,
        settings,
      });
    } catch (error) {
      next(error);
    }
  });

  router.put("/:type", async (request, response, next) => {
    try {
      const type = validateType(request.params.type);
      const settings = await saveBotSettings(
        type,
        request.body || {},
      );

      response.json({
        success: true,
        settings,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
