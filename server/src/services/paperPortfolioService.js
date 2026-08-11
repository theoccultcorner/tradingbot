import {
  database,
} from "../config/database.js";

const DEFAULT_STARTING_CASH =
  300;

const DEFAULT_FEE_RATE =
  0.001;

/*
 * =========================================================
 * ROADMAP #7
 *
 * PERSISTENT TRADE METADATA
 * =========================================================
 *
 * Trading Engine 2.0 attaches strategy,
 * signal label, score, confidence, exit
 * reason, and other context to each order.
 *
 * Preserve that metadata in SQLite so the
 * performance service can later group
 * historical results by strategy.
 */
function ensureTradeMetadataColumn() {
  const tradesTable =
    database
      .prepare(
        `
          SELECT name
          FROM sqlite_master
          WHERE
            type = 'table'
            AND name = ?
        `,
      )
      .get(
        "trades",
      );

  if (
    !tradesTable
  ) {
    return;
  }

  const columns =
    database
      .prepare(
        `
          PRAGMA table_info(trades)
        `,
      )
      .all();

  const hasMetadataColumn =
    columns.some(
      (
        column,
      ) =>
        column.name ===
        "metadata_json",
    );

  if (
    !hasMetadataColumn
  ) {
    database.exec(`
      ALTER TABLE trades
      ADD COLUMN metadata_json TEXT;
    `);
  }
}

ensureTradeMetadataColumn();

