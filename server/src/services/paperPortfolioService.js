import crypto from "node:crypto";

import {
  database,
} from "../config/database.js";

const DEFAULT_STARTING_CASH =
  300;

const DEFAULT_FEE_RATE =
  0.001;

function round(
  value,
  decimals = 8,
) {
  const multiplier =
    10 ** decimals;

  return (
    Math.round(
      (
        Number(value) +
        Number.EPSILON
      ) *
        multiplier,
    ) /
    multiplier
  );
}

function normalizeSymbol(
  symbol,
) {
  const normalized =
    String(
      symbol || "",
    )
      .trim()
      .toUpperCase();

  if (
    !/^[A-Z0-9]{5,20}$/.test(
      normalized,
    )
  ) {
    throw new Error(
      "A valid trading symbol is required.",
    );
  }

  return normalized;
}

function normalizeSide(
  side,
) {
  const normalized =
    String(
      side || "",
    )
      .trim()
      .toUpperCase();

  if (
    ![
      "BUY",
      "SELL",
    ].includes(
      normalized,
    )
  ) {
    throw new Error(
      "Order side must be BUY or SELL.",
    );
  }

  return normalized;
}

function ensurePortfolioRow(
  startingCash =
    DEFAULT_STARTING_CASH,
) {
  const existing =
    database
      .prepare(
        `
          SELECT *
          FROM portfolio
          WHERE id = ?
        `,
      )
      .get(
        "paper",
      );

  if (existing) {
    return existing;
  }

  const safeCash =
    Number.isFinite(
      Number(
        startingCash,
      ),
    ) &&
    Number(
      startingCash,
    ) > 0
      ? Number(
          startingCash,
        )
      : DEFAULT_STARTING_CASH;

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
      safeCash,
      safeCash,
      0,
      DEFAULT_FEE_RATE,
      Date.now(),
    );

  return database
    .prepare(
      `
        SELECT *
        FROM portfolio
        WHERE id = ?
      `,
    )
    .get(
      "paper",
    );
}

function loadPositions() {
  const rows =
    database
      .prepare(
        `
          SELECT *
          FROM positions
          ORDER BY symbol
        `,
      )
      .all();

  const positions =
    {};

  for (
    const row of rows
  ) {
    positions[
      row.symbol
    ] = {
      quantity:
        Number(
          row.quantity,
        ),

      averageEntryPrice:
        Number(
          row.average_entry_price,
        ),

      totalCost:
        Number(
          row.total_cost,
        ),
    };
  }

  return positions;
}

function loadTrades(
  limit = 100,
) {
  const safeLimit =
    Math.min(
      Math.max(
        Number(
          limit,
        ) || 100,
        1,
      ),
      2000,
    );

  const rows =
    database
      .prepare(
        `
          SELECT *
          FROM trades
          ORDER BY timestamp DESC
          LIMIT ?
        `,
      )
      .all(
        safeLimit,
      );

  return rows.map(
    (row) => ({
      id:
        row.id,

      symbol:
        row.symbol,

      timeframe:
        row.timeframe ||
        null,

      side:
        row.side,

      quantity:
        Number(
          row.quantity,
        ),

      price:
        Number(
          row.price,
        ),

      grossValue:
        Number(
          row.gross_value,
        ),

      fee:
        Number(
          row.fee,
        ),

      realizedProfit:
        Number(
          row.realized_profit,
        ),

      source:
        row.source ||
        null,

      timestamp:
        Number(
          row.timestamp,
        ),
    }),
  );
}

export async function ensurePaperPortfolio() {
  const row =
    ensurePortfolioRow();

  return {
    startingCash:
      Number(
        row.starting_cash,
      ),

    cash:
      Number(
        row.cash,
      ),

    positions:
      loadPositions(),

    realizedProfit:
      Number(
        row.realized_profit,
      ),

    feeRate:
      Number(
        row.fee_rate,
      ),
  };
}

export async function getPaperPortfolio({
  tradeLimit = 100,
} = {}) {
  const portfolio =
    await ensurePaperPortfolio();

  return {
    ...portfolio,

    trades:
      loadTrades(
        tradeLimit,
      ),
  };
}

