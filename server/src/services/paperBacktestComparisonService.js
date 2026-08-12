import {
  getRecentBacktests,
  getRecentWalkForwardTests,
} from "./backtestService.js";

const DEFAULT_MINIMUM_SAMPLE =
  20;

function numberOrZero(
  value,
) {
  const number =
    Number(
      value,
    );

  return Number.isFinite(
    number,
  )
    ? number
    : 0;
}

function nullableNumber(
  value,
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null;
  }

  const number =
    Number(
      value,
    );

  return Number.isFinite(
    number,
  )
    ? number
    : null;
}

function normalizeSymbol(
  value,
) {
  return String(
    value ||
      "",
  )
    .trim()
    .toUpperCase();
}

function normalizeTimeframe(
  value,
) {
  return String(
    value ||
      "",
  ).trim();
}

function absoluteDifference(
  paper,
  tested,
) {
  const paperNumber =
    nullableNumber(
      paper,
    );

  const testedNumber =
    nullableNumber(
      tested,
    );

  if (
    paperNumber ===
      null ||
    testedNumber ===
      null
  ) {
    return null;
  }

  return (
    paperNumber -
    testedNumber
  );
}

function absoluteGap(
  paper,
  tested,
) {
  const difference =
    absoluteDifference(
      paper,
      tested,
    );

  return difference ===
    null
    ? null
    : Math.abs(
        difference,
      );
}

function relativeDifferencePercent(
  paper,
  tested,
) {
  const paperNumber =
    nullableNumber(
      paper,
    );

  const testedNumber =
    nullableNumber(
      tested,
    );

  if (
    paperNumber ===
      null ||
    testedNumber ===
      null ||
    testedNumber ===
      0
  ) {
    return null;
  }

  return (
    (
      paperNumber -
      testedNumber
    ) /
    Math.abs(
      testedNumber,
    )
  ) *
    100;
}

/*
 * =========================================================
 * PAPER METRICS
 * =========================================================
 *
 * Normalize PerformanceTrackingService.getSummary()
 * into the same shape used by our test metrics.
 */
function buildPaperMetrics(
  summary,
) {
  const closedTrades =
    numberOrZero(
      summary
        ?.closedTrades,
    );

  return {
    source:
      "PAPER_TRADING",

    returnPercent:
      numberOrZero(
        summary
          ?.netReturnAfterCostsPercent ??
          summary
            ?.latestEquity
            ?.totalReturnPercent,
      ),

    profit:
      numberOrZero(
        summary
          ?.netProfitAfterCosts ??
          summary
            ?.accountProfitAfterFees,
      ),

    winRate:
      numberOrZero(
        summary
          ?.winRate,
      ),

    profitFactor:
      summary
        ?.profitFactor ===
      null
        ? null
        : nullableNumber(
            summary
              ?.profitFactor,
          ),

    expectancy:
      numberOrZero(
        summary
          ?.expectancyPerTrade,
      ),

    averageTrade:
      numberOrZero(
        summary
          ?.averageProfitPerClosedTrade,
      ),

    maximumDrawdownPercent:
      numberOrZero(
        summary
          ?.maximumDrawdownPercent,
      ),

    maximumDrawdownAmount:
      numberOrZero(
        summary
          ?.maximumDrawdownAmount,
      ),

    totalFees:
      numberOrZero(
        summary
          ?.totalFees,
      ),

    estimatedSlippage:
      numberOrZero(
        summary
          ?.estimatedSlippage,
      ),

    totalTradingCosts:
      numberOrZero(
        summary
          ?.totalTradingCosts,
      ),

    closedTrades,

    wins:
      numberOrZero(
        summary?.wins,
      ),

    losses:
      numberOrZero(
        summary?.losses,
      ),

    totalOrders:
      numberOrZero(
        summary
          ?.totalOrders,
      ),

    sampleAdequate:
      closedTrades >=
      DEFAULT_MINIMUM_SAMPLE,
  };
}

/*
 * =========================================================
 * STANDARD BACKTEST METRICS
 * =========================================================
 */
