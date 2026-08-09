import {
  useEffect,
  useState,
} from "react";

import {
  serverUrl,
} from "../config/server.js";

const BINANCE_STREAM_URL =
  "wss://stream.binance.us:9443/stream";

const DEFAULT_SYMBOLS = [
  "BTCUSD",
  "ETHUSD",
  "SOLUSD",
  "DOGEUSD",
];

const MAX_CANDLES =
  1500;

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
    const candle of
      candles
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

    const open =
      Number(
        candle.open,
      );

    const high =
      Number(
        candle.high,
      );

    const low =
      Number(
        candle.low,
      );

    const close =
      Number(
        candle.close,
      );

    if (
      !Number.isFinite(
        open,
      ) ||
      !Number.isFinite(
        high,
      ) ||
      !Number.isFinite(
        low,
      ) ||
      !Number.isFinite(
        close,
      )
    ) {
      continue;
    }

    map.set(
      time,
      {
        time,

        open,

        high,

        low,

        close,

        volume:
          Number(
            candle.volume,
          ) ||
          0,

        closeTime:
          Number(
            candle.closeTime,
          ) ||
          null,

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
  if (
    !candle
  ) {
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
      "The chart server returned invalid JSON.",
    );
  }
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

          /*
           * All historical chart requests
           * go through the shared server
           * configuration.
           */
          const url =
            serverUrl(
              `/api/multi-chart/candles?${query.toString()}`,
            );

          const response =
            await fetch(
              url,
            );

          const data =
            await readJson(
              response,
            );

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
                  candles.length >
                  0,

                connectionStatus:
                  candles.length >
                  0
                    ? "History loaded"
                    : "No history",
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
         * Load historical candles before
         * opening the live stream so the
         * chart begins with a full dataset.
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

        const socketUrl =
          `${BINANCE_STREAM_URL}?streams=${streams}`;

        socket =
          new WebSocket(
            socketUrl,
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

              if (
                !Number.isFinite(
                  candle.time,
                ) ||
                !Number.isFinite(
                  candle.open,
                ) ||
                !Number.isFinite(
                  candle.high,
                ) ||
                !Number.isFinite(
                  candle.low,
                ) ||
                !Number.isFinite(
                  candle.close,
                )
              ) {
                return;
              }

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

                      historicalReady:
                        true,

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