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
      "The wallet server returned invalid JSON.",
    );
  }
}

export default function useWallet({
  refreshMs =
    DEFAULT_REFRESH_MS,
} = {}) {
  const [
    wallet,
    setWallet,
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

  const loadWallet =
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
                "/api/wallet",
              ),
            );

          const data =
            await readJson(
              response,
            );

          if (!response.ok) {
            throw new Error(
              data.message ||
                `Could not load wallet. Status ${response.status}.`,
            );
          }

          setWallet(
            data.wallet ||
              data.data ||
              data ||
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
            "Wallet load failed:",
            requestError,
          );

          setError(
            requestError.message ||
              "Could not load wallet.",
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
      loadWallet();

      const timer =
        window.setInterval(
          () => {
            loadWallet({
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
      loadWallet,
      refreshMs,
    ],
  );

  return {
    wallet,

    loading,

    error,

    loadWallet,
  };
}