import {
  useCallback,
  useEffect,
  useState,
} from "react";

const SERVER_HTTP_URL =
  import.meta.env
    .VITE_SERVER_HTTP_URL ||
  "http://localhost:5000";

export default function useServerTradingEngine() {
  const [
    engine,
    setEngine,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const loadState =
    useCallback(async () => {
      try {
        setLoading(true);

        const response =
          await fetch(
            `${SERVER_HTTP_URL}/api/trading-engine/state`,
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Could not load server trading engine.",
          );
        }

        setEngine(
          data.engine,
        );

        setError("");
      } catch (
        requestError
      ) {
        setError(
          requestError.message,
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    loadState();

    const timer =
      setInterval(
        loadState,
        5000,
      );

    return () =>
      clearInterval(
        timer,
      );
  }, [loadState]);

  async function saveSettings(
    settings,
  ) {
    try {
      setLoading(true);

      const response =
        await fetch(
          `${SERVER_HTTP_URL}/api/trading-engine/settings`,
          {
            method: "POST",

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
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not update trading-engine settings.",
        );
      }

      setEngine(
        data.engine,
      );

      setError("");

      return {
        success: true,
      };
    } catch (
      requestError
    ) {
      setError(
        requestError.message,
      );

      return {
        success: false,
        message:
          requestError.message,
      };
    } finally {
      setLoading(false);
    }
  }

  return {
    engine,
    loading,
    error,
    loadState,
    saveSettings,
  };
}
