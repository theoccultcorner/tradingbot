import { Router } from "express";

const VALID_TIMEFRAMES = new Set([
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M",
]);

function normalizeSymbol(value) {
  const symbol = String(value || "")
    .trim()
    .toUpperCase();

  if (!/^[A-Z0-9]{5,20}$/.test(symbol)) {
    throw new Error(
      "A valid Binance symbol is required.",
    );
  }

  return symbol;
}

function normalizeTimeframe(value) {
  const timeframe = String(value || "").trim();

  if (!VALID_TIMEFRAMES.has(timeframe)) {
    throw new Error(
      "The selected timeframe is not supported.",
    );
  }

  return timeframe;
}

export function createMarketRouter({
  marketService,
  getLatestMarketState,
}) {
  const router = Router();

  router.get("/state", (request, response) => {
    const marketState = getLatestMarketState();

    if (!marketState) {
      return response.status(503).json({
        success: false,
        message: "Market data is still starting.",
      });
    }

    return response.json(marketState);
  });

  router.post(
    "/change",
    async (request, response, next) => {
      try {
        const symbol = normalizeSymbol(
          request.body?.symbol ||
            process.env.DEFAULT_SYMBOL ||
            "SOLUSD",
        );

        const timeframe = normalizeTimeframe(
          request.body?.timeframe ||
            process.env.DEFAULT_TIMEFRAME ||
            "1m",
        );

        await marketService.changeMarket({
          symbol,
          timeframe,
        });

        response.json({
          success: true,
          symbol,
          timeframe,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
