import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  serverUrl,
} from "../config/server.js";

const DEFAULT_REFRESH_MS =
  5000;

async function readJson(
  response,
) {
  const text =
    await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(
      text,
    );
  } catch {
    throw new Error(
      "The trading-engine server returned invalid JSON.",
    );
  }
}

export default function useServerTradingEngine({
  refreshMs =
    DEFAULT_REFRESH_MS,
} = {}) {
  const [
    engine,
    setEngine,
  ] =
    useState(
      null,
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

  const loadState =
    useCallback(
      async ({
        silent =
          false,
      } = {}) => {
        try {
          if (!silent) {
            setLoading(
              true,
            );
          }

          const response =
            await fetch(
              serverUrl(
                "/api/trading-engine/state",
              ),
            );

          const data =
            await readJson(
              response,
            );

          if (!response.ok) {
            throw new Error(
              data.message ||
                `Could not load server trading engine. Status ${response.status}.`,
            );
          }

          setEngine(
            data.engine ||
              data.state ||
              data.data ||
              null,
          );

          setError(
            "",
          );

          return data;
        } catch (
          requestError
        ) {
          console.error(
            "Server trading-engine state load failed:",
            requestError,
          );

          setError(
            requestError.message ||
              "Could not load server trading engine.",
          );

          return null;
        } finally {
          if (!silent) {
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
      loadState();

      const timer =
        window.setInterval(
          () => {
            loadState({
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
        window.clearInterval(
          timer,
        );
      };
    },
    [
      loadState,
      refreshMs,
    ],
  );

  const saveSettings =
    useCallback(
      async (
        settings,
      ) => {
        try {
          setLoading(
            true,
          );

          setError(
            "",
          );

          const response =
            await fetch(
              serverUrl(
                "/api/trading-engine/settings",
              ),
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify(
                    settings,
                  ),
              },
            );

          const data =
            await readJson(
              response,
            );

          if (!response.ok) {
            throw new Error(
              data.message ||
                `Could not update trading-engine settings. Status ${response.status}.`,
            );
          }

          const nextEngine =
            data.engine ||
            data.state ||
            data.data ||
            engine;

          setEngine(
            nextEngine,
          );

          setError(
            "",
          );

          return {
            success:
              true,

            engine:
              nextEngine,

            ...data,
          };
        } catch (
          requestError
        ) {
          console.error(
            "Trading-engine settings save failed:",
            requestError,
          );

          setError(
            requestError.message ||
              "Could not update trading-engine settings.",
          );

          return {
            success:
              false,

            message:
              requestError.message ||
              "Could not update trading-engine settings.",
          };
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        engine,
      ],
    );

  return {
    engine,

    loading,

    error,

    loadState,

    saveSettings,
  };
}