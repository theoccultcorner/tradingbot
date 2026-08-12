import {
  PaperBacktestComparisonService,
} from "./paperBacktestComparisonService.js";

const MINIMUM_CLOSED_TRADES =
  20;

const MAXIMUM_ACCEPTABLE_DRAWDOWN_PERCENT =
  10;

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
    value === null ||
    value === undefined
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

function clamp(
  value,
  minimum = 0,
  maximum = 100,
) {
  const number =
    numberOrZero(
      value,
    );

  return Math.min(
    Math.max(
      number,
      minimum,
    ),
    maximum,
  );
}

function round(
  value,
  decimals = 2,
) {
  const number =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return 0;
  }

  return Number(
    number.toFixed(
      decimals,
    ),
  );
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

/*
 * =========================================================
 * PROFITABILITY SCORE
 * =========================================================
 *
 * Maximum:
 * 20 points
 *
 * Uses net return AFTER estimated costs.
 */
function calculateProfitabilityScore(
  summary,
) {
  const returnPercent =
    numberOrZero(
      summary
        ?.netReturnAfterCostsPercent,
    );

  let score =
    0;

  if (
    returnPercent >
    0
  ) {
    /*
     * 1% return = 5 points
     * 2% return = 10 points
     * 3% return = 15 points
     * 4%+ return = 20 points
     */
    score =
      clamp(
        returnPercent *
          5,
        0,
        20,
      );
  }

  return {
    name:
      "Profitability",

    score:
      round(
        score,
      ),

    maximumScore:
      20,

    value:
      returnPercent,

    unit:
      "%",

    passed:
      returnPercent >
      0,

    message:
      returnPercent >
      0
        ? "Paper trading is profitable after estimated fees and slippage."
        : "Paper trading is not currently profitable after estimated fees and slippage.",
  };
}

/*
 * =========================================================
 * EXPECTANCY SCORE
 * =========================================================
 *
 * Maximum:
 * 15 points
 */
function calculateExpectancyScore(
  summary,
) {
  const expectancy =
    numberOrZero(
      summary
        ?.expectancyPerTrade,
    );

  const startingCash =
    Math.max(
      numberOrZero(
        summary
          ?.portfolio
          ?.startingCash,
      ),
      1,
    );

  const expectancyPercent =
    (
      expectancy /
      startingCash
    ) *
    100;

  let score =
    0;

  if (
    expectancy >
    0
  ) {
    /*
     * Reward expectancy relative to
     * bankroll rather than raw dollars.
     *
     * 0.05% of bankroll per trade:
     * full 15 points.
     */
    score =
      clamp(
        (
          expectancyPercent /
          0.05
        ) *
          15,
        0,
        15,
      );
  }

  return {
    name:
      "Expectancy",

    score:
      round(
        score,
      ),

    maximumScore:
      15,

    value:
      expectancy,

    expectancyPercent:
      round(
        expectancyPercent,
        4,
      ),

    passed:
      expectancy >
      0,

    message:
      expectancy >
      0
        ? "Average expected profit per closed trade is positive."
        : "Average expected profit per closed trade is not positive.",
  };
}

/*
 * =========================================================
 * PROFIT FACTOR SCORE
 * =========================================================
 *
 * Maximum:
 * 15 points
 */
function calculateProfitFactorScore(
  summary,
) {
  const profitFactor =
    summary
      ?.profitFactor ===
    null
      ? null
      : nullableNumber(
          summary
            ?.profitFactor,
        );

  let score =
    0;

  if (
    profitFactor ===
    null
  ) {
    /*
     * null can represent winning trades with
     * no losing denominator.
     *
     * This should only be trusted when the
     * sample is large enough.
     */
    score =
      summary
        ?.profitFactorSampleAdequate
        ? 15
        : 0;
  } else if (
    profitFactor >=
    1
  ) {
    /*
     * PF 1.0 = 5
     * PF 1.25 = 7.5
     * PF 1.5 = 10
     * PF 1.75 = 12.5
     * PF 2.0+ = 15
     */
    score =
      clamp(
        5 +
          (
            profitFactor -
            1
          ) *
            10,
        0,
        15,
      );
  }

  return {
    name:
      "Profit Factor",

    score:
      round(
        score,
      ),

    maximumScore:
      15,

    value:
      profitFactor,

    sampleAdequate:
      Boolean(
        summary
          ?.profitFactorSampleAdequate,
      ),

    passed:
      (
        profitFactor ===
          null &&
        Boolean(
          summary
            ?.profitFactorSampleAdequate,
        )
      ) ||
      (
        profitFactor !==
          null &&
        profitFactor >
          1
      ),

    message:
      !summary
        ?.profitFactorSampleAdequate
        ? "Profit factor does not yet have enough closed trades for a strong conclusion."
        : profitFactor ===
            null
          ? "No losing-profit denominator exists in the evaluated sample."
          : profitFactor >
              1
            ? "Gross winning profit exceeds gross losing profit."
            : "Gross losing profit is currently equal to or greater than gross winning profit.",
  };
}

