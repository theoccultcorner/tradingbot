import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  SERVER_HTTP_URL,
  SERVER_SOCKET_URL,
} from "../config/server.js";

const INITIAL_STATE = {
  candles: [],
  indicators: {},
  signal: null,

  price: null,
  priceDirection: "same",

  bid: null,
  ask: null,
  spread: null,

  bids: [],
  asks: [],
  trades: [],

  priceChangePercent: null,
  high24h: null,
  low24h: null,
  volume24h: null,
  quoteVolume24h: null,

  connectionStatus: "Connecting...",
  serverConnectionStatus: "Connecting...",
  error: "",
  updatedAt: null,
};

function normalizeMarketState(payload) {
  return {
    candles: Array.isArray(payload?.candles)
      ? payload.candles
      : [],

    indicators:
      payload?.indicators &&
      typeof payload.indicators === "object"
        ? payload.indicators
        : {},

    signal:
      payload?.signal &&
      typeof payload.signal === "object"
        ? payload.signal
        : null,

    price: Number.isFinite(Number(payload?.price))
      ? Number(payload.price)
      : null,

    priceDirection:
      payload?.priceDirection || "same",

    bid: Number.isFinite(Number(payload?.bid))
      ? Number(payload.bid)
      : null,

    ask: Number.isFinite(Number(payload?.ask))
      ? Number(payload.ask)
      : null,

    spread: Number.isFinite(
      Number(payload?.spread),
    )
      ? Number(payload.spread)
      : null,

    bids: Array.isArray(payload?.bids)
      ? payload.bids
      : [],

    asks: Array.isArray(payload?.asks)
      ? payload.asks
      : [],

    trades: Array.isArray(payload?.trades)
      ? payload.trades
      : [],

    priceChangePercent: Number.isFinite(
      Number(payload?.priceChangePercent),
    )
      ? Number(payload.priceChangePercent)
      : null,

    high24h: Number.isFinite(
      Number(payload?.high24h),
    )
      ? Number(payload.high24h)
      : null,

    low24h: Number.isFinite(
      Number(payload?.low24h),
    )
      ? Number(payload.low24h)
      : null,

    volume24h: Number.isFinite(
      Number(payload?.volume24h),
    )
      ? Number(payload.volume24h)
      : null,

    quoteVolume24h: Number.isFinite(
      Number(payload?.quoteVolume24h),
    )
      ? Number(payload.quoteVolume24h)
      : null,

    connectionStatus:
      payload?.connectionStatus || "Unknown",

    updatedAt:
      Number(payload?.updatedAt) || Date.now(),
  };
}

