import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  serverUrl,
} from "../config/server.js";

const DEFAULT_STATE = {
  settings: {
    enabled: false,
    timeframe: "15m",
    minimumScore: 60,
    minimumConfidence: 60,
    scanIntervalMinutes: 5,
    symbols: [],
  },

  running: false,
  lastScan: null,
  lastSelection: null,
};

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
      "The selector server returned invalid JSON.",
    );
  }
}

export default function useAutoMarketSelector() {
  const [
    selector,
    setSelector,
  ] =
    useState(
      DEFAULT_STATE,
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
      async () => {
        try {
          setLoading(
            true,
          );

          const response =
            await fetch(
              serverUrl(
                "/api/auto-selector/state",
              ),
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
                `Could not load selector state. Status ${response.status}.`,
            );
          }

          setSelector(
            data.selector ||
              data.state ||
              DEFAULT_STATE,
          );

          setError(
            "",
          );

          return data;
        } catch (
          requestError
        ) {
          setError(
            requestError.message ||
              "Could not load selector state.",
          );

          return null;
        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
    );

  useEffect(
    () => {
      loadState();
    },
    [
      loadState,
    ],
  );

  const saveSettings =
    useCallback(
      async (
        nextSettings,
      ) => {
        try {
          setLoading(
            true,
          );

          const response =
            await fetch(
              serverUrl(
                "/api/auto-selector/settings",
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
                    nextSettings,
                  ),
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
              data.message ||
                `Could not update selector settings. Status ${response.status}.`,
            );
          }

          const nextSelector =
            data.selector ||
            data.state ||
            {
              ...selector,

              settings: {
                ...selector.settings,
                ...nextSettings,
              },
            };

          setSelector(
            nextSelector,
          );

          setError(
            "",
          );

          return {
            success:
              true,

            selector:
              nextSelector,

            ...data,
          };
        } catch (
          requestError
        ) {
          setError(
            requestError.message ||
              "Could not update selector settings.",
          );

          return {
            success:
              false,

            message:
              requestError.message ||
              "Could not update selector settings.",
          };
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        selector,
      ],
    );

  const runNow =
    useCallback(
      async () => {
        try {
          setLoading(
            true,
          );

          const response =
            await fetch(
              serverUrl(
                "/api/auto-selector/run",
              ),
              {
                method:
                  "POST",
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
              data.message ||
                `Automatic selection failed. Status ${response.status}.`,
            );
          }

          const nextSelector =
            data.state ||
            data.selector ||
            DEFAULT_STATE;

          setSelector(
            nextSelector,
          );

          setError(
            "",
          );

          return {
            success:
              true,

            selector:
              nextSelector,

            ...data,
          };
        } catch (
          requestError
        ) {
          setError(
            requestError.message ||
              "Automatic selection failed.",
          );

          return {
            success:
              false,

            message:
              requestError.message ||
              "Automatic selection failed.",
          };
        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
    );

  return {
    selector,

    loading,

    error,

    loadState,

    saveSettings,

    runNow,
  };
}