const executePaperOrderTransaction =
  database.transaction(
    ({
      symbol,
      side,
      quantity,
      price,
      metadata = {},
    }) => {
      const normalizedSymbol =
        normalizeSymbol(
          symbol,
        );

      const normalizedSide =
        normalizeSide(
          side,
        );

      const numericQuantity =
        Number(
          quantity,
        );

      const numericPrice =
        Number(
          price,
        );

      if (
        !Number.isFinite(
          numericQuantity,
        ) ||
        numericQuantity <=
          0
      ) {
        throw new Error(
          "Quantity must be greater than zero.",
        );
      }

      if (
        !Number.isFinite(
          numericPrice,
        ) ||
        numericPrice <=
          0
      ) {
        throw new Error(
          "A valid market price is required.",
        );
      }

      const portfolio =
        ensurePortfolioRow();

      const feeRate =
        Number(
          portfolio.fee_rate,
        ) ||
        DEFAULT_FEE_RATE;

      const position =
        database
          .prepare(
            `
              SELECT *
              FROM positions
              WHERE symbol = ?
            `,
          )
          .get(
            normalizedSymbol,
          );

      const currentPosition = {
        quantity:
          Number(
            position
              ?.quantity,
          ) || 0,

        averageEntryPrice:
          Number(
            position
              ?.average_entry_price,
          ) || 0,

        totalCost:
          Number(
            position
              ?.total_cost,
          ) || 0,
      };

      const grossValue =
        numericQuantity *
        numericPrice;

      const fee =
        grossValue *
        feeRate;

      const timestamp =
        Date.now();

      const tradeId =
        crypto.randomUUID();

      const timeframe =
        metadata
          ?.timeframe ||
        null;

      const source =
        metadata
          ?.source ||
        "MANUAL";

      if (
        normalizedSide ===
        "BUY"
      ) {
        const totalDebit =
          grossValue +
          fee;

        if (
          totalDebit >
          Number(
            portfolio.cash,
          )
        ) {
          throw new Error(
            "Not enough paper cash for this purchase.",
          );
        }

        const previousQuantity =
          currentPosition
            .quantity;

        const previousCost =
          currentPosition
            .totalCost ||
          (
            previousQuantity *
            currentPosition
              .averageEntryPrice
          );

        const newQuantity =
          previousQuantity +
          numericQuantity;

        const newCost =
          previousCost +
          grossValue +
          fee;

        const newAverageEntryPrice =
          newCost /
          newQuantity;

        const nextCash =
          round(
            Number(
              portfolio.cash,
            ) -
              totalDebit,
            2,
          );

        database
          .prepare(
            `
              UPDATE portfolio
              SET
                cash = ?,
                updated_at = ?
              WHERE id = ?
            `,
          )
          .run(
            nextCash,
            timestamp,
            "paper",
          );

        database
          .prepare(
            `
              INSERT INTO positions (
                symbol,
                quantity,
                average_entry_price,
                total_cost,
                updated_at
              )
              VALUES (?, ?, ?, ?, ?)

              ON CONFLICT(symbol)
              DO UPDATE SET
                quantity =
                  excluded.quantity,
                average_entry_price =
                  excluded.average_entry_price,
                total_cost =
                  excluded.total_cost,
                updated_at =
                  excluded.updated_at
            `,
          )
          .run(
            normalizedSymbol,
            round(
              newQuantity,
            ),
            round(
              newAverageEntryPrice,
            ),
            round(
              newCost,
              2,
            ),
            timestamp,
          );

        database
          .prepare(
            `
              INSERT INTO trades (
                id,
                symbol,
                timeframe,
                side,
                quantity,
                price,
                gross_value,
                fee,
                realized_profit,
                source,
                timestamp
              )
              VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?
              )
            `,
          )
          .run(
            tradeId,
            normalizedSymbol,
            timeframe,
            "BUY",
            numericQuantity,
            numericPrice,
            grossValue,
            fee,
            0,
            source,
            timestamp,
          );

        return {
          trade: {
            id:
              tradeId,

            symbol:
              normalizedSymbol,

            timeframe,

            side:
              "BUY",

            quantity:
              numericQuantity,

            price:
              numericPrice,

            grossValue,

            fee,

            realizedProfit:
              0,

            source,

            timestamp,
          },

          message:
            `Bought ${numericQuantity} ${normalizedSymbol} at $${numericPrice.toFixed(
              4,
            )}.`,
        };
      }

      const ownedQuantity =
        currentPosition
          .quantity;

      if (
        numericQuantity >
        ownedQuantity +
          0.000000001
      ) {
        throw new Error(
          `You only own ${ownedQuantity} ${normalizedSymbol}.`,
        );
      }

      const netProceeds =
        grossValue -
        fee;

      const averageEntryPrice =
        currentPosition
          .averageEntryPrice;

      const costBasis =
        numericQuantity *
        averageEntryPrice;

      const realizedProfit =
        netProceeds -
        costBasis;

      const remainingQuantity =
        ownedQuantity -
        numericQuantity;

      const nextCash =
        round(
          Number(
            portfolio.cash,
          ) +
            netProceeds,
          2,
        );

      const nextRealizedProfit =
        round(
          Number(
            portfolio
              .realized_profit,
          ) +
            realizedProfit,
          2,
        );

      database
        .prepare(
          `
            UPDATE portfolio
            SET
              cash = ?,
              realized_profit = ?,
              updated_at = ?
            WHERE id = ?
          `,
        )
        .run(
          nextCash,
          nextRealizedProfit,
          timestamp,
          "paper",
        );

      if (
        remainingQuantity <=
        0.00000001
      ) {
        database
          .prepare(
            `
              DELETE FROM positions
              WHERE symbol = ?
            `,
          )
          .run(
            normalizedSymbol,
          );
      } else {
        database
          .prepare(
            `
              UPDATE positions
              SET
                quantity = ?,
                total_cost = ?,
                updated_at = ?
              WHERE symbol = ?
            `,
          )
          .run(
            round(
              remainingQuantity,
            ),

            round(
              remainingQuantity *
                averageEntryPrice,
              2,
            ),

            timestamp,

            normalizedSymbol,
          );
      }

      database
        .prepare(
          `
            INSERT INTO trades (
              id,
              symbol,
              timeframe,
              side,
              quantity,
              price,
              gross_value,
              fee,
              realized_profit,
              source,
              timestamp
            )
            VALUES (
              ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?
            )
          `,
        )
        .run(
          tradeId,
          normalizedSymbol,
          timeframe,
          "SELL",
          numericQuantity,
          numericPrice,
          grossValue,
          fee,
          realizedProfit,
          source,
          timestamp,
        );

      return {
        trade: {
          id:
            tradeId,

          symbol:
            normalizedSymbol,

          timeframe,

          side:
            "SELL",

          quantity:
            numericQuantity,

          price:
            numericPrice,

          grossValue,

          fee,

          realizedProfit,

          source,

          timestamp,
        },

        message:
          `Sold ${numericQuantity} ${normalizedSymbol} at $${numericPrice.toFixed(
            4,
          )}.`,
      };
    },
  );

