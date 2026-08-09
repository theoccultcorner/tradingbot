import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  serverUrl,
} from "../config/server.js";

const DEFAULT_STARTING_CASH =
  300;

const DEFAULT_FEE_RATE =
  0.001;

const DEFAULT_REFRESH_MS =
  3000;

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

function positiveNumberOrNull(
  value,
) {
  const number =
    Number(
      value,
    );

  return Number.isFinite(
    number,
  ) &&
    number >
      0
    ? number
    : null;
}

function normalizePosition(
  value = {},
) {
  return {
    ...value,

    quantity:
      numberOrZero(
        value.quantity,
      ),

    averageEntryPrice:
      numberOrZero(
        value.averageEntryPrice,
      ),

    totalCost:
      numberOrZero(
        value.totalCost,
      ),
  };
}

function normalizePortfolio(
  value = {},
) {
  const positions =
    {};

  for (
    const [
      symbol,
      position,
    ] of Object.entries(
      value.positions ||
        {},
    )
  ) {
    const normalized =
      normalizePosition(
        position,
      );

    if (
      normalized.quantity >
      0.00000001
    ) {
      positions[
        String(
          symbol,
        )
          .trim()
          .toUpperCase()
      ] =
        normalized;
    }
  }

  const startingCash =
    positiveNumberOrNull(
      value.startingCash,
    ) ||
    DEFAULT_STARTING_CASH;

  return {
    ...value,

    startingCash,

    cash:
      numberOrZero(
        value.cash,
      ),

    positions,

    realizedProfit:
      numberOrZero(
        value.realizedProfit,
      ),

    feeRate:
      positiveNumberOrNull(
        value.feeRate,
      ) ||
      DEFAULT_FEE_RATE,

    trades:
      Array.isArray(
        value.trades,
      )
        ? value.trades
        : [],
  };
}

async function readJson(
  response,
) {
  const text =
    await response.text();

  if (
    !text
  ) {
    return {};
  }

  try {
    return JSON.parse(
      text,
    );
  } catch {
    throw new Error(
      "The server returned invalid JSON.",
    );
  }
}

async function apiRequest(
  path,
  options = {},
) {
  const url =
    serverUrl(
      path,
    );

  const response =
    await fetch(
      url,
      {
        ...options,

        headers: {
          "Content-Type":
            "application/json",

          ...(
            options.headers ||
            {}
          ),
        },
      },
    );

  const data =
    await readJson(
      response,
    );

  if (
    !response.ok
  ) {
    throw new Error(
      data?.message ||
        `Request failed with status ${response.status}.`,
    );
  }

  return data;
}

function getPositionQuote({
  symbol,
  position,
  prices,
}) {
  const livePrice =
    positiveNumberOrNull(
      prices?.[
        symbol
      ],
    );

  if (
    livePrice !==
    null
  ) {
    return {
      price:
        livePrice,

      source:
        "live",
    };
  }

  const entryPrice =
    positiveNumberOrNull(
      position
        ?.averageEntryPrice,
    );

  if (
    entryPrice !==
    null
  ) {
    return {
      price:
        entryPrice,

      source:
        "entry",
    };
  }

  return {
    price:
      0,

    source:
      "missing",
  };
}

