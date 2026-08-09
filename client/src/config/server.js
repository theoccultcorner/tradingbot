const rawHttpUrl =
  import.meta.env
    .VITE_SERVER_HTTP_URL ||
  import.meta.env
    .VITE_API_URL ||
  "http://localhost:5000";

export const SERVER_HTTP_URL =
  String(
    rawHttpUrl,
  )
    .trim()
    .replace(
      /\/+$/,
      "",
    );

const configuredSocketUrl =
  import.meta.env
    .VITE_SERVER_SOCKET_URL;

function buildSocketUrl() {
  if (
    configuredSocketUrl
  ) {
    return String(
      configuredSocketUrl,
    )
      .trim()
      .replace(
        /\/+$/,
        "",
      );
  }

  try {
    const url =
      new URL(
        SERVER_HTTP_URL,
      );

    const protocol =
      url.protocol ===
      "https:"
        ? "wss:"
        : "ws:";

    return `${protocol}//${url.host}/ws`;
  } catch (
    error
  ) {
    console.error(
      "Could not build server WebSocket URL:",
      error,
    );

    return "ws://localhost:5000/ws";
  }
}

export const SERVER_SOCKET_URL =
  buildSocketUrl();

export function serverUrl(
  path = "",
) {
  const normalizedPath =
    String(
      path ||
        "",
    ).trim();

  if (
    !normalizedPath
  ) {
    return SERVER_HTTP_URL;
  }

  return `${SERVER_HTTP_URL}${
    normalizedPath.startsWith(
      "/",
    )
      ? normalizedPath
      : `/${normalizedPath}`
  }`;
}