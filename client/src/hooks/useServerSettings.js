import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  serverUrl,
} from "../config/server.js";

export default function useServerSettings({
  type,
  defaults,
  forceDisabledFields = {},
}) {
  const [
    settings,
    setSettingsState,
  ] =
    useState(
      defaults,
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

  const saveTimerRef =
    useRef(
      null,
    );

  const initializedRef =
    useRef(
      false,
    );

  const loadSettings =
    useCallback(
      async () => {
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
                `/api/settings/${type}`,
              ),
            );

          const text =
            await response.text();

          let data =
            {};

          if (
            text
          ) {
            try {
              data =
                JSON.parse(
                  text,
                );
            } catch {
              throw new Error(
                "The settings server returned invalid JSON.",
              );
            }
          }

          if (
            !response.ok
          ) {
            throw new Error(
              data.message ||
                `Could not load ${type} settings.`,
            );
          }

          setSettingsState({
            ...defaults,

            ...(
              data.settings ||
              {}
            ),

            ...forceDisabledFields,
          });
        } catch (
          requestError
        ) {
          console.error(
            `${type} settings load failed:`,
            requestError,
          );

          setError(
            requestError.message ||
              "Could not load settings.",
          );

          setSettingsState({
            ...defaults,
            ...forceDisabledFields,
          });
        } finally {
          initializedRef.current =
            true;

          setLoading(
            false,
          );
        }
      },
      [
        defaults,
        forceDisabledFields,
        type,
      ],
    );

  useEffect(
    () => {
      loadSettings();

      return () => {
        if (
          saveTimerRef.current
        ) {
          clearTimeout(
            saveTimerRef.current,
          );
        }
      };
    },
    [
      loadSettings,
    ],
  );

  const saveSettings =
    useCallback(
      async (
        nextSettings,
      ) => {
        try {
          setError(
            "",
          );

          const payload = {
            ...nextSettings,
            ...forceDisabledFields,
          };

          const response =
            await fetch(
              serverUrl(
                `/api/settings/${type}`,
              ),
              {
                method:
                  "PUT",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify(
                    payload,
                  ),
              },
            );

          const text =
            await response.text();

          let data =
            {};

          if (
            text
          ) {
            try {
              data =
                JSON.parse(
                  text,
                );
            } catch {
              throw new Error(
                "The settings server returned invalid JSON.",
              );
            }
          }

          if (
            !response.ok
          ) {
            throw new Error(
              data.message ||
                `Could not save ${type} settings.`,
            );
          }

          const savedSettings = {
            ...defaults,

            ...(
              data.settings ||
              payload
            ),

            ...forceDisabledFields,
          };

          setSettingsState(
            savedSettings,
          );

          return {
            success:
              true,

            settings:
              savedSettings,
          };
        } catch (
          requestError
        ) {
          console.error(
            `${type} settings save failed:`,
            requestError,
          );

          setError(
            requestError.message ||
              "Could not save settings.",
          );

          return {
            success:
              false,

            message:
              requestError.message ||
              "Could not save settings.",
          };
        }
      },
      [
        defaults,
        forceDisabledFields,
        type,
      ],
    );

  const setSettings =
    useCallback(
      (
        updater,
      ) => {
        setSettingsState(
          (
            previous,
          ) => {
            const next =
              typeof updater ===
              "function"
                ? updater(
                    previous,
                  )
                : {
                    ...previous,
                    ...updater,
                  };

            const normalizedNext = {
              ...next,
              ...forceDisabledFields,
            };

            if (
              initializedRef.current
            ) {
              if (
                saveTimerRef.current
              ) {
                clearTimeout(
                  saveTimerRef.current,
                );
              }

              saveTimerRef.current =
                setTimeout(
                  () => {
                    saveSettings(
                      normalizedNext,
                    );
                  },
                  500,
                );
            }

            return normalizedNext;
          },
        );
      },
      [
        forceDisabledFields,
        saveSettings,
      ],
    );

  return {
    settings,

    setSettings,

    loading,

    error,

    reload:
      loadSettings,

    saveNow:
      saveSettings,
  };
}