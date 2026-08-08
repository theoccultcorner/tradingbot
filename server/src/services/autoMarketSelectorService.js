import {
  DEFAULT_SYMBOLS,
  scanMarkets,
} from "./marketScannerService.js";

import {
  loadLocalSettings,
  saveLocalSettings,
} from "./localSettingsService.js";

import {
  DEFAULT_STRATEGY_CONFIG,
} from "../utils/signalEngine.js";

const LOCAL_SETTINGS_KEY =
  "autoMarketSelector";

const DEFAULT_SETTINGS = {
  enabled: false,

  timeframe:
    "15m",

  minimumScore:
    DEFAULT_STRATEGY_CONFIG
      .buyThreshold,

  minimumConfidence:
    60,

  scanIntervalMinutes:
    5,

  symbols:
    DEFAULT_SYMBOLS,
};

function cleanSettings(
  value = {},
) {
  return {
    enabled:
      Boolean(
        value.enabled,
      ),

    timeframe:
      String(
        value.timeframe ||
          "15m",
      ),

    /*
     * Strategy 2.0 does not produce BUY
     * below its configured BUY threshold.
     *
     * Prevent the selector from accepting
     * a meaningless minimum score below
     * that threshold.
     */
    minimumScore:
      Math.min(
        Math.max(
          Number(
            value.minimumScore,
          ) ||
            DEFAULT_STRATEGY_CONFIG
              .buyThreshold,

          DEFAULT_STRATEGY_CONFIG
            .buyThreshold,
        ),

        100,
      ),

    minimumConfidence:
      Math.min(
        Math.max(
          Number(
            value.minimumConfidence,
          ) || 60,

          0,
        ),

        100,
      ),

    scanIntervalMinutes:
      Math.max(
        Number(
          value.scanIntervalMinutes,
        ) || 5,

        1,
      ),

    symbols:
      Array.isArray(
        value.symbols,
      ) &&
      value.symbols.length >
        0
        ? [
            ...new Set(
              value.symbols.map(
                (
                  symbol,
                ) =>
                  String(
                    symbol,
                  )
                    .trim()
                    .toUpperCase(),
              ),
            ),
          ]
        : DEFAULT_SYMBOLS,
  };
}

export class AutoMarketSelectorService {
  constructor({
    onSelection,
  } = {}) {
    this.settings = {
      ...DEFAULT_SETTINGS,
    };

    this.onSelection =
      onSelection;

    this.timer =
      null;

    this.running =
      false;

    this.lastScan =
      null;

    this.lastSelection =
      null;

    this.initialized =
      false;
  }

  async initialize() {
    const saved =
      await loadLocalSettings(
        LOCAL_SETTINGS_KEY,
        {
          settings: {
            ...DEFAULT_SETTINGS,
          },

          lastSelection:
            null,
        },
      );

    this.settings =
      cleanSettings({
        ...DEFAULT_SETTINGS,

        ...(
          saved.settings ||
          {}
        ),
      });

    this.lastSelection =
      saved.lastSelection ||
      null;

    this.initialized =
      true;

    if (
      this.settings
        .enabled
    ) {
      this.start();
    }

    return this.getState();
  }

  getState() {
    return {
      settings: {
        ...this.settings,
      },

      running:
        this.running,

      lastScan:
        this.lastScan,

      lastSelection:
        this.lastSelection,
    };
  }

  async persistState() {
    await saveLocalSettings(
      LOCAL_SETTINGS_KEY,
      {
        settings: {
          ...this.settings,
        },

        lastSelection:
          this.lastSelection,
      },
    );
  }

  async updateSettings(
    nextSettings = {},
  ) {
    this.settings =
      cleanSettings({
        ...this.settings,
        ...nextSettings,
      });

    await this
      .persistState();

    if (
      this.settings
        .enabled
    ) {
      this.start();
    } else {
      this.stop();
    }

    return this.getState();
  }

  start() {
    this.stop();

    this.running =
      true;

    /*
     * Run immediately when enabled.
     */
    this.runOnce()
      .catch(
        (error) => {
          console.error(
            "Automatic market selection failed:",
            error,
          );
        },
      );

    const intervalMilliseconds =
      this.settings
        .scanIntervalMinutes *
      60 *
      1000;

    this.timer =
      setInterval(
        () => {
          this.runOnce()
            .catch(
              (
                error,
              ) => {
                console.error(
                  "Automatic market selection failed:",
                  error,
                );
              },
            );
        },

        intervalMilliseconds,
      );
  }

  stop() {
    this.running =
      false;

    if (
      this.timer
    ) {
      clearInterval(
        this.timer,
      );

      this.timer =
        null;
    }
  }

  async runOnce() {
    const scan =
      await scanMarkets({
        symbols:
          this.settings
            .symbols,

        timeframe:
          this.settings
            .timeframe,

        limit:
          300,
      });

    this.lastScan =
      scan;

    /*
     * Only actual Strategy 2.0 BUY signals
     * are allowed to rotate the server.
     *
     * minimumScore and minimumConfidence
     * then act as additional quality gates.
     */
    const qualified =
      scan.opportunities.filter(
        (
          opportunity,
        ) =>
          opportunity.action ===
            "BUY" &&

          opportunity.score >=
            this.settings
              .minimumScore &&

          opportunity.confidence >=
            this.settings
              .minimumConfidence,
      );

    /*
     * scanMarkets already sorts by
     * rankScore descending, so the first
     * qualified BUY is the best candidate.
     */
    const best =
      qualified[0] ||
      null;

    this.lastSelection =
      best
        ? {
            symbol:
              best.symbol,

            timeframe:
              best.timeframe,

            score:
              best.score,

            confidence:
              best.confidence,

            label:
              best.label,

            regime:
              best.regime,

            rankScore:
              best.rankScore,

            selectedAt:
              Date.now(),
          }
        : {
            symbol:
              null,

            timeframe:
              this.settings
                .timeframe,

            score:
              null,

            confidence:
              null,

            label:
              "No qualified BUY setup",

            regime:
              null,

            rankScore:
              null,

            selectedAt:
              Date.now(),
          };

    await this
      .persistState();

    if (
      best &&
      typeof this
        .onSelection ===
        "function"
    ) {
      await this
        .onSelection(
          this.lastSelection,
        );
    }

    return {
      state:
        this.getState(),

      scan,
    };
  }
}