/*
 * =========================================================
 * DRAWDOWN / RISK SCORE
 * =========================================================
 *
 * Maximum:
 * 15 points
 *
 * Lower drawdown receives a better score.
 */
function calculateRiskScore(
  summary,
) {
  const drawdown =
    nullableNumber(
      summary
        ?.maximumDrawdownPercent,
    );

  const equityPointCount =
    numberOrZero(
      summary
        ?.equityPointCount,
    );

  const performance1dComplete =
    Boolean(
      summary
        ?.performance1d
        ?.completePeriod,
    );

  /*
   * A freshly reset equity history can show
   * 0% drawdown simply because there has not
   * been enough time to observe meaningful
   * account movement.
   *
   * Do not award risk-readiness points until
   * there is enough history to judge drawdown.
   */
  const drawdownHistoryAdequate =
    performance1dComplete &&
    equityPointCount >=
      10;

  if (
    drawdown ===
    null
  ) {
    return {
      name:
        "Risk Control",

      score:
        0,

      maximumScore:
        15,

      value:
        null,

      historyAdequate:
        false,

      equityPointCount,

      passed:
        false,

      message:
        "Maximum drawdown data is unavailable.",
    };
  }

  if (
    !drawdownHistoryAdequate
  ) {
    return {
      name:
        "Risk Control",

      score:
        0,

      maximumScore:
        15,

      value:
        drawdown,

      unit:
        "%",

      historyAdequate:
        false,

      equityPointCount,

      maximumAcceptableDrawdownPercent:
        MAXIMUM_ACCEPTABLE_DRAWDOWN_PERCENT,

      passed:
        false,

      message:
        "Drawdown history is still too new to judge risk reliably.",
    };
  }

  /*
   * 0% DD  = 15
   * 2% DD  = 12
   * 5% DD  = 7.5
   * 10% DD = 0
   */
  const score =
    clamp(
      15 -
        (
          drawdown /
          MAXIMUM_ACCEPTABLE_DRAWDOWN_PERCENT
        ) *
          15,
      0,
      15,
    );

  return {
    name:
      "Risk Control",

    score:
      round(
        score,
      ),

    maximumScore:
      15,

    value:
      drawdown,

    unit:
      "%",

    historyAdequate:
      true,

    equityPointCount,

    maximumAcceptableDrawdownPercent:
      MAXIMUM_ACCEPTABLE_DRAWDOWN_PERCENT,

    passed:
      drawdown <
      MAXIMUM_ACCEPTABLE_DRAWDOWN_PERCENT,

    message:
      drawdown <
      MAXIMUM_ACCEPTABLE_DRAWDOWN_PERCENT
        ? "Maximum drawdown is inside the current readiness limit."
        : "Maximum drawdown exceeds the current readiness limit.",
  };
}

/*
 * =========================================================
 * PAPER SAMPLE SCORE
 * =========================================================
 *
 * Maximum:
 * 10 points
 */
function calculateSampleScore(
  summary,
) {
  const closedTrades =
    numberOrZero(
      summary
        ?.closedTrades,
    );

  const score =
    clamp(
      (
        closedTrades /
        MINIMUM_CLOSED_TRADES
      ) *
        10,
      0,
      10,
    );

  return {
    name:
      "Paper Sample",

    score:
      round(
        score,
      ),

    maximumScore:
      10,

    value:
      closedTrades,

    minimumRequired:
      MINIMUM_CLOSED_TRADES,

    passed:
      closedTrades >=
      MINIMUM_CLOSED_TRADES,

    progressPercent:
      round(
        clamp(
          (
            closedTrades /
            MINIMUM_CLOSED_TRADES
          ) *
            100,
        ),
      ),

    message:
      closedTrades >=
      MINIMUM_CLOSED_TRADES
        ? "The minimum paper-trading sample has been reached."
        : `${MINIMUM_CLOSED_TRADES - closedTrades} more closed paper trades are needed to reach the minimum sample.`,
  };
}