export async function placePaperOrder({
  symbol,
  side,
  quantity,
  price,
  metadata = {},
}) {
  const result =
    executePaperOrderTransaction({
      symbol,
      side,
      quantity,
      price,
      metadata,
    });

  const portfolio =
    await getPaperPortfolio();

  return {
    success:
      true,

    message:
      result.message,

    trade:
      result.trade,

    portfolio,
  };
}

export async function resetPaperPortfolio({
  startingCash =
    DEFAULT_STARTING_CASH,
} = {}) {
  const numericStartingCash =
    Number(
      startingCash,
    );

  const safeCash =
    Number.isFinite(
      numericStartingCash,
    ) &&
    numericStartingCash >
      0
      ? numericStartingCash
      : DEFAULT_STARTING_CASH;

  const reset =
    database.transaction(
      () => {
        database
          .prepare(
            `
              DELETE FROM trades
            `,
          )
          .run();

        database
          .prepare(
            `
              DELETE FROM positions
            `,
          )
          .run();

        database
          .prepare(
            `
              DELETE FROM order_executions
            `,
          )
          .run();

        database
          .prepare(
            `
              UPDATE portfolio
              SET
                starting_cash = ?,
                cash = ?,
                realized_profit = 0,
                fee_rate = ?,
                updated_at = ?
              WHERE id = ?
            `,
          )
          .run(
            safeCash,
            safeCash,
            DEFAULT_FEE_RATE,
            Date.now(),
            "paper",
          );
      },
    );

  reset();

  return getPaperPortfolio();
}