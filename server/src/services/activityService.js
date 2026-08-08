import {
  database,
} from "../config/database.js";

function safeLimitValue(
  limit,
) {
  return Math.min(
    Math.max(
      Number(limit) || 100,
      1,
    ),
    500,
  );
}

function loadRiskEvents(
  limit,
) {
  const rows =
    database
      .prepare(
        `
          SELECT *
          FROM risk_events
          ORDER BY timestamp DESC
          LIMIT ?
        `,
      )
      .all(
        limit,
      );

  return rows.map(
    (row) => ({
      id:
        row.id,

      type:
        "RISK_EVENT",

      eventType:
        row.type,

      symbol:
        row.symbol,

      timeframe:
        row.timeframe ||
        null,

      price:
        row.price ===
        null
          ? null
          : Number(
              row.price,
            ),

      quantity:
        row.quantity ===
        null
          ? null
          : Number(
              row.quantity,
            ),

      executed:
        Boolean(
          row.executed,
        ),

      orderKey:
        row.order_key ||
        null,

      message:
        row.message ||
        "",

      timestamp:
        Number(
          row.timestamp,
        ),
    }),
  );
}

function loadOrderExecutions(
  limit,
) {
  const rows =
    database
      .prepare(
        `
          SELECT *
          FROM order_executions
          ORDER BY updated_at DESC
          LIMIT ?
        `,
      )
      .all(
        limit,
      );

  return rows.map(
    (row) => {
      let order =
        null;

      let metadata =
        null;

      let result =
        null;

      try {
        order =
          row.order_json
            ? JSON.parse(
                row.order_json,
              )
            : null;
      } catch {
        order =
          null;
      }

      try {
        metadata =
          row.metadata_json
            ? JSON.parse(
                row.metadata_json,
              )
            : null;
      } catch {
        metadata =
          null;
      }

      try {
        result =
          row.result_json
            ? JSON.parse(
                row.result_json,
              )
            : null;
      } catch {
        result =
          null;
      }

      return {
        id:
          row.order_key,

        type:
          "ORDER_EXECUTION",

        orderKey:
          row.order_key,

        status:
          row.status,

        order,

        metadata,

        result,

        error:
          row.error ||
          null,

        startedAt:
          row.started_at ||
          null,

        completedAt:
          row.completed_at ||
          null,

        failedAt:
          row.failed_at ||
          null,

        timestamp:
          Number(
            row.updated_at ||
              row.completed_at ||
              row.failed_at ||
              row.started_at ||
              Date.now(),
          ),
      };
    },
  );
}

/*
 * Routine decisions are no longer stored
 * permanently.
 *
 * They live in the trading engine's current
 * in-memory/local runtime state instead.
 *
 * For now the Activity Center returns an
 * empty decision history instead of querying
 * Firestore.
 */
function loadDecisions() {
  return [];
}

export async function getServerActivity({
  limit = 100,
} = {}) {
  const safeLimit =
    safeLimitValue(
      limit,
    );

  const decisions =
    loadDecisions();

  const riskEvents =
    loadRiskEvents(
      safeLimit,
    );

  const executions =
    loadOrderExecutions(
      safeLimit,
    );

  const activity = [
    ...decisions,
    ...riskEvents,
    ...executions,
  ]
    .sort(
      (
        left,
        right,
      ) =>
        Number(
          right.timestamp,
        ) -
        Number(
          left.timestamp,
        ),
    )
    .slice(
      0,
      safeLimit,
    );

  return {
    activity,

    decisions,

    riskEvents,

    executions,

    storage:
      "sqlite",
  };
}