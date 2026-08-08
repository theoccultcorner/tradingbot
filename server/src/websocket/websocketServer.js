import {
  WebSocket,
  WebSocketServer,
} from "ws";

export function attachWebSocketServer({
  httpServer,
  path = "/ws",
  marketService,
  getLatestMarketState,
}) {
  const clients = new Set();

  const websocketServer = new WebSocketServer({
    server: httpServer,
    path,
  });

  function send(socket, message) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  function broadcast(message) {
    for (const client of clients) {
      send(client, message);
    }
  }

  websocketServer.on("connection", (socket) => {
    clients.add(socket);

    console.log(
      `Dashboard connected. Clients: ${clients.size}`,
    );

    const latestMarketState =
      getLatestMarketState();

    if (latestMarketState) {
      send(socket, {
        type: "market:update",
        payload: latestMarketState,
      });
    }

    socket.on("message", async (rawMessage) => {
      try {
        const message = JSON.parse(
          rawMessage.toString(),
        );

        if (message.type === "market:change") {
          await marketService.changeMarket({
            symbol:
              message.payload?.symbol || "SOLUSD",
            timeframe:
              message.payload?.timeframe || "1m",
          });

          return;
        }

        send(socket, {
          type: "server:error",
          payload: {
            message:
              "Unsupported WebSocket message type.",
          },
        });
      } catch (error) {
        send(socket, {
          type: "server:error",
          payload: {
            message: error.message,
          },
        });
      }
    });

    socket.on("close", () => {
      clients.delete(socket);

      console.log(
        `Dashboard disconnected. Clients: ${clients.size}`,
      );
    });

    socket.on("error", (error) => {
      console.error(
        "Dashboard WebSocket error:",
        error,
      );
    });
  });

  return {
    broadcast,

    close() {
      for (const client of clients) {
        try {
          client.close();
        } catch {
          // Ignore shutdown close errors.
        }
      }

      clients.clear();
      websocketServer.close();
    },
  };
}
