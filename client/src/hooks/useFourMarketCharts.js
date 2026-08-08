import {
  useEffect,
  useState,
} from "react";

const SERVER_HTTP_URL =
  import.meta.env
    .VITE_SERVER_HTTP_URL ||
  "http://localhost:5000";

const BINANCE_STREAM_URL =
  "wss://stream.binance.us:9443/stream";

const DEFAULT_SYMBOLS = [
  "BTCUSD",
  "ETHUSD",
  "SOLUSD",
  "DOGEUSD",
];

const MAX_CANDLES = 1500;

function createMarketState(
  symbol,
) {
  return {
    symbol,

    candles: [],

    price:
      null,

    loading:
      true,

    error:
      "",

    connectionStatus:
      "Loading history",

    historicalReady:
      false,
  };
}

function createInitialMarkets(
  symbols,
) {
  return Object.fromEntries(
    symbols.map(
      (
        symbol,
      ) => [
        symbol,
        createMarketState(
          symbol,
        ),
      ],
    ),
  );
}

function normalizeLiveCandle(
  kline,
) {
  return {
    time:
      Math.floor(
        Number(
          kline.t,
        ) /
          1000,
      ),

    open:
      Number(
        kline.o,
      ),

    high:
      Number(
        kline.h,
      ),

    low:
      Number(
        kline.l,
      ),

    close:
      Number(
        kline.c,
      ),

    volume:
      Number(
        kline.v,
      ),

    closeTime:
      Number(
        kline.T,
      ),

    closed:
      Boolean(
        kline.x,
      ),
  };
}

function normalizeHistoricalCandles(
  candles,
) {
  if (
    !Array.isArray(
      candles,
    )
  ) {
    return [];
  }

  const map =
    new Map();

  for (
    const candle of candles
  ) {
    const time =
      Number(
        candle?.time,
      );

    if (
      !Number.isFinite(
        time,
      )
    ) {
      continue;
    }

    map.set(
      time,
      {
        time,

        open:
          Number(
            candle.open,
          ),

        high:
          Number(
            candle.high,
          ),

        low:
          Number(
            candle.low,
          ),

        close:
          Number(
            candle.close,
          ),

        volume:
          Number(
            candle.volume,
          ),

        closeTime:
          Number(
            candle.closeTime,
          ),

        closed:
          candle.closed !==
          false,
      },
    );
  }

  return [
    ...map.values(),
  ]
    .sort(
      (
        left,
        right,
      ) =>
        left.time -
        right.time,
    )
    .slice(
      -MAX_CANDLES,
    );
}

function mergeCandle(
  candles = [],
  candle,
) {
  if (!candle) {
    return candles;
  }

  const next = [
    ...candles,
  ];

  if (
    next.length ===
    0
  ) {
    return [
      candle,
    ];
  }

  const lastIndex =
    next.length -
    1;

  const last =
    next[
      lastIndex
    ];

  if (
    Number(
      last.time,
    ) ===
    Number(
      candle.time,
    )
  ) {
    next[
      lastIndex
    ] =
      candle;
  } else if (
    Number(
      candle.time,
    ) >
    Number(
      last.time,
    )
  ) {
    next.push(
      candle,
    );
  }

  return next.slice(
    -MAX_CANDLES,
  );
}

