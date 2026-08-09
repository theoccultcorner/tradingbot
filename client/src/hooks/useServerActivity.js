import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  serverUrl,
} from "../config/server.js";

const DEFAULT_REFRESH_MS =
  15000;

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
      "The activity server returned invalid JSON.",
    );
  }
}

export default function useServerActivity({
  limit = 200,
  refreshMs = DEFAULT_REFRESH_MS,
} = {}) {
  const [
    activity,
    setActivity,
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

  const loadActivity =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        try {
          if (!silent) {
            setLoading(
              true,
            );
          }

          const query =
            new URLSearchParams({
              limit:
                String(
                  limit,
                ),
            });

          const response =
            await fetch(
              serverUrl(
                `/api/activity?${query.toString()}`,
              ),
            );

          const data =
            await readJson(
              response,
            );

          if (!response.ok) {
            throw new Error(
              data.message ||
                `Could not load activity. Status ${response.status}.`,
            );
          }

          setActivity(
            Array.isArray(
              data.activity,
            )
              ? data.activity
              : [],
          );

          setError(
            "",
          );

          return data;
        } catch (
          requestError
        ) {
          console.error(
            "Server activity load failed:",
            requestError,
          );

          setError(
            requestError.message ||
              "Could not load activity.",
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
      [
        limit,
      ],
    );

  useEffect(
    () => {
      loadActivity();

      const timer =
        window.setInterval(
          () => {
            loadActivity({
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
      loadActivity,
      refreshMs,
    ],
  );

  return {
    activity,

    loading,

    error,

    loadActivity,
  };
}