/*
 * =========================================================
 * VALIDATION SCORE
 * =========================================================
 *
 * Maximum:
 * 20 points
 *
 * Uses the paper-vs-standard and
 * paper-vs-walk-forward similarity system.
 *
 * IMPORTANT:
 *
 * This measures behavioral agreement,
 * not profitability.
 */
function calculateValidationScore(
  comparisonReport,
) {
  const combinedMatchScore =
    nullableNumber(
      comparisonReport
        ?.combinedMatchScore,
    );

  const comparisonCount =
    numberOrZero(
      comparisonReport
        ?.availableComparisonCount,
    );

  if (
    combinedMatchScore ===
      null ||
    comparisonCount ===
      0
  ) {
    return {
      name:
        "Validation",

      score:
        0,

      maximumScore:
        20,

      value:
        null,

      availableComparisonCount:
        comparisonCount,

      passed:
        false,

      statisticallyMeaningful:
        false,

      message:
        "No usable paper-vs-test validation is available for this market and timeframe.",
    };
  }

  /*
   * Match score maps directly into
   * 0-20 readiness points.
   *
   * Example:
   *
   * 70% match = 14 points
   */
  const score =
    clamp(
      (
        combinedMatchScore /
        100
      ) *
        20,
      0,
      20,
    );

  const statisticallyMeaningful =
    Boolean(
      comparisonReport
        ?.statisticallyMeaningful,
    );

  return {
    name:
      "Validation",

    score:
      round(
        score,
      ),

    maximumScore:
      20,

    value:
      combinedMatchScore,

    availableComparisonCount:
      comparisonCount,

    passed:
      statisticallyMeaningful &&
      combinedMatchScore >=
        65,

    statisticallyMeaningful,

    message:
      !statisticallyMeaningful
        ? "Historical-vs-paper similarity exists, but the sample is not yet statistically meaningful."
        : combinedMatchScore >=
            85
          ? "Paper behavior closely matches historical testing."
          : combinedMatchScore >=
              65
            ? "Paper behavior shows moderate agreement with historical testing."
            : "Paper behavior differs substantially from historical testing.",
  };
}

/*
 * =========================================================
 * RECENT PERFORMANCE SCORE
 * =========================================================
 *
 * Maximum:
 * 5 points
 *
 * Uses full rolling periods only.
 */
function calculateRecentPerformanceScore(
  summary,
) {
  const periods = [
    {
      name:
        "1d",

      value:
        summary
          ?.performance1d,
    },

    {
      name:
        "7d",

      value:
        summary
          ?.performance7d,
    },

    {
      name:
        "30d",

      value:
        summary
          ?.performance30d,
    },
  ];

  const completePeriods =
    periods.filter(
      (
        item,
      ) =>
        Boolean(
          item
            .value
            ?.completePeriod,
        ),
    );

  if (
    completePeriods.length ===
    0
  ) {
    return {
      name:
        "Recent Consistency",

      score:
        0,

      maximumScore:
        5,

      completePeriodCount:
        0,

      passed:
        false,

      periods:
        periods.map(
          (
            item,
          ) => ({
            name:
              item.name,

            complete:
              Boolean(
                item
                  .value
                  ?.completePeriod,
              ),

            returnPercent:
              numberOrZero(
                item
                  .value
                  ?.returnPercent,
              ),
          }),
        ),

      message:
        "Not enough full rolling-history periods are available yet.",
    };
  }

  const positivePeriods =
    completePeriods.filter(
      (
        item,
      ) =>
        numberOrZero(
          item
            .value
            ?.returnPercent,
        ) >
        0,
    ).length;

  const score =
    (
      positivePeriods /
      completePeriods.length
    ) *
    5;

  return {
    name:
      "Recent Consistency",

    score:
      round(
        score,
      ),

    maximumScore:
      5,

    completePeriodCount:
      completePeriods.length,

    positivePeriodCount:
      positivePeriods,

    passed:
      positivePeriods ===
        completePeriods.length &&
      completePeriods.length >
        0,

    periods:
      periods.map(
        (
          item,
        ) => ({
          name:
            item.name,

          complete:
            Boolean(
              item
                .value
                ?.completePeriod,
            ),

          returnPercent:
            numberOrZero(
              item
                .value
                ?.returnPercent,
            ),
        }),
      ),

    message:
      `${positivePeriods} of ${completePeriods.length} complete rolling periods are profitable.`,
  };
}

