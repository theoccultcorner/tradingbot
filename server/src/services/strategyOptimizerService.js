import {
  fetchHistoricalCandles,
  runStrategyBacktest,
} from "./backtestService.js";

const DEFAULT_SCORE_VALUES = [
  30,
  45,
  60,
];

const DEFAULT_CONFIDENCE_VALUES = [
  30,
  45,
  60,
];

const DEFAULT_STOP_LOSS_VALUES = [
  1,
  2,
  3,
];

const DEFAULT_TAKE_PROFIT_VALUES = [
  2,
  4,
  6,
];

const DEFAULT_TOP_RESULTS =
  20;

const DEFAULT_MAX_COMBINATIONS =
  250;

const MINIMUM_CANDLE_LIMIT =
  250;

const MAXIMUM_CANDLE_LIMIT =
  1000;

/*
 * Make sure optimization values are
 * valid finite positive numbers.
 */
function normalizeNumberArray(
  values,
  fallback,
  {
    minimum = 0,
    maximum = Infinity,
  } = {},
) {
  const source =
    Array.isArray(
      values,
    ) &&
    values.length >
      0
      ? values
      : fallback;

  const normalized =
    source
      .map(
        (value) =>
          Number(
            value,
          ),
      )
      .filter(
        (value) =>
          Number.isFinite(
            value,
          ) &&
          value >=
            minimum &&
          value <=
            maximum,
      );

  return [
    ...new Set(
      normalized,
    ),
  ].sort(
    (
      left,
      right,
    ) =>
      left -
      right,
  );
}

function normalizeLimit(
  value,
) {
  return Math.min(
    Math.max(
      Number(
        value,
      ) ||
        1000,
      MINIMUM_CANDLE_LIMIT,
    ),
    MAXIMUM_CANDLE_LIMIT,
  );
}

function normalizePositiveNumber(
  value,
  fallback,
) {
  const number =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      number,
    ) ||
    number <= 0
  ) {
    return fallback;
  }

  return number;
}

function normalizeNonNegativeNumber(
  value,
  fallback,
) {
  const number =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      number,
    ) ||
    number < 0
  ) {
    return fallback;
  }

  return number;
}

function normalizeInteger(
  value,
  fallback,
  minimum,
  maximum,
) {
  const number =
    Math.floor(
      Number(
        value,
      ),
    );

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return fallback;
  }

  return Math.min(
    Math.max(
      number,
      minimum,
    ),
    maximum,
  );
}

/*
 * Profit factor can be null when there
 * were profitable trades but no losing
 * trades.
 *
 * For optimizer ranking purposes, treat
 * that as a strong profit factor without
 * letting it become mathematically
 * infinite and dominate every result.
 */
function getRankingProfitFactor(
  result,
) {
  const value =
    Number(
      result
        ?.profitFactor,
    );

  if (
    Number.isFinite(
      value,
    )
  ) {
    return Math.min(
      Math.max(
        value,
        0,
      ),
      5,
    );
  }

  if (
    Number(
      result
        ?.grossProfit,
    ) >
      0 &&
    Number(
      result
        ?.grossLoss,
    ) ===
      0
  ) {
    return 5;
  }

  return 0;
}

/*
 * Score one backtest.
 *
 * We intentionally do NOT rank solely
 * by profit.
 *
 * Positive:
 * - net return
 * - profit factor
 * - win rate
 * - reasonable sample size
 *
 * Negative:
 * - drawdown
 * - excessive fees
 * - very small sample sizes
 */
