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

  /*
   * Keep the latest objects in refs.
   *
   * This prevents React from treating newly
   * created object instances as dependency
   * changes on every render.
   */
  const defaultsRef =
    useRef(
      defaults,
    );

  const forceDisabledFieldsRef =
    useRef(
      forceDisabledFields,
    );

  useEffect(
    () => {
      defaultsRef.current =
        defaults;
    },
    [
      defaults,
    ],
  );

  useEffect(
    () => {
      forceDisabledFieldsRef.current =
        forceDisabledFields;
    },
    [
      forceDisabledFields,
    ],
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

          const normalizedSettings = {
            ...defaultsRef.current,

            ...(
              data.settings ||
              {}
            ),

            ...forceDisabledFieldsRef.current,
          };

          setSettingsState(
            normalizedSettings,
          );

          setError(
            "",
          );

          initializedRef.current =
            true;

          return {
            success:
              true,

            settings:
              normalizedSettings,
          };
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

          const fallbackSettings = {
            ...defaultsRef.current,

            ...forceDisabledFieldsRef.current,
          };

          setSettingsState(
            fallbackSettings,
          );

          initializedRef.current =
            true;

          return {
            success:
              false,

            message:
              requestError.message ||
              "Could not load settings.",
          };
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        type,
      ],
    );

  /*
   * Load once when the settings TYPE changes.
   *
   * This is the important fix that stops
   * autoTrader / riskManager from firing
   * endless GET requests.
   */
  useEffect(
    () => {
      initializedRef.current =
        false;

      loadSettings();

      return () => {
        if (
          saveTimerRef.current
        ) {
          clearTimeout(
            saveTimerRef.current,
          );

          saveTimerRef.current =
            null;
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

            ...forceDisabledFieldsRef.current,
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
            ...defaultsRef.current,

            ...(
              data.settings ||
              payload
            ),

            ...forceDisabledFieldsRef.current,
          };

          setSettingsState(
            savedSettings,
          );

          setError(
            "",
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

              ...forceDisabledFieldsRef.current,
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
        saveSettings,
      ],
    );

  const saveNow =
    useCallback(
      async (
        nextSettings,
      ) => {
        if (
          saveTimerRef.current
        ) {
          clearTimeout(
            saveTimerRef.current,
          );

          saveTimerRef.current =
            null;
        }

        return saveSettings(
          nextSettings,
        );
      },
      [
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

    saveNow,
  };
}