function buildBacktestMetrics(
  result,
) {
  if (
    !result
  ) {
    return null;
  }

  const closedTrades =
    numberOrZero(
      result
        .closedTradeCount,
    );

  /*
   * Backtest averageTrade is the closest direct
   * equivalent to paper expectancy per closed
   * trade.
   */
  return {
    source:
      "STANDARD_BACKTEST",

    id:
      result.id ||
      null,

    symbol:
      result.symbol ||
      null,

    timeframe:
      result.timeframe ||
      null,

    returnPercent:
      numberOrZero(
        result
          .totalReturnPercent,
      ),

    profit:
      numberOrZero(
        result
          .totalProfit,
      ),

    winRate:
      numberOrZero(
        result.winRate,
      ),

    profitFactor:
      result
        .profitFactor ===
      null
        ? null
        : nullableNumber(
            result
              .profitFactor,
          ),

    expectancy:
      numberOrZero(
        result
          .averageTrade,
      ),

    averageTrade:
      numberOrZero(
        result
          .averageTrade,
      ),

    maximumDrawdownPercent:
      numberOrZero(
        result
          .maximumDrawdownPercent,
      ),

    maximumDrawdownAmount:
      numberOrZero(
        result
          .maximumDrawdownAmount,
      ),

    totalFees:
      numberOrZero(
        result
          .totalFees,
      ),

    estimatedSlippage:
      0,

    totalTradingCosts:
      numberOrZero(
        result
          .totalFees,
      ),

    closedTrades,

    wins:
      numberOrZero(
        result.wins,
      ),

    losses:
      numberOrZero(
        result.losses,
      ),

    totalOrders:
      numberOrZero(
        result
          .orderCount,
      ),

    startingCash:
      numberOrZero(
        result
          .startingCash,
      ),

    endingEquity:
      numberOrZero(
        result
          .endingEquity,
      ),

    candleCount:
      numberOrZero(
        result
          .candleCount,
      ),

    settings:
      result.settings ||
      {},

    completedAt:
      nullableNumber(
        result
          .completedAt,
      ),

    createdAt:
      nullableNumber(
        result
          .createdAt,
      ),

    sampleAdequate:
      closedTrades >=
      DEFAULT_MINIMUM_SAMPLE,
  };
}

/*
 * =========================================================
 * WALK-FORWARD METRICS
 * =========================================================
 *
 * Walk-forward results are especially useful because they
 * are already based on out-of-sample windows.
 */
function buildWalkForwardMetrics(
  result,
) {
  if (
    !result
  ) {
    return null;
  }

  const closedTrades =
    numberOrZero(
      result
        .closedTradeCount,
    );

  return {
    source:
      "WALK_FORWARD",

    id:
      result.id ||
      null,

    symbol:
      result.symbol ||
      null,

    timeframe:
      result.timeframe ||
      null,

    returnPercent:
      numberOrZero(
        result
          .totalReturnPercent,
      ),

    profit:
      numberOrZero(
        result
          .totalProfit,
      ),

    winRate:
      numberOrZero(
        result.winRate,
      ),

    profitFactor:
      result
        .profitFactor ===
      null
        ? null
        : nullableNumber(
            result
              .profitFactor,
          ),

    /*
     * Walk-forward has a dedicated
     * out-of-sample expectancy metric.
     */
    expectancy:
      numberOrZero(
        result
          .outOfSampleExpectancy ??
          result
            .averageTrade,
      ),

    averageTrade:
      numberOrZero(
        result
          .averageTrade,
      ),

    maximumDrawdownPercent:
      numberOrZero(
        result
          .maximumDrawdownPercent,
      ),

    maximumDrawdownAmount:
      numberOrZero(
        result
          .maximumDrawdownAmount,
      ),

    totalFees:
      numberOrZero(
        result
          .totalFees,
      ),

    estimatedSlippage:
      0,

    totalTradingCosts:
      numberOrZero(
        result
          .totalFees,
      ),

    closedTrades,

    wins:
      numberOrZero(
        result.wins,
      ),

    losses:
      numberOrZero(
        result.losses,
      ),

    totalOrders:
      numberOrZero(
        result
          .orderCount,
      ),

    startingCash:
      numberOrZero(
        result
          .startingCash,
      ),

    endingEquity:
      numberOrZero(
        result
          .endingEquity,
      ),

    candleCount:
      numberOrZero(
        result
          .candleCount,
      ),

    windowCount:
      numberOrZero(
        result
          .windowCount,
      ),

    profitableWindows:
      numberOrZero(
        result
          .profitableWindows,
      ),

    profitableWindowRate:
      numberOrZero(
        result
          .profitableWindowRate,
      ),

    averageTrainingReturnPercent:
      numberOrZero(
        result
          .averageTrainingReturnPercent,
      ),

    averageTestingReturnPercent:
      numberOrZero(
        result
          .averageTestingReturnPercent,
      ),

    averageReturnDegradationPercent:
      numberOrZero(
        result
          .averageReturnDegradationPercent,
      ),

    settings:
      result.settings ||
      {},

    completedAt:
      nullableNumber(
        result
          .completedAt,
      ),

    createdAt:
      nullableNumber(
        result
          .createdAt,
      ),

    sampleAdequate:
      closedTrades >=
      DEFAULT_MINIMUM_SAMPLE,
  };
}

