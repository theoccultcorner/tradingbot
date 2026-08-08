import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
} from "lightweight-charts";

const TWENTY_FOUR_HOURS =
  24 *
  60 *
  60;

function calculateEMA(
  candles,
  period,
) {
  if (
    !Array.isArray(
      candles,
    ) ||
    candles.length <
      period
  ) {
    return [];
  }

  const closes =
    candles.map(
      (
        candle,
      ) =>
        Number(
          candle.close,
        ),
    );

  const multiplier =
    2 /
    (
      period +
      1
    );

  let ema =
    closes
      .slice(
        0,
        period,
      )
      .reduce(
        (
          total,
          value,
        ) =>
          total +
          value,
        0,
      ) /
    period;

  const output = [
    {
      time:
        Number(
          candles[
            period -
              1
          ].time,
        ),

      value:
        ema,
    },
  ];

  for (
    let index =
      period;
    index <
    closes.length;
    index += 1
  ) {
    ema =
      (
        closes[
          index
        ] -
        ema
      ) *
        multiplier +
      ema;

    output.push({
      time:
        Number(
          candles[
            index
          ].time,
        ),

      value:
        ema,
    });
  }

  return output;
}

function calculateVWAP(
  candles,
) {
  let cumulativePriceVolume =
    0;

  let cumulativeVolume =
    0;

  const result = [];

  for (
    const candle of
      candles || []
  ) {
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

    const volume =
      Number(
        candle.volume,
      );

    if (
      !Number.isFinite(
        high,
      ) ||
      !Number.isFinite(
        low,
      ) ||
      !Number.isFinite(
        close,
      ) ||
      !Number.isFinite(
        volume,
      )
    ) {
      continue;
    }

    const typical =
      (
        high +
        low +
        close
      ) /
      3;

    cumulativePriceVolume +=
      typical *
      volume;

    cumulativeVolume +=
      volume;

    if (
      cumulativeVolume >
      0
    ) {
      result.push({
        time:
          Number(
            candle.time,
          ),

        value:
          cumulativePriceVolume /
          cumulativeVolume,
      });
    }
  }

  return result;
}

function calculateBollingerBands(
  candles,
  period = 20,
  deviations = 2,
) {
  const upper = [];
  const middle = [];
  const lower = [];

  if (
    !Array.isArray(
      candles,
    ) ||
    candles.length <
      period
  ) {
    return {
      upper,
      middle,
      lower,
    };
  }

  const closes =
    candles.map(
      (
        candle,
      ) =>
        Number(
          candle.close,
        ),
    );

  for (
    let index =
      period -
      1;
    index <
    candles.length;
    index += 1
  ) {
    const values =
      closes.slice(
        index -
          period +
          1,

        index +
          1,
      );

    const average =
      values.reduce(
        (
          total,
          value,
        ) =>
          total +
          value,
        0,
      ) /
      period;

    const variance =
      values.reduce(
        (
          total,
          value,
        ) =>
          total +
          (
            value -
            average
          ) **
            2,
        0,
      ) /
      period;

    const standardDeviation =
      Math.sqrt(
        variance,
      );

    const time =
      Number(
        candles[
          index
        ].time,
      );

    middle.push({
      time,
      value:
        average,
    });

    upper.push({
      time,
      value:
        average +
        standardDeviation *
          deviations,
    });

    lower.push({
      time,
      value:
        average -
        standardDeviation *
          deviations,
    });
  }

  return {
    upper,
    middle,
    lower,
  };
}

function formatCandles(
  candles = [],
) {
  return candles
    .filter(
      (
        candle,
      ) =>
        candle &&
        Number.isFinite(
          Number(
            candle.time,
          ),
        ) &&
        Number.isFinite(
          Number(
            candle.open,
          ),
        ) &&
        Number.isFinite(
          Number(
            candle.high,
          ),
        ) &&
        Number.isFinite(
          Number(
            candle.low,
          ),
        ) &&
        Number.isFinite(
          Number(
            candle.close,
          ),
        ),
    )
    .map(
      (
        candle,
      ) => ({
        time:
          Number(
            candle.time,
          ),

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
      }),
    );
}

function formatVolume(
  candles = [],
) {
  return candles
    .filter(
      (
        candle,
      ) =>
        Number.isFinite(
          Number(
            candle.time,
          ),
        ) &&
        Number.isFinite(
          Number(
            candle.volume,
          ),
        ),
    )
    .map(
      (
        candle,
      ) => ({
        time:
          Number(
            candle.time,
          ),

        value:
          Number(
            candle.volume,
          ),

        color:
          Number(
            candle.close,
          ) >=
          Number(
            candle.open,
          )
            ? "rgba(14, 203, 129, 0.36)"
            : "rgba(246, 70, 93, 0.36)",
      }),
    );
}

