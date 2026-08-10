import Database from "better-sqlite3";

import fs from "node:fs";

import path from "node:path";

import {
  fileURLToPath,
} from "node:url";

const currentFile =
  fileURLToPath(
    import.meta.url,
  );

const currentDirectory =
  path.dirname(
    currentFile,
  );

/*
 * Render persistent disk:
 *
 *   /var/data
 *
 * Local development:
 *
 *   server/data
 *
 * You can also override this with:
 *
 *   DATABASE_DIR=/some/path
 */
const isRender =
  Boolean(
    process.env.RENDER,
  );

const dataDirectory =
  process.env.DATABASE_DIR
    ? path.resolve(
        process.env.DATABASE_DIR,
      )
    : isRender
      ? "/var/data"
      : path.resolve(
          currentDirectory,
          "../../data",
        );

fs.mkdirSync(
  dataDirectory,
  {
    recursive:
      true,
  },
);

const databasePath =
  path.join(
    dataDirectory,
    "tradingbot.sqlite",
  );

export const database =
  new Database(
    databasePath,
  );

/*
 * WAL is safe here because the .sqlite,
 * .sqlite-wal and .sqlite-shm files will
 * all live inside the same persistent
 * directory.
 */
database.pragma(
  "journal_mode = WAL",
);

database.pragma(
  "foreign_keys = ON",
);

database.exec(`
  CREATE TABLE IF NOT EXISTS portfolio (
    id TEXT PRIMARY KEY,
    starting_cash REAL NOT NULL,
    cash REAL NOT NULL,
    realized_profit REAL NOT NULL DEFAULT 0,
    fee_rate REAL NOT NULL DEFAULT 0.001,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS positions (
    symbol TEXT PRIMARY KEY,
    quantity REAL NOT NULL,
    average_entry_price REAL NOT NULL,
    total_cost REAL NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    timeframe TEXT,
    side TEXT NOT NULL,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    gross_value REAL NOT NULL,
    fee REAL NOT NULL,
    realized_profit REAL NOT NULL DEFAULT 0,
    source TEXT,
    timestamp INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS executed_orders (
    order_key TEXT PRIMARY KEY,
    trade_id TEXT,
    timestamp INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS risk_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    symbol TEXT NOT NULL,
    timeframe TEXT,
    price REAL,
    quantity REAL,
    executed INTEGER NOT NULL DEFAULT 0,
    order_key TEXT,
    message TEXT,
    timestamp INTEGER NOT NULL
  );
`);

const existingPortfolio =
  database
    .prepare(
      `
        SELECT id
        FROM portfolio
        WHERE id = ?
      `,
    )
    .get(
      "paper",
    );

/*
 * IMPORTANT:
 *
 * Only create the paper portfolio when
 * it genuinely does not exist.
 *
 * Existing balances are NEVER reset here.
 */
if (
  !existingPortfolio
) {
  database
    .prepare(
      `
        INSERT INTO portfolio (
          id,
          starting_cash,
          cash,
          realized_profit,
          fee_rate,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      "paper",
      300,
      300,
      0,
      0.001,
      Date.now(),
    );

  console.log(
    "Created new paper portfolio with $300 starting cash.",
  );
}

console.log(
  `SQLite database ready: ${databasePath}`,
);

console.log(
  `SQLite storage: ${
    isRender
      ? "persistent Render disk"
      : "local development storage"
  }`,
);