/*
 * =========================================================
 * METRIC COMPARISON
 * =========================================================
 */
function compareMetrics(
  paper,
  tested,
) {
  if (
    !paper ||
    !tested
  ) {
    return null;
  }

  return {
    returnPercent: {
      paper:
        paper.returnPercent,

      tested:
        tested.returnPercent,

      difference:
        absoluteDifference(
          paper.returnPercent,
          tested.returnPercent,
        ),

      absoluteGap:
        absoluteGap(
          paper.returnPercent,
          tested.returnPercent,
        ),

      relativeDifferencePercent:
        relativeDifferencePercent(
          paper.returnPercent,
          tested.returnPercent,
        ),
    },

    profit: {
      paper:
        paper.profit,

      tested:
        tested.profit,

      difference:
        absoluteDifference(
          paper.profit,
          tested.profit,
        ),

      absoluteGap:
        absoluteGap(
          paper.profit,
          tested.profit,
        ),
    },

    winRate: {
      paper:
        paper.winRate,

      tested:
        tested.winRate,

      difference:
        absoluteDifference(
          paper.winRate,
          tested.winRate,
        ),

      absoluteGap:
        absoluteGap(
          paper.winRate,
          tested.winRate,
        ),
    },

    profitFactor: {
      paper:
        paper.profitFactor,

      tested:
        tested.profitFactor,

      difference:
        absoluteDifference(
          paper.profitFactor,
          tested.profitFactor,
        ),

      absoluteGap:
        absoluteGap(
          paper.profitFactor,
          tested.profitFactor,
        ),
    },

    expectancy: {
      paper:
        paper.expectancy,

      tested:
        tested.expectancy,

      difference:
        absoluteDifference(
          paper.expectancy,
          tested.expectancy,
        ),

      absoluteGap:
        absoluteGap(
          paper.expectancy,
          tested.expectancy,
        ),
    },

    maximumDrawdownPercent: {
      paper:
        paper
          .maximumDrawdownPercent,

      tested:
        tested
          .maximumDrawdownPercent,

      difference:
        absoluteDifference(
          paper
            .maximumDrawdownPercent,
          tested
            .maximumDrawdownPercent,
        ),

      absoluteGap:
        absoluteGap(
          paper
            .maximumDrawdownPercent,
          tested
            .maximumDrawdownPercent,
        ),

      /*
       * Positive means paper drawdown is WORSE.
       */
      paperWorseBy:
        Math.max(
          absoluteDifference(
            paper
              .maximumDrawdownPercent,
            tested
              .maximumDrawdownPercent,
          ) ||
            0,
          0,
        ),
    },

    closedTrades: {
      paper:
        paper.closedTrades,

      tested:
        tested.closedTrades,

      difference:
        absoluteDifference(
          paper.closedTrades,
          tested.closedTrades,
        ),
    },

    totalFees: {
      paper:
        paper.totalFees,

      tested:
        tested.totalFees,

      difference:
        absoluteDifference(
          paper.totalFees,
          tested.totalFees,
        ),
    },
  };
}

