function formatMoney(
  value,
  decimals = 2,
) {
  const number =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return "—";
  }

  return number.toLocaleString(
    "en-US",
    {
      style:
        "currency",

      currency:
        "USD",

      minimumFractionDigits:
        decimals,

      maximumFractionDigits:
        decimals,
    },
  );
}

function formatQuantity(
  value,
) {
  const number =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return "—";
  }

  return number.toLocaleString(
    "en-US",
    {
      minimumFractionDigits:
        0,

      maximumFractionDigits:
        8,
    },
  );
}

function formatPercent(
  value,
) {
  const number =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return "—";
  }

  return `${
    number >= 0
      ? "+"
      : ""
  }${number.toFixed(2)}%`;
}

function getProfitClass(
  value,
) {
  const number =
    Number(
      value,
    );

  if (
    number >
    0
  ) {
    return "positive";
  }

  if (
    number <
    0
  ) {
    return "negative";
  }

  return "neutral";
}

function getAssetName(
  position,
) {
  if (
    position?.asset
  ) {
    return position.asset;
  }

  const symbol =
    String(
      position?.symbol ||
        "",
    ).toUpperCase();

  if (
    symbol.endsWith(
      "USD",
    )
  ) {
    return symbol.slice(
      0,
      -3,
    );
  }

  return (
    symbol ||
    "—"
  );
}

function normalizePositions(
  positions,
) {
  /*
   * Some versions of the portfolio hook
   * return positions as an array.
   */
  if (
    Array.isArray(
      positions,
    )
  ) {
    return positions;
  }

  /*
   * Other versions return:
   *
   * {
   *   SOLUSD: {...},
   *   ETHUSD: {...}
   * }
   *
   * Convert that into an array so the UI
   * works with either version.
   */
  if (
    positions &&
    typeof positions ===
      "object"
  ) {
    return Object.entries(
      positions,
    ).map(
      ([
        symbol,
        position,
      ]) => ({
        symbol,

        ...(
          position ||
          {}
        ),
      }),
    );
  }

  return [];
}