function usePaperPortfolio({
  prices = {},
  feeRate =
    DEFAULT_FEE_RATE,
  refreshMs =
    DEFAULT_REFRESH_MS,
} = {}) {
  const [
    rawPortfolio,
    setRawPortfolio,
  ] =
    useState(
      () =>
        normalizePortfolio(
          {},
        ),
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    error,
    setError,
  ] =
    useState(
      "",
    );

  const [
    updatedAt,
    setUpdatedAt,
  ] =
    useState(
      null,
    );

  const mountedRef =
    useRef(
      true,
    );

  const stateVersionRef =
    useRef(
      0,
    );

  const applyPortfolio =
    useCallback(
      (
        portfolio,
      ) => {
        const normalized =
          normalizePortfolio(
            portfolio,
          );

        stateVersionRef.current +=
          1;

        if (
          mountedRef.current
        ) {
          setRawPortfolio(
            normalized,
          );

          setUpdatedAt(
            Date.now(),
          );

          setError(
            "",
          );
        }

        return normalized;
      },
      [],
    );

  const loadPortfolio =
    useCallback(
      async ({
        silent =
          false,
      } = {}) => {
        if (
          !silent &&
          mountedRef.current
        ) {
          setLoading(
            true,
          );
        }

        const versionAtStart =
          stateVersionRef.current;

        try {
          const result =
            await apiRequest(
              "/api/portfolio",
            );

          if (
            !mountedRef
              .current
          ) {
            return null;
          }

          if (
            stateVersionRef
              .current !==
            versionAtStart
          ) {
            return null;
          }

          const incoming =
            result.portfolio ||
            result.data ||
            result;

          const normalized =
            normalizePortfolio(
              incoming,
            );

          setRawPortfolio(
            normalized,
          );

          setUpdatedAt(
            Date.now(),
          );

          setError(
            "",
          );

          return normalized;
        } catch (
          loadError
        ) {
          if (
            mountedRef
              .current
          ) {
            setError(
              loadError.message ||
                "Could not load the paper portfolio.",
            );
          }

          return null;
        } finally {
          if (
            mountedRef
              .current &&
            !silent
          ) {
            setLoading(
              false,
            );
          }
        }
      },
      [],
    );

  useEffect(
    () => {
      mountedRef.current =
        true;

      loadPortfolio();

      const interval =
        window.setInterval(
          () => {
            loadPortfolio({
              silent:
                true,
            });
          },
          Math.max(
            Number(
              refreshMs,
            ) ||
              DEFAULT_REFRESH_MS,
            1000,
          ),
        );

      return () => {
        mountedRef.current =
          false;

        window.clearInterval(
          interval,
        );
      };
    },
    [
      loadPortfolio,
      refreshMs,
    ],
  );

  const valuation =
    useMemo(
      () => {
        let marketValue =
          0;

        let costBasis =
          0;

        let unrealizedProfit =
          0;

        let liveValuedPositions =
          0;

        let fallbackValuedPositions =
          0;

        let missingValuedPositions =
          0;

        const valuedPositions =
          {};

        for (
          const [
            symbol,
            position,
          ] of Object.entries(
            rawPortfolio
              .positions ||
              {},
          )
        ) {
          const quantity =
            numberOrZero(
              position
                .quantity,
            );

          if (
            quantity <=
            0
          ) {
            continue;
          }

          const averageEntryPrice =
            numberOrZero(
              position
                .averageEntryPrice,
            );

          const quote =
            getPositionQuote({
              symbol,
              position,
              prices,
            });

          if (
            quote.source ===
            "live"
          ) {
            liveValuedPositions +=
              1;
          } else if (
            quote.source ===
            "entry"
          ) {
            fallbackValuedPositions +=
              1;
          } else {
            missingValuedPositions +=
              1;
          }

          const positionValue =
            quantity *
            quote.price;

          const positionCostBasis =
            quantity *
            averageEntryPrice;

          const positionProfit =
            positionValue -
            positionCostBasis;

          marketValue +=
            positionValue;

          costBasis +=
            positionCostBasis;

          unrealizedProfit +=
            positionProfit;

          valuedPositions[
            symbol
          ] = {
            ...position,

            symbol,

            quantity,

            averageEntryPrice,

            currentPrice:
              quote.price,

            priceSource:
              quote.source,

            marketValue:
              positionValue,

            costBasis:
              positionCostBasis,

            unrealizedProfit:
              positionProfit,

            unrealizedReturnPercent:
              positionCostBasis >
              0
                ? (
                    positionProfit /
                    positionCostBasis
                  ) *
                  100
                : 0,
          };
        }

        const cash =
          numberOrZero(
            rawPortfolio.cash,
          );

        const startingCash =
          positiveNumberOrNull(
            rawPortfolio
              .startingCash,
          ) ||
          DEFAULT_STARTING_CASH;

        const totalEquity =
          cash +
          marketValue;

        const totalProfit =
          totalEquity -
          startingCash;

        const totalReturnPercent =
          startingCash >
          0
            ? (
                totalProfit /
                startingCash
              ) *
              100
            : 0;

        return {
          cash,

          startingCash,

          marketValue,

          costBasis,

          unrealizedProfit,

          totalEquity,

          totalProfit,

          totalReturnPercent,

          positions:
            valuedPositions,

          liveValuedPositions,

          fallbackValuedPositions,

          missingValuedPositions,

          valuationComplete:
            missingValuedPositions ===
            0,
        };
      },
      [
        rawPortfolio,
        prices,
      ],
    );

  const placePaperOrder =
    useCallback(
      async ({
        symbol,
        side,
        quantity,
        price,
      }) => {
        try {
          const normalizedSymbol =
            String(
              symbol ||
                "",
            )
              .trim()
              .toUpperCase();

          const normalizedSide =
            String(
              side ||
                "",
            )
              .trim()
              .toUpperCase();

          const numericQuantity =
            Number(
              quantity,
            );

          const numericPrice =
            Number(
              price,
            );

          if (
            !normalizedSymbol
          ) {
            throw new Error(
              "A symbol is required.",
            );
          }

          if (
            ![
              "BUY",
              "SELL",
            ].includes(
              normalizedSide,
            )
          ) {
            throw new Error(
              "Order side must be BUY or SELL.",
            );
          }

          if (
            !Number.isFinite(
              numericQuantity,
            ) ||
            numericQuantity <=
              0
          ) {
            throw new Error(
              "Quantity must be greater than zero.",
            );
          }

          if (
            !Number.isFinite(
              numericPrice,
            ) ||
            numericPrice <=
              0
          ) {
            throw new Error(
              "Price must be greater than zero.",
            );
          }

          const result =
            await apiRequest(
              "/api/portfolio/order",
              {
                method:
                  "POST",

                body:
                  JSON.stringify({
                    symbol:
                      normalizedSymbol,

                    side:
                      normalizedSide,

                    quantity:
                      numericQuantity,

                    price:
                      numericPrice,
                  }),
              },
            );

          if (
            result.success ===
            false
          ) {
            throw new Error(
              result.message ||
                "The paper order failed.",
            );
          }

          if (
            result.portfolio
          ) {
            applyPortfolio(
              result.portfolio,
            );
          } else {
            await loadPortfolio({
              silent:
                true,
            });
          }

          return {
            ...result,

            success:
              true,
          };
        } catch (
          orderError
        ) {
          return {
            success:
              false,

            message:
              orderError.message ||
              "The paper order failed.",
          };
        }
      },
      [
        applyPortfolio,
        loadPortfolio,
      ],
    );

  const resetPortfolio =
    useCallback(
      async (
        startingCash =
          DEFAULT_STARTING_CASH,
      ) => {
        try {
          const numericStartingCash =
            Number(
              startingCash,
            );

          if (
            !Number.isFinite(
              numericStartingCash,
            ) ||
            numericStartingCash <=
              0
          ) {
            throw new Error(
              "Starting cash must be greater than zero.",
            );
          }

          const result =
            await apiRequest(
              "/api/portfolio/reset",
              {
                method:
                  "POST",

                body:
                  JSON.stringify({
                    startingCash:
                      numericStartingCash,
                  }),
              },
            );

          if (
            result.success ===
            false
          ) {
            throw new Error(
              result.message ||
                "Could not reset the paper portfolio.",
            );
          }

          if (
            result.portfolio
          ) {
            applyPortfolio(
              result.portfolio,
            );
          } else {
            await loadPortfolio();
          }

          return {
            ...result,

            success:
              true,
          };
        } catch (
          resetError
        ) {
          return {
            success:
              false,

            message:
              resetError.message ||
              "Could not reset the paper portfolio.",
          };
        }
      },
      [
        applyPortfolio,
        loadPortfolio,
      ],
    );

  return {
    ...rawPortfolio,

    ...valuation,

    feeRate:
      positiveNumberOrNull(
        rawPortfolio
          .feeRate,
      ) ||
      positiveNumberOrNull(
        feeRate,
      ) ||
      DEFAULT_FEE_RATE,

    loading,

    error,

    updatedAt,

    refresh:
      loadPortfolio,

    placePaperOrder,

    resetPortfolio,
  };
}

export default usePaperPortfolio;