/*
 * =========================================================
 * HARD SAFETY BLOCKERS
 * =========================================================
 *
 * These can prevent go-live readiness regardless
 * of the numeric score.
 */
function buildSafetyBlockers({
  summary,
  comparisonReport,
}) {
  const blockers =
    [];

  const expectancy =
    numberOrZero(
      summary
        ?.expectancyPerTrade,
    );

  const netProfit =
    numberOrZero(
      summary
        ?.netProfitAfterCosts,
    );

  const profitFactor =
    summary
      ?.profitFactor ===
    null
      ? null
      : nullableNumber(
          summary
            ?.profitFactor,
        );

  const drawdown =
    nullableNumber(
      summary
        ?.maximumDrawdownPercent,
    );

  if (
    expectancy <=
    0
  ) {
    blockers.push({
      code:
        "NON_POSITIVE_EXPECTANCY",

      severity:
        "BLOCKER",

      message:
        "Expectancy per closed trade is not positive.",
    });
  }

  if (
    netProfit <=
    0
  ) {
    blockers.push({
      code:
        "NON_POSITIVE_NET_PROFIT",

      severity:
        "BLOCKER",

      message:
        "Paper trading is not profitable after estimated costs.",
    });
  }

  if (
    profitFactor !==
      null &&
    profitFactor <
      1
  ) {
    blockers.push({
      code:
        "PROFIT_FACTOR_BELOW_ONE",

      severity:
        "BLOCKER",

      message:
        "Profit factor is below 1.0.",
    });
  }

  if (
    drawdown !==
      null &&
    drawdown >
      MAXIMUM_ACCEPTABLE_DRAWDOWN_PERCENT
  ) {
    blockers.push({
      code:
        "EXCESSIVE_DRAWDOWN",

      severity:
        "BLOCKER",

      message:
        `Maximum drawdown exceeds ${MAXIMUM_ACCEPTABLE_DRAWDOWN_PERCENT}%.`,
    });
  }

  /*
   * If validation has enough data and still
   * produces a poor behavioral match, block.
   */
  if (
    comparisonReport
      ?.statisticallyMeaningful &&
    comparisonReport
      ?.combinedStatus ===
      "POOR_MATCH"
  ) {
    blockers.push({
      code:
        "POOR_VALIDATION_MATCH",

      severity:
        "BLOCKER",

      message:
        "Paper trading differs substantially from historical testing.",
    });
  }

  /*
   * Walk-forward profitability should matter
   * because it is out-of-sample behavior.
   *
   * Only turn it into a hard blocker when that
   * test itself has enough closed trades.
   */
  const walkForward =
    comparisonReport
      ?.walkForward
      ?.walkForward;

  if (
    walkForward
      ?.sampleAdequate &&
    numberOrZero(
      walkForward
        ?.returnPercent,
    ) <=
      0
  ) {
    blockers.push({
      code:
        "WALK_FORWARD_NOT_PROFITABLE",

      severity:
        "BLOCKER",

      message:
        "The matching walk-forward test is not profitable.",
    });
  }

  return blockers;
}

/*
 * =========================================================
 * DATA REQUIREMENTS
 * =========================================================
 *
 * Missing evidence should not be confused with
 * failed evidence.
 */
