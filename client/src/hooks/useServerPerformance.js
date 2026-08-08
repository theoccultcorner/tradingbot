import {
  useCallback,
  useEffect,
  useState,
} from "react";

const SERVER_HTTP_URL =
  import.meta.env
    .VITE_SERVER_HTTP_URL ||
  "http://localhost:5000";

export default function useServerPerformance() {
  const [
    summary,
    setSummary,
  ] = useState(null);

  const [
    history,
    setHistory,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const loadPerformance =
    useCallback(async () => {
      try {
        setLoading(true);

        const [
          summaryResponse,
          equityResponse,
        ] =
          await Promise.all([
            fetch(
              `${SERVER_HTTP_URL}/api/performance/summary`,
            ),

            fetch(
              `${SERVER_HTTP_URL}/api/performance/equity?limit=500`,
            ),
          ]);

        const summaryData =
          await summaryResponse.json();

        const equityData =
          await equityResponse.json();

        if (
          !summaryResponse.ok
        ) {
          throw new Error(
            summaryData.message ||
              "Could not load performance summary.",
          );
        }

        if (
          !equityResponse.ok
        ) {
          throw new Error(
            equityData.message ||
              "Could not load equity history.",
          );
        }

        setSummary(
          summaryData.summary,
        );

        setHistory(
          equityData.history ||
            [],
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
    loadPerformance();

    const timer =
      setInterval(
        loadPerformance,
        30000,
      );

    return () =>
      clearInterval(
        timer,
      );
  }, [loadPerformance]);

  function downloadCsv() {
    window.open(
      `${SERVER_HTTP_URL}/api/performance/trades.csv`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return {
    summary,
    history,
    loading,
    error,
    loadPerformance,
    downloadCsv,
  };
}