function formatPrice(
  value,
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
    return "—";
  }

  if (
    number >=
    1000
  ) {
    return number.toLocaleString(
      "en-US",
      {
        minimumFractionDigits:
          2,

        maximumFractionDigits:
          2,
      },
    );
  }

  if (
    number >=
    1
  ) {
    return number.toFixed(
      4,
    );
  }

  return number.toFixed(
    6,
  );
}

function formatPercent(
  value,
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
    return "—";
  }

  return `${
    number >=
    0
      ? "+"
      : ""
  }${number.toFixed(
    2,
  )}%`;
}

function formatVolumeNumber(
  value,
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
    return "—";
  }

  if (
    number >=
    1_000_000_000
  ) {
    return `${(
      number /
      1_000_000_000
    ).toFixed(
      2,
    )}B`;
  }

  if (
    number >=
    1_000_000
  ) {
    return `${(
      number /
      1_000_000
    ).toFixed(
      2,
    )}M`;
  }

  if (
    number >=
    1000
  ) {
    return `${(
      number /
      1000
    ).toFixed(
      2,
    )}K`;
  }

  return number.toFixed(
    2,
  );
}

function MiniMarketChart({
  symbol,
  timeframe,
  candles = [],
  price,
  connectionStatus,
  error,
}) {
  const containerRef =
    useRef(
      null,
    );

  const chartRef =
    useRef(
      null,
    );

  const candleSeriesRef =
    useRef(
      null,
    );

  const volumeSeriesRef =
    useRef(
      null,
    );

  const ema9Ref =
    useRef(
      null,
    );

  const ema21Ref =
    useRef(
      null,
    );

  const ema50Ref =
    useRef(
      null,
    );

  const ema200Ref =
    useRef(
      null,
    );

  const vwapRef =
    useRef(
      null,
    );

  const bollingerUpperRef =
    useRef(
      null,
    );

  const bollingerMiddleRef =
    useRef(
      null,
    );

  const bollingerLowerRef =
    useRef(
      null,
    );

  const fittedLengthRef =
    useRef(
      0,
    );

  const candlesRef =
    useRef(
      candles,
    );

  const [
    selectedCandle,
    setSelectedCandle,
  ] =
    useState(
      null,
    );

  useEffect(
    () => {
      candlesRef.current =
        candles;
    },
    [
      candles,
    ],
  );

  const ema9 =
    useMemo(
      () =>
        calculateEMA(
          candles,
          9,
        ),
      [
        candles,
      ],
    );

  const ema21 =
    useMemo(
      () =>
        calculateEMA(
          candles,
          21,
        ),
      [
        candles,
      ],
    );

  const ema50 =
    useMemo(
      () =>
        calculateEMA(
          candles,
          50,
        ),
      [
        candles,
      ],
    );

  const ema200 =
    useMemo(
      () =>
        calculateEMA(
          candles,
          200,
        ),
      [
        candles,
      ],
    );

  const vwap =
    useMemo(
      () =>
        calculateVWAP(
          candles,
        ),
      [
        candles,
      ],
    );

  const bollinger =
    useMemo(
      () =>
        calculateBollingerBands(
          candles,
          20,
          2,
        ),
      [
        candles,
      ],
    );

  const latestCandle =
    candles[
      candles.length -
        1
    ] ||
    null;

  const displayCandle =
    selectedCandle ||
    latestCandle;

  const statistics =
    useMemo(
      () => {
        if (
          candles.length ===
          0
        ) {
          return {
            high:
              null,

            low:
              null,

            volume:
              null,

            changePercent:
              null,
          };
        }

        const newestTime =
          Number(
            candles[
              candles.length -
                1
            ]?.time,
          );

        const cutoff =
          Number.isFinite(
            newestTime,
          )
            ? newestTime -
              TWENTY_FOUR_HOURS
            : null;

        const recentCandles =
          cutoff ===
          null
            ? candles
            : candles.filter(
                (
                  candle,
                ) =>
                  Number(
                    candle.time,
                  ) >=
                  cutoff,
              );

        const source =
          recentCandles.length >
          0
            ? recentCandles
            : candles;

        let high =
          -Infinity;

        let low =
          Infinity;

        let totalVolume =
          0;

        for (
          const candle of
            source
        ) {
          const candleHigh =
            Number(
              candle.high,
            );

          const candleLow =
            Number(
              candle.low,
            );

          const candleVolume =
            Number(
              candle.volume,
            );

          if (
            Number.isFinite(
              candleHigh,
            )
          ) {
            high =
              Math.max(
                high,
                candleHigh,
              );
          }

          if (
            Number.isFinite(
              candleLow,
            )
          ) {
            low =
              Math.min(
                low,
                candleLow,
              );
          }

          if (
            Number.isFinite(
              candleVolume,
            )
          ) {
            totalVolume +=
              candleVolume;
          }
        }

        const firstOpen =
          Number(
            source[0]
              ?.open,
          );

        const lastClose =
          Number(
            source[
              source.length -
                1
            ]?.close,
          );

        const changePercent =
          Number.isFinite(
            firstOpen,
          ) &&
          firstOpen !==
            0 &&
          Number.isFinite(
            lastClose,
          )
            ? (
                (
                  lastClose -
                  firstOpen
                ) /
                firstOpen
              ) *
              100
            : null;

        return {
          high:
            Number.isFinite(
              high,
            )
              ? high
              : null,

          low:
            Number.isFinite(
              low,
            )
              ? low
              : null,

          volume:
            totalVolume,

          changePercent,
        };
      },
      [
        candles,
      ],
    );

  useEffect(
    () => {
      fittedLengthRef.current =
        0;

      setSelectedCandle(
        null,
      );
    },
    [
      symbol,
      timeframe,
    ],
  );

  useEffect(
    () => {
      if (
        !containerRef.current
      ) {
        return undefined;
      }

      const chart =
        createChart(
          containerRef.current,
          {
            width:
              containerRef
                .current
                .clientWidth,

            height:
              430,

            layout: {
              background: {
                type:
                  ColorType.Solid,

                color:
                  "#181a20",
              },

              textColor:
                "#848e9c",

              fontFamily:
                "Arial, Helvetica, sans-serif",
            },

            grid: {
              vertLines: {
                color:
                  "#242830",
              },

              horzLines: {
                color:
                  "#242830",
              },
            },

            rightPriceScale: {
              borderColor:
                "#2b3139",

              scaleMargins: {
                top:
                  0.05,

                bottom:
                  0.25,
              },
            },

            /*
             * Dense candle layout:
             *
             * On the 1m timeframe the
             * complete 24-hour window
             * contains approximately
             * 1,440 candles.
             */
            timeScale: {
              borderColor:
                "#2b3139",

              timeVisible:
                true,

              secondsVisible:
                false,

              rightOffset:
                1,

              barSpacing:
                2,

              minBarSpacing:
                0.15,

              fixLeftEdge:
                false,

              fixRightEdge:
                false,

              lockVisibleTimeRangeOnResize:
                true,

              rightBarStaysOnScroll:
                true,
            },

            crosshair: {
              vertLine: {
                color:
                  "#848e9c",

                labelBackgroundColor:
                  "#2b3139",
              },

              horzLine: {
                color:
                  "#848e9c",

                labelBackgroundColor:
                  "#2b3139",
              },
            },

            handleScale: {
              mouseWheel:
                true,

              pinch:
                true,

              axisPressedMouseMove:
                true,
            },

            handleScroll: {
              mouseWheel:
                true,

              pressedMouseMove:
                true,

              horzTouchDrag:
                true,

              vertTouchDrag:
                true,
            },
          },
        );

      const candleSeries =
        chart.addSeries(
          CandlestickSeries,
          {
            upColor:
              "#0ecb81",

            downColor:
              "#f6465d",

            borderUpColor:
              "#0ecb81",

            borderDownColor:
              "#f6465d",

            wickUpColor:
              "#0ecb81",

            wickDownColor:
              "#f6465d",

            priceLineVisible:
              true,

            lastValueVisible:
              true,
          },
        );

      const volumeSeries =
        chart.addSeries(
          HistogramSeries,
          {
            priceFormat: {
              type:
                "volume",
            },

            priceScaleId:
              "",

            priceLineVisible:
              false,

            lastValueVisible:
              false,
          },
        );

      volumeSeries
        .priceScale()
        .applyOptions({
          scaleMargins: {
            top:
              0.84,

            bottom:
              0,
          },
        });

      const ema9Series =
        chart.addSeries(
          LineSeries,
          {
            color:
              "#f0b90b",

            lineWidth:
              2,

            title:
              "EMA 9",

            priceLineVisible:
              false,

            lastValueVisible:
              false,
          },
        );

      const ema21Series =
        chart.addSeries(
          LineSeries,
          {
            color:
              "#00b8d9",

            lineWidth:
              2,

            title:
              "EMA 21",

            priceLineVisible:
              false,

            lastValueVisible:
              false,
          },
        );

      const ema50Series =
        chart.addSeries(
          LineSeries,
          {
            color:
              "#9c6ade",

            lineWidth:
              1,

            title:
              "EMA 50",

            priceLineVisible:
              false,

            lastValueVisible:
              false,
          },
        );

      const ema200Series =
        chart.addSeries(
          LineSeries,
          {
            color:
              "#ff8a65",

            lineWidth:
              1,

            title:
              "EMA 200",

            priceLineVisible:
              false,

            lastValueVisible:
              false,
          },
        );

      const vwapSeries =
        chart.addSeries(
          LineSeries,
          {
            color:
              "#ffffff",

            lineWidth:
              2,

            lineStyle:
              2,

            title:
              "VWAP",

            priceLineVisible:
              false,

            lastValueVisible:
              false,
          },
        );

      const bollingerUpperSeries =
        chart.addSeries(
          LineSeries,
          {
            color:
              "rgba(132, 142, 156, 0.75)",

            lineWidth:
              1,

            title:
              "BB Upper",

            priceLineVisible:
              false,

            lastValueVisible:
              false,
          },
        );

      const bollingerMiddleSeries =
        chart.addSeries(
          LineSeries,
          {
            color:
              "rgba(132, 142, 156, 0.45)",

            lineWidth:
              1,

            lineStyle:
              2,

            title:
              "BB Middle",

            priceLineVisible:
              false,

            lastValueVisible:
              false,
          },
        );

      const bollingerLowerSeries =
        chart.addSeries(
          LineSeries,
          {
            color:
              "rgba(132, 142, 156, 0.75)",

            lineWidth:
              1,

            title:
              "BB Lower",

            priceLineVisible:
              false,

            lastValueVisible:
              false,
          },
        );

      chartRef.current =
        chart;

      candleSeriesRef.current =
        candleSeries;

      volumeSeriesRef.current =
        volumeSeries;

      ema9Ref.current =
        ema9Series;

      ema21Ref.current =
        ema21Series;

      ema50Ref.current =
        ema50Series;

      ema200Ref.current =
        ema200Series;

      vwapRef.current =
        vwapSeries;

      bollingerUpperRef.current =
        bollingerUpperSeries;

      bollingerMiddleRef.current =
        bollingerMiddleSeries;

      bollingerLowerRef.current =
        bollingerLowerSeries;

      chart.subscribeCrosshairMove(
        (
          parameter,
        ) => {
          if (
            !parameter
              ?.time
          ) {
            setSelectedCandle(
              null,
            );

            return;
          }

          const time =
            Number(
              parameter.time,
            );

          const candle =
            candlesRef.current.find(
              (
                item,
              ) =>
                Number(
                  item.time,
                ) ===
                time,
            );

          if (
            candle
          ) {
            setSelectedCandle(
              candle,
            );
          }
        },
      );

      const resizeObserver =
        new ResizeObserver(
          (
            entries,
          ) => {
            const entry =
              entries[0];

            if (!entry) {
              return;
            }

            chart.applyOptions({
              width:
                entry
                  .contentRect
                  .width,
            });
          },
        );

      resizeObserver.observe(
        containerRef.current,
      );

      return () => {
        resizeObserver
          .disconnect();

        chart.remove();

        chartRef.current =
          null;

        candleSeriesRef.current =
          null;

        volumeSeriesRef.current =
          null;

        ema9Ref.current =
          null;

        ema21Ref.current =
          null;

        ema50Ref.current =
          null;

        ema200Ref.current =
          null;

        vwapRef.current =
          null;

        bollingerUpperRef.current =
          null;

        bollingerMiddleRef.current =
          null;

        bollingerLowerRef.current =
          null;
      };
    },
    [],
  );

  useEffect(
    () => {
      if (
        !candleSeriesRef.current
      ) {
        return;
      }

      const formattedCandles =
        formatCandles(
          candles,
        );

      candleSeriesRef.current
        .setData(
          formattedCandles,
        );

      volumeSeriesRef.current
        ?.setData(
          formatVolume(
            candles,
          ),
        );

      ema9Ref.current
        ?.setData(
          ema9,
        );

      ema21Ref.current
        ?.setData(
          ema21,
        );

      ema50Ref.current
        ?.setData(
          ema50,
        );

      ema200Ref.current
        ?.setData(
          ema200,
        );

      vwapRef.current
        ?.setData(
          vwap,
        );

      bollingerUpperRef.current
        ?.setData(
          bollinger.upper,
        );

      bollingerMiddleRef.current
        ?.setData(
          bollinger.middle,
        );

      bollingerLowerRef.current
        ?.setData(
          bollinger.lower,
        );

      if (
        formattedCandles.length ===
        0
      ) {
        return;
      }

      const historyArrived =
        fittedLengthRef.current <
          10 &&
        formattedCandles.length >=
          10;

      if (
        fittedLengthRef.current ===
          0 ||
        historyArrived
      ) {
        const newest =
          Number(
            formattedCandles[
              formattedCandles.length -
                1
            ].time,
          );

        const oldest =
          Number(
            formattedCandles[0]
              .time,
          );

        if (
          Number.isFinite(
            newest,
          ) &&
          Number.isFinite(
            oldest,
          )
        ) {
          const start =
            Math.max(
              oldest,

              newest -
                TWENTY_FOUR_HOURS,
            );

          chartRef.current
            ?.timeScale()
            .setVisibleRange({
              from:
                start,

              to:
                newest,
            });
        }

        fittedLengthRef.current =
          formattedCandles.length;
      }
    },
    [
      candles,
      ema9,
      ema21,
      ema50,
      ema200,
      vwap,
      bollinger,
    ],
  );

  return (
    <article className="mini-market-chart">
      <header className="mini-chart-header">
        <div>
          <span className="mini-chart-symbol">
            {symbol.replace(
              "USD",
              "/USD",
            )}
          </span>

          <small>
            {timeframe}
            {" · "}
            24H
            {" · "}
            {
              candles.length
            }
            {" candles"}
          </small>
        </div>

        <div className="mini-chart-price">
          <strong>
            $
            {formatPrice(
              price,
            )}
          </strong>

          <span
            className={
              statistics
                .changePercent >
              0
                ? "mini-market-change positive"
                : statistics
                      .changePercent <
                    0
                  ? "mini-market-change negative"
                  : "mini-market-change"
            }
          >
            {formatPercent(
              statistics
                .changePercent,
            )}
          </span>
        </div>
      </header>

      <div className="mini-chart-ohlc">
        <span>
          O{" "}
          <strong>
            {formatPrice(
              displayCandle
                ?.open,
            )}
          </strong>
        </span>

        <span>
          H{" "}
          <strong className="positive">
            {formatPrice(
              displayCandle
                ?.high,
            )}
          </strong>
        </span>

        <span>
          L{" "}
          <strong className="negative">
            {formatPrice(
              displayCandle
                ?.low,
            )}
          </strong>
        </span>

        <span>
          C{" "}
          <strong>
            {formatPrice(
              displayCandle
                ?.close,
            )}
          </strong>
        </span>

        <span>
          Vol{" "}
          <strong>
            {formatVolumeNumber(
              displayCandle
                ?.volume,
            )}
          </strong>
        </span>
      </div>

      <div className="mini-chart-statistics">
        <span>
          24H High

          <strong>
            $
            {formatPrice(
              statistics.high,
            )}
          </strong>
        </span>

        <span>
          24H Low

          <strong>
            $
            {formatPrice(
              statistics.low,
            )}
          </strong>
        </span>

        <span>
          24H Volume

          <strong>
            {formatVolumeNumber(
              statistics.volume,
            )}
          </strong>
        </span>
      </div>

      <div className="mini-chart-indicators">
        <span className="mini-ema9">
          EMA 9
        </span>

        <span className="mini-ema21">
          EMA 21
        </span>

        <span className="mini-ema50">
          EMA 50
        </span>

        <span className="mini-ema200">
          EMA 200
        </span>

        <span className="mini-vwap">
          VWAP
        </span>

        <span className="mini-bollinger">
          Bollinger
        </span>

        <span
          className={
            connectionStatus ===
            "Live"
              ? "mini-live-status live"
              : "mini-live-status"
          }
        >
          ●{" "}
          {
            connectionStatus
          }
        </span>
      </div>

      {error && (
        <p className="mini-chart-error">
          {error}
        </p>
      )}

      <div
        ref={
          containerRef
        }
        className="mini-chart-canvas detailed"
        aria-label={`${symbol} ${timeframe} detailed 24-hour candlestick chart`}
      />
    </article>
  );
}

export default MiniMarketChart;