function buildDataGaps({
  summary,
  comparisonReport,
}) {
  const gaps =
    [];

  const closedTrades =
    numberOrZero(
      summary
        ?.closedTrades,
    );

  const equityPointCount =
    numberOrZero(
      summary
        ?.equityPointCount,
    );

  const performance1dComplete =
    Boolean(
      summary
        ?.performance1d
        ?.completePeriod,
    );

  if (
    closedTrades <
    MINIMUM_CLOSED_TRADES
  ) {
    gaps.push({
      code:
        "PAPER_SAMPLE_TOO_SMALL",

      message:
        `Only ${closedTrades} closed paper trades are available. At least ${MINIMUM_CLOSED_TRADES} are required.`,
    });
  }

  if (
    !summary
      ?.profitFactorSampleAdequate
  ) {
    gaps.push({
      code:
        "PROFIT_FACTOR_SAMPLE_TOO_SMALL",

      message:
        "Profit factor does not yet have a large enough closed-trade sample.",
    });
  }

  if (
    !comparisonReport
      ?.success
  ) {
    gaps.push({
      code:
        "NO_MATCHING_VALIDATION_TEST",

      message:
        "No matching standard or walk-forward comparison is available.",
    });
  }

  if (
    comparisonReport
      ?.success &&
    !comparisonReport
      ?.statisticallyMeaningful
  ) {
    gaps.push({
      code:
        "VALIDATION_SAMPLE_TOO_SMALL",

      message:
        "Paper-vs-test validation exists, but its sample is not yet statistically meaningful.",
    });
  }

  /*
   * Drawdown should not be trusted immediately
   * after equity history has been reset.
   *
   * Require:
   *
   * - at least one complete 24-hour period
   * - at least 10 stored equity snapshots
   */
  if (
    !performance1dComplete ||
    equityPointCount <
      10
  ) {
    gaps.push({
      code:
        "DRAWDOWN_HISTORY_TOO_NEW",

      message:
        "Drawdown history is still too new to evaluate risk reliably.",
    });
  }

  const performance7d =
    summary
      ?.performance7d;

  if (
    !performance7d
      ?.completePeriod
  ) {
    gaps.push({
      code:
        "SEVEN_DAY_HISTORY_INCOMPLETE",

      message:
        "A complete 7-day paper-performance history is not available yet.",
    });
  }

  return gaps;
}

/*
 * =========================================================
 * READINESS STATUS
 * =========================================================
 */
function determineReadinessStatus({
  score,
  safetyBlockers,
  dataGaps,
}) {
  /*
   * Hard safety problems always win.
   */
  if (
    safetyBlockers.length >
    0
  ) {
    return "NOT_READY";
  }

  /*
   * No known safety failure, but we still
   * need more evidence.
   */
  if (
    dataGaps.length >
    0
  ) {
    return "NEEDS_MORE_DATA";
  }

  if (
    score >=
    80
  ) {
    return "READY_FOR_TINY_LIVE";
  }

  if (
    score >=
    65
  ) {
    return "CAUTION";
  }

  return "NOT_READY";
}

function readinessLabel(
  status,
) {
  switch (
    status
  ) {
    case "READY_FOR_TINY_LIVE":
      return "Ready for Tiny-Live Review";

    case "CAUTION":
      return "Caution";

    case "NEEDS_MORE_DATA":
      return "Needs More Data";

    case "NOT_READY":
    default:
      return "Not Ready";
  }
}

/*
 * =========================================================
 * SERVICE
 * =========================================================
 */
export class GoLiveReadinessService {
  constructor({
    performanceService,
  }) {
    if (
      !performanceService
    ) {
      throw new Error(
        "GoLiveReadinessService requires performanceService.",
      );
    }

    this.performanceService =
      performanceService;

    this.comparisonService =
      new PaperBacktestComparisonService({
        performanceService,
      });
  }

