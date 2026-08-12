import {
  getRecentBacktests,
  getRecentWalkForwardTests,
} from "./backtestService.js";

const DEFAULT_MINIMUM_SAMPLE =
  20;

/*
 * =========================================================
 * BASIC HELPERS
 * =========================================================
 */

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
 * MARKET MATCHING
 * =========================================================
 */

function sameMarket({
  result,
  symbol,
  timeframe,
}) {
  if (
    !result
  ) {
    return false;
  }

  return (
    normalizeSymbol(
      result.symbol,
    ) ===
      normalizeSymbol(
        symbol,
      ) &&
    normalizeTimeframe(
      result.timeframe,
    ) ===
      normalizeTimeframe(
        timeframe,
      )
  );
}

/*
 * IMPORTANT:
 *
 * Step 9 must compare LIKE-FOR-LIKE markets.
 *
 * BTCUSD 5m paper trading must NEVER silently
 * fall back to BTCUSD 1m just because the
 * symbol matches.
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

  return (
    results.find(
      (
        result,
      ) =>
        sameMarket({
          result,
          symbol,
          timeframe,
        }),
    ) ||
    null
  );
}

/*
 * =========================================================
 * PAPER DRAWDOWN VALIDATION
 * =========================================================
 *
 * We previously had contaminated equity snapshots where a
 * crypto MARKET PRICE was effectively treated as ACCOUNT
 * EQUITY.
 *
 * Example:
 *
 * starting bankroll: ~$300
 * reported drawdown: ~$84,000
 *
 * That historical data must not be allowed to destroy the
 * Step 9 match score.
 *
 * We do NOT silently rewrite the drawdown.
 *
 * Instead:
 *
 * - preserve the raw value
 * - flag it as invalid
 * - exclude it from the comparison score
 */
function validatePaperDrawdown({
  summary,
  drawdownAmount,
  drawdownPercent,
}) {
  const startingCash =
    numberOrZero(
      summary
        ?.portfolio
        ?.startingCash,
    );

  const currentEquity =
    numberOrZero(
      summary
        ?.latestEquity
        ?.equity,
    );

  const safeAccountReference =
    Math.max(
      startingCash,
      currentEquity,
      1,
    );

  const amount =
    nullableNumber(
      drawdownAmount,
    );

  const percent =
    nullableNumber(
      drawdownPercent,
    );

  const reasons =
    [];

  if (
    amount ===
      null ||
    percent ===
      null
  ) {
    reasons.push(
      "Paper drawdown is missing or invalid.",
    );
  }

  if (
    percent !==
      null &&
    (
      percent <
        0 ||
      percent >
        100
    )
  ) {
    reasons.push(
      "Paper drawdown percentage is outside the expected 0-100% range.",
    );
  }

  /*
   * If amount and percent are both present, infer
   * the equity peak from:
   *
   * drawdown % =
   * drawdown amount / peak equity
   */
  if (
    amount !==
      null &&
    amount >
      0 &&
    percent !==
      null &&
    percent >
      0
  ) {
    const impliedPeak =
      amount /
      (
        percent /
        100
      );

    /*
     * A historical peak more than 10x the
     * currently known bankroll/equity is treated
     * as suspicious for this paper account.
     *
     * This catches the contaminated BTC-price
     * snapshot without rejecting normal movement.
     */
    if (
      impliedPeak >
      safeAccountReference *
        10
    ) {
      reasons.push(
        `Paper drawdown implies an equity peak of approximately $${impliedPeak.toFixed(
          2,
        )}, which is inconsistent with the current paper-account scale.`,
      );
    }
  }

  /*
   * Extremely large drawdown amount compared with
   * the known account scale is another independent
   * corruption signal.
   */
  if (
    amount !==
      null &&
    amount >
      safeAccountReference *
        10
  ) {
    reasons.push(
      "Paper drawdown amount is far larger than the known paper-account scale.",
    );
  }

  return {
    valid:
      reasons.length ===
      0,

    amount,

    percent,

    reasons,
  };
}

/*
 * =========================================================
 * PAPER METRICS
 * =========================================================
 */

