import { useCallback, useEffect, useState } from "react";

const SERVER_HTTP_URL =
  import.meta.env.VITE_SERVER_HTTP_URL || "http://localhost:5000";

export default function useServerActivity() {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadActivity = useCallback(async () => {
    try {
      const response = await fetch(`${SERVER_HTTP_URL}/api/activity?limit=200`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not load activity.");
      setActivity(data.activity || []);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivity();
    const timer = setInterval(loadActivity, 15000);
    return () => clearInterval(timer);
  }, [loadActivity]);

  return { activity, loading, error, loadActivity };
}
