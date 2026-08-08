import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import useFirestoreSettings from "./useFirestoreSettings";

const DEFAULT_SETTINGS = {
  enabled: true,
  stopLossPercent: 2,
  takeProfitPercent: 4,
  trailingStopEnabled: true,
  trailingStopPercent: 1.5,
  dailyLossLimit: 100,
  maximumTradesPerDay: 10,
  emergencyStop: false,
};

function isToday(timestamp) {
  const date =
    new Date(timestamp);

  const now =
    new Date();

  return (
    date.getFullYear() ===
      now.getFullYear() &&
    date.getMonth() ===
      now.getMonth() &&
    date.getDate() ===
      now.getDate()
  );
}

function createEvent({
  type,
  symbol,
  price,
  message,
  executed = false,
}) {
  return {
    id: crypto.randomUUID(),
    type,
    symbol,
    price,
    message,
    executed,
    timestamp: Date.now(),
  };
}

export default function useRiskManager({
  symbol,
  price,
  portfolio,
}) {
  const {
    settings,
    setSettings,
    loading:
      settingsLoading,
    error:
      settingsError,
  } = useFirestoreSettings({
    type: "riskManager",
    defaults:
      DEFAULT_SETTINGS,
    forceDisabledFields: {
      emergencyStop: false,
    },
  });

  const [
    events,
    setEvents,
  ] = useState([]);

  const [
    status,
    setStatus,
  ] = useState("Monitoring");

  const highWaterMarksRef =
    useRef({});

  const exitLockRef =
    useRef(false);

  const todaysTrades =
    useMemo(
      () =>
        (
          portfolio.trades ||
          []
        ).filter(
          (trade) =>
            isToday(
              trade.timestamp,
            ),
        ),
      [portfolio.trades],
    );

  const tradesToday =
    todaysTrades.length;

  const realizedProfitToday =
    useMemo(
      () =>
        todaysTrades.reduce(
          (
            total,
            trade,
          ) =>
            total +
            Number(
              trade.realizedProfit ||
                0,
            ),
          0,
        ),
      [todaysTrades],
    );

  const dailyLossReached =
    realizedProfitToday <=
    -Math.abs(
      Number(
        settings.dailyLossLimit,
      ),
    );

  const tradeLimitReached =
    tradesToday >=
    Number(
      settings.maximumTradesPerDay,
    );

  const canOpenTrade =
    settings.enabled &&
    !settings.emergencyStop &&
    !dailyLossReached &&
    !tradeLimitReached &&
    !settingsLoading &&
    !settingsError &&
    !portfolio.loading &&
    !portfolio.error;

  useEffect(() => {
    if (settingsLoading) {
      setStatus(
        "Loading Firestore settings",
      );
      return;
    }

    if (settingsError) {
      setStatus(
        "Settings unavailable",
      );
      return;
    }

    if (portfolio.loading) {
      setStatus(
        "Loading Firestore portfolio",
      );
      return;
    }

    if (portfolio.error) {
      setStatus(
        "Portfolio unavailable",
      );
      return;
    }

    if (
      settings.emergencyStop
    ) {
      setStatus(
        "Emergency stop active",
      );
      return;
    }

    if (!settings.enabled) {
      setStatus("Disabled");
      return;
    }

    if (dailyLossReached) {
      setStatus(
        "Daily loss limit reached",
      );
      return;
    }

    if (tradeLimitReached) {
      setStatus(
        "Daily trade limit reached",
      );
      return;
    }

    setStatus("Monitoring");
  }, [
    dailyLossReached,
    portfolio.error,
    portfolio.loading,
    settings.emergencyStop,
    settings.enabled,
    settingsError,
    settingsLoading,
    tradeLimitReached,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function evaluateRiskExit() {
      if (
        settingsLoading ||
        settingsError ||
        !settings.enabled ||
        settings.emergencyStop ||
        exitLockRef.current ||
        portfolio.loading ||
        portfolio.error
      ) {
        return;
      }

      const currentPrice =
        Number(price);

      if (
        !Number.isFinite(
          currentPrice,
        ) ||
        currentPrice <= 0
      ) {
        return;
      }

      const position =
        portfolio.positions.find(
          (item) =>
            item.symbol ===
            symbol,
        );

      if (
        !position ||
        position.quantity <= 0
      ) {
        delete highWaterMarksRef
          .current[symbol];

        return;
      }

      const entryPrice =
        Number(
          position.averageEntryPrice,
        );

      if (
        !Number.isFinite(
          entryPrice,
        ) ||
        entryPrice <= 0
      ) {
        return;
      }

      const previousHigh =
        highWaterMarksRef
          .current[symbol] ||
        entryPrice;

      const highWaterMark =
        Math.max(
          previousHigh,
          currentPrice,
        );

      highWaterMarksRef.current[
        symbol
      ] = highWaterMark;

      const returnPercent =
        (
          (
            currentPrice -
            entryPrice
          ) /
          entryPrice
        ) * 100;

      const trailingDropPercent =
        (
          (
            highWaterMark -
            currentPrice
          ) /
          highWaterMark
        ) * 100;

      let exitType = null;
      let exitMessage = "";

      if (
        returnPercent <=
        -Math.abs(
          Number(
            settings.stopLossPercent,
          ),
        )
      ) {
        exitType =
          "STOP_LOSS";

        exitMessage =
          `Stop-loss triggered at ${returnPercent.toFixed(
            2,
          )}%.`;
      } else if (
        returnPercent >=
        Math.abs(
          Number(
            settings.takeProfitPercent,
          ),
        )
      ) {
        exitType =
          "TAKE_PROFIT";

        exitMessage =
          `Take-profit triggered at ${returnPercent.toFixed(
            2,
          )}%.`;
      } else if (
        settings.trailingStopEnabled &&
        highWaterMark >
          entryPrice &&
        trailingDropPercent >=
          Math.abs(
            Number(
              settings.trailingStopPercent,
            ),
          )
      ) {
        exitType =
          "TRAILING_STOP";

        exitMessage =
          "Trailing stop triggered after a " +
          `${trailingDropPercent.toFixed(
            2,
          )}% decline from the position high.`;
      }

      if (!exitType) {
        return;
      }

      exitLockRef.current =
        true;

      try {
        const result =
          await portfolio.placePaperOrder(
            {
              symbol,
              side: "SELL",
              quantity:
                position.quantity,
              price:
                currentPrice,
            },
          );

        if (cancelled) {
          return;
        }

        const event =
          createEvent({
            type: exitType,
            symbol,
            price:
              currentPrice,
            message:
              `${exitMessage} ` +
              `${
                result.message ||
                ""
              }`,
            executed:
              Boolean(
                result.success,
              ),
          });

        setEvents(
          (previous) =>
            [
              event,
              ...previous,
            ].slice(
              0,
              100,
            ),
        );

        if (result.success) {
          delete highWaterMarksRef
            .current[symbol];

          setStatus(
            `${exitType} executed`,
          );
        } else {
          setStatus(
            "Risk exit failed",
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Risk exit failed:",
            error,
          );

          setStatus(
            "Risk exit failed",
          );

          setEvents(
            (previous) =>
              [
                createEvent({
                  type:
                    exitType,
                  symbol,
                  price:
                    currentPrice,
                  message:
                    `${exitMessage} ${error.message}`,
                  executed:
                    false,
                }),
                ...previous,
              ].slice(
                0,
                100,
              ),
          );
        }
      } finally {
        window.setTimeout(
          () => {
            exitLockRef.current =
              false;
          },
          1000,
        );
      }
    }

    evaluateRiskExit();

    return () => {
      cancelled = true;
    };
  }, [
    portfolio.error,
    portfolio.loading,
    portfolio.placePaperOrder,
    portfolio.positions,
    price,
    settings.emergencyStop,
    settings.enabled,
    settings.stopLossPercent,
    settings.takeProfitPercent,
    settings.trailingStopEnabled,
    settings.trailingStopPercent,
    settingsError,
    settingsLoading,
    symbol,
  ]);

  function updateSetting(
    name,
    value,
  ) {
    setSettings(
      (previous) => ({
        ...previous,
        [name]: value,
      }),
    );
  }

  function toggleEnabled() {
    setSettings(
      (previous) => ({
        ...previous,
        enabled:
          !previous.enabled,
      }),
    );
  }

  function toggleEmergencyStop() {
    setSettings(
      (previous) => ({
        ...previous,
        emergencyStop:
          !previous.emergencyStop,
      }),
    );
  }

  function clearEvents() {
    setEvents([]);
  }

  return {
    settings,
    status,
    events,
    tradesToday,
    realizedProfitToday,
    dailyLossReached,
    tradeLimitReached,
    canOpenTrade,

    settingsLoading,
    settingsError,

    updateSetting,
    toggleEnabled,
    toggleEmergencyStop,
    clearEvents,
  };
}