/*
 * =========================================================
 * COMPARISON SCORE
 * =========================================================
 *
 * This is NOT a profitability score.
 *
 * It measures how closely paper behavior resembles
 * tested behavior.
 *
 * A strategy can achieve a high match score while still
 * being unprofitable in both environments.
 */
function calculateMatchScore(
  comparison,
) {
  if (
    !comparison
  ) {
    return 0;
  }

  let score =
    100;

  /*
   * Return gap:
   * lose up to 25 points.
   */
  const returnGap =
    numberOrZero(
      comparison
        .returnPercent
        ?.absoluteGap,
    );

  score -=
    Math.min(
      returnGap *
        5,
      25,
    );

  /*
   * Win-rate gap:
   * lose up to 20 points.
   */
  const winRateGap =
    numberOrZero(
      comparison
        .winRate
        ?.absoluteGap,
    );

  score -=
    Math.min(
      winRateGap *
        1.25,
      20,
    );

  /*
   * Profit-factor gap:
   * lose up to 20 points.
   */
  const profitFactorGap =
    nullableNumber(
      comparison
        .profitFactor
        ?.absoluteGap,
    );

  if (
    profitFactorGap !==
    null
  ) {
    score -=
      Math.min(
        profitFactorGap *
          20,
        20,
      );
  }

  /*
   * Expectancy gap:
   *
   * Relative to tested expectancy where possible.
   * Lose up to 20 points.
   */
  const testedExpectancy =
    Math.abs(
      numberOrZero(
        comparison
          .expectancy
          ?.tested,
      ),
    );

  const expectancyGap =
    numberOrZero(
      comparison
        .expectancy
        ?.absoluteGap,
    );

  if (
    testedExpectancy >
    0
  ) {
    score -=
      Math.min(
        (
          expectancyGap /
          testedExpectancy
        ) *
          20,
        20,
      );
  } else if (
    expectancyGap >
    0
  ) {
    score -=
      10;
  }

  /*
   * Drawdown gap:
   * lose up to 15 points.
   */
  const drawdownGap =
    numberOrZero(
      comparison
        .maximumDrawdownPercent
        ?.absoluteGap,
    );

  score -=
    Math.min(
      drawdownGap *
        3,
      15,
    );

  return Math.max(
    Math.min(
      Number(
        score.toFixed(
          2,
        ),
      ),
      100,
    ),
    0,
  );
}

function classifyMatch(
  score,
) {
  if (
    score >=
    85
  ) {
    return "GOOD_MATCH";
  }

  if (
    score >=
    65
  ) {
    return "MODERATE_DRIFT";
  }

  return "POOR_MATCH";
}

/*
 * =========================================================
 * TEST SELECTION
 * =========================================================
 */
function findMatchingResult({
  results,
  symbol,
  timeframe,
}) {
  if (
    !Array.isArray(
      results,
    )
  ) {
    return null;
  }

  const normalizedSymbol =
    normalizeSymbol(
      symbol,
    );

  const normalizedTimeframe =
    normalizeTimeframe(
      timeframe,
    );

  /*
   * First preference:
   * same symbol AND timeframe.
   */
  const exact =
    results.find(
      (
        result,
      ) =>
        normalizeSymbol(
          result?.symbol,
        ) ===
          normalizedSymbol &&
        normalizeTimeframe(
          result?.timeframe,
        ) ===
          normalizedTimeframe,
    );

  if (
    exact
  ) {
    return exact;
  }

  /*
   * Second preference:
   * same symbol.
   */
  const symbolOnly =
    results.find(
      (
        result,
      ) =>
        normalizeSymbol(
          result?.symbol,
        ) ===
        normalizedSymbol,
    );

  return (
    symbolOnly ||
    null
  );
}

