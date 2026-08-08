import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const DEFAULT_SYMBOLS = [
  "BTCUSD",
  "ETHUSD",
  "SOLUSD",
  "DOGEUSD",
  "ADAUSD",
  "LINKUSD",
  "AVAXUSD",
  "XRPUSD",
];

const BINANCE_BASE_URL =
  "https://api.binance.us";

const DEFAULT_REFRESH_MS =
  5000;

function normalizeSymbols(
  symbols,
) {
  const values =
    Array.isArray(
      symbols,
    )
      ? symbols
      : DEFAULT_SYMBOLS;

  return [
    ...new Set(
      values
        .map(
          (
            value,
          ) =>
            String(
              value || "",
            )
              .trim()
              .toUpperCase(),
        )
        .filter(
          Boolean,
        ),
    ),
  ];
}

function validPrice(
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

async function fetchSinglePrice(
  symbol,
  signal,
) {
  const query =
    new URLSearchParams({
      symbol,
    });

  const response =
    await fetch(
      `${BINANCE_BASE_URL}/api/v3/ticker/price?${query}`,
      {
        signal,
      },
    );

  const data =
    await response.json();

  if (
    !response.ok
  ) {
    throw new Error(
      data?.msg ||
        `Could not load ${symbol} price.`,
    );
  }

  const price =
    validPrice(
      data?.price,
    );

  if (
    price ===
    null
  ) {
    throw new Error(
      `Invalid ${symbol} price received.`,
    );
  }

  return {
    symbol,
    price,
  };
}

function useMarketPrices({
  symbols =
    DEFAULT_SYMBOLS,

  refreshMs =
    DEFAULT_REFRESH_MS,
} = {}) {
  const normalizedSymbols =
    normalizeSymbols(
      symbols,
    );

  const symbolsKey =
    normalizedSymbols
      .join(",");

  const [
    prices,
    setPrices,
  ] =
    useState(
      {},
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

  const controllerRef =
    useRef(
      null,
    );

  const loadPrices =
    useCallback(
      async () => {
        controllerRef
          .current
          ?.abort();

        const controller =
          new AbortController();

        controllerRef.current =
          controller;

        try {
          const results =
            await Promise.allSettled(
              normalizedSymbols.map(
                (
                  symbol,
                ) =>
                  fetchSinglePrice(
                    symbol,
                    controller.signal,
                  ),
              ),
            );

          if (
            !mountedRef
              .current
          ) {
            return;
          }

          const nextPrices =
            {};

          const failures =
            [];

          for (
            let index =
              0;
            index <
            results.length;
            index +=
            1
          ) {
            const result =
              results[
                index
              ];

            const symbol =
              normalizedSymbols[
                index
              ];

            if (
              result.status ===
              "fulfilled"
            ) {
              nextPrices[
                result.value
                  .symbol
              ] =
                result.value
                  .price;
            } else if (
              result.reason
                ?.name !==
              "AbortError"
            ) {
              failures.push(
                symbol,
              );
            }
          }

          setPrices(
            (
              previous,
            ) => ({
              /*
               * Keep the last known valid
               * price for a symbol if one
               * individual request fails.
               */
              ...previous,
              ...nextPrices,
            }),
          );

          if (
            Object.keys(
              nextPrices,
            ).length >
            0
          ) {
            setUpdatedAt(
              Date.now(),
            );
          }

          if (
            failures.length ===
            normalizedSymbols.length
          ) {
            setError(
              "Could not load live portfolio prices.",
            );
          } else if (
            failures.length >
            0
          ) {
            setError(
              `Some prices are temporarily unavailable: ${failures.join(
                ", ",
              )}.`,
            );
          } else {
            setError(
              "",
            );
          }
        } catch (
          loadError
        ) {
          if (
            loadError
              ?.name ===
            "AbortError"
          ) {
            return;
          }

          if (
            mountedRef
              .current
          ) {
            setError(
              loadError.message ||
                "Could not load market prices.",
            );
          }
        } finally {
          if (
            mountedRef
              .current
          ) {
            setLoading(
              false,
            );
          }
        }
      },
      [
        symbolsKey,
      ],
    );

  useEffect(
    () => {
      mountedRef.current =
        true;

      loadPrices();

      const interval =
        window.setInterval(
          loadPrices,
          Math.max(
            Number(
              refreshMs,
            ) ||
              DEFAULT_REFRESH_MS,
            2000,
          ),
        );

      return () => {
        mountedRef.current =
          false;

        controllerRef
          .current
          ?.abort();

        window.clearInterval(
          interval,
        );
      };
    },
    [
      loadPrices,
      refreshMs,
    ],
  );

  return {
    prices,
    loading,
    error,
    updatedAt,
    refresh:
      loadPrices,
  };
}

export {
  DEFAULT_SYMBOLS,
};

export default useMarketPrices;