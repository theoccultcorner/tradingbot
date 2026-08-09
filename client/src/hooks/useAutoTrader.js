import {
  useEffect,
  useRef,
  useState,
} from "react";

import useServerSettings from "./useServerSettings";

const DEFAULT_SETTINGS = {
  enabled: false,
  minimumConfidence: 40,
  buyAmount: 100,
  maximumPositionValue: 500,
  cooldownMinutes: 5,
};

function findLatestClosedCandle(
  candles = [],
) {
  for (
    let index =
      candles.length - 1;
    index >= 0;
    index -= 1
  ) {
    if (
      candles[index]
        ?.closed
    ) {
      return candles[
        index
      ];
    }
  }

  return null;
}

function createDecision({
  symbol,
  candle,
  signal,
  price,
}) {
  return {
    id:
      crypto.randomUUID(),

    symbol,

    candleTime:
      candle.time,

    action:
      signal?.action ||
      "WAIT",

    label:
      signal?.label ||
      "Unavailable",

    confidence:
      Number(
        signal
          ?.confidence,
      ) ||
      0,

    score:
      Number(
        signal
          ?.totalScore,
      ) ||
      0,

    price:
      Number(
        price,
      ),

    timestamp:
      Date.now(),

    executed:
      false,

    quantity:
      0,

    message:
      "",
  };
}

function getPortfolioPosition(
  portfolio,
  symbol,
) {
  /*
   * Support both portfolio formats:
   *
   * Older client:
   * positions = [...]
   *
   * New server-backed portfolio:
   * positions = {
   *   BTCUSD: {...},
   *   ETHUSD: {...}
   * }
   */

  if (
    Array.isArray(
      portfolio
        ?.positions,
    )
  ) {
    return (
      portfolio.positions.find(
        (
          position,
        ) =>
          position?.symbol ===
          symbol,
      ) ||
      null
    );
  }

  if (
    portfolio
      ?.positions &&
    typeof portfolio
      .positions ===
      "object"
  ) {
    return (
      portfolio.positions[
        symbol
      ] ||
      null
    );
  }

  return null;
}

