import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  serverUrl,
} from "../config/server.js";

const DEFAULT_REFRESH_MS =
  30000;

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
      "The performance server returned invalid JSON.",
    );
  }
}

export default function useServerPerformance({
  refreshMs =
    DEFAULT_REFRESH_MS,
} = {}) {
  const [
    summary,
    setSummary,
  ] =
    useState(
      null,
    );

  const [
    history,
    setHistory,
  ] =
    useState(
      [],
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

  const loadPerformance =
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

          const [
            summaryResponse,
            equityResponse,
          ] =
            await Promise.all([
              fetch(
                serverUrl(
                  "/api/performance/summary",
                ),
              ),

              fetch(
                serverUrl(
                  "/api/performance/equity?limit=500",
                ),
              ),
            ]);

          const [
            summaryData,
            equityData,
          ] =
            await Promise.all([
              readJson(
                summaryResponse,
              ),

              readJson(
                equityResponse,
              ),
            ]);

          if (
            !summaryResponse.ok
          ) {
            throw new Error(
              summaryData.message ||
                `Could not load performance summary. Status ${summaryResponse.status}.`,
            );
          }

          if (
            !equityResponse.ok
          ) {
            throw new Error(
              equityData.message ||
                `Could not load equity history. Status ${equityResponse.status}.`,
            );
          }

          setSummary(
            summaryData.summary ||
              summaryData.data ||
              null,
          );

          setHistory(
            Array.isArray(
              equityData.history,
            )
              ? equityData.history
              : [],
          );

          setError(
            "",
          );

          return {
            summary:
              summaryData.summary ||
              summaryData.data ||
              null,

            history:
              Array.isArray(
                equityData.history,
              )
                ? equityData.history
                : [],
          };
        } catch (
          requestError
        ) {
          console.error(
            "Server performance load failed:",
            requestError,
          );

          setError(
            requestError.message ||
              "Could not load server performance.",
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
      loadPerformance();

      const timer =
        window.setInterval(
          () => {
            loadPerformance({
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
      loadPerformance,
      refreshMs,
    ],
  );

  function downloadCsv() {
    window.open(
      serverUrl(
        "/api/performance/trades.csv",
      ),
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