export default function useBinanceMarket({
  symbol = "SOLUSD",
  timeframe = "1m",
} = {}) {
  const [marketState, setMarketState] =
    useState(INITIAL_STATE);

  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const mountedRef = useRef(false);

  const symbolRef = useRef(symbol);
  const timeframeRef = useRef(timeframe);

  useEffect(() => {
    symbolRef.current = symbol;
    timeframeRef.current = timeframe;
  }, [symbol, timeframe]);

  useEffect(() => {
    mountedRef.current = true;

    let intentionallyClosed = false;

    function clearReconnectTimer() {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    }

    function sendMarketSelection(socket) {
      if (
        !socket ||
        socket.readyState !== WebSocket.OPEN
      ) {
        return;
      }

      socket.send(
        JSON.stringify({
          type: "market:change",
          payload: {
            symbol: symbolRef.current,
            timeframe: timeframeRef.current,
          },
        }),
      );
    }

    async function loadInitialSnapshot() {
      try {
        const response = await fetch(
          `${SERVER_HTTP_URL}/api/market/state`,
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Could not load server market state.",
          );
        }

        if (!mountedRef.current) {
          return;
        }

        setMarketState((previous) => ({
          ...previous,
          ...normalizeMarketState(data),
          serverConnectionStatus:
            previous.serverConnectionStatus,
          error: "",
        }));
      } catch (error) {
        console.warn(
          "Initial market snapshot unavailable:",
          error,
        );
      }
    }

    function scheduleReconnect() {
      if (intentionallyClosed) {
        return;
      }

      reconnectAttemptsRef.current += 1;

      const delay = Math.min(
        1000 *
          2 **
            Math.max(
              reconnectAttemptsRef.current - 1,
              0,
            ),
        30000,
      );

      setMarketState((previous) => ({
        ...previous,
        serverConnectionStatus:
          "Reconnecting...",
      }));

      clearReconnectTimer();

      reconnectTimerRef.current =
        setTimeout(connect, delay);
    }

    function connect() {
      if (
        intentionallyClosed ||
        !mountedRef.current
      ) {
        return;
      }

      clearReconnectTimer();

      setMarketState((previous) => ({
        ...previous,
        serverConnectionStatus:
          reconnectAttemptsRef.current === 0
            ? "Connecting..."
            : "Reconnecting...",
      }));

      const socket = new WebSocket(
        SERVER_SOCKET_URL,
      );

      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptsRef.current = 0;

        setMarketState((previous) => ({
          ...previous,
          serverConnectionStatus: "Connected",
          error: "",
        }));

        sendMarketSelection(socket);
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "market:update") {
            setMarketState((previous) => ({
              ...previous,
              ...normalizeMarketState(
                message.payload,
              ),
              serverConnectionStatus:
                "Connected",
              error: "",
            }));

            return;
          }

          if (message.type === "server:error") {
            setMarketState((previous) => ({
              ...previous,
              error:
                message.payload?.message ||
                "The server reported an error.",
            }));
          }
        } catch (error) {
          console.error(
            "Could not process server WebSocket message:",
            error,
          );
        }
      };

      socket.onerror = () => {
        setMarketState((previous) => ({
          ...previous,
          serverConnectionStatus:
            "Connection error",
          error:
            "Could not connect to the Node trading server.",
        }));
      };

      socket.onclose = () => {
        socketRef.current = null;

        if (!intentionallyClosed) {
          scheduleReconnect();
        }
      };
    }

    loadInitialSnapshot();
    connect();

    return () => {
      intentionallyClosed = true;
      mountedRef.current = false;

      clearReconnectTimer();

      if (socketRef.current) {
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null;
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setMarketState((previous) => ({
      ...previous,
      candles: [],
      indicators: {},
      signal: null,
      bids: [],
      asks: [],
      trades: [],
      error: "",
      connectionStatus:
        "Changing market...",
    }));

    const socket = socketRef.current;

    if (
      socket &&
      socket.readyState === WebSocket.OPEN
    ) {
      socket.send(
        JSON.stringify({
          type: "market:change",
          payload: {
            symbol,
            timeframe,
          },
        }),
      );

      return;
    }

    async function changeMarketWithRest() {
      try {
        const response = await fetch(
          `${SERVER_HTTP_URL}/api/market/change`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              symbol,
              timeframe,
            }),
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Could not change the server market.",
          );
        }
      } catch (error) {
        setMarketState((previous) => ({
          ...previous,
          error: error.message,
        }));
      }
    }

    changeMarketWithRest();
  }, [symbol, timeframe]);

  return {
    candles: marketState.candles,
    indicators: marketState.indicators,
    signal: marketState.signal,

    price: marketState.price,
    priceDirection:
      marketState.priceDirection,

    bid: marketState.bid,
    ask: marketState.ask,
    spread: marketState.spread,

    bids: marketState.bids,
    asks: marketState.asks,
    trades: marketState.trades,

    priceChangePercent:
      marketState.priceChangePercent,

    high24h: marketState.high24h,
    low24h: marketState.low24h,
    volume24h: marketState.volume24h,
    quoteVolume24h:
      marketState.quoteVolume24h,

    connectionStatus:
      marketState.connectionStatus,

    serverConnectionStatus:
      marketState.serverConnectionStatus,

    updatedAt: marketState.updatedAt,
    error: marketState.error,
  };
}