export default function useAutoTrader({
  symbol,
  price,
  candles = [],
  signal,
  portfolio,
  riskManager,
}) {
  const {
    settings,
    setSettings,

    loading:
      settingsLoading,

    error:
      settingsError,
  } =
    useServerSettings({
      type:
        "autoTrader",

      defaults:
        DEFAULT_SETTINGS,

      /*
       * Keep client-side auto trader
       * disabled.
       *
       * The server trading engine is
       * authoritative.
       */
      forceDisabledFields: {
        enabled:
          false,
      },
    });

  const [
    status,
    setStatus,
  ] =
    useState(
      "Disabled",
    );

  const [
    lastDecision,
    setLastDecision,
  ] =
    useState(
      null,
    );

  const [
    activity,
    setActivity,
  ] =
    useState(
      [],
    );

  const initializedRef =
    useRef(
      false,
    );

  const lastProcessedCandleRef =
    useRef(
      null,
    );

  const lastTradeTimeRef =
    useRef(
      0,
    );

  const evaluatingRef =
    useRef(
      false,
    );

  useEffect(
    () => {
      initializedRef.current =
        false;

      lastProcessedCandleRef.current =
        null;

      lastTradeTimeRef.current =
        0;

      evaluatingRef.current =
        false;

      setLastDecision(
        null,
      );

      setStatus(
        settings.enabled
          ? "Monitoring"
          : "Disabled",
      );
    },
    [
      symbol,
      settings.enabled,
    ],
  );

  useEffect(
    () => {
      let cancelled =
        false;

      function recordDecision(
        decision,
      ) {
        if (
          cancelled
        ) {
          return;
        }

        setLastDecision(
          decision,
        );

        setActivity(
          (
            previous,
          ) =>
            [
              decision,
              ...previous,
            ].slice(
              0,
              100,
            ),
        );

        setStatus(
          decision.executed
            ? `${decision.action} executed`
            : "Monitoring",
        );
      }

      async function evaluate() {
        if (
          evaluatingRef
            .current
        ) {
          return;
        }

        if (
          settingsLoading
        ) {
          setStatus(
            "Loading server settings",
          );

          return;
        }

        if (
          settingsError
        ) {
          setStatus(
            "Settings unavailable",
          );

          return;
        }

        if (
          !settings.enabled
        ) {
          setStatus(
            "Disabled",
          );

          return;
        }

        if (
          portfolio.loading
        ) {
          setStatus(
            "Loading server portfolio",
          );

          return;
        }

        if (
          portfolio.error
        ) {
          setStatus(
            "Portfolio unavailable",
          );

          return;
        }

        if (
          riskManager
            .settings
            ?.emergencyStop
        ) {
          setStatus(
            "Emergency stop active",
          );

          return;
        }

        const closedCandle =
          findLatestClosedCandle(
            candles,
          );

        if (
          !closedCandle
        ) {
          setStatus(
            "Waiting for a closed candle",
          );

          return;
        }

        if (
          !initializedRef
            .current
        ) {
          initializedRef.current =
            true;

          lastProcessedCandleRef.current =
            closedCandle.time;

          setStatus(
            "Monitoring new candle closes",
          );

          return;
        }

        if (
          lastProcessedCandleRef
            .current ===
          closedCandle.time
        ) {
          return;
        }

        lastProcessedCandleRef.current =
          closedCandle.time;

        const decision =
          createDecision({
            symbol,

            candle:
              closedCandle,

            signal,

            price,
          });

        const currentPrice =
          Number(
            price,
          );

        if (
          !Number.isFinite(
            currentPrice,
          ) ||
          currentPrice <=
            0
        ) {
          decision.message =
            "Skipped because no valid price was available.";

          recordDecision(
            decision,
          );

          return;
        }

        if (
          !signal ||
          signal.action ===
            "WAIT"
        ) {
          decision.message =
            `No trade: ${
              signal
                ?.label ||
              "neutral signal"
            }.`;

          recordDecision(
            decision,
          );

          return;
        }

        const minimumConfidence =
          Number(
            settings
              .minimumConfidence,
          );

        if (
          Number(
            signal
              .confidence,
          ) <
          minimumConfidence
        ) {
          decision.message =
            `Skipped: ${signal.confidence}% confidence is ` +
            `below the ${minimumConfidence}% requirement.`;

          recordDecision(
            decision,
          );

          return;
        }

        const cooldownMinutes =
          Math.max(
            Number(
              settings
                .cooldownMinutes,
            ) ||
              0,
            0,
          );

        const cooldownMilliseconds =
          cooldownMinutes *
          60 *
          1000;

        const timeSinceLastTrade =
          Date.now() -
          lastTradeTimeRef
            .current;

        if (
          lastTradeTimeRef
            .current >
            0 &&
          timeSinceLastTrade <
            cooldownMilliseconds
        ) {
          const remainingMinutes =
            Math.ceil(
              (
                cooldownMilliseconds -
                timeSinceLastTrade
              ) /
                60000,
            );

          decision.message =
            "Skipped: cooldown active for approximately " +
            `${remainingMinutes} more minute(s).`;

          recordDecision(
            decision,
          );

          return;
        }

        const currentPosition =
          getPortfolioPosition(
            portfolio,
            symbol,
          );

        evaluatingRef.current =
          true;

        try {
          if (
            signal.action ===
            "BUY"
          ) {
            if (
              !riskManager
                .canOpenTrade
            ) {
              decision.message =
                "Skipped: risk manager blocked new entries. " +
                `${riskManager.status}.`;

              recordDecision(
                decision,
              );

              return;
            }

            const currentPositionValue =
              Number(
                currentPosition
                  ?.marketValue,
              ) ||
              0;

            const maximumPositionValue =
              Math.max(
                Number(
                  settings
                    .maximumPositionValue,
                ) ||
                  0,
                0,
              );

            if (
              currentPositionValue >=
              maximumPositionValue
            ) {
              decision.message =
                "Skipped: position is already at or above " +
                `$${maximumPositionValue.toFixed(
                  2,
                )}.`;

              recordDecision(
                decision,
              );

              return;
            }

            const remainingPositionAllowance =
              maximumPositionValue -
              currentPositionValue;

            const buyAmount =
              Math.max(
                Number(
                  settings
                    .buyAmount,
                ) ||
                  0,
                0,
              );

            const feeRate =
              Number(
                portfolio
                  .feeRate,
              ) ||
              0;

            const cash =
              Number(
                portfolio
                  .cash,
              ) ||
              0;

            const availableCashBeforeFee =
              cash /
              (
                1 +
                feeRate
              );

            const availablePurchaseAmount =
              Math.min(
                buyAmount,
                remainingPositionAllowance,
                availableCashBeforeFee,
              );

            if (
              !Number.isFinite(
                availablePurchaseAmount,
              ) ||
              availablePurchaseAmount <
                1
            ) {
              decision.message =
                "Skipped: insufficient paper cash or position allowance.";

              recordDecision(
                decision,
              );

              return;
            }

            const quantity =
              availablePurchaseAmount /
              currentPrice;

            const result =
              await portfolio
                .placePaperOrder({
                  symbol,

                  side:
                    "BUY",

                  quantity,

                  price:
                    currentPrice,
                });

            decision.executed =
              Boolean(
                result
                  .success,
              );

            decision.quantity =
              quantity;

            decision.message =
              result.message ||
              (
                result.success
                  ? "BUY completed."
                  : "BUY failed."
              );

            if (
              result.success
            ) {
              lastTradeTimeRef.current =
                decision.timestamp;
            }

            recordDecision(
              decision,
            );

            return;
          }

          if (
            signal.action ===
            "SELL"
          ) {
            if (
              !currentPosition ||
              Number(
                currentPosition
                  .quantity,
              ) <=
                0
            ) {
              decision.message =
                "Skipped: there is no open position to sell.";

              recordDecision(
                decision,
              );

              return;
            }

            const quantity =
              Number(
                currentPosition
                  .quantity,
              );

            const result =
              await portfolio
                .placePaperOrder({
                  symbol,

                  side:
                    "SELL",

                  quantity,

                  price:
                    currentPrice,
                });

            decision.executed =
              Boolean(
                result
                  .success,
              );

            decision.quantity =
              quantity;

            decision.message =
              result.message ||
              (
                result.success
                  ? "SELL completed."
                  : "SELL failed."
              );

            if (
              result.success
            ) {
              lastTradeTimeRef.current =
                decision.timestamp;
            }

            recordDecision(
              decision,
            );

            return;
          }

          decision.message =
            `Skipped: unsupported action ${signal.action}.`;

          recordDecision(
            decision,
          );
        } finally {
          evaluatingRef.current =
            false;
        }
      }

      evaluate().catch(
        (
          error,
        ) => {
          evaluatingRef.current =
            false;

          console.error(
            "Auto trader evaluation failed:",
            error,
          );

          if (
            !cancelled
          ) {
            setStatus(
              "Auto trader error",
            );
          }
        },
      );

      return () => {
        cancelled =
          true;
      };
    },
    [
      candles,

      portfolio.cash,

      portfolio.error,

      portfolio.feeRate,

      portfolio.loading,

      portfolio.placePaperOrder,

      portfolio.positions,

      price,

      riskManager.canOpenTrade,

      riskManager.settings
        ?.emergencyStop,

      riskManager.status,

      settings.buyAmount,

      settings.cooldownMinutes,

      settings.enabled,

      settings.maximumPositionValue,

      settings.minimumConfidence,

      settingsError,

      settingsLoading,

      signal,

      symbol,
    ],
  );

  function updateSetting(
    name,
    value,
  ) {
    setSettings(
      (
        previous,
      ) => ({
        ...previous,

        [name]:
          value,
      }),
    );
  }

  function toggleEnabled() {
    setSettings(
      (
        previous,
      ) => ({
        ...previous,

        enabled:
          !previous.enabled,
      }),
    );

    initializedRef.current =
      false;

    lastProcessedCandleRef.current =
      null;

    evaluatingRef.current =
      false;
  }

  function disableAutoTrader() {
    setSettings(
      (
        previous,
      ) => ({
        ...previous,

        enabled:
          false,
      }),
    );

    setStatus(
      "Disabled",
    );

    initializedRef.current =
      false;

    lastProcessedCandleRef.current =
      null;

    evaluatingRef.current =
      false;
  }

  function clearActivity() {
    setActivity(
      [],
    );

    setLastDecision(
      null,
    );
  }

  return {
    settings,

    status,

    lastDecision,

    activity,

    settingsLoading,

    settingsError,

    updateSetting,

    toggleEnabled,

    disableAutoTrader,

    clearActivity,
  };
}