function parseMetadata(
  value,
) {
  if (!value) {
    return {};
  }

  if (
    typeof value ===
    "object"
  ) {
    return value;
  }

  try {
    const parsed =
      JSON.parse(
        value,
      );

    return (
      parsed &&
      typeof parsed ===
        "object" &&
      !Array.isArray(
        parsed,
      )
    )
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function serializeMetadata(
  value,
) {
  try {
    return JSON.stringify(
      value &&
      typeof value ===
        "object" &&
      !Array.isArray(
        value,
      )
        ? value
        : {},
    );
  } catch {
    return "{}";
  }
}

function round(
  value,
  decimals = 8,
) {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      (
        Number(value) +
        Number.EPSILON
      ) *
        factor,
    ) /
    factor
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
      .toUpperCase()
      .replace(
        /[^A-Z0-9]/g,
        "",
      );

  if (
    !normalized
  ) {
    throw new Error(
      "A valid symbol is required.",
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
    normalized !==
      "BUY" &&
    normalized !==
      "SELL"
  ) {
    throw new Error(
      "Order side must be BUY or SELL.",
    );
  }

  return normalized;
}

function ensurePortfolioRow() {
  let row =
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

  if (
    !row
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
          VALUES (
            ?, ?, ?, ?, ?, ?
          )
        `,
      )
      .run(
        "paper",
        DEFAULT_STARTING_CASH,
        DEFAULT_STARTING_CASH,
        0,
        DEFAULT_FEE_RATE,
        Date.now(),
      );

    row =
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
  }

  return row;
}

function loadPositions() {
  const rows =
    database
      .prepare(
        `
          SELECT *
          FROM positions
          ORDER BY symbol ASC
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

      updatedAt:
        Number(
          row.updated_at,
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
    (
      row,
    ) => {
      const metadata =
        parseMetadata(
          row.metadata_json,
        );

      return {
        id:
          row.id,

        symbol:
          row.symbol,

        timeframe:
          row.timeframe ||
          metadata.timeframe ||
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
          metadata.source ||
          null,

        /*
         * Keep the complete metadata object.
         */
        metadata,

        /*
         * Frequently used strategy fields are
         * also exposed at the top level for
         * performance/reporting convenience.
         */
        strategy:
          metadata.strategy ||
          null,

        signalAction:
          metadata.signalAction ||
          null,

        label:
          metadata.label ||
          null,

        score:
          Number.isFinite(
            Number(
              metadata.score,
            ),
          )
            ? Number(
                metadata.score,
              )
            : null,

        confidence:
          Number.isFinite(
            Number(
              metadata.confidence,
            ),
          )
            ? Number(
                metadata.confidence,
              )
            : null,

        type:
          metadata.type ||
          null,

        candleTime:
          metadata.candleTime ||
          null,

        timestamp:
          Number(
            row.timestamp,
          ),
      };
    },
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

      const metadataJson =
        serializeMetadata(
          metadata,
        );

      /*
       * =====================================================
       * BUY
       * =====================================================
       */
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

        /*
         * Include the BUY fee in the cost
         * basis.
         *
         * This makes later realized P/L
         * reflect the actual cost of entering
         * the position.
         */
        const newCost =
          previousCost +
          grossValue +
          fee;

        const newQuantity =
          previousQuantity +
          numericQuantity;

        const newAverageEntryPrice =
          newQuantity > 0
            ? newCost /
              newQuantity
            : numericPrice;

        const nextCash =
          Number(
            portfolio.cash,
          ) -
          totalDebit;

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
            round(
              nextCash,
              2,
            ),

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
              VALUES (
                ?, ?, ?, ?, ?
              )

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
                metadata_json,
                timestamp
              )
              VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?
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

            metadataJson,

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

            metadata: {
              ...metadata,
            },

            strategy:
              metadata
                ?.strategy ||
              null,

            signalAction:
              metadata
                ?.signalAction ||
              null,

            label:
              metadata
                ?.label ||
              null,

            score:
              Number.isFinite(
                Number(
                  metadata
                    ?.score,
                ),
              )
                ? Number(
                    metadata
                      ?.score,
                  )
                : null,

            confidence:
              Number.isFinite(
                Number(
                  metadata
                    ?.confidence,
                ),
              )
                ? Number(
                    metadata
                      ?.confidence,
                  )
                : null,

            type:
              metadata
                ?.type ||
              null,

            candleTime:
              metadata
                ?.candleTime ||
              null,

            timestamp,
          },

          message:
            `Bought ${numericQuantity} ${normalizedSymbol} at $${numericPrice.toFixed(
              4,
            )}.`,
        };
      }

      /*
       * =====================================================
       * SELL
       * =====================================================
       */

      const ownedQuantity =
        currentPosition
          .quantity;

      if (
        ownedQuantity <=
        0
      ) {
        throw new Error(
          `No ${normalizedSymbol} position is available to sell.`,
        );
      }

      /*
       * Small tolerance protects against
       * floating-point differences when the
       * bot attempts to close the full
       * position.
       */
      if (
        numericQuantity >
        ownedQuantity +
          0.00000001
      ) {
        throw new Error(
          `Cannot sell ${numericQuantity} ${normalizedSymbol}. ` +
            `Only ${ownedQuantity} is available.`,
        );
      }

      const actualSellQuantity =
        Math.min(
          numericQuantity,
          ownedQuantity,
        );

      const actualGrossValue =
        actualSellQuantity *
        numericPrice;

      const actualFee =
        actualGrossValue *
        feeRate;

      const netProceeds =
        actualGrossValue -
        actualFee;

      const averageEntryPrice =
        currentPosition
          .averageEntryPrice;

      /*
       * averageEntryPrice already includes
       * the proportional BUY-side fee
       * because BUY cost basis includes the
       * entry fee.
       */
      const costBasis =
        actualSellQuantity *
        averageEntryPrice;

      const realizedProfit =
        netProceeds -
        costBasis;

      const remainingQuantity =
        ownedQuantity -
        actualSellQuantity;

      const nextCash =
        Number(
          portfolio.cash,
        ) +
        netProceeds;

      const nextRealizedProfit =
        Number(
          portfolio
            .realized_profit,
        ) +
        realizedProfit;

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
          round(
            nextCash,
            2,
          ),

          round(
            nextRealizedProfit,
            8,
          ),

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
        /*
         * Remaining cost basis must shrink
         * proportionally with the remaining
         * quantity.
         */
        const remainingCost =
          remainingQuantity *
          averageEntryPrice;

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
              remainingCost,
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
              metadata_json,
              timestamp
            )
            VALUES (
              ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?
            )
          `,
        )
        .run(
          tradeId,

          normalizedSymbol,

          timeframe,

          "SELL",

          actualSellQuantity,

          numericPrice,

          actualGrossValue,

          actualFee,

          realizedProfit,

          source,

          metadataJson,

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
            actualSellQuantity,

          price:
            numericPrice,

          grossValue:
            actualGrossValue,

          fee:
            actualFee,

          realizedProfit,

          source,

          metadata: {
            ...metadata,
          },

          strategy:
            metadata
              ?.strategy ||
            null,

          signalAction:
            metadata
              ?.signalAction ||
            null,

          label:
            metadata
              ?.label ||
            null,

          score:
            Number.isFinite(
              Number(
                metadata
                  ?.score,
              ),
            )
              ? Number(
                  metadata
                    ?.score,
                )
              : null,

          confidence:
            Number.isFinite(
              Number(
                metadata
                  ?.confidence,
              ),
            )
              ? Number(
                  metadata
                    ?.confidence,
                )
              : null,

          type:
            metadata
              ?.type ||
            null,

          candleTime:
            metadata
              ?.candleTime ||
            null,

          timestamp,
        },

        message:
          `Sold ${actualSellQuantity} ${normalizedSymbol} at $${numericPrice.toFixed(
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
  /*
   * This transaction is authoritative.
   *
   * BUY:
   * - subtracts cash
   * - creates/updates crypto holdings
   * - records trade
   *
   * SELL:
   * - adds cash
   * - reduces/removes holdings
   * - records realized P/L
   */
  const result =
    executePaperOrderTransaction({
      symbol,
      side,
      quantity,
      price,
      metadata,
    });

  /*
   * Read the portfolio AFTER the SQLite
   * transaction completes.
   *
   * This means the caller receives the
   * actual post-trade balance and holdings.
   */
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

  /*
   * =====================================================
   * IMPORTANT RESET FIX
   * =====================================================
   *
   * Reset all portfolio state AND clear the
   * idempotency records used by
   * idempotentOrderService.js.
   *
   * Without clearing order_executions, an
   * old order can be returned as:
   *
   * success: true
   * duplicate: true
   *
   * even though no new portfolio transaction
   * took place.
   */
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

        /*
         * This is the table actually used by
         * executeIdempotentPaperOrder().
         */
        database
          .prepare(
            `
              DELETE FROM order_executions
            `,
          )
          .run();

        /*
         * Keep this for compatibility with
         * the older execution table defined
         * in database.js.
         *
         * If the table exists, clear it too.
         */
        const legacyTable =
          database
            .prepare(
              `
                SELECT name
                FROM sqlite_master
                WHERE
                  type = 'table'
                  AND name = ?
              `,
            )
            .get(
              "executed_orders",
            );

        if (
          legacyTable
        ) {
          database
            .prepare(
              `
                DELETE FROM executed_orders
              `,
            )
            .run();
        }

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

        /*
         * Defensive fallback in case the
         * portfolio row was somehow removed.
         */
        const updatedPortfolio =
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

        if (
          !updatedPortfolio
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
                VALUES (
                  ?, ?, ?, ?, ?, ?
                )
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
        }
      },
    );

  reset();

  return getPaperPortfolio();
}