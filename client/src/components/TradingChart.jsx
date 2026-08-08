import { useEffect, useRef } from "react";

import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
} from "lightweight-charts";

const TWENTY_FOUR_HOURS_SECONDS =
  24 * 60 * 60;

function toLineData(
  values = [],
) {
  return values
    .filter(
      (item) =>
        item &&
        Number.isFinite(
          Number(
            item.time,
          ),
        ) &&
        Number.isFinite(
          Number(
            item.value,
          ),
        ),
    )
    .map(
      (item) => ({
        time:
          Number(
            item.time,
          ),

        value:
          Number(
            item.value,
          ),
      }),
    );
}

function toCandleData(
  candles = [],
) {
  return candles
    .filter(
      (candle) =>
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
      (candle) => ({
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

function toVolumeData(
  candles = [],
) {
  return candles
    .filter(
      (candle) =>
        candle &&
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
      (candle) => ({
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
            ? "rgba(14, 203, 129, 0.45)"
            : "rgba(246, 70, 93, 0.45)",
      }),
    );
}

function set24HourView(
  chart,
  formattedCandles,
) {
  if (
    !chart ||
    !Array.isArray(
      formattedCandles,
    ) ||
    formattedCandles.length ===
      0
  ) {
    return;
  }

  const newestCandle =
    formattedCandles[
      formattedCandles.length -
        1
    ];

  const newestTime =
    Number(
      newestCandle.time,
    );

  if (
    !Number.isFinite(
      newestTime,
    )
  ) {
    return;
  }

  const twentyFourHoursAgo =
    newestTime -
    TWENTY_FOUR_HOURS_SECONDS;

  chart
    .timeScale()
    .setVisibleRange({
      from:
        twentyFourHoursAgo,

      to:
        newestTime,
    });
}

function TradingChart({
  candles = [],
  indicators = {},
  symbol = "SOLUSD",
  timeframe = "1m",
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

  const ema9SeriesRef =
    useRef(
      null,
    );

  const ema21SeriesRef =
    useRef(
      null,
    );

  const ema50SeriesRef =
    useRef(
      null,
    );

  const ema200SeriesRef =
    useRef(
      null,
    );

  const vwapSeriesRef =
    useRef(
      null,
    );

  const bollingerUpperSeriesRef =
    useRef(
      null,
    );

  const bollingerMiddleSeriesRef =
    useRef(
      null,
    );

  const bollingerLowerSeriesRef =
    useRef(
      null,
    );

  /*
   * Prevent every live market update
   * from forcing the user back to the
   * default 24-hour zoom.
   */
  const initialViewRef =
    useRef(
      false,
    );

  /*
   * Reset the 24-hour view whenever the
   * selected market or timeframe changes.
   */
  useEffect(
    () => {
      initialViewRef.current =
        false;
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
              520,

            layout: {
              background: {
                type:
                  ColorType.Solid,

                color:
                  "#181a20",
              },

              textColor:
                "#b7bdc6",

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
                  0.08,

                bottom:
                  0.22,
              },
            },

            timeScale: {
              borderColor:
                "#2b3139",

              timeVisible:
                true,

              secondsVisible:
                false,

              rightOffset:
                2,

              /*
               * Let the 24-hour range
               * determine the visible
               * spacing instead of forcing
               * a large fixed bar size.
               */
              barSpacing:
                6,

              minBarSpacing:
                0.5,

              /*
               * Give the user freedom to
               * pan through historical data.
               */
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
              axisPressedMouseMove:
                true,

              mouseWheel:
                true,

              pinch:
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

            lastValueVisible:
              false,

            priceLineVisible:
              false,
          },
        );

      volumeSeries
        .priceScale()
        .applyOptions({
          scaleMargins: {
            top:
              0.82,

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

            priceLineVisible:
              false,

            lastValueVisible:
              false,

            title:
              "EMA 9",
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

            priceLineVisible:
              false,

            lastValueVisible:
              false,

            title:
              "EMA 21",
          },
        );

      const ema50Series =
        chart.addSeries(
          LineSeries,
          {
            color:
              "#9c6ade",

            lineWidth:
              2,

            priceLineVisible:
              false,

            lastValueVisible:
              false,

            title:
              "EMA 50",
          },
        );

      const ema200Series =
        chart.addSeries(
          LineSeries,
          {
            color:
              "#ff8a65",

            lineWidth:
              2,

            priceLineVisible:
              false,

            lastValueVisible:
              false,

            title:
              "EMA 200",
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

            priceLineVisible:
              false,

            lastValueVisible:
              false,

            title:
              "VWAP",
          },
        );

      const bollingerUpperSeries =
        chart.addSeries(
          LineSeries,
          {
            color:
              "rgba(132, 142, 156, 0.8)",

            lineWidth:
              1,

            priceLineVisible:
              false,

            lastValueVisible:
              false,

            title:
              "BB Upper",
          },
        );

      const bollingerMiddleSeries =
        chart.addSeries(
          LineSeries,
          {
            color:
              "rgba(132, 142, 156, 0.55)",

            lineWidth:
              1,

            lineStyle:
              2,

            priceLineVisible:
              false,

            lastValueVisible:
              false,

            title:
              "BB Middle",
          },
        );

      const bollingerLowerSeries =
        chart.addSeries(
          LineSeries,
          {
            color:
              "rgba(132, 142, 156, 0.8)",

            lineWidth:
              1,

            priceLineVisible:
              false,

            lastValueVisible:
              false,

            title:
              "BB Lower",
          },
        );

      chartRef.current =
        chart;

      candleSeriesRef.current =
        candleSeries;

      volumeSeriesRef.current =
        volumeSeries;

      ema9SeriesRef.current =
        ema9Series;

      ema21SeriesRef.current =
        ema21Series;

      ema50SeriesRef.current =
        ema50Series;

      ema200SeriesRef.current =
        ema200Series;

      vwapSeriesRef.current =
        vwapSeries;

      bollingerUpperSeriesRef.current =
        bollingerUpperSeries;

      bollingerMiddleSeriesRef.current =
        bollingerMiddleSeries;

      bollingerLowerSeriesRef.current =
        bollingerLowerSeries;

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

        ema9SeriesRef.current =
          null;

        ema21SeriesRef.current =
          null;

        ema50SeriesRef.current =
          null;

        ema200SeriesRef.current =
          null;

        vwapSeriesRef.current =
          null;

        bollingerUpperSeriesRef.current =
          null;

        bollingerMiddleSeriesRef.current =
          null;

        bollingerLowerSeriesRef.current =
          null;

        initialViewRef.current =
          false;
      };
    },
    [],
  );

  useEffect(
    () => {
      if (
        !candleSeriesRef.current ||
        candles.length ===
          0
      ) {
        return;
      }

      const formattedCandles =
        toCandleData(
          candles,
        );

      const formattedVolume =
        toVolumeData(
          candles,
        );

      candleSeriesRef.current
        .setData(
          formattedCandles,
        );

      volumeSeriesRef.current
        ?.setData(
          formattedVolume,
        );

      /*
       * Initial chart view:
       *
       * Show the last 24 hours ending at
       * the newest available candle.
       */
      if (
        !initialViewRef.current &&
        formattedCandles.length >
          0
      ) {
        set24HourView(
          chartRef.current,
          formattedCandles,
        );

        initialViewRef.current =
          true;
      }
    },
    [
      candles,
      symbol,
      timeframe,
    ],
  );

  useEffect(
    () => {
      ema9SeriesRef.current
        ?.setData(
          toLineData(
            indicators.ema9,
          ),
        );

      ema21SeriesRef.current
        ?.setData(
          toLineData(
            indicators.ema21,
          ),
        );

      ema50SeriesRef.current
        ?.setData(
          toLineData(
            indicators.ema50,
          ),
        );

      ema200SeriesRef.current
        ?.setData(
          toLineData(
            indicators.ema200,
          ),
        );

      vwapSeriesRef.current
        ?.setData(
          toLineData(
            indicators.vwap,
          ),
        );

      bollingerUpperSeriesRef.current
        ?.setData(
          toLineData(
            indicators
              .bollingerUpper,
          ),
        );

      bollingerMiddleSeriesRef.current
        ?.setData(
          toLineData(
            indicators
              .bollingerMiddle,
          ),
        );

      bollingerLowerSeriesRef.current
        ?.setData(
          toLineData(
            indicators
              .bollingerLower,
          ),
        );
    },
    [
      indicators,
    ],
  );

  return (
    <section className="panel chart-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">
            LIVE MARKET
          </p>

          <h2>
            {symbol.replace(
              "USD",
              "/USD",
            )}{" "}
            · {timeframe}
          </h2>
        </div>

        <div className="chart-legend">
          <span className="legend-ema9">
            EMA 9
          </span>

          <span className="legend-ema21">
            EMA 21
          </span>

          <span className="legend-ema50">
            EMA 50
          </span>

          <span className="legend-ema200">
            EMA 200
          </span>

          <span className="legend-vwap">
            VWAP
          </span>

          <span className="legend-bollinger">
            Bollinger
          </span>
        </div>
      </div>

      <div
        ref={
          containerRef
        }
        className="trading-chart"
        aria-label={`${symbol} candlestick chart showing the most recent 24 hours`}
      />
    </section>
  );
}

export default TradingChart;