function buildWarnings({
  paper,
  tested,
  symbol,
  timeframe,
}) {
  const warnings =
    [];

  if (
    !tested
  ) {
    warnings.push(
      "No matching saved test was found.",
    );

    return warnings;
  }

  if (
    normalizeSymbol(
      tested.symbol,
    ) !==
    normalizeSymbol(
      symbol,
    )
  ) {
    warnings.push(
      `The selected test uses ${tested.symbol}, while paper trading is currently being evaluated for ${symbol}.`,
    );
  }

  if (
    normalizeTimeframe(
      tested.timeframe,
    ) !==
    normalizeTimeframe(
      timeframe,
    )
  ) {
    warnings.push(
      `The selected test uses timeframe ${tested.timeframe}, while paper trading is currently being evaluated for ${timeframe}.`,
    );
  }

  if (
    !paper.sampleAdequate
  ) {
    warnings.push(
      `Paper trading has only ${paper.closedTrades} closed trades. At least ${DEFAULT_MINIMUM_SAMPLE} are recommended before treating the comparison as meaningful.`,
    );
  }

  if (
    !tested.sampleAdequate
  ) {
    warnings.push(
      `The selected test has only ${tested.closedTrades} closed trades. At least ${DEFAULT_MINIMUM_SAMPLE} are recommended before treating the comparison as meaningful.`,
    );
  }

  /*
   * This first Step 9 implementation compares
   * performance statistics.
   *
   * It does not yet guarantee that paper trading
   * and the saved backtest cover the exact same
   * wall-clock market interval.
   */
  warnings.push(
    "This comparison matches symbol, timeframe and performance statistics, but does not yet guarantee identical historical start/end timestamps.",
  );

  return warnings;
}

export class PaperBacktestComparisonService {
  constructor({
    performanceService,
  }) {
    if (
      !performanceService
    ) {
      throw new Error(
        "PaperBacktestComparisonService requires performanceService.",
      );
    }

    this.performanceService =
      performanceService;
  }

  /*
   * =======================================================
   * STANDARD BACKTEST VS PAPER
   * =======================================================
   */
  async compareStandard({
    symbol =
      null,

    timeframe =
      null,

    backtestId =
      null,
  } = {}) {
    const [
      summary,
      recentBacktests,
    ] =
      await Promise.all([
        this.performanceService
          .getSummary(),

        getRecentBacktests(
          50,
        ),
      ]);

    const activeSymbol =
      normalizeSymbol(
        symbol ||
          summary
            ?.latestEquity
            ?.symbol ||
          "",
      );

    const activeTimeframe =
      normalizeTimeframe(
        timeframe ||
          summary
            ?.latestEquity
            ?.timeframe ||
          "",
      );

    let selectedResult =
      null;

    if (
      backtestId
    ) {
      selectedResult =
        recentBacktests.find(
          (
            result,
          ) =>
            result.id ===
            backtestId,
        ) ||
        null;
    }

    if (
      !selectedResult
    ) {
      selectedResult =
        findMatchingResult({
          results:
            recentBacktests,

          symbol:
            activeSymbol,

          timeframe:
            activeTimeframe,
        });
    }

    const paper =
      buildPaperMetrics(
        summary,
      );

    const tested =
      buildBacktestMetrics(
        selectedResult,
      );

    const comparison =
      tested
        ? compareMetrics(
            paper,
            tested,
          )
        : null;

    const matchScore =
      comparison
        ? calculateMatchScore(
            comparison,
          )
        : 0;

    return {
      success:
        Boolean(
          tested,
        ),

      comparisonType:
        "PAPER_VS_STANDARD_BACKTEST",

      symbol:
        activeSymbol ||
        null,

      timeframe:
        activeTimeframe ||
        null,

      status:
        tested
          ? classifyMatch(
              matchScore,
            )
          : "NO_MATCHING_TEST",

      matchScore,

      minimumRecommendedClosedTrades:
        DEFAULT_MINIMUM_SAMPLE,

      paper,

      backtest:
        tested,

      difference:
        comparison,

      warnings:
        buildWarnings({
          paper,

          tested,

          symbol:
            activeSymbol,

          timeframe:
            activeTimeframe,
        }),

      generatedAt:
        Date.now(),
    };
  }