  async getReadinessReport({
    symbol =
      null,

    timeframe =
      null,
  } = {}) {
    /*
     * Get the performance summary first so
     * we can resolve the active market when
     * explicit query parameters are omitted.
     */
    const summary =
      await this.performanceService
        .getSummary();

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

    const comparisonReport =
      await this.comparisonService
        .getComparisonReport({
          symbol:
            activeSymbol ||
            null,

          timeframe:
            activeTimeframe ||
            null,
        });

    const profitability =
      calculateProfitabilityScore(
        summary,
      );

    const expectancy =
      calculateExpectancyScore(
        summary,
      );

    const profitFactor =
      calculateProfitFactorScore(
        summary,
      );

    const risk =
      calculateRiskScore(
        summary,
      );

    const validation =
      calculateValidationScore(
        comparisonReport,
      );

    const sample =
      calculateSampleScore(
        summary,
      );

    const recentConsistency =
      calculateRecentPerformanceScore(
        summary,
      );

    const categories = {
      profitability,

      expectancy,

      profitFactor,

      risk,

      validation,

      sample,

      recentConsistency,
    };

    const score =
      Object.values(
        categories,
      ).reduce(
        (
          total,
          category,
        ) =>
          total +
          numberOrZero(
            category.score,
          ),
        0,
      );

    const readinessScore =
      round(
        clamp(
          score,
          0,
          100,
        ),
      );

    const safetyBlockers =
      buildSafetyBlockers({
        summary,
        comparisonReport,
      });

    const dataGaps =
      buildDataGaps({
        summary,
        comparisonReport,
      });

    const status =
      determineReadinessStatus({
        score:
          readinessScore,

        safetyBlockers,

        dataGaps,
      });

    const readyForTinyLive =
      status ===
      "READY_FOR_TINY_LIVE";

    return {
      success:
        true,

      title:
        "Go-Live Readiness",

      symbol:
        activeSymbol ||
        null,

      timeframe:
        activeTimeframe ||
        null,

      readinessScore,

      status,

      statusLabel:
        readinessLabel(
          status,
        ),

      readyForTinyLive,

      /*
       * Important distinction:
       *
       * This report evaluates readiness.
       *
       * It does NOT promise future
       * profitability.
       */
      scoreMeaning:
        "READINESS_EVIDENCE_NOT_FUTURE_PROFIT_GUARANTEE",

      thresholds: {
        minimumClosedTrades:
          MINIMUM_CLOSED_TRADES,

        maximumAcceptableDrawdownPercent:
          MAXIMUM_ACCEPTABLE_DRAWDOWN_PERCENT,

        cautionScore:
          65,

        tinyLiveReviewScore:
          80,
      },

      categories,

      safetyBlockers,

      dataGaps,

      evidence: {
        closedTrades:
          numberOrZero(
            summary
              ?.closedTrades,
          ),

        wins:
          numberOrZero(
            summary
              ?.wins,
          ),

        losses:
          numberOrZero(
            summary
              ?.losses,
          ),

        winRate:
          numberOrZero(
            summary
              ?.winRate,
          ),

        expectancyPerTrade:
          numberOrZero(
            summary
              ?.expectancyPerTrade,
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

        netProfitAfterCosts:
          numberOrZero(
            summary
              ?.netProfitAfterCosts,
          ),

        netReturnAfterCostsPercent:
          numberOrZero(
            summary
              ?.netReturnAfterCostsPercent,
          ),

        maximumDrawdownPercent:
          nullableNumber(
            summary
              ?.maximumDrawdownPercent,
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

        performance1d:
          summary
            ?.performance1d ||
          null,

        performance7d:
          summary
            ?.performance7d ||
          null,

        performance30d:
          summary
            ?.performance30d ||
          null,
      },

      validation: {
        success:
          Boolean(
            comparisonReport
              ?.success,
          ),

        combinedMatchScore:
          nullableNumber(
            comparisonReport
              ?.combinedMatchScore,
          ),

        combinedStatus:
          comparisonReport
            ?.combinedStatus ||
          "NO_MATCHING_TEST",

        statisticallyMeaningful:
          Boolean(
            comparisonReport
              ?.statisticallyMeaningful,
          ),

        availableComparisonCount:
          numberOrZero(
            comparisonReport
              ?.availableComparisonCount,
          ),

        standard: {
          available:
            Boolean(
              comparisonReport
                ?.standard
                ?.success,
            ),

          status:
            comparisonReport
              ?.standard
              ?.status ||
            "NO_MATCHING_TEST",

          matchScore:
            nullableNumber(
              comparisonReport
                ?.standard
                ?.matchScore,
            ),

          closedTrades:
            numberOrZero(
              comparisonReport
                ?.standard
                ?.backtest
                ?.closedTrades,
            ),

          returnPercent:
            nullableNumber(
              comparisonReport
                ?.standard
                ?.backtest
                ?.returnPercent,
            ),
        },

        walkForward: {
          available:
            Boolean(
              comparisonReport
                ?.walkForward
                ?.success,
            ),

          status:
            comparisonReport
              ?.walkForward
              ?.status ||
            "NO_MATCHING_TEST",

          matchScore:
            nullableNumber(
              comparisonReport
                ?.walkForward
                ?.matchScore,
            ),

          closedTrades:
            numberOrZero(
              comparisonReport
                ?.walkForward
                ?.walkForward
                ?.closedTrades,
            ),

          returnPercent:
            nullableNumber(
              comparisonReport
                ?.walkForward
                ?.walkForward
                ?.returnPercent,
            ),

          profitableWindowRate:
            nullableNumber(
              comparisonReport
                ?.walkForward
                ?.walkForward
                ?.profitableWindowRate,
            ),
        },
      },

      generatedAt:
        Date.now(),
    };
  }
}

export default GoLiveReadinessService;