import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const SERVER_HTTP_URL =
  import.meta.env.VITE_SERVER_HTTP_URL ||
  "http://localhost:5000";

export default function useFirestoreSettings({
  type,
  defaults,
  forceDisabledFields = {},
}) {
  const [settings, setSettingsState] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const saveTimerRef = useRef(null);
  const initializedRef = useRef(false);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${SERVER_HTTP_URL}/api/settings/${type}`,
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not load settings.",
        );
      }

      setSettingsState({
        ...defaults,
        ...(data.settings || {}),
        ...forceDisabledFields,
      });
    } catch (requestError) {
      console.error(`${type} settings load failed:`, requestError);
      setError(requestError.message);
      setSettingsState({
        ...defaults,
        ...forceDisabledFields,
      });
    } finally {
      initializedRef.current = true;
      setLoading(false);
    }
  }, [defaults, forceDisabledFields, type]);

  useEffect(() => {
    loadSettings();

    return () => {
      clearTimeout(saveTimerRef.current);
    };
  }, [loadSettings]);

  const saveSettings = useCallback(
    async (nextSettings) => {
      try {
        setError("");

        const response = await fetch(
          `${SERVER_HTTP_URL}/api/settings/${type}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(nextSettings),
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Could not save settings.",
          );
        }

        return {
          success: true,
          settings: data.settings,
        };
      } catch (requestError) {
        console.error(`${type} settings save failed:`, requestError);
        setError(requestError.message);

        return {
          success: false,
          message: requestError.message,
        };
      }
    },
    [type],
  );

  const setSettings = useCallback(
    (updater) => {
      setSettingsState((previous) => {
        const next =
          typeof updater === "function"
            ? updater(previous)
            : {
                ...previous,
                ...updater,
              };

        if (initializedRef.current) {
          clearTimeout(saveTimerRef.current);

          saveTimerRef.current = setTimeout(() => {
            saveSettings(next);
          }, 500);
        }

        return next;
      });
    },
    [saveSettings],
  );

  return {
    settings,
    setSettings,
    loading,
    error,
    reload: loadSettings,
    saveNow: saveSettings,
  };
}
