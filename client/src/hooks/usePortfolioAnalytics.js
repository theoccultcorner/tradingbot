import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "binance-equity-history-v1";
const MAX_HISTORY_POINTS = 2000;

function loadEquityHistory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Could not load equity history:", error);
    return [];
  }
}

function calculateMaximumDrawdown(history) {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      amount: 0,
      percent: 0,
    };
  }

  let peak = Number(history[0].equity) || 0;
  let maximumAmount = 0;
  let maximumPercent = 0;

  for (const point of history) {
    const equity = Number(point.equity);

    if (!Number.isFinite(equity)) {
      continue;
    }

    if (equity > peak) {
      peak = equity;
    }

    if (peak <= 0) {
      continue;
    }

    const drawdownAmount = peak - equity;
    const drawdownPercent =
      (drawdownAmount / peak) * 100;

    if (drawdownAmount > maximumAmount) {
      maximumAmount = drawdownAmount;
      maximumPercent = drawdownPercent;
    }
  }

  return {
    amount: maximumAmount,
    percent: maximumPercent,
  };
}

function calculateCurrentDrawdown(history) {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      amount: 0,
      percent: 0,
    };
  }

  const validEquities = history
    .map((point) => Number(point.equity))
    .filter(Number.isFinite);

  if (validEquities.length === 0) {
    return {
      amount: 0,
      percent: 0,
    };
  }

  const peak = Math.max(...validEquities);
  const current =
    validEquities[validEquities.length - 1];

  if (peak <= 0) {
    return {
      amount: 0,
      percent: 0,
    };
  }

  const amount = peak - current;

  return {
    amount,
    percent: (amount / peak) * 100,
  };
}

function calculateStreaks(closedTrades) {
  let currentType = null;
  let currentLength = 0;

  let longestWinStreak = 0;
  let longestLossStreak = 0;

  for (const trade of closedTrades) {
    const profit = Number(trade.realizedProfit);

    const nextType =
      profit > 0
        ? "win"
        : profit < 0
          ? "loss"
          : "flat";

    if (nextType === currentType) {
      currentLength += 1;
    } else {
      currentType = nextType;
      currentLength = 1;
    }

    if (nextType === "win") {
      longestWinStreak = Math.max(
        longestWinStreak,
        currentLength,
      );
    }

    if (nextType === "loss") {
      longestLossStreak = Math.max(
        longestLossStreak,
        currentLength,
      );
    }
  }

  return {
    longestWinStreak,
    longestLossStreak,
  };
}