export default function useFourMarketCharts({
  symbols =
    DEFAULT_SYMBOLS,

  timeframe =
    "5m",
} = {}) {
  const [
    markets,
    setMarkets,
  ] =
    useState(
      () =>
        createInitialMarkets(
          symbols,
        ),
    );

  useEffect(
    () => {
      let cancelled =
        false;

      let socket =
        null;

      setMarkets(
        createInitialMarkets(
          symbols,
        ),
      );

      async function loadMarketHistory(
        symbol,
      ) {
        try {
          const query =
            new URLSearchParams({
              symbol,

              timeframe,
            });

          const response =
            await fetch(
              `${SERVER_HTTP_URL}/api/multi-chart/candles?${query}`,
            );

          const data =
            await response.json();

          if (
            !response.ok
          ) {
            throw new Error(
              data.message ||
                `Could not load ${symbol}.`,
            );
          }

          if (
            cancelled
          ) {
            return;
          }

          const candles =
            normalizeHistoricalCandles(
              data.candles,
            );

          const latest =
            candles[
              candles.length -
                1
            ];

          console.log(
            `Four-chart history loaded: ${symbol} ${timeframe} (${candles.length} candles)`,
          );

          setMarkets(
            (
              previous,
            ) => ({
              ...previous,

              [symbol]: {
                ...previous[
                  symbol
                ],

                candles,

                price:
                  Number(
                    latest
                      ?.close,
                  ) ||
                  null,

                loading:
                  false,

                error:
                  "",

                historicalReady:
                  true,

                connectionStatus:
                  "History loaded",
              },
            }),
          );
        } catch (
          error
        ) {
          if (
            cancelled
          ) {
            return;
          }

          console.error(
            `Could not load ${symbol} chart history:`,
            error,
          );

          setMarkets(
            (
              previous,
            ) => ({
              ...previous,

              [symbol]: {
                ...previous[
                  symbol
                ],

                loading:
                  false,

                error:
                  error.message ||
                  `Could not load ${symbol}.`,

                historicalReady:
                  false,

                connectionStatus:
                  "History error",
              },
            }),
          );
        }
      }

      async function start() {
        /*
         * IMPORTANT:
         *
         * Load the full historical datasets
         * BEFORE opening the live WebSocket.
         *
         * This prevents the chart from first
         * receiving one live candle and
         * treating that as its initial dataset.
         */
        await Promise.allSettled(
          symbols.map(
            (
              symbol,
            ) =>
              loadMarketHistory(
                symbol,
              ),
          ),
        );

        if (
          cancelled
        ) {
          return;
        }

        const streams =
          symbols
            .map(
              (
                symbol,
              ) =>
                `${symbol.toLowerCase()}@kline_${timeframe}`,
            )
            .join(
              "/",
            );

        socket =
          new WebSocket(
            `${BINANCE_STREAM_URL}?streams=${streams}`,
          );

        socket.addEventListener(
          "open",
          () => {
            if (
              cancelled
            ) {
              return;
            }

            setMarkets(
              (
                previous,
              ) => {
                const next = {
                  ...previous,
                };

                for (
                  const symbol of
                    symbols
                ) {
                  next[
                    symbol
                  ] = {
                    ...next[
                      symbol
                    ],

                    connectionStatus:
                      "Live",
                  };
                }

                return next;
              },
            );

            console.log(
              `Four-market stream connected: ${timeframe}`,
            );
          },
        );

        socket.addEventListener(
          "message",
          (
            event,
          ) => {
            if (
              cancelled
            ) {
              return;
            }

            try {
              const message =
                JSON.parse(
                  event.data,
                );

              const data =
                message?.data;

              if (
                !data?.k
              ) {
                return;
              }

              const symbol =
                String(
                  data.s ||
                    data.k.s ||
                    "",
                )
                  .trim()
                  .toUpperCase();

              if (
                !symbols.includes(
                  symbol,
                )
              ) {
                return;
              }

              const candle =
                normalizeLiveCandle(
                  data.k,
                );

              setMarkets(
                (
                  previous,
                ) => {
                  const current =
                    previous[
                      symbol
                    ] ||
                    createMarketState(
                      symbol,
                    );

                  return {
                    ...previous,

                    [symbol]: {
                      ...current,

                      candles:
                        mergeCandle(
                          current
                            .candles,
                          candle,
                        ),

                      price:
                        candle.close,

                      loading:
                        false,

                      error:
                        "",

                      connectionStatus:
                        "Live",
                    },
                  };
                },
              );
            } catch (
              error
            ) {
              console.error(
                "Four-chart WebSocket message error:",
                error,
              );
            }
          },
        );

        socket.addEventListener(
          "error",
          (
            error,
          ) => {
            if (
              cancelled
            ) {
              return;
            }

            console.error(
              "Four-market WebSocket error:",
              error,
            );

            setMarkets(
              (
                previous,
              ) => {
                const next = {
                  ...previous,
                };

                for (
                  const symbol of
                    symbols
                ) {
                  next[
                    symbol
                  ] = {
                    ...next[
                      symbol
                    ],

                    connectionStatus:
                      "Stream error",
                  };
                }

                return next;
              },
            );
          },
        );

        socket.addEventListener(
          "close",
          () => {
            if (
              cancelled
            ) {
              return;
            }

            setMarkets(
              (
                previous,
              ) => {
                const next = {
                  ...previous,
                };

                for (
                  const symbol of
                    symbols
                ) {
                  next[
                    symbol
                  ] = {
                    ...next[
                      symbol
                    ],

                    connectionStatus:
                      "Disconnected",
                  };
                }

                return next;
              },
            );
          },
        );
      }

      start();

      return () => {
        cancelled =
          true;

        if (
          socket &&
          (
            socket.readyState ===
              WebSocket.OPEN ||
            socket.readyState ===
              WebSocket.CONNECTING
          )
        ) {
          try {
            socket.close();
          } catch {
            // Intentional shutdown.
          }
        }
      };
    },
    [
      symbols.join(
        ",",
      ),

      timeframe,
    ],
  );

  return {
    markets,
    symbols,
    timeframe,
  };
}