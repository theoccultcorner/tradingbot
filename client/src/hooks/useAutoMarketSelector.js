import {
  useCallback,
  useEffect,
  useState,
} from "react";

const SERVER_HTTP_URL =
  import.meta.env
    .VITE_SERVER_HTTP_URL ||
  "http://localhost:5000";

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

export default function useAutoMarketSelector() {
  const [
    selector,
    setSelector,
  ] = useState(
    DEFAULT_STATE,
  );

  const [
    loading,
    setLoading,
  ] = useState(
    true,
  );

  const [
    error,
    setError,
  ] = useState(
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
              `${SERVER_HTTP_URL}/api/auto-selector/state`,
            );

          const data =
            await response.json();

          if (
            !response.ok
          ) {
            throw new Error(
              data.message ||
                "Could not load selector state.",
            );
          }

          setSelector(
            data.selector,
          );

          setError(
            "",
          );
        } catch (
          requestError
        ) {
          setError(
            requestError.message,
          );
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

  async function saveSettings(
    nextSettings,
  ) {
    try {
      setLoading(
        true,
      );

      const response =
        await fetch(
          `${SERVER_HTTP_URL}/api/auto-selector/settings`,
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
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.message ||
            "Could not update selector settings.",
        );
      }

      setSelector(
        data.selector,
      );

      setError(
        "",
      );

      return {
        success:
          true,
      };
    } catch (
      requestError
    ) {
      setError(
        requestError.message,
      );

      return {
        success:
          false,

        message:
          requestError.message,
      };
    } finally {
      setLoading(
        false,
      );
    }
  }

  async function runNow() {
    try {
      setLoading(
        true,
      );

      const response =
        await fetch(
          `${SERVER_HTTP_URL}/api/auto-selector/run`,
          {
            method:
              "POST",
          },
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.message ||
            "Automatic selection failed.",
        );
      }

      setSelector(
        data.state,
      );

      setError(
        "",
      );

      return data;
    } catch (
      requestError
    ) {
      setError(
        requestError.message,
      );

      return null;
    } finally {
      setLoading(
        false,
      );
    }
  }

  return {
    selector,
    loading,
    error,
    loadState,
    saveSettings,
    runNow,
  };
}