function calculateOptimizationScore(
  result,
  {
    minimumTrades,
  },
) {
  const totalReturnPercent =
    Number(
      result
        ?.totalReturnPercent,
    ) || 0;

  const maximumDrawdownPercent =
    Number(
      result
        ?.maximumDrawdownPercent,
    ) || 0;

  const winRate =
    Number(
      result
        ?.winRate,
    ) || 0;

  const closedTrades =
    Number(
      result
        ?.closedTradeCount,
    ) || 0;

  const totalFees =
    Number(
      result
        ?.totalFees,
    ) || 0;

  const startingCash =
    Number(
      result
        ?.startingCash,
    ) || 1;

  const profitFactor =
    getRankingProfitFactor(
      result,
    );

  /*
   * A result with too few trades is not
   * reliable enough to rank highly.
   */
  if (
    closedTrades <
    minimumTrades
  ) {
    return -10000;
  }

  const returnScore =
    totalReturnPercent *
    3;

  const profitFactorScore =
    profitFactor *
    8;

  const winRateScore =
    winRate *
    0.05;

  /*
   * Reward additional observations, but
   * cap the contribution so a hyperactive
   * strategy cannot win just because it
   * trades constantly.
   */
  const sampleSizeScore =
    Math.min(
      closedTrades,
      40,
    ) *
    0.35;

  const drawdownPenalty =
    maximumDrawdownPercent *
    2;

  const feePercent =
    (
      totalFees /
      startingCash
    ) *
    100;

  const feePenalty =
    feePercent *
    0.5;

  return (
    returnScore +
    profitFactorScore +
    winRateScore +
    sampleSizeScore -
    drawdownPenalty -
    feePenalty
  );
}

function buildParameterGrid({
  minimumScores,
  minimumConfidences,
  stopLossPercents,
  takeProfitPercents,
  maximumCombinations,
}) {
  const combinations =
    [];

  for (
    const minimumScore
    of minimumScores
  ) {
    for (
      const minimumConfidence
      of minimumConfidences
    ) {
      for (
        const stopLossPercent
        of stopLossPercents
      ) {
        for (
          const takeProfitPercent
          of takeProfitPercents
        ) {
          /*
           * Reject obviously unreasonable
           * combinations where the profit
           * target is tiny relative to the
           * stop.
           *
           * We still allow a 1:1 setup,
           * because higher win-rate
           * strategies can sometimes make
           * that viable.
           */
          if (
            takeProfitPercent <
            stopLossPercent
          ) {
            continue;
          }

          combinations.push({
            minimumScore,
            minimumConfidence,
            stopLossPercent,
            takeProfitPercent,
          });

          if (
            combinations.length >=
            maximumCombinations
          ) {
            return combinations;
          }
        }
      }
    }
  }

  return combinations;
}

function createCompactResult(
  result,
  optimizationScore,
  qualified,
) {
  return {
    settings: {
      minimumScore:
        result.settings
          .minimumScore,

      minimumConfidence:
        result.settings
          .minimumConfidence,

      stopLossPercent:
        result.settings
          .stopLossPercent,

      takeProfitPercent:
        result.settings
          .takeProfitPercent,

      buyAmount:
        result.settings
          .buyAmount,

      feeRate:
        result.settings
          .feeRate,
    },

    optimizationScore,

    qualified,

    endingEquity:
      result.endingEquity,

    totalProfit:
      result.totalProfit,

    totalReturnPercent:
      result
        .totalReturnPercent,

    totalFees:
      result.totalFees,

    closedTradeCount:
      result
        .closedTradeCount,

    orderCount:
      result.orderCount,

    wins:
      result.wins,

    losses:
      result.losses,

    winRate:
      result.winRate,

    profitFactor:
      result.profitFactor,

    averageTrade:
      result.averageTrade,

    maximumDrawdownAmount:
      result
        .maximumDrawdownAmount,

    maximumDrawdownPercent:
      result
        .maximumDrawdownPercent,

    openPosition:
      result.openPosition
        ? {
            entryTime:
              result
                .openPosition
                .entryTime,

            entryPrice:
              result
                .openPosition
                .entryPrice,

            quantity:
              result
                .openPosition
                .quantity,

            entryConfidence:
              result
                .openPosition
                .entryConfidence,

            entryScore:
              result
                .openPosition
                .entryScore,
          }
        : null,
  };
}

function qualifiesResult(
  result,
  {
    minimumTrades,
    maximumDrawdownPercent,
    requirePositiveReturn,
  },
) {
  const closedTrades =
    Number(
      result
        .closedTradeCount,
    ) || 0;

  if (
    closedTrades <
    minimumTrades
  ) {
    return false;
  }

  if (
    Number(
      result
        .maximumDrawdownPercent,
    ) >
    maximumDrawdownPercent
  ) {
    return false;
  }

  if (
    requirePositiveReturn &&
    Number(
      result
        .totalReturnPercent,
    ) <= 0
  ) {
    return false;
  }

  return true;
}

