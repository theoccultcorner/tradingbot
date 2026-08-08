import { calculateAllIndicators } from "./indicators";
import { calculateTradingSignal } from "./signalEngine";

function calculateMaximumDrawdown(equityCurve) {
  let peak = equityCurve[0]?.equity ?? 0;
  let maximumDrawdown = 0;

  for (const point of equityCurve) {
    peak = Math.max(peak, point.equity);

    if (peak <= 0) {
      continue;
    }

    const drawdown = ((peak - point.equity) / peak) * 100;
    maximumDrawdown = Math.max(maximumDrawdown, drawdown);
  }

  return maximumDrawdown;
}

function calculateProfitFactor(closedTrades) {
  const grossProfit = closedTrades
    .filter((trade) => trade.profit > 0)
    .reduce((total, trade) => total + trade.profit, 0);

  const grossLoss = Math.abs(
    closedTrades
      .filter((trade) => trade.profit < 0)
      .reduce((total, trade) => total + trade.profit, 0),
  );

  if (grossLoss === 0) {
    return grossProfit > 0 ? Infinity : 0;
  }

  return grossProfit / grossLoss;
}

export function runBacktest({
  candles = [],
  startingCash = 10000,
  buyAmount = 500,
  minimumConfidence = 40,
  feeRate = 0.001,
  minimumHistory = 210,
}) {
  if (!Array.isArray(candles) || candles.length < minimumHistory + 2) {
    return {
      ready: false,
      message: `At least ${minimumHistory + 2} candles are required.`,
      startingCash,
      endingEquity: startingCash,
      totalProfit: 0,
      totalReturnPercent: 0,
      maximumDrawdown: 0,
      winRate: 0,
      profitFactor: 0,
      tradeCount: 0,
      wins: 0,
      losses: 0,
      openPosition: null,
      trades: [],
      equityCurve: [],
    };
  }

  let cash = Number(startingCash);
  let position = null;

  const trades = [];
  const closedTrades = [];
  const equityCurve = [];

  for (
    let index = minimumHistory;
    index < candles.length;
    index += 1
  ) {
    const history = candles.slice(0, index + 1);
    const currentCandle = history[history.length - 1];
    const price = Number(currentCandle.close);

    if (!Number.isFinite(price) || price <= 0) {
      continue;
    }

    const indicators = calculateAllIndicators(history);

    const signal = calculateTradingSignal({
      price,
      candles: history,
      indicators,
    });

    const signalQualified =
      signal.confidence >= minimumConfidence;

    if (
      !position &&
      signal.action === "BUY" &&
      signalQualified
    ) {
      const availableAmount = Math.min(
        Number(buyAmount),
        cash / (1 + feeRate),
      );

      if (availableAmount > 0) {
        const quantity = availableAmount / price;
        const entryFee = availableAmount * feeRate;
        const totalDebit = availableAmount + entryFee;

        cash -= totalDebit;

        position = {
          entryTime: currentCandle.time,
          entryPrice: price,
          quantity,
          entryValue: availableAmount,
          entryFee,
          entrySignal: signal,
        };

        trades.push({
          id: `buy-${currentCandle.time}`,
          side: "BUY",
          time: currentCandle.time,
          price,
          quantity,
          fee: entryFee,
          confidence: signal.confidence,
          score: signal.totalScore,
        });
      }
    } else if (
      position &&
      signal.action === "SELL" &&
      signalQualified
    ) {
      const grossProceeds = position.quantity * price;
      const exitFee = grossProceeds * feeRate;
      const netProceeds = grossProceeds - exitFee;

      cash += netProceeds;

      const totalFees = position.entryFee + exitFee;

      const profit =
        netProceeds -
        position.entryValue -
        position.entryFee;

      const returnPercent =
        position.entryValue > 0
          ? (profit / position.entryValue) * 100
          : 0;

      const closedTrade = {
        id: `closed-${currentCandle.time}`,
        entryTime: position.entryTime,
        exitTime: currentCandle.time,
        entryPrice: position.entryPrice,
        exitPrice: price,
        quantity: position.quantity,
        entryValue: position.entryValue,
        exitValue: grossProceeds,
        totalFees,
        profit,
        returnPercent,
        entryConfidence:
          position.entrySignal.confidence,
        exitConfidence: signal.confidence,
      };

      closedTrades.push(closedTrade);

      trades.push({
        id: `sell-${currentCandle.time}`,
        side: "SELL",
        time: currentCandle.time,
        price,
        quantity: position.quantity,
        fee: exitFee,
        confidence: signal.confidence,
        score: signal.totalScore,
        realizedProfit: profit,
      });

      position = null;
    }

    const openPositionValue = position
      ? position.quantity * price
      : 0;

    const equity = cash + openPositionValue;

    equityCurve.push({
      time: currentCandle.time,
      equity,
    });
  }

  const finalPrice = Number(
    candles[candles.length - 1]?.close,
  );

  const openPositionValue =
    position && Number.isFinite(finalPrice)
      ? position.quantity * finalPrice
      : 0;

  const endingEquity = cash + openPositionValue;
  const totalProfit = endingEquity - startingCash;

  const totalReturnPercent =
    startingCash > 0
      ? (totalProfit / startingCash) * 100
      : 0;

  const wins = closedTrades.filter(
    (trade) => trade.profit > 0,
  ).length;

  const losses = closedTrades.filter(
    (trade) => trade.profit <= 0,
  ).length;

  const winRate =
    closedTrades.length > 0
      ? (wins / closedTrades.length) * 100
      : 0;

  return {
    ready: true,
    message: "Backtest complete.",
    startingCash,
    endingEquity,
    cash,
    totalProfit,
    totalReturnPercent,
    maximumDrawdown:
      calculateMaximumDrawdown(equityCurve),
    winRate,
    profitFactor:
      calculateProfitFactor(closedTrades),
    tradeCount: closedTrades.length,
    orderCount: trades.length,
    wins,
    losses,
    openPosition: position,
    trades,
    closedTrades,
    equityCurve,
  };
}