  /*
   * =======================================================
   * WALK-FORWARD VS PAPER
   * =======================================================
   *
   * This comparison is especially useful because the
   * walk-forward side is based on out-of-sample test
   * windows rather than only one historical simulation.
   */
  async compareWalkForward({
    symbol =
      null,

    timeframe =
      null,

    walkForwardId =
      null,
  } = {}) {
    const [
      summary,
      recentTests,
    ] =
      await Promise.all([
        this.performanceService
          .getSummary(),

        getRecentWalkForwardTests(
          50,
        ),
      ]);

    const activeSymbol =
      normalizeSymbol(
        symbol ||
          summary
            ?.latestEquity
            ?.symbol ||
          "",
      );

    const activeTimeframe =
      normalizeTimeframe(
        timeframe ||
          summary
            ?.latestEquity
            ?.timeframe ||
          "",
      );

    let selectedResult =
      null;

    if (
      walkForwardId
    ) {
      selectedResult =
        recentTests.find(
          (
            result,
          ) =>
            result.id ===
            walkForwardId,
        ) ||
        null;
    }

    if (
      !selectedResult
    ) {
      selectedResult =
        findMatchingResult({
          results:
            recentTests,

          symbol:
            activeSymbol,

          timeframe:
            activeTimeframe,
        });
    }

    const paper =
      buildPaperMetrics(
        summary,
      );

    const tested =
      buildWalkForwardMetrics(
        selectedResult,
      );

    const comparison =
      tested
        ? compareMetrics(
            paper,
            tested,
          )
        : null;

    const matchScore =
      comparison
        ? calculateMatchScore(
            comparison,
          )
        : 0;

    return {
      success:
        Boolean(
          tested,
        ),

      comparisonType:
        "PAPER_VS_WALK_FORWARD",

      symbol:
        activeSymbol ||
        null,

      timeframe:
        activeTimeframe ||
        null,

      status:
        tested
          ? classifyMatch(
              matchScore,
            )
          : "NO_MATCHING_TEST",

      matchScore,

      minimumRecommendedClosedTrades:
        DEFAULT_MINIMUM_SAMPLE,

      paper,

      walkForward:
        tested,

      difference:
        comparison,

      warnings:
        buildWarnings({
          paper,

          tested,

          symbol:
            activeSymbol,

          timeframe:
            activeTimeframe,
        }),

      generatedAt:
        Date.now(),
    };
  }

  /*
   * =======================================================
   * COMPLETE STEP 9 REPORT
   * =======================================================
   *
   * Returns BOTH comparisons in one call.
   */
  async getComparisonReport({
    symbol =
      null,

    timeframe =
      null,
  } = {}) {
    const [
      standard,
      walkForward,
    ] =
      await Promise.all([
        this.compareStandard({
          symbol,
          timeframe,
        }),

        this.compareWalkForward({
          symbol,
          timeframe,
        }),
      ]);

    const availableScores =
      [
        standard.success
          ? standard
              .matchScore
          : null,

        walkForward.success
          ? walkForward
              .matchScore
          : null,
      ].filter(
        (
          value,
        ) =>
          Number.isFinite(
            Number(
              value,
            ),
          ),
      );

    const combinedMatchScore =
      availableScores.length >
      0
        ? availableScores.reduce(
            (
              total,
              value,
            ) =>
              total +
              Number(
                value,
              ),
            0,
          ) /
          availableScores.length
        : 0;

    return {
      success:
        standard.success ||
        walkForward.success,

      roadmapStep:
        9,

      title:
        "Paper vs Backtest Comparison",

      symbol:
        standard.symbol ||
        walkForward.symbol ||
        null,

      timeframe:
        standard.timeframe ||
        walkForward.timeframe ||
        null,

      combinedMatchScore:
        Number(
          combinedMatchScore.toFixed(
            2,
          ),
        ),

      combinedStatus:
        availableScores.length >
        0
          ? classifyMatch(
              combinedMatchScore,
            )
          : "NO_MATCHING_TEST",

      standard,

      walkForward,

      generatedAt:
        Date.now(),
    };
  }
}

export default PaperBacktestComparisonService;