function buildPaperMetrics(
  summary,
) {
  const closedTrades =
    numberOrZero(
      summary
        ?.closedTrades,
    );

  const rawDrawdownPercent =
    nullableNumber(
      summary
        ?.maximumDrawdownPercent,
    );

  const rawDrawdownAmount =
    nullableNumber(
      summary
        ?.maximumDrawdownAmount,
    );

  const drawdownValidation =
    validatePaperDrawdown({
      summary,

      drawdownAmount:
        rawDrawdownAmount,

      drawdownPercent:
        rawDrawdownPercent,
    });

  return {
    source:
      "PAPER_TRADING",

    startingCash:
      numberOrZero(
        summary
          ?.portfolio
          ?.startingCash,
      ),

    currentEquity:
      numberOrZero(
        summary
          ?.latestEquity
          ?.equity,
      ),

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

    /*
     * Use null when contaminated so this value
     * cannot be scored as if it were trustworthy.
     */
    maximumDrawdownPercent:
      drawdownValidation
        .valid
        ? rawDrawdownPercent
        : null,

    maximumDrawdownAmount:
      drawdownValidation
        .valid
        ? rawDrawdownAmount
        : null,

    rawMaximumDrawdownPercent:
      rawDrawdownPercent,

    rawMaximumDrawdownAmount:
      rawDrawdownAmount,

    drawdownDataValid:
      drawdownValidation
        .valid,

    drawdownWarnings:
      drawdownValidation
        .reasons,

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

    /*
     * averageTrade is the direct closed-trade
     * equivalent of paper expectancy.
     */
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
      nullableNumber(
        result
          .maximumDrawdownPercent,
      ),

    maximumDrawdownAmount:
      nullableNumber(
        result
          .maximumDrawdownAmount,
      ),

    totalFees:
      numberOrZero(
        result
          .totalFees,
      ),

    /*
     * Standard backtest currently has fees but
     * does not separately model our paper
     * slippage estimate.
     */
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
      nullableNumber(
        result
          .maximumDrawdownPercent,
      ),

    maximumDrawdownAmount:
      nullableNumber(
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

  const paperDrawdown =
    nullableNumber(
      paper
        .maximumDrawdownPercent,
    );

  const testedDrawdown =
    nullableNumber(
      tested
        .maximumDrawdownPercent,
    );

  const drawdownAvailable =
    paperDrawdown !==
      null &&
    testedDrawdown !==
      null;

  return {
    returnPercent: {
      available:
        true,

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
      available:
        true,

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
      available:
        true,

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
      /*
       * null profit factor can legitimately mean
       * no losing trades.
       *
       * If either side is null, do not score the
       * numeric gap.
       */
      available:
        paper.profitFactor !==
          null &&
        tested.profitFactor !==
          null,

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
      available:
        true,

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
      available:
        drawdownAvailable,

      paper:
        paperDrawdown,

      tested:
        testedDrawdown,

      difference:
        drawdownAvailable
          ? absoluteDifference(
              paperDrawdown,
              testedDrawdown,
            )
          : null,

      absoluteGap:
        drawdownAvailable
          ? absoluteGap(
              paperDrawdown,
              testedDrawdown,
            )
          : null,

      paperWorseBy:
        drawdownAvailable
          ? Math.max(
              absoluteDifference(
                paperDrawdown,
                testedDrawdown,
              ) ||
                0,
              0,
            )
          : null,

      excludedReason:
        drawdownAvailable
          ? null
          : paper
              .drawdownDataValid ===
            false
            ? "Paper drawdown data failed validation and was excluded from scoring."
            : "Drawdown data is unavailable.",
    },

    closedTrades: {
      available:
        true,

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
      available:
        true,

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
 * MATCH SCORE
 * =========================================================
 *
 * IMPORTANT:
 *
 * This measures similarity.
 *
 * It does NOT measure profitability.
 *
 * Two losing systems could theoretically be
 * extremely similar and receive a high match score.
 */
function calculateMatchScore(
  comparison,
) {
  if (
    !comparison
  ) {
    return null;
  }

  let score =
    100;

  let availableWeight =
    0;

  let possibleWeight =
    0;

  /*
   * RETURN
   *
   * Maximum penalty: 25
   */
  possibleWeight +=
    25;

  if (
    comparison
      .returnPercent
      ?.available
  ) {
    availableWeight +=
      25;

    const gap =
      numberOrZero(
        comparison
          .returnPercent
          .absoluteGap,
      );

    score -=
      Math.min(
        gap *
          5,
        25,
      );
  }

  /*
   * WIN RATE
   *
   * Maximum penalty: 20
   */
  possibleWeight +=
    20;

  if (
    comparison
      .winRate
      ?.available
  ) {
    availableWeight +=
      20;

    const gap =
      numberOrZero(
        comparison
          .winRate
          .absoluteGap,
      );

    score -=
      Math.min(
        gap *
          1.25,
        20,
      );
  }

  /*
   * PROFIT FACTOR
   *
   * Maximum penalty: 20
   */
  possibleWeight +=
    20;

  if (
    comparison
      .profitFactor
      ?.available
  ) {
    availableWeight +=
      20;

    const gap =
      numberOrZero(
        comparison
          .profitFactor
          .absoluteGap,
      );

    score -=
      Math.min(
        gap *
          20,
        20,
      );
  }

  /*
   * EXPECTANCY
   *
   * Maximum penalty: 20
   */
  possibleWeight +=
    20;

  if (
    comparison
      .expectancy
      ?.available
  ) {
    availableWeight +=
      20;

    const testedExpectancy =
      Math.abs(
        numberOrZero(
          comparison
            .expectancy
            .tested,
        ),
      );

    const expectancyGap =
      numberOrZero(
        comparison
          .expectancy
          .absoluteGap,
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
  }

  /*
   * DRAWDOWN
   *
   * Maximum penalty: 15
   *
   * If paper drawdown is contaminated, this
   * entire metric is excluded.
   */
  possibleWeight +=
    15;

  if (
    comparison
      .maximumDrawdownPercent
      ?.available
  ) {
    availableWeight +=
      15;

    const gap =
      numberOrZero(
        comparison
          .maximumDrawdownPercent
          .absoluteGap,
      );

    score -=
      Math.min(
        gap *
          3,
        15,
      );
  }

  /*
   * If a metric is unavailable, normalize the
   * remaining score so missing data doesn't act
   * like an automatic failure.
   */
  if (
    availableWeight <=
    0
  ) {
    return null;
  }

  const unavailableWeight =
    possibleWeight -
    availableWeight;

  const effectiveMaximum =
    100 -
    unavailableWeight;

  if (
    effectiveMaximum <=
    0
  ) {
    return null;
  }

  const normalizedScore =
    (
      score /
      effectiveMaximum
    ) *
    100;

  return Math.max(
    Math.min(
      Number(
        normalizedScore.toFixed(
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
  const value =
    nullableNumber(
      score,
    );

  if (
    value ===
    null
  ) {
    return "UNAVAILABLE";
  }

  if (
    value >=
    85
  ) {
    return "GOOD_MATCH";
  }

  if (
    value >=
    65
  ) {
    return "MODERATE_DRIFT";
  }

  return "POOR_MATCH";
}

/*
 * =========================================================
 * STATUS LOGIC
 * =========================================================
 */

function determineComparisonStatus({
  tested,
  paper,
  matchScore,
}) {
  if (
    !tested
  ) {
    return "NO_MATCHING_TEST";
  }

  /*
   * Do not pretend we know whether paper and
   * historical behavior match after only a tiny
   * handful of trades.
   */
  if (
    !paper
      ?.sampleAdequate ||
    !tested
      ?.sampleAdequate
  ) {
    return "INSUFFICIENT_SAMPLE";
  }

  if (
    matchScore ===
      null
  ) {
    return "INSUFFICIENT_DATA";
  }

  return classifyMatch(
    matchScore,
  );
}

/*
 * =========================================================
 * WARNINGS
 * =========================================================
 */

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
      `No saved test was found for ${symbol || "the requested symbol"} ${timeframe || "and timeframe"}.`,
    );

    return warnings;
  }

  /*
   * This should no longer occur because exact
   * market matching is mandatory.
   *
   * Keep the safeguards anyway.
   */
  if (
    normalizeSymbol(
      tested.symbol,
    ) !==
    normalizeSymbol(
      symbol,
    )
  ) {
    warnings.push(
      `Test symbol ${tested.symbol} does not match paper symbol ${symbol}.`,
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
      `Test timeframe ${tested.timeframe} does not match paper timeframe ${timeframe}.`,
    );
  }

  if (
    !paper
      .sampleAdequate
  ) {
    warnings.push(
      `Paper trading has only ${paper.closedTrades} closed trades. At least ${DEFAULT_MINIMUM_SAMPLE} are recommended before treating the comparison as statistically meaningful.`,
    );
  }

  if (
    !tested
      .sampleAdequate
  ) {
    warnings.push(
      `The selected test has only ${tested.closedTrades} closed trades. At least ${DEFAULT_MINIMUM_SAMPLE} are recommended before treating the comparison as statistically meaningful.`,
    );
  }

  if (
    paper
      .drawdownDataValid ===
    false
  ) {
    warnings.push(
      "Paper drawdown data appears contaminated by historical equity snapshots and has been excluded from the comparison score.",
    );

    for (
      const warning of
      paper
        .drawdownWarnings ||
      []
    ) {
      warnings.push(
        warning,
      );
    }
  }

  /*
   * Step 9 v1 still compares aggregate metrics.
   *
   * Exact identical start/end market-period
   * alignment is a future enhancement.
   */
  warnings.push(
    "The comparison requires the same symbol and timeframe, but it does not yet guarantee that paper trading and the saved test cover identical wall-clock start and end timestamps.",
  );

  return warnings;
}

/*
 * =========================================================
 * SCORE AVAILABILITY
 * =========================================================
 */

function validCompletedScore(
  comparison,
) {
  if (
    !comparison
      ?.success
  ) {
    return null;
  }

  const score =
    nullableNumber(
      comparison
        .matchScore,
    );

  return score;
}

/*
 * =========================================================
 * SERVICE
 * =========================================================
 */

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
   * PAPER VS STANDARD BACKTEST
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

    /*
     * If a specific ID is requested, it STILL must
     * match the requested symbol and timeframe.
     */
    if (
      backtestId
    ) {
      const requested =
        recentBacktests.find(
          (
            result,
          ) =>
            result.id ===
            backtestId,
        ) ||
        null;

      if (
        requested &&
        sameMarket({
          result:
            requested,

          symbol:
            activeSymbol,

          timeframe:
            activeTimeframe,
        })
      ) {
        selectedResult =
          requested;
      }
    }

    if (
      !selectedResult &&
      !backtestId
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
        : null;

    const status =
      determineComparisonStatus({
        tested,
        paper,
        matchScore,
      });

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

      status,

      matchScore,

      scoreMeaning:
        "SIMILARITY_ONLY_NOT_PROFITABILITY",

      statisticallyMeaningful:
        Boolean(
          paper
            .sampleAdequate &&
          tested
            ?.sampleAdequate,
        ),

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
   * PAPER VS WALK-FORWARD
   * =======================================================
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
      const requested =
        recentTests.find(
          (
            result,
          ) =>
            result.id ===
            walkForwardId,
        ) ||
        null;

      if (
        requested &&
        sameMarket({
          result:
            requested,

          symbol:
            activeSymbol,

          timeframe:
            activeTimeframe,
        })
      ) {
        selectedResult =
          requested;
      }
    }

    if (
      !selectedResult &&
      !walkForwardId
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
        : null;

    const status =
      determineComparisonStatus({
        tested,
        paper,
        matchScore,
      });

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

      status,

      matchScore,

      scoreMeaning:
        "SIMILARITY_ONLY_NOT_PROFITABILITY",

      statisticallyMeaningful:
        Boolean(
          paper
            .sampleAdequate &&
          tested
            ?.sampleAdequate,
        ),

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

    /*
     * Missing comparisons are EXCLUDED.
     *
     * They are NOT converted to score 0.
     */
    const availableScores =
      [
        validCompletedScore(
          standard,
        ),

        validCompletedScore(
          walkForward,
        ),
      ].filter(
        (
          value,
        ) =>
          value !==
            null,
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
              value,
            0,
          ) /
          availableScores.length
        : null;

    const hasAnyTest =
      standard.success ||
      walkForward.success;

    const hasInsufficientSample =
      [
        standard,
        walkForward,
      ].some(
        (
          result,
        ) =>
          result.success &&
          result.status ===
            "INSUFFICIENT_SAMPLE",
      );

    let combinedStatus =
      "NO_MATCHING_TEST";

    if (
      hasAnyTest
    ) {
      if (
        hasInsufficientSample
      ) {
        combinedStatus =
          "INSUFFICIENT_SAMPLE";
      } else if (
        combinedMatchScore !==
        null
      ) {
        combinedStatus =
          classifyMatch(
            combinedMatchScore,
          );
      } else {
        combinedStatus =
          "INSUFFICIENT_DATA";
      }
    }

    const combinedStatisticallyMeaningful =
      hasAnyTest &&
      [
        standard,
        walkForward,
      ]
        .filter(
          (
            result,
          ) =>
            result.success,
        )
        .every(
          (
            result,
          ) =>
            result
              .statisticallyMeaningful,
        );

    const warnings =
      [];

    if (
      !standard.success
    ) {
      warnings.push(
        `No exact standard backtest match exists for ${standard.symbol || "the active symbol"} ${standard.timeframe || "the active timeframe"}.`,
      );
    }

    if (
      !walkForward.success
    ) {
      warnings.push(
        `No exact walk-forward match exists for ${walkForward.symbol || "the active symbol"} ${walkForward.timeframe || "the active timeframe"}.`,
      );
    }

    if (
      hasInsufficientSample
    ) {
      warnings.push(
        `At least ${DEFAULT_MINIMUM_SAMPLE} closed trades are recommended on both sides before Step 9 should be treated as statistically meaningful.`,
      );
    }

    return {
      success:
        hasAnyTest,

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
        combinedMatchScore ===
        null
          ? null
          : Number(
              combinedMatchScore.toFixed(
                2,
              ),
            ),

      combinedStatus,

      scoreMeaning:
        "SIMILARITY_ONLY_NOT_PROFITABILITY",

      statisticallyMeaningful:
        combinedStatisticallyMeaningful,

      minimumRecommendedClosedTrades:
        DEFAULT_MINIMUM_SAMPLE,

      availableComparisonCount:
        [
          standard.success,
          walkForward.success,
        ].filter(
          Boolean,
        ).length,

      standard,

      walkForward,

      warnings,

      generatedAt:
        Date.now(),
    };
  }
}

export default PaperBacktestComparisonService;