import {
  useCallback,
  useEffect,
  useState,
} from "react";

const SERVER_HTTP_URL =
  import.meta.env
    .VITE_SERVER_HTTP_URL ||
  "http://localhost:5000";

export default function useWallet() {
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
      async () => {
        try {
          const response =
            await fetch(
              `${SERVER_HTTP_URL}/api/wallet`,
            );

          const data =
            await response.json();

          if (
            !response.ok
          ) {
            throw new Error(
              data.message ||
                "Could not load wallet.",
            );
          }

          setWallet(
            data.wallet,
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
      loadWallet();

      /*
       * Refresh wallet valuation every
       * five seconds.
       */
      const timer =
        setInterval(
          loadWallet,
          5000,
        );

      return () => {
        clearInterval(
          timer,
        );
      };
    },
    [
      loadWallet,
    ],
  );

  return {
    wallet,
    loading,
    error,
    loadWallet,
  };
}