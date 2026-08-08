import {
  database,
} from "../config/database.js";

import {
  placePaperOrder,
} from "./paperPortfolioService.js";

database.exec(`
  CREATE TABLE IF NOT EXISTS order_executions (
    order_key TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    order_json TEXT,
    metadata_json TEXT,
    result_json TEXT,
    error TEXT,
    started_at INTEGER,
    completed_at INTEGER,
    failed_at INTEGER,
    updated_at INTEGER NOT NULL
  );
`);

function normalizeOrderKey(
  orderKey,
) {
  const normalized =
    String(
      orderKey ||
        "",
    )
      .trim()
      .replace(
        /[^a-zA-Z0-9_-]/g,
        "_",
      );

  if (!normalized) {
    throw new Error(
      "A valid order key is required.",
    );
  }

  return normalized;
}

function parseJson(
  value,
  fallback = null,
) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(
      value,
    );
  } catch {
    return fallback;
  }
}

function getExistingExecution(
  orderKey,
) {
  return database
    .prepare(
      `
        SELECT *
        FROM order_executions
        WHERE order_key = ?
      `,
    )
    .get(
      orderKey,
    );
}

export async function executeIdempotentPaperOrder({
  orderKey,
  order,
  metadata = {},
}) {
  const safeOrderKey =
    normalizeOrderKey(
      orderKey,
    );

  const existing =
    getExistingExecution(
      safeOrderKey,
    );

  if (existing) {
    const existingResult =
      parseJson(
        existing
          .result_json,
        null,
      );

    if (
      existing.status ===
      "COMPLETED"
    ) {
      return {
        success:
          Boolean(
            existingResult
              ?.success,
          ),

        duplicate:
          true,

        message:
          existingResult
            ?.message ||
          "This order was already processed.",

        result:
          existingResult,

        orderKey:
          safeOrderKey,
      };
    }

    if (
      existing.status ===
      "PROCESSING"
    ) {
      return {
        success:
          false,

        duplicate:
          true,

        message:
          "This order is already being processed.",

        orderKey:
          safeOrderKey,
      };
    }

    if (
      existing.status ===
      "FAILED"
    ) {
      return {
        success:
          false,

        duplicate:
          true,

        message:
          existing.error ||
          "This order previously failed.",

        orderKey:
          safeOrderKey,
      };
    }
  }

  const timestamp =
    Date.now();

  /*
   * Atomically claim this order key.
   */
  const claimOrder =
    database.transaction(
      () => {
        const current =
          getExistingExecution(
            safeOrderKey,
          );

        if (current) {
          return false;
        }

        database
          .prepare(
            `
              INSERT INTO order_executions (
                order_key,
                status,
                order_json,
                metadata_json,
                started_at,
                updated_at
              )
              VALUES (
                ?, ?, ?, ?, ?, ?
              )
            `,
          )
          .run(
            safeOrderKey,
            "PROCESSING",
            JSON.stringify(
              order ||
                {},
            ),
            JSON.stringify(
              metadata ||
                {},
            ),
            timestamp,
            timestamp,
          );

        return true;
      },
    );

  const claimed =
    claimOrder();

  if (!claimed) {
    const current =
      getExistingExecution(
        safeOrderKey,
      );

    const result =
      parseJson(
        current
          ?.result_json,
        null,
      );

    return {
      success:
        Boolean(
          result?.success,
        ),

      duplicate:
        true,

      message:
        result?.message ||
        "This order is already being processed.",

      result,

      orderKey:
        safeOrderKey,
    };
  }

  try {
    /*
     * Metadata is passed into the portfolio
     * service so source/timeframe information
     * is saved with the executed trade.
     */
    const result =
      await placePaperOrder({
        ...order,

        metadata,
      });

    database
      .prepare(
        `
          UPDATE order_executions
          SET
            status = ?,
            result_json = ?,
            completed_at = ?,
            updated_at = ?
          WHERE order_key = ?
        `,
      )
      .run(
        "COMPLETED",
        JSON.stringify(
          result,
        ),
        Date.now(),
        Date.now(),
        safeOrderKey,
      );

    return {
      ...result,

      duplicate:
        false,

      orderKey:
        safeOrderKey,
    };
  } catch (error) {
    database
      .prepare(
        `
          UPDATE order_executions
          SET
            status = ?,
            error = ?,
            failed_at = ?,
            updated_at = ?
          WHERE order_key = ?
        `,
      )
      .run(
        "FAILED",

        error.message ||
          "The order failed.",

        Date.now(),

        Date.now(),

        safeOrderKey,
      );

    throw error;
  }
}