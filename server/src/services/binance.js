import axios from "axios";
import crypto from "node:crypto";

const baseURL =
  process.env.BINANCE_BASE_URL || "https://api.binance.us";

const apiKey = process.env.BINANCE_API_KEY;
const apiSecret = process.env.BINANCE_API_SECRET;

const binanceClient = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    "X-MBX-APIKEY": apiKey || "",
  },
});

function createSignature(queryString) {
  if (!apiSecret) {
    throw new Error("BINANCE_API_SECRET is missing.");
  }

  return crypto
    .createHmac("sha256", apiSecret)
    .update(queryString)
    .digest("hex");
}

async function signedRequest(method, endpoint, parameters = {}) {
  if (!apiKey || !apiSecret) {
    throw new Error("Binance API credentials are missing.");
  }

  const params = {
    ...parameters,
    timestamp: Date.now(),
    recvWindow: 5000,
  };

  const queryString = new URLSearchParams(params).toString();
  const signature = createSignature(queryString);

  const response = await binanceClient.request({
    method,
    url: `${endpoint}?${queryString}&signature=${signature}`,
  });

  return response.data;
}

export async function getServerTime() {
  const response = await binanceClient.get("/api/v3/time");
  return response.data;
}

export async function getPrice(symbol = "BTCUSD") {
  const normalizedSymbol = symbol.toUpperCase();

  const response = await binanceClient.get("/api/v3/ticker/price", {
    params: {
      symbol: normalizedSymbol,
    },
  });

  return response.data;
}

export async function getAccount() {
  return signedRequest("GET", "/api/v3/account");
}

export async function createMarketOrder({
  symbol,
  side,
  quantity,
}) {
  return signedRequest("POST", "/api/v3/order", {
    symbol: symbol.toUpperCase(),
    side: side.toUpperCase(),
    type: "MARKET",
    quantity,
  });
}