function PortfolioPanel({
  portfolio,
  onReset,
}) {
  const positions =
    normalizePositions(
      portfolio
        ?.positions,
    );

  const trades =
    Array.isArray(
      portfolio?.trades,
    )
      ? portfolio.trades
      : [];

  /*
   * Support both naming conventions used
   * by versions of the portfolio hook.
   */
  const totalMarketValue =
    Number.isFinite(
      Number(
        portfolio
          ?.totalMarketValue,
      ),
    )
      ? Number(
          portfolio
            .totalMarketValue,
        )
      : Number(
          portfolio
            ?.marketValue,
        ) ||
        0;

  const totalEquity =
    Number(
      portfolio
        ?.totalEquity,
    ) ||
    0;

  const cash =
    Number(
      portfolio
        ?.cash,
    ) ||
    0;

  const totalProfit =
    Number(
      portfolio
        ?.totalProfit,
    ) ||
    0;

  const totalReturnPercent =
    Number(
      portfolio
        ?.totalReturnPercent,
    ) ||
    0;

  const realizedProfit =
    Number(
      portfolio
        ?.realizedProfit,
    ) ||
    0;

  const unrealizedProfit =
    Number(
      portfolio
        ?.unrealizedProfit,
    ) ||
    0;

  const feeRate =
    Number(
      portfolio
        ?.feeRate,
    ) ||
    0;

  return (
    <section className="panel portfolio-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">
            PAPER ACCOUNT
          </p>

          <h2>
            Portfolio
          </h2>
        </div>

        <button
          type="button"
          className="reset-portfolio-button"
          onClick={
            onReset
          }
        >
          Reset
        </button>
      </div>

      {/* ===================================================
          ACCOUNT SUMMARY
          =================================================== */}

      <div className="portfolio-summary">
        <article>
          <span>
            Total equity
          </span>

          <strong>
            {formatMoney(
              totalEquity,
            )}
          </strong>
        </article>

        <article>
          <span>
            Available cash
          </span>

          <strong>
            {formatMoney(
              cash,
            )}
          </strong>
        </article>

        <article>
          <span>
            Crypto holdings
          </span>

          <strong>
            {formatMoney(
              totalMarketValue,
            )}
          </strong>
        </article>

        <article>
          <span>
            Total return
          </span>

          <strong
            className={getProfitClass(
              totalProfit,
            )}
          >
            {formatMoney(
              totalProfit,
            )}

            {" · "}

            {formatPercent(
              totalReturnPercent,
            )}
          </strong>
        </article>

        <article>
          <span>
            Realized P/L
          </span>

          <strong
            className={getProfitClass(
              realizedProfit,
            )}
          >
            {formatMoney(
              realizedProfit,
            )}
          </strong>
        </article>

        <article>
          <span>
            Unrealized P/L
          </span>

          <strong
            className={getProfitClass(
              unrealizedProfit,
            )}
          >
            {formatMoney(
              unrealizedProfit,
            )}
          </strong>
        </article>
      </div>

      {/* ===================================================
          TOKEN HOLDINGS
          =================================================== */}

      <div className="portfolio-section-heading">
        <div>
          <h3>
            Token holdings
          </h3>

          <small>
            Current amount and live cash value
          </small>
        </div>

        <span>
          {
            positions.length
          }{" "}
          {
            positions.length ===
            1
              ? "asset"
              : "assets"
          }
        </span>
      </div>

      {positions.length >
      0 ? (
        <div className="token-holdings-grid">
          {positions.map(
            (
              position,
            ) => {
              const asset =
                getAssetName(
                  position,
                );

              const quantity =
                Number(
                  position
                    .quantity,
                ) ||
                0;

              const currentPrice =
                Number(
                  position
                    .currentPrice,
                ) ||
                0;

              const averageEntryPrice =
                Number(
                  position
                    .averageEntryPrice,
                ) ||
                0;

              /*
               * Prefer the value already
               * calculated by usePaperPortfolio.
               *
               * If it is unavailable, calculate:
               *
               * quantity × current price
               */
              const marketValue =
                Number.isFinite(
                  Number(
                    position
                      .marketValue,
                  ),
                )
                  ? Number(
                      position
                        .marketValue,
                    )
                  : quantity *
                    currentPrice;

              const positionCostBasis =
                Number.isFinite(
                  Number(
                    position
                      .costBasis,
                  ),
                )
                  ? Number(
                      position
                        .costBasis,
                    )
                  : quantity *
                    averageEntryPrice;

              const positionProfit =
                Number.isFinite(
                  Number(
                    position
                      .unrealizedProfit,
                  ),
                )
                  ? Number(
                      position
                        .unrealizedProfit,
                    )
                  : marketValue -
                    positionCostBasis;

              const positionPercent =
                Number.isFinite(
                  Number(
                    position
                      .unrealizedReturnPercent,
                  ),
                )
                  ? Number(
                      position
                        .unrealizedReturnPercent,
                    )
                  : Number.isFinite(
                        Number(
                          position
                            .unrealizedPercent,
                        ),
                      )
                    ? Number(
                        position
                          .unrealizedPercent,
                      )
                    : positionCostBasis >
                        0
                      ? (
                          positionProfit /
                          positionCostBasis
                        ) *
                        100
                      : 0;

              return (
                <article
                  className="token-holding-card"
                  key={
                    position.symbol ||
                    asset
                  }
                >
                  <div className="token-holding-header">
                    <div>
                      <strong className="token-holding-symbol">
                        {
                          asset
                        }
                      </strong>

                      <small>
                        {
                          position.symbol ||
                          `${asset}USD`
                        }
                      </small>
                    </div>

                    <strong className="token-holding-value">
                      {formatMoney(
                        marketValue,
                      )}
                    </strong>
                  </div>

                  <div className="token-holding-primary">
                    <span>
                      Amount held
                    </span>

                    <strong>
                      {formatQuantity(
                        quantity,
                      )}{" "}
                      {
                        asset
                      }
                    </strong>
                  </div>

                  <div className="token-holding-details">
                    <div>
                      <span>
                        Current price
                      </span>

                      <strong>
                        {formatMoney(
                          currentPrice,
                          currentPrice <
                          1
                            ? 6
                            : 4,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Cash value
                      </span>

                      <strong>
                        {formatMoney(
                          marketValue,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Avg entry
                      </span>

                      <strong>
                        {formatMoney(
                          averageEntryPrice,
                          averageEntryPrice <
                          1
                            ? 6
                            : 4,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Cost basis
                      </span>

                      <strong>
                        {formatMoney(
                          positionCostBasis,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Unrealized P/L
                      </span>

                      <strong
                        className={getProfitClass(
                          positionProfit,
                        )}
                      >
                        {formatMoney(
                          positionProfit,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Return
                      </span>

                      <strong
                        className={getProfitClass(
                          positionPercent,
                        )}
                      >
                        {formatPercent(
                          positionPercent,
                        )}
                      </strong>
                    </div>
                  </div>
                </article>
              );
            },
          )}
        </div>
      ) : (
        <p className="empty-state">
          No token holdings.
        </p>
      )}

      {/* ===================================================
          OPEN POSITIONS TABLE
          =================================================== */}

      <div className="portfolio-section-heading">
        <h3>
          Open positions
        </h3>

        <span>
          Fee:{" "}
          {(
            feeRate *
            100
          ).toFixed(
            2,
          )}
          %
        </span>
      </div>

      <div className="positions-table">
        <div className="positions-header">
          <span>
            Asset
          </span>

          <span>
            Quantity
          </span>

          <span>
            Entry
          </span>

          <span>
            Price
          </span>

          <span>
            Cash value
          </span>

          <span>
            P/L
          </span>
        </div>

        {positions.length >
        0 ? (
          positions.map(
            (
              position,
            ) => {
              const asset =
                getAssetName(
                  position,
                );

              const quantity =
                Number(
                  position
                    .quantity,
                ) ||
                0;

              const currentPrice =
                Number(
                  position
                    .currentPrice,
                ) ||
                0;

              const averageEntryPrice =
                Number(
                  position
                    .averageEntryPrice,
                ) ||
                0;

              const marketValue =
                Number.isFinite(
                  Number(
                    position
                      .marketValue,
                  ),
                )
                  ? Number(
                      position
                        .marketValue,
                    )
                  : quantity *
                    currentPrice;

              const costBasis =
                Number.isFinite(
                  Number(
                    position
                      .costBasis,
                  ),
                )
                  ? Number(
                      position
                        .costBasis,
                    )
                  : quantity *
                    averageEntryPrice;

              const profit =
                Number.isFinite(
                  Number(
                    position
                      .unrealizedProfit,
                  ),
                )
                  ? Number(
                      position
                        .unrealizedProfit,
                    )
                  : marketValue -
                    costBasis;

              const percent =
                Number.isFinite(
                  Number(
                    position
                      .unrealizedReturnPercent,
                  ),
                )
                  ? Number(
                      position
                        .unrealizedReturnPercent,
                    )
                  : Number.isFinite(
                        Number(
                          position
                            .unrealizedPercent,
                        ),
                      )
                    ? Number(
                        position
                          .unrealizedPercent,
                      )
                    : costBasis >
                        0
                      ? (
                          profit /
                          costBasis
                        ) *
                        100
                      : 0;

              return (
                <div
                  className="position-row"
                  key={
                    position.symbol ||
                    asset
                  }
                >
                  <strong>
                    {
                      asset
                    }
                  </strong>

                  <span>
                    {formatQuantity(
                      quantity,
                    )}
                  </span>

                  <span>
                    {formatMoney(
                      averageEntryPrice,
                      4,
                    )}
                  </span>

                  <span>
                    {formatMoney(
                      currentPrice,
                      4,
                    )}
                  </span>

                  <strong>
                    {formatMoney(
                      marketValue,
                    )}
                  </strong>

                  <span
                    className={getProfitClass(
                      profit,
                    )}
                  >
                    {formatMoney(
                      profit,
                    )}

                    <small>
                      {formatPercent(
                        percent,
                      )}
                    </small>
                  </span>
                </div>
              );
            },
          )
        ) : (
          <p className="empty-state">
            No open paper positions.
          </p>
        )}
      </div>

      {/* ===================================================
          TRADE HISTORY
          =================================================== */}

      <div className="portfolio-section-heading">
        <h3>
          Paper trade history
        </h3>

        <span>
          {
            trades.length
          }{" "}
          trades
        </span>
      </div>

      <div className="portfolio-trades">
        <div className="portfolio-trades-header">
          <span>
            Side
          </span>

          <span>
            Symbol
          </span>

          <span>
            Quantity
          </span>

          <span>
            Price
          </span>

          <span>
            Fee
          </span>

          <span>
            P/L
          </span>

          <span>
            Time
          </span>
        </div>

        {trades.length >
        0 ? (
          trades
            .slice(
              0,
              50,
            )
            .map(
              (
                trade,
              ) => (
                <div
                  className="portfolio-trade-row"
                  key={
                    trade.id
                  }
                >
                  <strong
                    className={
                      trade.side ===
                      "BUY"
                        ? "positive"
                        : "negative"
                    }
                  >
                    {
                      trade.side
                    }
                  </strong>

                  <span>
                    {
                      trade.symbol
                    }
                  </span>

                  <span>
                    {formatQuantity(
                      trade.quantity,
                    )}
                  </span>

                  <span>
                    {formatMoney(
                      trade.price,
                      4,
                    )}
                  </span>

                  <span>
                    {formatMoney(
                      trade.fee,
                    )}
                  </span>

                  <span
                    className={getProfitClass(
                      trade
                        .realizedProfit,
                    )}
                  >
                    {trade.side ===
                    "SELL"
                      ? formatMoney(
                          trade
                            .realizedProfit,
                        )
                      : "—"}
                  </span>

                  <time>
                    {new Date(
                      trade.timestamp,
                    ).toLocaleString()}
                  </time>
                </div>
              ),
            )
        ) : (
          <p className="empty-state">
            No paper trades have been placed.
          </p>
        )}
      </div>
    </section>
  );
}

export default PortfolioPanel;