export async function optimizeStrategy({
  symbol = "SOLUSD",
  timeframe = "5m",

  limit = 1000,

  startingCash = 10000,

  buyAmount = 500,

  feeRate = 0.001,

  minimumHistory = 210,

  minimumScores =
    DEFAULT_SCORE_VALUES,

  minimumConfidences =
    DEFAULT_CONFIDENCE_VALUES,

  stopLossPercents =
    DEFAULT_STOP_LOSS_VALUES,

  takeProfitPercents =
    DEFAULT_TAKE_PROFIT_VALUES,

  minimumTrades = 3,

  maximumDrawdownPercent = 20,

  requirePositiveReturn = false,

  topResults =
    DEFAULT_TOP_RESULTS,

  maximumCombinations =
    DEFAULT_MAX_COMBINATIONS,
} = {}) {
  const startedAt =
    Date.now();

  const safeSymbol =
    String(
      symbol,
    )
      .trim()
      .toUpperCase();

  const safeTimeframe =
    String(
      timeframe,
    )
      .trim();

  const safeLimit =
    normalizeLimit(
      limit,
    );

  const safeStartingCash =
    normalizePositiveNumber(
      startingCash,
      10000,
    );

  const safeBuyAmount =
    normalizePositiveNumber(
      buyAmount,
      500,
    );

  const safeFeeRate =
    normalizeNonNegativeNumber(
      feeRate,
      0.001,
    );

  const safeMinimumHistory =
    normalizeInteger(
      minimumHistory,
      210,
      50,
      500,
    );

  const safeMinimumTrades =
    normalizeInteger(
      minimumTrades,
      3,
      0,
      1000,
    );

  const safeMaximumDrawdownPercent =
    normalizePositiveNumber(
      maximumDrawdownPercent,
      20,
    );

  const safeTopResults =
    normalizeInteger(
      topResults,
      DEFAULT_TOP_RESULTS,
      1,
      100,
    );

  const safeMaximumCombinations =
    normalizeInteger(
      maximumCombinations,
      DEFAULT_MAX_COMBINATIONS,
      1,
      2000,
    );

  const safeMinimumScores =
    normalizeNumberArray(
      minimumScores,
      DEFAULT_SCORE_VALUES,
      {
        minimum:
          0,

        maximum:
          100,
      },
    );

  const safeMinimumConfidences =
    normalizeNumberArray(
      minimumConfidences,
      DEFAULT_CONFIDENCE_VALUES,
      {
        minimum:
          0,

        maximum:
          100,
      },
    );

  const safeStopLossPercents =
    normalizeNumberArray(
      stopLossPercents,
      DEFAULT_STOP_LOSS_VALUES,
      {
        minimum:
          0.1,

        maximum:
          50,
      },
    );

  const safeTakeProfitPercents =
    normalizeNumberArray(
      takeProfitPercents,
      DEFAULT_TAKE_PROFIT_VALUES,
      {
        minimum:
          0.1,

        maximum:
          100,
      },
    );

  /*
   * Download market history ONCE.
   *
   * Every strategy configuration is then
   * tested against the exact same candles.
   */
  const candles =
    await fetchHistoricalCandles({
      symbol:
        safeSymbol,

      timeframe:
        safeTimeframe,

      limit:
        safeLimit,
    });

  if (
    candles.length <
    safeMinimumHistory +
      2
  ) {
    throw new Error(
      `Not enough historical candles to optimize ${safeSymbol} ${safeTimeframe}.`,
    );
  }

  const parameterGrid =
    buildParameterGrid({
      minimumScores:
        safeMinimumScores,

      minimumConfidences:
        safeMinimumConfidences,

      stopLossPercents:
        safeStopLossPercents,

      takeProfitPercents:
        safeTakeProfitPercents,

      maximumCombinations:
        safeMaximumCombinations,
    });

  if (
    parameterGrid.length ===
    0
  ) {
    throw new Error(
      "The optimizer produced no parameter combinations.",
    );
  }

  const results = [];

  const failures = [];

  /*
   * Run sequentially.
   *
   * The existing backtester calculates a
   * full indicator history during each run,
   * so running hundreds simultaneously
   * could overload Node and make the
   * trading server unresponsive.
   */
  for (
    let index = 0;
    index <
    parameterGrid.length;
    index += 1
  ) {
    const configuration =
      parameterGrid[
        index
      ];

    try {
      const result =
        runStrategyBacktest({
          candles,

          symbol:
            safeSymbol,

          timeframe:
            safeTimeframe,

          startingCash:
            safeStartingCash,

          buyAmount:
            safeBuyAmount,

          feeRate:
            safeFeeRate,

          minimumHistory:
            safeMinimumHistory,

          minimumScore:
            configuration
              .minimumScore,

          minimumConfidence:
            configuration
              .minimumConfidence,

          stopLossPercent:
            configuration
              .stopLossPercent,

          takeProfitPercent:
            configuration
              .takeProfitPercent,
        });

      const qualified =
        qualifiesResult(
          result,
          {
            minimumTrades:
              safeMinimumTrades,

            maximumDrawdownPercent:
              safeMaximumDrawdownPercent,

            requirePositiveReturn:
              Boolean(
                requirePositiveReturn,
              ),
          },
        );

      const optimizationScore =
        calculateOptimizationScore(
          result,
          {
            minimumTrades:
              safeMinimumTrades,
          },
        );

      results.push(
        createCompactResult(
          result,
          optimizationScore,
          qualified,
        ),
      );
    } catch (
      error
    ) {
      failures.push({
        configuration,

        message:
          error.message ||
          "Backtest failed.",
      });
    }
  }

  /*
   * Rank qualified strategies first.
   *
   * If none qualify, the response still
   * contains the best available results so
   * we can inspect why the strategy failed.
   */
  results.sort(
    (
      left,
      right,
    ) => {
      if (
        left.qualified !==
        right.qualified
      ) {
        return left.qualified
          ? -1
          : 1;
      }

      return (
        right
          .optimizationScore -
        left
          .optimizationScore
      );
    },
  );

  const qualifiedResults =
    results.filter(
      (result) =>
        result.qualified,
    );

  const top =
    results.slice(
      0,
      safeTopResults,
    );

  const best =
    qualifiedResults[0] ||
    results[0] ||
    null;

  const profitableResults =
    results.filter(
      (result) =>
        Number(
          result
            .totalProfit,
        ) >
        0,
    );

  const finishedAt =
    Date.now();

  return {
    success:
      true,

    symbol:
      safeSymbol,

    timeframe:
      safeTimeframe,

    candleCount:
      candles.length,

    startedAt,

    finishedAt,

    durationMilliseconds:
      finishedAt -
      startedAt,

    settings: {
      startingCash:
        safeStartingCash,

      buyAmount:
        safeBuyAmount,

      feeRate:
        safeFeeRate,

      minimumHistory:
        safeMinimumHistory,

      minimumTrades:
        safeMinimumTrades,

      maximumDrawdownPercent:
        safeMaximumDrawdownPercent,

      requirePositiveReturn:
        Boolean(
          requirePositiveReturn,
        ),

      maximumCombinations:
        safeMaximumCombinations,
    },

    searchSpace: {
      minimumScores:
        safeMinimumScores,

      minimumConfidences:
        safeMinimumConfidences,

      stopLossPercents:
        safeStopLossPercents,

      takeProfitPercents:
        safeTakeProfitPercents,
    },

    summary: {
      combinationsTested:
        results.length,

      combinationsFailed:
        failures.length,

      qualifiedStrategies:
        qualifiedResults.length,

      profitableStrategies:
        profitableResults.length,

      unprofitableStrategies:
        results.length -
        profitableResults.length,

      bestFound:
        Boolean(
          best,
        ),
    },

    best,

    topResults:
      top,

    failures:
      failures.slice(
        0,
        20,
      ),
  };
}

export {
  buildParameterGrid,
  calculateOptimizationScore,
};