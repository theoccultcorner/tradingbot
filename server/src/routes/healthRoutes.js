import { Router } from "express";

export function createHealthRouter({
  getLatestMarketState,
}) {
  const router = Router();

  router.get("/", (request, response) => {
    const marketState = getLatestMarketState();

    response.json({
      status: "ok",
      tradingMode:
        process.env.TRADING_MODE || "paper",
      marketConnection:
        marketState?.connectionStatus || "Starting",
      symbol:
        marketState?.symbol ||
        process.env.DEFAULT_SYMBOL ||
        "SOLUSD",
      timeframe:
        marketState?.timeframe ||
        process.env.DEFAULT_TIMEFRAME ||
        "1m",
    });
  });

  return router;
}