export default function usePortfolioAnalytics({
  portfolio,
} = {}) {
  const [equityHistory, setEquityHistory] =
    useState(loadEquityHistory);

  useEffect(() => {
    if (!portfolio) {
      return;
    }

    const equity = Number(portfolio.totalEquity);

    if (!Number.isFinite(equity)) {
      return;
    }

    setEquityHistory((previous) => {
      const timestamp = Date.now();
      const latest = previous[previous.length - 1];

      /*
       * Avoid creating excessive points from every small
       * WebSocket price update.
       */
      const minimumTimeDifference = 5000;
      const minimumEquityDifference = 0.01;

      if (latest) {
        const timeDifference =
          timestamp - Number(latest.timestamp);

        const equityDifference = Math.abs(
          equity - Number(latest.equity),
        );

        if (
          timeDifference < minimumTimeDifference &&
          equityDifference < minimumEquityDifference
        ) {
          return previous;
        }

        /*
         * Update the latest point during the same five-second
         * period instead of continuously adding new entries.
         */
        if (timeDifference < minimumTimeDifference) {
          const updated = [...previous];

          updated[updated.length - 1] = {
            timestamp,
            equity,
          };

          return updated;
        }
      }

      return [
        ...previous,
        {
          timestamp,
          equity,
        },
      ].slice(-MAX_HISTORY_POINTS);
    });
  }, [
    portfolio?.totalEquity,
    portfolio?.trades?.length,
  ]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(equityHistory),
    );
  }, [equityHistory]);

  const analytics = useMemo(() => {
    if (!portfolio) {
      return null;
    }

    const trades = Array.isArray(portfolio.trades)
      ? [...portfolio.trades].reverse()
      : [];

    const closedTrades = trades.filter(
      (trade) =>
        trade.side === "SELL" &&
        Number.isFinite(
          Number(trade.realizedProfit),
        ),
    );

    const winningTrades = closedTrades.filter(
      (trade) =>
        Number(trade.realizedProfit) > 0,
    );

    const losingTrades = closedTrades.filter(
      (trade) =>
        Number(trade.realizedProfit) < 0,
    );

    const flatTrades = closedTrades.filter(
      (trade) =>
        Number(trade.realizedProfit) === 0,
    );

    const grossProfit = winningTrades.reduce(
      (total, trade) =>
        total + Number(trade.realizedProfit),
      0,
    );

    const grossLoss = Math.abs(
      losingTrades.reduce(
        (total, trade) =>
          total + Number(trade.realizedProfit),
        0,
      ),
    );

    const averageWinner =
      winningTrades.length > 0
        ? grossProfit / winningTrades.length
        : 0;

    const averageLoser =
      losingTrades.length > 0
        ? -grossLoss / losingTrades.length
        : 0;

    const largestWinner =
      winningTrades.length > 0
        ? Math.max(
            ...winningTrades.map((trade) =>
              Number(trade.realizedProfit),
            ),
          )
        : 0;

    const largestLoser =
      losingTrades.length > 0
        ? Math.min(
            ...losingTrades.map((trade) =>
              Number(trade.realizedProfit),
            ),
          )
        : 0;

    const winRate =
      closedTrades.length > 0
        ? (winningTrades.length /
            closedTrades.length) *
          100
        : 0;

    const lossRate =
      closedTrades.length > 0
        ? (losingTrades.length /
            closedTrades.length) *
          100
        : 0;

    const profitFactor =
      grossLoss > 0
        ? grossProfit / grossLoss
        : grossProfit > 0
          ? Infinity
          : 0;

    const expectancy =
      closedTrades.length > 0
        ? closedTrades.reduce(
            (total, trade) =>
              total +
              Number(trade.realizedProfit),
            0,
          ) / closedTrades.length
        : 0;

    const totalFees = trades.reduce(
      (total, trade) =>
        total + Number(trade.fee || 0),
      0,
    );

    const streaks =
      calculateStreaks(closedTrades);

    const maximumDrawdown =
      calculateMaximumDrawdown(equityHistory);

    const currentDrawdown =
      calculateCurrentDrawdown(equityHistory);

    return {
      totalOrders: trades.length,
      closedTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      flatTrades: flatTrades.length,

      winRate,
      lossRate,

      grossProfit,
      grossLoss,
      profitFactor,
      expectancy,

      averageWinner,
      averageLoser,
      largestWinner,
      largestLoser,

      totalFees,

      longestWinStreak:
        streaks.longestWinStreak,

      longestLossStreak:
        streaks.longestLossStreak,

      maximumDrawdownAmount:
        maximumDrawdown.amount,

      maximumDrawdownPercent:
        maximumDrawdown.percent,

      currentDrawdownAmount:
        currentDrawdown.amount,

      currentDrawdownPercent:
        currentDrawdown.percent,

      equityHistory,
    };
  }, [portfolio, equityHistory]);

  function resetEquityHistory() {
    const currentEquity = Number(
      portfolio?.totalEquity,
    );

    const nextHistory = Number.isFinite(currentEquity)
      ? [
          {
            timestamp: Date.now(),
            equity: currentEquity,
          },
        ]
      : [];

    setEquityHistory(nextHistory);
  }

  return {
    analytics,
    equityHistory,
    resetEquityHistory,
  };
}